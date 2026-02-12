/**
 * Precommit - Quick Pre-Commit Risk Check
 *
 * Fast scan of staged changes to identify risks
 * before committing.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph, GraphNode } from './graph/types.js';

export interface PrecommitFile {
  path: string;
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
}

export interface PrecommitResult {
  status: 'pass' | 'warn' | 'fail';
  files: PrecommitFile[];
  totalChanges: number;
  summary: string;
  suggestions: string[];
}

/**
 * Quick risk check for staged changes
 */
export async function runPrecommitCheck(
  rootDir: string,
  graph: KnowledgeGraph
): Promise<PrecommitResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Get staged files quickly
  let stagedOutput = '';
  try {
    stagedOutput = await git.diff(['--cached', '--numstat']);
  } catch {
    return {
      status: 'pass',
      files: [],
      totalChanges: 0,
      summary: 'No staged changes',
      suggestions: [],
    };
  }

  if (!stagedOutput.trim()) {
    return {
      status: 'pass',
      files: [],
      totalChanges: 0,
      summary: 'No staged changes',
      suggestions: [],
    };
  }

  const files: PrecommitFile[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;

  for (const line of stagedOutput.split('\n')) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    const filePath = parts[2];

    totalAdditions += additions;
    totalDeletions += deletions;

    // Quick risk assessment
    const reasons: string[] = [];
    let risk: PrecommitFile['risk'] = 'low';

    // Size-based risk
    const totalLines = additions + deletions;
    if (totalLines > 200) {
      risk = 'high';
      reasons.push(`Large change (${totalLines} lines)`);
    } else if (totalLines > 50) {
      if (risk === 'low') risk = 'medium';
      reasons.push(`Moderate change (${totalLines} lines)`);
    }

    // File pattern risk
    if (filePath.includes('config') || filePath.endsWith('.env')) {
      risk = 'high';
      reasons.push('Configuration file');
    }
    if (filePath.includes('package.json') || filePath.includes('Cargo.toml')) {
      if (risk === 'low') risk = 'medium';
      reasons.push('Dependency file');
    }
    if (filePath.includes('migration') || filePath.includes('schema')) {
      risk = 'high';
      reasons.push('Database change');
    }

    // Graph-based risk (if available)
    const node = Object.values(graph.nodes).find(
      (n) => n.type === 'file' && n.filePath === filePath
    ) as GraphNode | undefined;

    if (node) {
      // Check complexity
      if (node.complexity !== undefined && node.complexity > 20) {
        risk = 'high';
        reasons.push('High complexity file');
      }

      // Check dependents
      const dependents = graph.edges.filter(
        (e) => e.type === 'imports' && graph.nodes[e.target]?.filePath === node.filePath
      );
      if (dependents.length > 5) {
        if (risk === 'low') risk = 'medium';
        reasons.push(`${dependents.length} dependents`);
      }
    }

    if (risk === 'high') highRiskCount++;
    if (risk === 'medium') mediumRiskCount++;

    if (reasons.length === 0) {
      reasons.push('Standard change');
    }

    files.push({ path: filePath, risk, reasons });
  }

  // Determine overall status
  let status: PrecommitResult['status'] = 'pass';
  let summary = '';

  if (highRiskCount > 0) {
    status = 'fail';
    summary = `${highRiskCount} high-risk file(s) detected`;
  } else if (mediumRiskCount > 0) {
    status = 'warn';
    summary = `${mediumRiskCount} medium-risk file(s) - review carefully`;
  } else {
    summary = 'All changes look safe';
  }

  // Generate suggestions
  const suggestions: string[] = [];

  if (totalAdditions + totalDeletions > 300) {
    suggestions.push('Consider splitting into smaller commits');
  }

  if (highRiskCount > 0) {
    suggestions.push('Get a second pair of eyes on high-risk changes');
  }

  const hasTests = files.some((f) => f.path.includes('test') || f.path.includes('spec'));
  const hasCode = files.some(
    (f) =>
      f.path.endsWith('.ts') ||
      f.path.endsWith('.js') ||
      f.path.endsWith('.py') ||
      f.path.endsWith('.go')
  );

  if (hasCode && !hasTests) {
    suggestions.push('Consider adding tests');
  }

  // Sort by risk level
  files.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.risk] - order[b.risk];
  });

  return {
    status,
    files,
    totalChanges: totalAdditions + totalDeletions,
    summary,
    suggestions,
  };
}

/**
 * Format precommit result for display
 */
export function formatPrecommit(result: PrecommitResult): string {
  const lines: string[] = [];

  // Status header
  const statusIcon =
    result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️ ' : '❌';

  const statusColor =
    result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL';

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push(`┃  ${statusIcon} PRE-COMMIT CHECK: ${statusColor.padEnd(26)}┃`);
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.files.length === 0) {
    lines.push('No staged changes to check.');
    return lines.join('\n');
  }

  lines.push(`${result.summary}`);
  lines.push(`${result.files.length} file(s), ${result.totalChanges} line(s) changed`);
  lines.push('');

  // Group files by risk
  const highRisk = result.files.filter((f) => f.risk === 'high');
  const mediumRisk = result.files.filter((f) => f.risk === 'medium');
  const lowRisk = result.files.filter((f) => f.risk === 'low');

  if (highRisk.length > 0) {
    lines.push('🔴 HIGH RISK');
    lines.push('─'.repeat(50));
    for (const file of highRisk) {
      lines.push(`  ${file.path}`);
      lines.push(`    ${file.reasons.join(', ')}`);
    }
    lines.push('');
  }

  if (mediumRisk.length > 0) {
    lines.push('🟡 MEDIUM RISK');
    lines.push('─'.repeat(50));
    for (const file of mediumRisk) {
      lines.push(`  ${file.path}`);
      lines.push(`    ${file.reasons.join(', ')}`);
    }
    lines.push('');
  }

  if (lowRisk.length > 0 && result.status !== 'fail') {
    lines.push('🟢 LOW RISK');
    lines.push('─'.repeat(50));
    for (const file of lowRisk.slice(0, 5)) {
      lines.push(`  ${file.path}`);
    }
    if (lowRisk.length > 5) {
      lines.push(`  ... and ${lowRisk.length - 5} more`);
    }
    lines.push('');
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push('💡 SUGGESTIONS');
    lines.push('─'.repeat(50));
    for (const suggestion of result.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(51));

  return lines.join('\n');
}
