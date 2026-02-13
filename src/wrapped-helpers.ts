/**
 * Helper functions for wrapped analysis - extracted from gatherWrappedData
 * Each function handles a single concern in the wrapped data gathering process
 */

import type { DefaultLogFields, SimpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

/**
 * Fetch commits for the given period
 */
export async function fetchPeriodCommits(
  git: SimpleGit,
  range: { start: Date; end: Date }
): Promise<
  Array<{
    hash: string;
    date: string;
    author: string;
    message: string;
  }>
> {
  const afterDate = new Date(range.start);
  afterDate.setDate(afterDate.getDate() - 1);
  const beforeDate = new Date(range.end);
  beforeDate.setDate(beforeDate.getDate() + 1);

  const log = await git.log({
    '--after': afterDate.toISOString().split('T')[0],
    '--before': beforeDate.toISOString().split('T')[0],
  });

  return log.all.map((c: DefaultLogFields) => ({
    hash: c.hash,
    date: c.date,
    author: c.author_name,
    message: c.message,
  }));
}

/**
 * Analyze contributor statistics from commits
 */
export function analyzeContributors(
  commits: Array<{ author: string }>
): Array<{ name: string; commits: number; percentage: number }> {
  const contributorCounts = new Map<string, number>();
  for (const commit of commits) {
    contributorCounts.set(commit.author, (contributorCounts.get(commit.author) || 0) + 1);
  }

  return [...contributorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      commits: count,
      percentage: Math.round((count / commits.length) * 100),
    }));
}

/**
 * Analyze which files changed most frequently
 */
export async function analyzeFileChanges(
  git: SimpleGit,
  commits: Array<{ hash: string }>,
  getFileNickname: (path: string) => string
): Promise<{
  topFiles: Array<{ path: string; commits: number; nickname: string }>;
  totalFilesChanged: number;
}> {
  const fileCounts = new Map<string, number>();

  for (const commit of commits.slice(0, 500)) {
    // Limit to avoid too many git calls
    try {
      const diff = await git.raw(['diff-tree', '--no-commit-id', '--name-only', '-r', commit.hash]);
      const files = diff.trim().split('\n').filter(Boolean);
      for (const file of files) {
        fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
      }
    } catch {
      // Ignore individual commit errors
    }
  }

  const topFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({
      path,
      commits: count,
      nickname: getFileNickname(path),
    }));

  return {
    topFiles,
    totalFilesChanged: fileCounts.size,
  };
}

/**
 * Analyze time-based commit patterns
 */
export function analyzeTimePatterns(commits: Array<{ date: string }>): {
  monthCounts: Map<string, number>;
  dayCounts: Map<string, number>;
  hourCounts: Map<number, number>;
  lateNightCommits: number;
  weekendCommits: number;
} {
  const monthCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  let lateNightCommits = 0;
  let weekendCommits = 0;

  for (const commit of commits) {
    const date = new Date(commit.date);
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    dayCounts.set(
      date.toISOString().split('T')[0],
      (dayCounts.get(date.toISOString().split('T')[0]) || 0) + 1
    );
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    if (hour >= 0 && hour < 5) lateNightCommits++;
    if (dayOfWeek === 0 || dayOfWeek === 6) weekendCommits++;
  }

  return {
    monthCounts,
    dayCounts,
    hourCounts,
    lateNightCommits,
    weekendCommits,
  };
}

/**
 * Get top entry from counts map
 */
export function getTopEntry<K>(counts: Map<K, number>): [K, number] | null {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Analyze lines of code added/removed
 */
export async function analyzeLinesChanged(
  git: SimpleGit,
  targetYear: number
): Promise<{ added: number; removed: number }> {
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;

  try {
    const stats = await git.raw([
      'log',
      '--numstat',
      '--format=',
      `--after=${targetYear - 1}-12-31`,
      `--before=${targetYear + 1}-01-01`,
    ]);

    for (const line of stats.split('\n')) {
      const match = line.match(/^(\d+)\s+(\d+)/);
      if (match) {
        totalLinesAdded += parseInt(match[1], 10) || 0;
        totalLinesRemoved += parseInt(match[2], 10) || 0;
      }
    }
  } catch {
    // Ignore errors
  }

  return {
    added: totalLinesAdded,
    removed: totalLinesRemoved,
  };
}

/**
 * Analyze language distribution from knowledge graph
 */
export function analyzeLanguages(
  graph: KnowledgeGraph
): Array<{ lang: string; percentage: number }> {
  const langEntries = Object.entries(graph.metadata.languages as Record<string, number>).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );
  const totalLangFiles = langEntries.reduce((sum, [, count]) => sum + (count as number), 0);

  return langEntries.slice(0, 3).map(([lang, count]) => ({
    lang,
    percentage: Math.round(((count as number) / totalLangFiles) * 100),
  }));
}
