/**
 * Who - Expert Finder
 *
 * Identifies who knows the most about a specific file or area
 * based on git history and contribution patterns.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface Expert {
  name: string;
  email: string;
  commits: number;
  linesChanged: number;
  lastTouch: string;
  expertise: 'primary' | 'significant' | 'contributor';
  recentActivity: boolean;
}

export interface WhoResult {
  filePath: string;
  exists: boolean;
  experts: Expert[];
  relatedExperts: Array<{
    file: string;
    expert: string;
    reason: string;
  }>;
  suggestions: string[];
}

/**
 * Analyze who knows the most about a file
 */
/**
 * Get author contribution statistics from git log
 */
async function getAuthorStats(
  git: SimpleGit,
  filePath: string
): Promise<Map<string, { name: string; email: string; commits: number; lastTouch: string }>> {
  const log = await git.log({ file: filePath, maxCount: 100 });

  if (log.total === 0) {
    return new Map();
  }

  const authorStats = new Map<
    string,
    { name: string; email: string; commits: number; lastTouch: string }
  >();

  for (const commit of log.all) {
    const key = commit.author_email;
    const existing = authorStats.get(key);

    if (existing) {
      existing.commits++;
      if (new Date(commit.date) > new Date(existing.lastTouch)) {
        existing.lastTouch = commit.date;
      }
    } else {
      authorStats.set(key, {
        name: commit.author_name,
        email: commit.author_email,
        commits: 1,
        lastTouch: commit.date,
      });
    }
  }

  return authorStats;
}

/**
 * Get line change statistics from git numstat
 */
async function getAuthorLines(git: SimpleGit, filePath: string): Promise<Map<string, number>> {
  const authorLines = new Map<string, number>();
  try {
    const numstat = await git.raw(['log', '--numstat', '--format=%ae', '--', filePath]);

    let currentAuthor = '';
    for (const line of numstat.split('\n')) {
      if (line.includes('@')) {
        currentAuthor = line.trim();
      } else if (line.match(/^\d+\s+\d+/)) {
        const match = line.match(/^(\d+)\s+(\d+)/);
        if (match && currentAuthor) {
          const added = parseInt(match[1], 10) || 0;
          const removed = parseInt(match[2], 10) || 0;
          authorLines.set(currentAuthor, (authorLines.get(currentAuthor) || 0) + added + removed);
        }
      }
    }
  } catch {
    // Fallback: use commit count estimate
  }
  return authorLines;
}

/**
 * Build expert list from author stats
 */
function buildExpertList(
  authorStats: Map<string, { name: string; email: string; commits: number; lastTouch: string }>,
  authorLines: Map<string, number>,
  totalCommits: number
): Expert[] {
  const experts: Expert[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const [email, stats] of authorStats.entries()) {
    const commitPercentage = stats.commits / totalCommits;
    const linesChanged = authorLines.get(email) || stats.commits * 20;
    const recentActivity = new Date(stats.lastTouch) > thirtyDaysAgo;

    let expertise: Expert['expertise'];
    if (commitPercentage >= 0.5) {
      expertise = 'primary';
    } else if (commitPercentage >= 0.2) {
      expertise = 'significant';
    } else {
      expertise = 'contributor';
    }

    experts.push({
      name: stats.name,
      email: stats.email,
      commits: stats.commits,
      linesChanged,
      lastTouch: stats.lastTouch,
      expertise,
      recentActivity,
    });
  }

  // Sort by expertise level, then commits
  experts.sort((a, b) => {
    const order = { primary: 0, significant: 1, contributor: 2 };
    if (order[a.expertise] !== order[b.expertise]) {
      return order[a.expertise] - order[b.expertise];
    }
    return b.commits - a.commits;
  });

  return experts;
}

/**
 * Find experts for related files
 */
async function findRelatedExperts(
  git: SimpleGit,
  graph: KnowledgeGraph,
  filePath: string,
  primaryExperts: Expert[]
): Promise<Array<{ file: string; expert: string; reason: string }>> {
  const relatedExperts: Array<{ file: string; expert: string; reason: string }> = [];

  // Find related files from graph edges
  const relatedFiles: string[] = [];
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode?.filePath === filePath && targetNode) {
        relatedFiles.push(targetNode.filePath);
      } else if (targetNode?.filePath === filePath && sourceNode) {
        relatedFiles.push(sourceNode.filePath);
      }
    }
  }

  // Get top expert for each related file (limit to 3)
  for (const relatedFile of relatedFiles.slice(0, 3)) {
    try {
      const relatedLog = await git.log({ file: relatedFile, maxCount: 20 });

      if (relatedLog.total > 0) {
        // Find most frequent author
        const authorCounts = new Map<string, number>();
        for (const commit of relatedLog.all) {
          authorCounts.set(commit.author_name, (authorCounts.get(commit.author_name) || 0) + 1);
        }

        const topAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topAuthor && !primaryExperts.find((e) => e.name === topAuthor[0])) {
          relatedExperts.push({
            file: relatedFile,
            expert: topAuthor[0],
            reason: `Expert on related file (${topAuthor[1]} commits)`,
          });
        }
      }
    } catch {
      // Skip this related file
    }
  }

  return relatedExperts;
}

/**
 * Generate suggestions based on expert analysis
 */
function generateSuggestions(experts: Expert[]): string[] {
  const suggestions: string[] = [];

  if (experts.length === 0) {
    suggestions.push('No contributors found for this file.');
    return suggestions;
  }

  const primary = experts.find((e) => e.expertise === 'primary');
  if (primary) {
    suggestions.push(`${primary.name} is the primary expert - start with them.`);
  }

  const recentExperts = experts.filter((e) => e.recentActivity);
  if (recentExperts.length > 0 && recentExperts[0] !== primary) {
    suggestions.push(`${recentExperts[0].name} has been active recently.`);
  }

  if (experts.length === 1) {
    suggestions.push('⚠️ Single point of knowledge - consider pairing.');
  }

  if (experts.every((e) => !e.recentActivity)) {
    suggestions.push('⚠️ No recent activity - knowledge may be stale.');
  }

  return suggestions;
}

/**
 * Find experts for a file - refactored from monolithic function
 */
export async function findExperts(
  rootDir: string,
  filePath: string,
  graph: KnowledgeGraph
): Promise<WhoResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      filePath,
      exists: false,
      experts: [],
      relatedExperts: [],
      suggestions: ['This is not a git repository.'],
    };
  }

  // Check if file exists in graph
  const fileNode = Object.values(graph.nodes).find(
    (n) => n.type === 'file' && (n.filePath === filePath || n.filePath.endsWith(filePath))
  );

  const actualPath = fileNode?.filePath || filePath;

  try {
    // Get author statistics
    const authorStats = await getAuthorStats(git, actualPath);

    if (authorStats.size === 0) {
      return {
        filePath: actualPath,
        exists: false,
        experts: [],
        relatedExperts: [],
        suggestions: [`No git history found for ${actualPath}`],
      };
    }

    // Get line statistics
    const authorLines = await getAuthorLines(git, actualPath);

    // Build expert list
    const totalCommits = [...authorStats.values()].reduce((sum, s) => sum + s.commits, 0);
    const experts = buildExpertList(authorStats, authorLines, totalCommits);

    // Find related experts
    const relatedExperts = await findRelatedExperts(git, graph, actualPath, experts);

    // Generate suggestions
    const suggestions = generateSuggestions(experts);

    return {
      filePath: actualPath,
      exists: true,
      experts: experts.slice(0, 5),
      relatedExperts: relatedExperts.slice(0, 3),
      suggestions,
    };
  } catch (error) {
    return {
      filePath: actualPath,
      exists: false,
      experts: [],
      relatedExperts: [],
      suggestions: [`Error analyzing file: ${error instanceof Error ? error.message : 'Unknown'}`],
    };
  }
}

/**
 * Format who result for display
 */
export function formatWho(result: WhoResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  👤 WHO KNOWS THIS CODE?                         ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');
  lines.push(`File: ${result.filePath}`);
  lines.push('');

  if (!result.exists || result.experts.length === 0) {
    lines.push('No experts found for this file.');
    if (result.suggestions.length > 0) {
      lines.push('');
      for (const suggestion of result.suggestions) {
        lines.push(`  ${suggestion}`);
      }
    }
    return lines.join('\n');
  }

  lines.push('EXPERTS');
  lines.push('─'.repeat(50));

  for (let i = 0; i < result.experts.length; i++) {
    const expert = result.experts[i];
    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const badge =
      expert.expertise === 'primary'
        ? '⭐ Primary'
        : expert.expertise === 'significant'
          ? '📌 Significant'
          : '👤 Contributor';

    const lastTouchDate = new Date(expert.lastTouch).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    lines.push(`${rank} ${expert.name}`);
    lines.push(`   ${badge} | ${expert.commits} commits | ~${expert.linesChanged} lines`);
    lines.push(`   Last touch: ${lastTouchDate}${expert.recentActivity ? ' (recent)' : ''}`);
    lines.push('');
  }

  if (result.relatedExperts.length > 0) {
    lines.push('RELATED EXPERTS');
    lines.push('─'.repeat(50));
    for (const related of result.relatedExperts) {
      lines.push(`  ${related.expert}`);
      lines.push(`    ${related.reason}`);
      lines.push(`    File: ${related.file}`);
      lines.push('');
    }
  }

  if (result.suggestions.length > 0) {
    lines.push('SUGGESTIONS');
    lines.push('─'.repeat(50));
    for (const suggestion of result.suggestions) {
      lines.push(`  💡 ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(51));

  return lines.join('\n');
}
