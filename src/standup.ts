/**
 * Standup - Daily Standup Summary Generator
 *
 * Generates a quick summary for daily standups showing:
 * - What changed yesterday (commits, files)
 * - What's planned today (staged files, hotspots)
 * - Blockers (high-risk files, circular dependencies)
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { GraphNode, KnowledgeGraph } from './graph/types.js';

export interface StandupResult {
  period: { start: Date; end: Date };
  yesterday: {
    commits: number;
    filesChanged: string[];
    summary: string;
  };
  today: {
    stagedFiles: string[];
    hotspots: string[]; // Files that might need attention
    suggestions: string[];
  };
  blockers: {
    highRiskFiles: Array<{ path: string; risk: number; reason: string }>;
    circularDependencies: number;
  };
}

/**
 * Calculate risk score for a file node
 */
function calculateRiskScore(
  node: GraphNode,
  graph: KnowledgeGraph
): { risk: number; reason: string } {
  let risk = 0;
  const reasons: string[] = [];

  // Complexity factor
  if (node.complexity !== undefined) {
    if (node.complexity > 20) {
      risk += 40;
      reasons.push('very high complexity');
    } else if (node.complexity > 15) {
      risk += 25;
      reasons.push('high complexity');
    } else if (node.complexity > 10) {
      risk += 10;
      reasons.push('moderate complexity');
    }
  }

  // How many files depend on this (more = riskier)
  const dependents = graph.edges.filter(
    (e) => e.type === 'imports' && graph.nodes[e.target]?.filePath === node.filePath
  );
  if (dependents.length > 10) {
    risk += 30;
    reasons.push(`${dependents.length} dependents`);
  } else if (dependents.length > 5) {
    risk += 15;
    reasons.push(`${dependents.length} dependents`);
  }

  // Large files are riskier
  const fileNode = node as { lineCount?: number };
  if (fileNode.lineCount !== undefined && fileNode.lineCount > 500) {
    risk += 15;
    reasons.push('large file');
  }

  // Entry points are risky
  if (node.filePath.includes('index') && node.filePath.split('/').length <= 2) {
    risk += 20;
    reasons.push('entry point');
  }

  return {
    risk: Math.min(100, risk),
    reason: reasons.length > 0 ? reasons.join(', ') : 'multiple factors',
  };
}

/**
 * Count circular dependencies
 */
function countCircularDependencies(graph: KnowledgeGraph): number {
  const adjacency = new Map<string, Set<string>>();

  // Build adjacency list
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') {
      adjacency.set(node.filePath, new Set());
    }
  }

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode?.filePath && targetNode?.filePath) {
        const deps = adjacency.get(sourceNode.filePath);
        if (deps) {
          deps.add(targetNode.filePath);
        }
      }
    }
  }

  // Find cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  let cycleCount = 0;

  function dfs(node: string, pathStack: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    pathStack.push(node);

    const neighbors = adjacency.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, pathStack);
      } else if (recursionStack.has(neighbor)) {
        cycleCount++;
      }
    }

    pathStack.pop();
    recursionStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycleCount;
}

/**
 * Parse a relative time string like "2 days ago" into a Date
 */
function parseRelativeTime(since: string): Date {
  const date = new Date();
  const match = since.match(/(\d+)\s*(day|hour|week)s?\s*ago/i);

  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'hour':
        date.setHours(date.getHours() - amount);
        break;
      case 'day':
        date.setDate(date.getDate() - amount);
        break;
      case 'week':
        date.setDate(date.getDate() - amount * 7);
        break;
    }
  } else {
    // Default: 24 hours ago
    date.setDate(date.getDate() - 1);
  }

  return date;
}

/**
 * Generate standup summary
 */
export async function generateStandup(
  rootDir: string,
  graph: KnowledgeGraph,
  options: { since?: string } = {}
): Promise<StandupResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Parse the since parameter
  const sinceDate = options.since
    ? parseRelativeTime(options.since)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();

  // Yesterday's activity
  const yesterday = {
    commits: 0,
    filesChanged: [] as string[],
    summary: '',
  };

  try {
    const recentLog = await git.log({
      '--after': sinceDate.toISOString(),
    });

    const filesChanged = new Set<string>();

    for (const commit of recentLog.all) {
      try {
        const diff = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);
        for (const file of diff.trim().split('\n').filter(Boolean)) {
          if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            filesChanged.add(file);
          }
        }
      } catch {
        // Skip individual commit errors
      }
    }

    yesterday.commits = recentLog.total;
    yesterday.filesChanged = [...filesChanged].slice(0, 10);

    // Generate summary
    if (yesterday.commits === 0) {
      yesterday.summary = 'No commits in this period';
    } else if (yesterday.commits === 1) {
      yesterday.summary = '1 commit';
    } else {
      yesterday.summary = `${yesterday.commits} commits`;
    }

    if (filesChanged.size > 0) {
      yesterday.summary += `, ${filesChanged.size} files touched`;
    }
  } catch {
    yesterday.summary = 'Unable to access git history';
  }

  // Today's plan
  const today = {
    stagedFiles: [] as string[],
    hotspots: [] as string[],
    suggestions: [] as string[],
  };

  // Check staged files
  try {
    const status = await git.status();
    today.stagedFiles = status.staged.slice(0, 5);
  } catch {
    // Git not available
  }

  // Find hotspots from recent changes
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
  const hotspotCandidates: Array<{ path: string; score: number }> = [];

  for (const node of fileNodes) {
    // Check if this file was recently changed
    const wasChanged = yesterday.filesChanged.includes(node.filePath);
    const complexity = node.complexity ?? 0;

    if (wasChanged && complexity > 10) {
      hotspotCandidates.push({
        path: node.filePath,
        score: complexity,
      });
    }
  }

  // Sort by score and take top 3
  hotspotCandidates.sort((a, b) => b.score - a.score);
  today.hotspots = hotspotCandidates.slice(0, 3).map((h) => h.path);

  // Generate suggestions
  if (today.stagedFiles.length > 0) {
    today.suggestions.push(`${today.stagedFiles.length} files staged - ready to commit`);
  }

  if (today.hotspots.length > 0) {
    today.suggestions.push('Review recently changed complex files');
  }

  if (yesterday.commits > 5) {
    today.suggestions.push('Heavy activity yesterday - check for conflicts');
  }

  if (today.suggestions.length === 0) {
    today.suggestions.push('Ready to start fresh work');
  }

  // Blockers - high risk files among recent changes
  const blockers = {
    highRiskFiles: [] as Array<{ path: string; risk: number; reason: string }>,
    circularDependencies: 0,
  };

  for (const filePath of yesterday.filesChanged) {
    const node = fileNodes.find((n) => n.filePath === filePath);
    if (node) {
      const { risk, reason } = calculateRiskScore(node, graph);
      if (risk >= 50) {
        blockers.highRiskFiles.push({ path: filePath, risk, reason });
      }
    }
  }

  // Sort by risk and take top 3
  blockers.highRiskFiles.sort((a, b) => b.risk - a.risk);
  blockers.highRiskFiles = blockers.highRiskFiles.slice(0, 3);

  // Count circular dependencies
  blockers.circularDependencies = countCircularDependencies(graph);

  return {
    period: { start: sinceDate, end: now },
    yesterday,
    today,
    blockers,
  };
}

/**
 * Format standup result for display
 */
export function formatStandup(result: StandupResult): string {
  const lines: string[] = [];
  const date = result.period.end.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Header
  lines.push(`\u250F${'\u2501'.repeat(51)}\u2513`);
  lines.push('\u2503  \uD83D\uDCCB STANDUP SUMMARY                               \u2503');
  lines.push(`\u2517${'\u2501'.repeat(51)}\u251B`);
  lines.push('');
  lines.push(`\uD83D\uDCC5 ${date}`);
  lines.push('');

  // Yesterday
  lines.push('YESTERDAY');
  lines.push('\u2500'.repeat(53));

  if (result.yesterday.commits === 0) {
    lines.push('  No commits in this period');
  } else {
    lines.push(`  \u2713 ${result.yesterday.summary}`);

    if (result.yesterday.filesChanged.length > 0) {
      const modified = result.yesterday.filesChanged.filter((f) => !f.startsWith('test'));
      const tests = result.yesterday.filesChanged.filter((f) => f.includes('test'));

      if (modified.length > 0) {
        lines.push(
          `  \u2713 Modified: ${modified.slice(0, 3).join(', ')}${modified.length > 3 ? ` (+${modified.length - 3} more)` : ''}`
        );
      }
      if (tests.length > 0) {
        lines.push(`  \u2713 Tests: ${tests.length} test file(s) updated`);
      }
    }
  }

  lines.push('');

  // Today
  lines.push('TODAY');
  lines.push('\u2500'.repeat(53));

  if (result.today.stagedFiles.length > 0) {
    lines.push(`  \uD83D\uDCDD Staged: ${result.today.stagedFiles.length} file(s) ready to commit`);
    for (const file of result.today.stagedFiles.slice(0, 3)) {
      lines.push(`     - ${file}`);
    }
  } else {
    lines.push('  \uD83D\uDCDD No files staged');
  }

  if (result.today.hotspots.length > 0) {
    lines.push(
      `  \uD83C\uDFAF Focus areas: ${result.today.hotspots.length} complex file(s) recently changed`
    );
    for (const hotspot of result.today.hotspots) {
      lines.push(`     - ${hotspot}`);
    }
  }

  if (result.today.suggestions.length > 0) {
    for (const suggestion of result.today.suggestions) {
      lines.push(`  \uD83D\uDCA1 ${suggestion}`);
    }
  }

  lines.push('');

  // Blockers
  const hasBlockers =
    result.blockers.highRiskFiles.length > 0 || result.blockers.circularDependencies > 0;

  lines.push('BLOCKERS');
  lines.push('\u2500'.repeat(53));

  if (!hasBlockers) {
    lines.push('  \u2705 No blockers detected');
  } else {
    if (result.blockers.highRiskFiles.length > 0) {
      for (const file of result.blockers.highRiskFiles) {
        lines.push(`  \u26A0\uFE0F  ${file.path}`);
        lines.push(`     Risk: ${file.risk}% (${file.reason})`);
      }
    }

    if (result.blockers.circularDependencies > 0) {
      lines.push(
        `  \u26A0\uFE0F  ${result.blockers.circularDependencies} circular dependenc${result.blockers.circularDependencies === 1 ? 'y' : 'ies'} detected`
      );
    }
  }

  lines.push('');

  return lines.join('\n');
}
