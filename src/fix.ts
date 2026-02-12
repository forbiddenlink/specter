/**
 * Fix - Actionable Fix Suggestions
 *
 * Analyzes files and provides concrete, actionable suggestions to fix
 * detected issues like high complexity, large files, circular dependencies,
 * dead code, and low bus factor.
 */

import path from 'node:path';
import { type SimpleGit, simpleGit } from 'simple-git';
import { Project, type SourceFile, SyntaxKind } from 'ts-morph';
import { type CyclesResult, detectCycles } from './cycles.js';
import type { KnowledgeGraph } from './graph/types.js';
import { type DeadCodeResult, execute as findDeadCode } from './tools/get-dead-code.js';

// Types
export type SuggestionSeverity = 'critical' | 'warning' | 'info';

export interface CodeBlock {
  startLine: number;
  endLine: number;
  description: string;
  suggestedName: string;
}

export interface FixSuggestion {
  severity: SuggestionSeverity;
  title: string;
  details: string[];
  codeBlocks?: CodeBlock[];
  expectedOutcome?: string;
}

export interface FixResult {
  filePath: string;
  absolutePath: string;
  suggestions: FixSuggestion[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

/**
 * Analyze a function's body to identify extractable code blocks
 */
function identifyExtractableBlocks(
  sourceFile: SourceFile,
  funcStartLine: number,
  funcEndLine: number,
  complexity: number
): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const funcText = sourceFile.getFullText();
  const _lines = funcText.split('\n');

  // Find control flow structures that could be extracted
  sourceFile.forEachDescendant((node) => {
    const nodeStart = node.getStartLineNumber();
    const nodeEnd = node.getEndLineNumber();

    // Only analyze nodes within this function
    if (nodeStart < funcStartLine || nodeEnd > funcEndLine) return;

    const kind = node.getKind();
    const lineSpan = nodeEnd - nodeStart;

    // Look for substantial blocks that could be extracted
    if (lineSpan >= 5) {
      switch (kind) {
        case SyntaxKind.IfStatement: {
          const ifNode = node;
          const condition = ifNode.getChildAtIndex(2)?.getText()?.slice(0, 30) || '';
          // Check for large if blocks
          if (lineSpan >= 10) {
            blocks.push({
              startLine: nodeStart,
              endLine: nodeEnd,
              description: `Conditional block (${condition}${condition.length >= 30 ? '...' : ''})`,
              suggestedName: guessBlockName('handle', condition),
            });
          }
          break;
        }

        case SyntaxKind.ForStatement:
        case SyntaxKind.ForInStatement:
        case SyntaxKind.ForOfStatement:
        case SyntaxKind.WhileStatement: {
          if (lineSpan >= 8) {
            blocks.push({
              startLine: nodeStart,
              endLine: nodeEnd,
              description: 'Loop block with substantial logic',
              suggestedName: 'processItems',
            });
          }
          break;
        }

        case SyntaxKind.TryStatement: {
          if (lineSpan >= 10) {
            blocks.push({
              startLine: nodeStart,
              endLine: nodeEnd,
              description: 'Error handling block',
              suggestedName: 'handleErrors',
            });
          }
          break;
        }

        case SyntaxKind.SwitchStatement: {
          if (lineSpan >= 15) {
            blocks.push({
              startLine: nodeStart,
              endLine: nodeEnd,
              description: 'Switch statement with multiple cases',
              suggestedName: 'processCase',
            });
          }
          break;
        }

        case SyntaxKind.Block: {
          // Look for comment-delimited logical sections
          const blockText = node.getText();
          const parent = node.getParent();

          // Skip if parent is a function (we want inner blocks)
          if (
            parent?.getKind() === SyntaxKind.FunctionDeclaration ||
            parent?.getKind() === SyntaxKind.ArrowFunction ||
            parent?.getKind() === SyntaxKind.MethodDeclaration
          ) {
            break;
          }

          if (lineSpan >= 15 && hasLogicalCohesion(blockText)) {
            blocks.push({
              startLine: nodeStart,
              endLine: nodeEnd,
              description: 'Cohesive code block',
              suggestedName: 'processLogic',
            });
          }
          break;
        }
      }
    }
  });

  // Deduplicate and prioritize larger blocks
  const deduped = deduplicateBlocks(blocks);

  // Limit suggestions based on complexity
  const maxSuggestions = Math.min(Math.ceil(complexity / 10), 5);
  return deduped.slice(0, maxSuggestions);
}

/**
 * Check if a block has logical cohesion (comments indicating purpose)
 */
function hasLogicalCohesion(text: string): boolean {
  return text.includes('//') || text.includes('/*') || text.includes('TODO');
}

/**
 * Guess a function name based on the block content
 */
function guessBlockName(prefix: string, content: string): string {
  const clean = content
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');

  return prefix + clean.charAt(0).toUpperCase() + clean.slice(1) || `${prefix}Block`;
}

/**
 * Remove overlapping blocks, keeping the larger ones
 */
function deduplicateBlocks(blocks: CodeBlock[]): CodeBlock[] {
  // Sort by size (largest first)
  const sorted = [...blocks].sort((a, b) => b.endLine - b.startLine - (a.endLine - a.startLine));

  const result: CodeBlock[] = [];

  for (const block of sorted) {
    const overlaps = result.some(
      (existing) =>
        (block.startLine >= existing.startLine && block.startLine <= existing.endLine) ||
        (block.endLine >= existing.startLine && block.endLine <= existing.endLine) ||
        (block.startLine <= existing.startLine && block.endLine >= existing.endLine)
    );

    if (!overlaps) {
      result.push(block);
    }
  }

  // Sort by line number for output
  return result.sort((a, b) => a.startLine - b.startLine);
}

/**
 * Get bus factor information for a specific file
 */
async function getFileBusFactor(
  rootDir: string,
  filePath: string
): Promise<{ busFactor: number; contributors: { name: string; percentage: number }[] }> {
  const git: SimpleGit = simpleGit(rootDir);

  try {
    const rawLog = await git.raw(['log', '--format=%an', '--follow', filePath]);

    const authors = rawLog.trim().split('\n').filter(Boolean);
    const authorCounts = new Map<string, number>();

    for (const author of authors) {
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    }

    const total = authors.length;
    const contributors = [...authorCounts.entries()]
      .map(([name, count]) => ({
        name,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Bus factor = number of people with >= 20% contribution
    const significantContributors = contributors.filter((c) => c.percentage >= 20);
    const busFactor = Math.max(1, significantContributors.length);

    return { busFactor, contributors: contributors.slice(0, 5) };
  } catch {
    return { busFactor: 0, contributors: [] };
  }
}

/**
 * Check if a file is involved in any circular dependencies
 */
function getFileCycles(filePath: string, cyclesResult: CyclesResult): string[][] {
  return cyclesResult.cycles
    .filter((cycle) => cycle.files.includes(filePath))
    .map((cycle) => cycle.files);
}

/**
 * Get dead exports for a specific file
 */
function getFileDeadExports(
  filePath: string,
  deadCodeResult: DeadCodeResult
): { name: string; line: number }[] {
  return deadCodeResult.items
    .filter((item) => item.filePath === filePath)
    .map((item) => ({ name: item.name, line: item.lineStart }));
}

/**
 * Analyze complexity for functions in a file
 */
function analyzeFileComplexity(
  graph: KnowledgeGraph,
  filePath: string
): Array<{ name: string; complexity: number; lineStart: number; lineEnd: number }> {
  return Object.values(graph.nodes)
    .filter((n) => n.filePath === filePath && n.type === 'function' && n.complexity !== undefined)
    .map((n) => ({
      name: n.name,
      complexity: n.complexity!,
      lineStart: n.lineStart,
      lineEnd: n.lineEnd,
    }))
    .sort((a, b) => b.complexity - a.complexity);
}

/**
 * Get file size information
 */
function getFileInfo(
  graph: KnowledgeGraph,
  filePath: string
): { lineCount: number; importCount: number; exportCount: number } | null {
  const fileNode = Object.values(graph.nodes).find(
    (n) => n.type === 'file' && n.filePath === filePath
  ) as { lineCount?: number; importCount?: number; exportCount?: number } | undefined;

  if (!fileNode) return null;

  return {
    lineCount: fileNode.lineCount || 0,
    importCount: fileNode.importCount || 0,
    exportCount: fileNode.exportCount || 0,
  };
}

/**
 * Suggest how to break a circular dependency cycle
 */
function suggestCycleBreak(cycle: string[], targetFile: string): string[] {
  const details: string[] = [];
  const files = cycle.map((f) => path.basename(f));
  const targetBase = path.basename(targetFile);

  // Find position in cycle
  const targetIdx = files.indexOf(targetBase);
  const nextFile = files[(targetIdx + 1) % files.length];
  const _prevFile = files[(targetIdx - 1 + files.length) % files.length];

  details.push(`Cycle: ${files.join(' -> ')} -> [loop]`);
  details.push('');
  details.push('Options to break this cycle:');
  details.push('');
  details.push(`1. Extract shared types/interfaces to a new file`);
  details.push(`   Create: ${path.dirname(targetFile)}/types.ts or shared.ts`);
  details.push(`   Move: Common interfaces used by both ${targetBase} and ${nextFile}`);
  details.push('');
  details.push(`2. Use dependency injection`);
  details.push(`   Instead of: import { X } from './${nextFile.replace(/\.\w+$/, '')}'`);
  details.push(`   Pass X as a parameter or use a factory pattern`);
  details.push('');
  details.push(`3. Lazy imports (if runtime is acceptable)`);
  details.push(`   Use dynamic import() inside functions instead of top-level import`);

  return details;
}

/**
 * Suggest how to split a large file
 */
function suggestFileSplit(filePath: string, graph: KnowledgeGraph, lineCount: number): string[] {
  const details: string[] = [];
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Group functions/classes by likely concern
  const symbols = Object.values(graph.nodes)
    .filter((n) => n.filePath === filePath && n.type !== 'file')
    .map((n) => n.name);

  details.push(`This file has ${lineCount} lines - consider splitting.`);
  details.push('');
  details.push('Suggested structure:');
  details.push('');
  details.push(`${dir}/`);
  details.push(`  ${baseName}/`);
  details.push(`    index.ts       - Re-exports public API`);

  // Group by naming patterns
  const groups = groupSymbolsByPattern(symbols);
  let fileNum = 1;

  for (const [pattern, syms] of Object.entries(groups)) {
    if (syms.length >= 2) {
      details.push(
        `    ${pattern}.ts    - ${syms.slice(0, 3).join(', ')}${syms.length > 3 ? '...' : ''}`
      );
      fileNum++;
    }
  }

  if (fileNum === 1) {
    // No clear groupings, suggest by function type
    details.push(`    core.ts        - Main logic`);
    details.push(`    helpers.ts     - Utility functions`);
    details.push(`    types.ts       - Type definitions`);
  }

  details.push('');
  details.push('Benefits:');
  details.push('  - Easier to navigate and understand');
  details.push('  - Better code ownership visibility');
  details.push('  - Improved test isolation');

  return details;
}

/**
 * Group symbols by naming patterns
 */
function groupSymbolsByPattern(symbols: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    types: [],
    helpers: [],
    handlers: [],
    validators: [],
    formatters: [],
    other: [],
  };

  for (const sym of symbols) {
    const lower = sym.toLowerCase();
    if (lower.includes('type') || lower.includes('interface') || sym.match(/^I[A-Z]/)) {
      groups.types.push(sym);
    } else if (
      lower.includes('helper') ||
      lower.includes('util') ||
      lower.includes('get') ||
      lower.includes('is')
    ) {
      groups.helpers.push(sym);
    } else if (lower.includes('handle') || lower.includes('on')) {
      groups.handlers.push(sym);
    } else if (lower.includes('valid') || lower.includes('check')) {
      groups.validators.push(sym);
    } else if (lower.includes('format') || lower.includes('render') || lower.includes('display')) {
      groups.formatters.push(sym);
    } else {
      groups.other.push(sym);
    }
  }

  // Filter out empty groups
  return Object.fromEntries(Object.entries(groups).filter(([_, syms]) => syms.length > 0));
}

/**
 * Generate fix suggestions for a file
 */
export async function generateFix(
  filePath: string,
  rootDir: string,
  graph: KnowledgeGraph,
  options: { severity?: SuggestionSeverity } = {}
): Promise<FixResult> {
  const minSeverity = options.severity || 'info';
  const severityOrder: Record<SuggestionSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const minSeverityLevel = severityOrder[minSeverity];

  const suggestions: FixSuggestion[] = [];
  const absolutePath = path.resolve(rootDir, filePath);

  // 1. Analyze complexity
  const complexFunctions = analyzeFileComplexity(graph, filePath);
  const highComplexityThreshold = 20;
  const mediumComplexityThreshold = 10;

  for (const func of complexFunctions) {
    if (func.complexity >= highComplexityThreshold) {
      // Load the source file to analyze extractable blocks
      let codeBlocks: CodeBlock[] = [];
      try {
        const project = new Project({ skipAddingFilesFromTsConfig: true });
        const sourceFile = project.addSourceFileAtPath(absolutePath);
        codeBlocks = identifyExtractableBlocks(
          sourceFile,
          func.lineStart,
          func.lineEnd,
          func.complexity
        );
      } catch {
        // Could not analyze source file
      }

      const suggestion: FixSuggestion = {
        severity: 'critical',
        title: `Function too complex (complexity: ${func.complexity})`,
        details: [
          `Function: ${func.name}() at line ${func.lineStart}`,
          '',
          'Suggested fix:',
          'Extract these code blocks into separate functions:',
        ],
        codeBlocks,
        expectedOutcome: `Complexity ${func.complexity} -> ~${Math.ceil(func.complexity / (codeBlocks.length + 1))} per function`,
      };

      if (codeBlocks.length === 0) {
        suggestion.details.push('');
        suggestion.details.push('Unable to auto-detect blocks. Manual review suggested:');
        suggestion.details.push('  - Look for nested conditionals');
        suggestion.details.push('  - Identify loops with complex bodies');
        suggestion.details.push('  - Find repeated patterns that could be helper functions');
      }

      if (severityOrder[suggestion.severity] <= minSeverityLevel) {
        suggestions.push(suggestion);
      }
    } else if (func.complexity >= mediumComplexityThreshold) {
      const suggestion: FixSuggestion = {
        severity: 'warning',
        title: `Function approaching complexity threshold (complexity: ${func.complexity})`,
        details: [
          `Function: ${func.name}() at line ${func.lineStart}`,
          '',
          'Suggested fix:',
          '  - Consider breaking down before it grows further',
          '  - Add comments to clarify complex logic',
          `  - Target complexity under ${mediumComplexityThreshold}`,
        ],
      };

      if (severityOrder[suggestion.severity] <= minSeverityLevel) {
        suggestions.push(suggestion);
      }
    }
  }

  // 2. Check file size
  const fileInfo = getFileInfo(graph, filePath);
  if (fileInfo) {
    if (fileInfo.lineCount > 500) {
      const suggestion: FixSuggestion = {
        severity: 'warning',
        title: `Large file (${fileInfo.lineCount} lines)`,
        details: suggestFileSplit(filePath, graph, fileInfo.lineCount),
      };

      if (severityOrder[suggestion.severity] <= minSeverityLevel) {
        suggestions.push(suggestion);
      }
    } else if (fileInfo.lineCount > 300) {
      const suggestion: FixSuggestion = {
        severity: 'info',
        title: `File growing large (${fileInfo.lineCount} lines)`,
        details: [
          'Consider organizing into sections or splitting soon.',
          '',
          'Tips:',
          '  - Group related functions together',
          '  - Move types/interfaces to a separate file',
          '  - Extract utility functions to helpers.ts',
        ],
      };

      if (severityOrder[suggestion.severity] <= minSeverityLevel) {
        suggestions.push(suggestion);
      }
    }
  }

  // 3. Check circular dependencies
  const cyclesResult = detectCycles(graph);
  const fileCycles = getFileCycles(filePath, cyclesResult);

  if (fileCycles.length > 0) {
    for (const cycle of fileCycles.slice(0, 2)) {
      const severity: SuggestionSeverity = cycle.length >= 4 ? 'critical' : 'warning';
      const suggestion: FixSuggestion = {
        severity,
        title: `Circular dependency detected (${cycle.length} files)`,
        details: suggestCycleBreak(cycle, filePath),
      };

      if (severityOrder[suggestion.severity] <= minSeverityLevel) {
        suggestions.push(suggestion);
      }
    }
  }

  // 4. Check dead code
  const deadCodeResult = findDeadCode(graph, { directory: path.dirname(filePath) });
  const fileDeadExports = getFileDeadExports(filePath, deadCodeResult);

  if (fileDeadExports.length > 0) {
    const suggestion: FixSuggestion = {
      severity: 'info',
      title: 'Unused exports detected',
      details: [
        'These exports are never imported elsewhere:',
        '',
        ...fileDeadExports.map((e) => `  - ${e.name} (line ${e.line})`),
        '',
        'Suggested fix:',
        '  - Remove if truly unused, or',
        '  - Mark as @public if part of external API',
        '  - Add to index.ts if meant to be re-exported',
      ],
    };

    if (severityOrder[suggestion.severity] <= minSeverityLevel) {
      suggestions.push(suggestion);
    }
  }

  // 5. Check bus factor
  const busFactorInfo = await getFileBusFactor(rootDir, filePath);

  if (busFactorInfo.busFactor === 1 && busFactorInfo.contributors.length > 0) {
    const owner = busFactorInfo.contributors[0];
    const suggestion: FixSuggestion = {
      severity: 'warning',
      title: `Low bus factor (${busFactorInfo.busFactor})`,
      details: [
        `Only ${owner.name} has touched this file (${owner.percentage}% of commits).`,
        '',
        'Suggested fix:',
        '  - Schedule a pairing session to share knowledge',
        '  - Add inline documentation for complex logic',
        '  - Create a README in this directory',
        '  - Consider code review rotations',
      ],
    };

    if (severityOrder[suggestion.severity] <= minSeverityLevel) {
      suggestions.push(suggestion);
    }
  }

  // Sort by severity
  suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Calculate summary
  const summary = {
    critical: suggestions.filter((s) => s.severity === 'critical').length,
    warning: suggestions.filter((s) => s.severity === 'warning').length,
    info: suggestions.filter((s) => s.severity === 'info').length,
    total: suggestions.length,
  };

  return {
    filePath,
    absolutePath,
    suggestions,
    summary,
  };
}

/**
 * Generate fixes for all files with issues
 */
export async function generateFixAll(
  rootDir: string,
  graph: KnowledgeGraph,
  options: { severity?: SuggestionSeverity } = {}
): Promise<FixResult[]> {
  const results: FixResult[] = [];

  // Get all files from the graph
  const files = Object.values(graph.nodes)
    .filter((n) => n.type === 'file')
    .map((n) => n.filePath);

  for (const file of files) {
    const result = await generateFix(file, rootDir, graph, options);
    if (result.summary.total > 0) {
      results.push(result);
    }
  }

  // Sort by total issues (most issues first), then by critical count
  results.sort((a, b) => {
    if (a.summary.critical !== b.summary.critical) {
      return b.summary.critical - a.summary.critical;
    }
    return b.summary.total - a.summary.total;
  });

  return results;
}

/**
 * Get severity emoji
 */
function getSeverityEmoji(severity: SuggestionSeverity): string {
  switch (severity) {
    case 'critical':
      return '\u{1F534}'; // red circle
    case 'warning':
      return '\u{1F7E1}'; // yellow circle
    case 'info':
      return '\u{1F480}'; // skull (dead code theme)
  }
}

/**
 * Get severity label
 */
function getSeverityLabel(severity: SuggestionSeverity): string {
  switch (severity) {
    case 'critical':
      return 'CRITICAL';
    case 'warning':
      return 'WARNING';
    case 'info':
      return 'INFO';
  }
}

/**
 * Format fix results for CLI output
 */
export function formatFix(result: FixResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('  \u{1F527} SPECTER FIX SUGGESTIONS');
  lines.push('');
  lines.push(`  Analyzing: ${result.filePath}`);
  lines.push('');
  lines.push(`  ${'\u2550'.repeat(58)}`);

  if (result.suggestions.length === 0) {
    lines.push('');
    lines.push('  \u2705 No issues detected in this file!');
    lines.push('');
    lines.push(`  ${'\u2550'.repeat(58)}`);
    return lines.join('\n');
  }

  for (const suggestion of result.suggestions) {
    lines.push('');
    lines.push(
      `  ${getSeverityEmoji(suggestion.severity)} ${getSeverityLabel(suggestion.severity)}: ${suggestion.title}`
    );
    lines.push('');

    for (const detail of suggestion.details) {
      lines.push(`     ${detail}`);
    }

    if (suggestion.codeBlocks && suggestion.codeBlocks.length > 0) {
      lines.push('');
      for (let i = 0; i < suggestion.codeBlocks.length; i++) {
        const block = suggestion.codeBlocks[i];
        lines.push(
          `     ${i + 1}. Lines ${block.startLine}-${block.endLine}: Extract to ${block.suggestedName}()`
        );
        lines.push(`        ${block.description}`);
      }
    }

    if (suggestion.expectedOutcome) {
      lines.push('');
      lines.push(`     Expected result: ${suggestion.expectedOutcome}`);
    }

    lines.push('');
    lines.push(`  ${'\u2500'.repeat(58)}`);
  }

  // Summary
  lines.push('');
  const parts = [];
  if (result.summary.critical > 0) parts.push(`${result.summary.critical} critical`);
  if (result.summary.warning > 0) parts.push(`${result.summary.warning} warning`);
  if (result.summary.info > 0) parts.push(`${result.summary.info} info`);

  lines.push(`  Summary: ${result.summary.total} suggestions (${parts.join(', ')})`);
  lines.push(`  Run: specter fix ${result.filePath} --apply  (coming soon)`);
  lines.push('');
  lines.push(`  ${'\u2550'.repeat(58)}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format multiple fix results for CLI output
 */
export function formatFixAll(results: FixResult[]): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('  \u{1F527} SPECTER FIX SUGGESTIONS - ALL FILES');
  lines.push('');
  lines.push(`  ${'\u2550'.repeat(58)}`);
  lines.push('');

  if (results.length === 0) {
    lines.push('  \u2705 No issues detected in the codebase!');
    lines.push('');
    lines.push(`  ${'\u2550'.repeat(58)}`);
    return lines.join('\n');
  }

  // Summary counts
  let totalCritical = 0;
  let totalWarning = 0;
  let totalInfo = 0;

  for (const result of results) {
    totalCritical += result.summary.critical;
    totalWarning += result.summary.warning;
    totalInfo += result.summary.info;
  }

  lines.push(`  Files with issues: ${results.length}`);
  lines.push(`  Total suggestions: ${totalCritical + totalWarning + totalInfo}`);
  lines.push(`    \u{1F534} Critical: ${totalCritical}`);
  lines.push(`    \u{1F7E1} Warning:  ${totalWarning}`);
  lines.push(`    \u{1F480} Info:     ${totalInfo}`);
  lines.push('');
  lines.push(`  ${'\u2500'.repeat(58)}`);
  lines.push('');

  // List files with critical issues first
  const criticalFiles = results.filter((r) => r.summary.critical > 0);
  const warningFiles = results.filter((r) => r.summary.critical === 0 && r.summary.warning > 0);
  const infoFiles = results.filter((r) => r.summary.critical === 0 && r.summary.warning === 0);

  if (criticalFiles.length > 0) {
    lines.push('  \u{1F534} CRITICAL ISSUES');
    lines.push('');
    for (const result of criticalFiles.slice(0, 10)) {
      lines.push(`     ${result.filePath}`);
      for (const sug of result.suggestions.filter((s) => s.severity === 'critical').slice(0, 2)) {
        lines.push(`       - ${sug.title}`);
      }
    }
    if (criticalFiles.length > 10) {
      lines.push(`     ... and ${criticalFiles.length - 10} more files`);
    }
    lines.push('');
  }

  if (warningFiles.length > 0) {
    lines.push('  \u{1F7E1} WARNING ISSUES');
    lines.push('');
    for (const result of warningFiles.slice(0, 8)) {
      lines.push(`     ${result.filePath} (${result.summary.warning} warnings)`);
    }
    if (warningFiles.length > 8) {
      lines.push(`     ... and ${warningFiles.length - 8} more files`);
    }
    lines.push('');
  }

  if (infoFiles.length > 0) {
    lines.push('  \u{1F480} INFO');
    lines.push('');
    for (const result of infoFiles.slice(0, 5)) {
      lines.push(`     ${result.filePath} (${result.summary.info} suggestions)`);
    }
    if (infoFiles.length > 5) {
      lines.push(`     ... and ${infoFiles.length - 5} more files`);
    }
    lines.push('');
  }

  lines.push(`  ${'\u2500'.repeat(58)}`);
  lines.push('');
  lines.push('  Run: specter fix <file> to see detailed suggestions');
  lines.push('');
  lines.push(`  ${'\u2550'.repeat(58)}`);
  lines.push('');

  return lines.join('\n');
}
