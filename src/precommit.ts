/**
 * Precommit - Quick Pre-Commit Risk Check
 *
 * Fast scan of staged changes to identify risks
 * before committing.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { GraphNode, KnowledgeGraph } from './graph/types.js';

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
 * Assess risk based on file size changes
 */
function assessFileSizeRisk(
  additions: number,
  deletions: number
): { risk: PrecommitFile['risk']; reasons: string[] } {
  const reasons: string[] = [];
  let risk: PrecommitFile['risk'] = 'low';

  const totalLines = additions + deletions;
  if (totalLines > 200) {
    risk = 'high';
    reasons.push(`Large change (${totalLines} lines)`);
  } else if (totalLines > 50) {
    risk = 'medium';
    reasons.push(`Moderate change (${totalLines} lines)`);
  }

  return { risk, reasons };
}

/**
 * Assess risk based on file path patterns
 */
function assessFilePatternRisk(filePath: string): {
  risk: PrecommitFile['risk'];
  reasons: string[];
} {
  const reasons: string[] = [];
  let risk: PrecommitFile['risk'] = 'low';

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

  return { risk, reasons };
}

/**
 * Assess risk based on knowledge graph data
 */
function assessGraphBasedRisk(
  node: GraphNode | undefined,
  graph: KnowledgeGraph
): { risk: PrecommitFile['risk']; reasons: string[] } {
  const reasons: string[] = [];
  let risk: PrecommitFile['risk'] = 'low';

  if (!node) return { risk, reasons };

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

  return { risk, reasons };
}

/**
 * Generate suggestions based on precommit analysis
 */
function generatePrecommitSuggestions(result: Omit<PrecommitResult, 'suggestions'>): string[] {
  const suggestions: string[] = [];

  if (result.totalChanges > 300) {
    suggestions.push('Consider splitting into smaller commits');
  }

  const highRiskCount = result.files.filter((f) => f.risk === 'high').length;
  if (highRiskCount > 0) {
    suggestions.push('Get a second pair of eyes on high-risk changes');
  }

  const hasTests = result.files.some((f) => f.path.includes('test') || f.path.includes('spec'));
  const hasCode = result.files.some(
    (f) =>
      f.path.endsWith('.ts') ||
      f.path.endsWith('.js') ||
      f.path.endsWith('.py') ||
      f.path.endsWith('.go')
  );

  if (hasCode && !hasTests) {
    suggestions.push('Consider adding tests');
  }

  return suggestions;
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

  for (const line of stagedOutput.split('\n')) {
    if (!line.trim()) continue;

    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    const filePath = parts[2];

    totalAdditions += additions;
    totalDeletions += deletions;

    // Assess risk from multiple sources
    const sizeRisk = assessFileSizeRisk(additions, deletions);
    const patternRisk = assessFilePatternRisk(filePath);

    // Combine size and pattern risk
    let reasons = [...sizeRisk.reasons, ...patternRisk.reasons];
    let risk: PrecommitFile['risk'] = sizeRisk.risk;
    if (patternRisk.risk === 'high' || (patternRisk.risk === 'medium' && risk === 'low')) {
      risk = patternRisk.risk === 'high' ? 'high' : 'medium';
    }

    // Check graph-based risk
    const node = Object.values(graph.nodes).find(
      (n) => n.type === 'file' && n.filePath === filePath
    ) as GraphNode | undefined;

    const graphRisk = assessGraphBasedRisk(node, graph);
    reasons = [...reasons, ...graphRisk.reasons];
    if (graphRisk.risk === 'high') {
      risk = 'high';
    } else if (graphRisk.risk === 'medium' && risk === 'low') {
      risk = 'medium';
    }

    if (reasons.length === 0) {
      reasons.push('Standard change');
    }

    files.push({ path: filePath, risk, reasons });
  }

  // Determine overall status
  let status: PrecommitResult['status'] = 'pass';
  let summary = '';

  const highRiskCount = files.filter((f) => f.risk === 'high').length;
  const mediumRiskCount = files.filter((f) => f.risk === 'medium').length;

  if (highRiskCount > 0) {
    status = 'fail';
    summary = `${highRiskCount} high-risk file(s) detected`;
  } else if (mediumRiskCount > 0) {
    status = 'warn';
    summary = `${mediumRiskCount} medium-risk file(s) - review carefully`;
  } else {
    summary = 'All changes look safe';
  }

  // Sort by risk level
  files.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.risk] - order[b.risk];
  });

  // Create temporary result for suggestions generation
  const tempResult: Omit<PrecommitResult, 'suggestions'> = {
    status,
    files,
    totalChanges: totalAdditions + totalDeletions,
    summary,
  };

  return {
    ...tempResult,
    suggestions: generatePrecommitSuggestions(tempResult),
  };
}

/**
 * Format precommit result for display
 */
export function formatPrecommit(result: PrecommitResult): string {
  const lines: string[] = [];

  // Status header
  const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️ ' : '❌';

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
