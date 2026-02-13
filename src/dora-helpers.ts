/**
 * Helper functions for DORA metrics calculation - extracted from calculateDora
 * Each function handles a distinct phase of DORA metric computation
 */

import type { SimpleGit } from 'simple-git';

/**
 * Get deployment/tag information for the analysis period
 */
export async function getDeployments(
  git: SimpleGit,
  startDate: Date,
  endDate: Date
): Promise<{ count: number; times: Date[] }> {
  const deployTimes: Date[] = [];
  let deployCount = 0;

  try {
    const tags = await git.tags();

    for (const tag of tags.all) {
      try {
        const tagInfo = await git.raw(['log', '-1', '--format=%aI', tag]);
        const tagDate = new Date(tagInfo.trim());
        if (tagDate >= startDate && tagDate <= endDate) {
          deployCount++;
          deployTimes.push(tagDate);
        }
      } catch {
        // Skip tags we can't parse
      }
    }
  } catch {
    // Ignore errors
  }

  return { count: deployCount, times: deployTimes };
}

/**
 * Calculate lead times - time from commit to deployment
 */
export async function calculateLeadTimes(
  git: SimpleGit,
  tags: any,
  since: string,
  startDate: Date,
  endDate: Date
): Promise<number[]> {
  const leadTimes: number[] = [];

  try {
    for (const tag of tags.all) {
      try {
        const tagDateStr = await git.raw(['log', '-1', '--format=%aI', tag]);
        const tagDate = new Date(tagDateStr.trim());

        if (tagDate >= startDate && tagDate <= endDate) {
          // Get commits in this tag that aren't in previous tag
          const prevTag = await git
            .raw(['describe', '--tags', '--abbrev=0', `${tag}^`])
            .catch(() => '');
          const range = prevTag.trim() ? `${prevTag.trim()}..${tag}` : tag;

          try {
            const commits = await git.raw(['log', '--format=%H %aI', range]);
            for (const line of commits.trim().split('\n')) {
              if (!line) continue;
              const [hash, dateStr] = line.split(' ');
              if (hash && dateStr) {
                const commitDate = new Date(dateStr);
                const leadTimeHours = (tagDate.getTime() - commitDate.getTime()) / (1000 * 60 * 60);
                if (leadTimeHours >= 0 && leadTimeHours < 24 * 365) {
                  leadTimes.push(leadTimeHours);
                }
              }
            }
          } catch {
            // Skip if we can't get commits for this range
          }
        }
      } catch {
        // Skip tags we can't analyze
      }
    }
  } catch {
    // Ignore errors
  }

  return leadTimes;
}

/**
 * Analyze changes for failure rate and change statistics
 */
export function analyzeChangeFailures(commits: Array<{ message: string; refs?: string }>): {
  reverts: number;
  merges: number;
} {
  let revertCount = 0;
  let mergeCount = 0;

  for (const commit of commits) {
    const msg = commit.message.toLowerCase();

    // Count reverts
    if (msg.startsWith('revert') || msg.includes('revert "')) {
      revertCount++;
    }

    // Count merges to base branch
    if (
      msg.startsWith('merge') ||
      commit.refs?.includes('main') ||
      commit.refs?.includes('master')
    ) {
      mergeCount++;
    }
  }

  return { reverts: revertCount, merges: mergeCount };
}

/**
 * Calculate Mean Time To Recovery from revert patterns
 */
export function calculateMTTR(commits: Array<{ date: string; message: string }>): number[] {
  const recoveryTimes: number[] = [];

  // Sort commits chronologically
  const sortedCommits = [...commits].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Find revert-fix patterns
  for (let i = 0; i < sortedCommits.length; i++) {
    const commit = sortedCommits[i];
    if (commit.message.toLowerCase().includes('revert')) {
      // Look for fix commit within the next 50 commits
      for (let j = i + 1; j < Math.min(i + 50, sortedCommits.length); j++) {
        const nextCommit = sortedCommits[j];
        const nextMsg = nextCommit.message.toLowerCase();

        if (
          nextMsg.includes('fix') ||
          nextMsg.includes('hotfix') ||
          nextMsg.includes('patch') ||
          nextMsg.includes('restore')
        ) {
          const revertDate = new Date(commit.date);
          const fixDate = new Date(nextCommit.date);
          const recoveryHours = (fixDate.getTime() - revertDate.getTime()) / (1000 * 60 * 60);

          if (recoveryHours > 0 && recoveryHours < 24 * 30) {
            recoveryTimes.push(recoveryHours);
          }
          break;
        }
      }
    }
  }

  return recoveryTimes;
}

/**
 * Calculate aggregate metrics from raw values
 */
export interface AggregateMetricsInput {
  deployCount: number;
  weeksAnalyzed: number;
  leadTimes: number[];
  commitCount: number;
  revertCount: number;
  mergeCount: number;
  recoveryTimes: number[];
}

export interface AggregateMetrics {
  deploysPerWeek: number;
  avgLeadTime: number;
  failureRate: number;
  avgMTTR: number;
}

export function aggregateMetrics(input: AggregateMetricsInput): AggregateMetrics {
  const {
    deployCount,
    weeksAnalyzed,
    leadTimes,
    commitCount,
    revertCount,
    mergeCount,
    recoveryTimes,
  } = input;

  // Deployment frequency
  const deploysPerWeek = deployCount / weeksAnalyzed;

  // Average lead time
  let avgLeadTime = 0;
  if (leadTimes.length > 0) {
    avgLeadTime = leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length;
  } else if (commitCount > 0 && deployCount > 0) {
    // Estimate if no data
    const hoursInPeriod = weeksAnalyzed * 7 * 24;
    avgLeadTime = hoursInPeriod / deployCount / 2;
  }

  // Change failure rate
  const totalChanges = Math.max(mergeCount, deployCount, 1);
  const failureRate = (revertCount / totalChanges) * 100;

  // MTTR
  let avgMTTR = 0;
  if (recoveryTimes.length > 0) {
    avgMTTR = recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length;
  } else if (revertCount > 0) {
    // Estimate if we have reverts but can't find recovery
    avgMTTR = 24;
  }

  return {
    deploysPerWeek,
    avgLeadTime,
    failureRate,
    avgMTTR,
  };
}
