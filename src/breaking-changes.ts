/**
 * Breaking Changes Detection
 *
 * Detects potential breaking changes between branches or commits.
 * Looks for: removed exports, changed function signatures, renamed types.
 */

import { spawnSync } from 'node:child_process';
import type { PersonalityMode } from './personality/types.js';

/**
 * Execute git command safely using spawnSync with argument array
 * Avoids shell injection by not interpolating user input into shell strings
 */
function gitCommand(args: string[], rootDir: string): string {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed');
  return result.stdout?.toString() || '';
}

export interface BreakingChange {
  type: 'removed-export' | 'signature-change' | 'type-change' | 'renamed' | 'removed-property';
  severity: 'high' | 'medium' | 'low';
  file: string;
  name: string;
  description: string;
  line?: number;
}

export interface BreakingChangesResult {
  changes: BreakingChange[];
  analyzedFiles: number;
  comparedTo: string;
  riskLevel: 'safe' | 'caution' | 'breaking';
  summary: string;
}

/**
 * Detect breaking changes by analyzing git diff
 */
export async function detectBreakingChanges(
  rootDir: string,
  compareTo: string = 'main'
): Promise<BreakingChangesResult> {
  const changes: BreakingChange[] = [];
  let analyzedFiles = 0;

  try {
    // Get diff of source files using safe argument array
    const diffOutput = gitCommand(
      ['diff', `${compareTo}...HEAD`, '--name-status', '--', '*.ts', '*.tsx', '*.js', '*.jsx'],
      rootDir
    ).trim();

    if (!diffOutput) {
      return {
        changes: [],
        analyzedFiles: 0,
        comparedTo: compareTo,
        riskLevel: 'safe',
        summary: 'No source file changes detected.',
      };
    }

    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const line of diffOutput.split('\n').filter(Boolean)) {
      const [status, file] = line.split('\t');
      if (status === 'M' || status?.startsWith('R')) {
        modifiedFiles.push(file);
      } else if (status === 'D') {
        deletedFiles.push(file);
      }
    }

    analyzedFiles = modifiedFiles.length + deletedFiles.length;

    // Check deleted files for exports
    for (const file of deletedFiles) {
      changes.push({
        type: 'removed-export',
        severity: 'high',
        file,
        name: file,
        description: `Entire file deleted - all exports removed`,
      });
    }

    // Analyze modified files for breaking changes
    for (const file of modifiedFiles) {
      const fileChanges = await analyzeFileDiff(rootDir, compareTo, file);
      changes.push(...fileChanges);
    }
  } catch {
    // Git diff failed, likely no comparison branch
    return {
      changes: [],
      analyzedFiles: 0,
      comparedTo: compareTo,
      riskLevel: 'safe',
      summary: `Could not compare to ${compareTo}. Branch may not exist.`,
    };
  }

  // Determine risk level
  const highCount = changes.filter((c) => c.severity === 'high').length;
  const mediumCount = changes.filter((c) => c.severity === 'medium').length;

  let riskLevel: 'safe' | 'caution' | 'breaking' = 'safe';
  if (highCount > 0) {
    riskLevel = 'breaking';
  } else if (mediumCount > 0) {
    riskLevel = 'caution';
  }

  const summary =
    changes.length === 0
      ? 'No breaking changes detected. Safe to merge.'
      : `Found ${changes.length} potential breaking change(s): ${highCount} high, ${mediumCount} medium severity.`;

  return {
    changes,
    analyzedFiles,
    comparedTo: compareTo,
    riskLevel,
    summary,
  };
}

/**
 * Analyze a single file's diff for breaking changes
 */
async function analyzeFileDiff(
  rootDir: string,
  compareTo: string,
  file: string
): Promise<BreakingChange[]> {
  const changes: BreakingChange[] = [];

  try {
    // Get the unified diff for this file using safe argument array
    const diff = gitCommand(['diff', `${compareTo}...HEAD`, '--', file], rootDir);

    // Look for removed exports
    const removedExportPattern =
      /^-\s*export\s+(const|function|class|interface|type|enum)\s+(\w+)/gm;
    let match: RegExpExecArray | null = removedExportPattern.exec(diff);
    while (match !== null) {
      const [, kind, name] = match;
      // Check if it's actually removed (not just modified)
      const addedPattern = new RegExp(
        `^\\+\\s*export\\s+(const|function|class|interface|type|enum)\\s+${name}\\b`,
        'm'
      );
      if (!addedPattern.test(diff)) {
        changes.push({
          type: 'removed-export',
          severity: 'high',
          file,
          name,
          description: `Exported ${kind} "${name}" was removed`,
        });
      }
      match = removedExportPattern.exec(diff);
    }

    // Look for function signature changes (parameters added/removed)
    const funcSignaturePattern = /^-\s*export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm;
    match = funcSignaturePattern.exec(diff);
    while (match !== null) {
      const [, , funcName, oldParams] = match;
      // Check if same function exists with different signature
      const newFuncPattern = new RegExp(
        `^\\+\\s*export\\s+(async\\s+)?function\\s+${funcName}\\s*\\(([^)]*)\\)`,
        'm'
      );
      const newMatch = newFuncPattern.exec(diff);
      if (newMatch) {
        const newParams = newMatch[2];
        if (normalizeParams(oldParams) !== normalizeParams(newParams)) {
          changes.push({
            type: 'signature-change',
            severity: 'high',
            file,
            name: funcName,
            description: `Function "${funcName}" signature changed`,
          });
        }
      }
      match = funcSignaturePattern.exec(diff);
    }

    // Look for interface/type property removals
    const removedPropertyPattern = /^-\s+(\w+)\s*[?]?\s*:/gm;
    match = removedPropertyPattern.exec(diff);
    while (match !== null) {
      const [, propName] = match;
      // Only flag if not re-added
      const addedPropPattern = new RegExp(`^\\+\\s+${propName}\\s*[?]?\\s*:`, 'm');
      if (!addedPropPattern.test(diff)) {
        changes.push({
          type: 'removed-property',
          severity: 'medium',
          file,
          name: propName,
          description: `Property "${propName}" was removed from interface/type`,
        });
      }
      match = removedPropertyPattern.exec(diff);
    }

    // Look for required parameter additions (not optional)
    const addedRequiredParam = /^\+[^-]*function\s+\w+\s*\([^)]*,\s*(\w+)\s*:[^=)]+\)/gm;
    match = addedRequiredParam.exec(diff);
    while (match !== null) {
      const [, paramName] = match;
      if (!paramName.includes('?') && !diff.includes(`${paramName}?:`)) {
        changes.push({
          type: 'signature-change',
          severity: 'medium',
          file,
          name: paramName,
          description: `New required parameter "${paramName}" added`,
        });
      }
      match = addedRequiredParam.exec(diff);
    }
  } catch {
    // Individual file analysis failed
  }

  return changes;
}

/**
 * Normalize parameter strings for comparison
 */
function normalizeParams(params: string): string {
  return params
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

/**
 * Format breaking changes result for display
 */
export function formatBreakingChanges(
  result: BreakingChangesResult,
  personality: PersonalityMode = 'default'
): string {
  const lines: string[] = [];

  // Header
  const emoji =
    result.riskLevel === 'safe'
      ? '\u2705'
      : result.riskLevel === 'caution'
        ? '\u26A0\uFE0F'
        : '\u{1F6A8}';

  lines.push('');
  lines.push(`${emoji} BREAKING CHANGES ANALYSIS`);
  lines.push('\u2500'.repeat(50));
  lines.push(`  Compared to: ${result.comparedTo}`);
  lines.push(`  Files analyzed: ${result.analyzedFiles}`);
  lines.push('');

  if (result.changes.length === 0) {
    if (personality === 'roast') {
      lines.push("  No breaking changes. Wow, you actually didn't break anything.");
    } else if (personality === 'cheerleader') {
      lines.push('  \u{1F389} No breaking changes! Your API is safe and sound!');
    } else if (personality === 'executive') {
      lines.push('  Risk assessment: CLEAR. No API contract violations detected.');
    } else {
      lines.push('  \u2705 No breaking changes detected. Safe to merge.');
    }
  } else {
    // High severity
    const high = result.changes.filter((c) => c.severity === 'high');
    if (high.length > 0) {
      lines.push('\u{1F534} HIGH SEVERITY (Breaking)');
      for (const change of high) {
        lines.push(`   \u2022 ${change.description}`);
        lines.push(`     ${change.file}`);
      }
      lines.push('');
    }

    // Medium severity
    const medium = result.changes.filter((c) => c.severity === 'medium');
    if (medium.length > 0) {
      lines.push('\u{1F7E1} MEDIUM SEVERITY (May Break)');
      for (const change of medium) {
        lines.push(`   \u2022 ${change.description}`);
        lines.push(`     ${change.file}`);
      }
      lines.push('');
    }

    // Low severity
    const low = result.changes.filter((c) => c.severity === 'low');
    if (low.length > 0) {
      lines.push('\u{1F7E2} LOW SEVERITY (Review)');
      for (const change of low.slice(0, 5)) {
        lines.push(`   \u2022 ${change.description}`);
      }
      if (low.length > 5) {
        lines.push(`   ... and ${low.length - 5} more`);
      }
      lines.push('');
    }

    // Summary with personality
    lines.push('\u2500'.repeat(50));
    if (personality === 'roast') {
      lines.push(`  ${result.changes.length} breaking changes. Hope you like angry users.`);
    } else if (personality === 'executive') {
      lines.push(`  Risk exposure: ${high.length} critical, ${medium.length} moderate issues.`);
      lines.push('  Recommend: Review with API consumers before merge.');
    } else {
      lines.push(`  ${result.summary}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
