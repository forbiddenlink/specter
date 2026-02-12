/**
 * DORA Metrics - DevOps Research & Assessment
 *
 * Industry-standard metrics for measuring software delivery performance:
 * 1. Deployment Frequency - How often code is deployed
 * 2. Lead Time for Changes - Time from commit to deploy
 * 3. Change Failure Rate - % of deployments causing failures
 * 4. Mean Time to Recovery - Time to recover from failures
 */

import { simpleGit, type SimpleGit } from 'simple-git';

// Types
export type PerformanceLevel = 'elite' | 'high' | 'medium' | 'low';

export interface DoraMetric {
  value: number;
  level: PerformanceLevel;
  description: string;
}

export interface DoraMetrics {
  deploymentFrequency: DoraMetric;
  leadTimeForChanges: DoraMetric;
  changeFailureRate: DoraMetric;
  meanTimeToRecovery: DoraMetric;
  overallLevel: PerformanceLevel;
  period: { start: Date; end: Date };
  rawData: {
    deployCount: number;
    commitCount: number;
    revertCount: number;
    mergeCount: number;
    weeksAnalyzed: number;
  };
}

// DORA benchmarks based on research
const BENCHMARKS = {
  deploymentFrequency: {
    elite: 7, // Multiple per day = 7+ per week
    high: 1, // Weekly
    medium: 0.25, // Monthly (1/4 per week)
    // Low = less than monthly
  },
  leadTimeForChanges: {
    elite: 1, // < 1 hour
    high: 24 * 7, // < 1 week (in hours)
    medium: 24 * 30, // < 1 month (in hours)
    // Low = > 1 month
  },
  changeFailureRate: {
    elite: 5, // < 5%
    high: 10, // < 10%
    medium: 15, // < 15%
    // Low = > 15%
  },
  meanTimeToRecovery: {
    elite: 1, // < 1 hour
    high: 24, // < 1 day (in hours)
    medium: 24 * 7, // < 1 week (in hours)
    // Low = > 1 week
  },
};

/**
 * Determine performance level for deployment frequency
 */
function getDeployFrequencyLevel(deploysPerWeek: number): PerformanceLevel {
  if (deploysPerWeek >= BENCHMARKS.deploymentFrequency.elite) return 'elite';
  if (deploysPerWeek >= BENCHMARKS.deploymentFrequency.high) return 'high';
  if (deploysPerWeek >= BENCHMARKS.deploymentFrequency.medium) return 'medium';
  return 'low';
}

/**
 * Determine performance level for lead time
 */
function getLeadTimeLevel(hours: number): PerformanceLevel {
  if (hours <= BENCHMARKS.leadTimeForChanges.elite) return 'elite';
  if (hours <= BENCHMARKS.leadTimeForChanges.high) return 'high';
  if (hours <= BENCHMARKS.leadTimeForChanges.medium) return 'medium';
  return 'low';
}

/**
 * Determine performance level for change failure rate
 */
function getFailureRateLevel(percentage: number): PerformanceLevel {
  if (percentage <= BENCHMARKS.changeFailureRate.elite) return 'elite';
  if (percentage <= BENCHMARKS.changeFailureRate.high) return 'high';
  if (percentage <= BENCHMARKS.changeFailureRate.medium) return 'medium';
  return 'low';
}

/**
 * Determine performance level for MTTR
 */
function getMTTRLevel(hours: number): PerformanceLevel {
  if (hours <= BENCHMARKS.meanTimeToRecovery.elite) return 'elite';
  if (hours <= BENCHMARKS.meanTimeToRecovery.high) return 'high';
  if (hours <= BENCHMARKS.meanTimeToRecovery.medium) return 'medium';
  return 'low';
}

/**
 * Get human-readable description for deployment frequency
 */
function getDeployFrequencyDescription(deploysPerWeek: number): string {
  if (deploysPerWeek >= 7) return 'Multiple per day';
  if (deploysPerWeek >= 5) return 'Daily';
  if (deploysPerWeek >= 1) return 'Weekly';
  if (deploysPerWeek >= 0.25) return 'Monthly';
  if (deploysPerWeek > 0) return 'Quarterly';
  return 'No deployments';
}

/**
 * Get human-readable description for lead time
 */
function getLeadTimeDescription(hours: number): string {
  if (hours < 1) return '< 1 hour';
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 7) return `${days.toFixed(1)} days`;
  const weeks = days / 7;
  if (weeks < 4) return `${weeks.toFixed(1)} weeks`;
  const months = days / 30;
  return `${months.toFixed(1)} months`;
}

/**
 * Get human-readable description for failure rate
 */
function getFailureRateDescription(percentage: number): string {
  if (percentage === 0) return 'No failures detected';
  if (percentage < 5) return `${percentage.toFixed(1)}% (Excellent)`;
  if (percentage < 10) return `${percentage.toFixed(1)}% (Good)`;
  if (percentage < 15) return `${percentage.toFixed(1)}% (Moderate)`;
  return `${percentage.toFixed(1)}% (Needs improvement)`;
}

/**
 * Get human-readable description for MTTR
 */
function getMTTRDescription(hours: number): string {
  if (hours === 0) return 'No recoveries needed';
  if (hours < 1) return '< 1 hour';
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  const days = hours / 24;
  if (days < 7) return `${days.toFixed(1)} days`;
  return `${(days / 7).toFixed(1)} weeks`;
}

/**
 * Calculate overall performance level from individual metrics
 */
function calculateOverallLevel(metrics: {
  deploymentFrequency: DoraMetric;
  leadTimeForChanges: DoraMetric;
  changeFailureRate: DoraMetric;
  meanTimeToRecovery: DoraMetric;
}): PerformanceLevel {
  const levels: PerformanceLevel[] = [
    metrics.deploymentFrequency.level,
    metrics.leadTimeForChanges.level,
    metrics.changeFailureRate.level,
    metrics.meanTimeToRecovery.level,
  ];

  const levelScores: Record<PerformanceLevel, number> = {
    elite: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const avgScore =
    levels.reduce((sum, level) => sum + levelScores[level], 0) / levels.length;

  if (avgScore >= 3.5) return 'elite';
  if (avgScore >= 2.5) return 'high';
  if (avgScore >= 1.5) return 'medium';
  return 'low';
}

/**
 * Parse time period string (e.g., "6 months ago")
 */
function parsePeriod(since: string): Date {
  const sinceDate = new Date();
  const match = since.match(/(\d+)\s*(month|week|day|year)s?\s*ago/i);

  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'day':
        sinceDate.setDate(sinceDate.getDate() - amount);
        break;
      case 'week':
        sinceDate.setDate(sinceDate.getDate() - amount * 7);
        break;
      case 'month':
        sinceDate.setMonth(sinceDate.getMonth() - amount);
        break;
      case 'year':
        sinceDate.setFullYear(sinceDate.getFullYear() - amount);
        break;
    }
  }

  return sinceDate;
}

/**
 * Calculate DORA metrics from git history
 */
export async function calculateDora(
  rootDir: string,
  options: { since?: string } = {}
): Promise<DoraMetrics> {
  const git: SimpleGit = simpleGit(rootDir);
  const since = options.since || '6 months ago';
  const startDate = parsePeriod(since);
  const endDate = new Date();

  // Calculate weeks in analysis period
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksAnalyzed = Math.max(
    1,
    (endDate.getTime() - startDate.getTime()) / msPerWeek
  );

  // Initialize raw data
  let deployCount = 0;
  let commitCount = 0;
  let revertCount = 0;
  let mergeCount = 0;
  const deployTimes: Date[] = [];
  const leadTimes: number[] = [];
  const recoveryTimes: number[] = [];

  try {
    // 1. Get tags/releases for deployment frequency
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

    // 2. Get all commits for lead time calculation
    const log = await git.log({
      '--since': since,
      format: {
        hash: '%H',
        date: '%aI',
        message: '%s',
        refs: '%D',
      },
    });

    commitCount = log.all.length;

    // Track commits that became part of releases
    const tagCommits = new Map<string, Date>();

    // For each tag, find when its commits were first authored
    for (const tag of tags.all) {
      try {
        const tagDateStr = await git.raw(['log', '-1', '--format=%aI', tag]);
        const tagDate = new Date(tagDateStr.trim());

        if (tagDate >= startDate && tagDate <= endDate) {
          // Get commits in this tag that aren't in previous tag
          const prevTag = await git.raw(['describe', '--tags', '--abbrev=0', `${tag}^`]).catch(() => '');
          const range = prevTag.trim() ? `${prevTag.trim()}..${tag}` : tag;

          try {
            const commits = await git.raw(['log', '--format=%H %aI', range]);
            for (const line of commits.trim().split('\n')) {
              if (!line) continue;
              const [hash, dateStr] = line.split(' ');
              if (hash && dateStr) {
                const commitDate = new Date(dateStr);
                const leadTimeHours =
                  (tagDate.getTime() - commitDate.getTime()) / (1000 * 60 * 60);
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

    // 3. Count reverts and merges for change failure rate
    for (const commit of log.all) {
      const msg = commit.message.toLowerCase();

      // Count reverts
      if (msg.startsWith('revert') || msg.includes('revert "')) {
        revertCount++;

        // Try to find the recovery time (time between original commit and revert)
        // This is a simplification - in reality we'd need to find the original commit
        // For now, estimate based on typical patterns
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

    // 4. Estimate MTTR from revert patterns
    // Look for revert -> fix patterns
    const sortedCommits = [...log.all].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

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
            const recoveryHours =
              (fixDate.getTime() - revertDate.getTime()) / (1000 * 60 * 60);

            if (recoveryHours > 0 && recoveryHours < 24 * 30) {
              recoveryTimes.push(recoveryHours);
            }
            break;
          }
        }
      }
    }
  } catch (error) {
    // Not a git repo or other error - return defaults
  }

  // Calculate metrics
  const deploysPerWeek = deployCount / weeksAnalyzed;

  // Average lead time (or estimate if no data)
  let avgLeadTime = 0;
  if (leadTimes.length > 0) {
    avgLeadTime = leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length;
  } else if (commitCount > 0 && deployCount > 0) {
    // Estimate: commits spread across deploys
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
    // Estimate based on typical patterns
    avgMTTR = 24; // Default to 1 day if we have reverts but can't find recovery
  }

  // Build metrics
  const deploymentFrequency: DoraMetric = {
    value: Math.round(deploysPerWeek * 100) / 100,
    level: getDeployFrequencyLevel(deploysPerWeek),
    description: getDeployFrequencyDescription(deploysPerWeek),
  };

  const leadTimeForChanges: DoraMetric = {
    value: Math.round(avgLeadTime * 10) / 10,
    level: getLeadTimeLevel(avgLeadTime),
    description: getLeadTimeDescription(avgLeadTime),
  };

  const changeFailureRate: DoraMetric = {
    value: Math.round(failureRate * 10) / 10,
    level: getFailureRateLevel(failureRate),
    description: getFailureRateDescription(failureRate),
  };

  const meanTimeToRecovery: DoraMetric = {
    value: Math.round(avgMTTR * 10) / 10,
    level: getMTTRLevel(avgMTTR),
    description: getMTTRDescription(avgMTTR),
  };

  return {
    deploymentFrequency,
    leadTimeForChanges,
    changeFailureRate,
    meanTimeToRecovery,
    overallLevel: calculateOverallLevel({
      deploymentFrequency,
      leadTimeForChanges,
      changeFailureRate,
      meanTimeToRecovery,
    }),
    period: { start: startDate, end: endDate },
    rawData: {
      deployCount,
      commitCount,
      revertCount,
      mergeCount,
      weeksAnalyzed: Math.round(weeksAnalyzed * 10) / 10,
    },
  };
}

/**
 * Get level emoji
 */
function getLevelEmoji(level: PerformanceLevel): string {
  switch (level) {
    case 'elite':
      return '\u2B50'; // star
    case 'high':
      return '\uD83D\uDFE2'; // green circle
    case 'medium':
      return '\uD83D\uDFE1'; // yellow circle
    case 'low':
      return '\uD83D\uDD34'; // red circle
  }
}

/**
 * Get level display text
 */
function getLevelText(level: PerformanceLevel): string {
  switch (level) {
    case 'elite':
      return 'ELITE';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
  }
}

/**
 * Get overall level display
 */
function getOverallDisplay(level: PerformanceLevel): string {
  switch (level) {
    case 'elite':
      return '\u2B50 ELITE PERFORMER';
    case 'high':
      return '\uD83D\uDFE2 HIGH PERFORMER';
    case 'medium':
      return '\uD83D\uDFE1 MEDIUM PERFORMER';
    case 'low':
      return '\uD83D\uDD34 LOW PERFORMER';
  }
}

/**
 * Calculate progress to elite level
 */
function calculateEliteProgress(metrics: DoraMetrics): number {
  const levels: PerformanceLevel[] = [
    metrics.deploymentFrequency.level,
    metrics.leadTimeForChanges.level,
    metrics.changeFailureRate.level,
    metrics.meanTimeToRecovery.level,
  ];

  const levelScores: Record<PerformanceLevel, number> = {
    elite: 100,
    high: 75,
    medium: 50,
    low: 25,
  };

  const avgScore =
    levels.reduce((sum, level) => sum + levelScores[level], 0) / levels.length;

  return Math.round(avgScore);
}

/**
 * Format DORA metrics for display
 */
export function formatDora(metrics: DoraMetrics): string {
  const lines: string[] = [];

  // Header
  lines.push('\u250F' + '\u2501'.repeat(51) + '\u2513');
  lines.push('\u2503  \uD83D\uDCCA DORA METRICS                                    \u2503');
  lines.push('\u2517' + '\u2501'.repeat(51) + '\u251B');
  lines.push('');

  // Overall performance
  lines.push(`Overall Performance: ${getOverallDisplay(metrics.overallLevel)}`);
  lines.push('');

  // Metrics table - column widths
  const labelWidth = 23; // Width for metric labels
  const valueWidth = 18; // Width for value column

  lines.push('                          Your Team        Elite Target');
  lines.push('  ' + '\u2500'.repeat(53));

  // Helper to truncate/pad values
  const formatValue = (val: string): string => {
    if (val.length > valueWidth) {
      return val.slice(0, valueWidth - 1) + '\u2026'; // ellipsis
    }
    return val.padEnd(valueWidth);
  };

  // Deployment Frequency
  const dfEmoji = getLevelEmoji(metrics.deploymentFrequency.level);
  const dfValue =
    metrics.deploymentFrequency.value >= 1
      ? `${metrics.deploymentFrequency.value}/week`
      : `${(metrics.deploymentFrequency.value * 4).toFixed(1)}/month`;
  lines.push(
    `  ${dfEmoji} Deployment Frequency   ${formatValue(dfValue)}Multiple/day`
  );

  // Lead Time
  const ltEmoji = getLevelEmoji(metrics.leadTimeForChanges.level);
  const ltValue = metrics.leadTimeForChanges.description;
  lines.push(
    `  ${ltEmoji} Lead Time for Changes  ${formatValue(ltValue)}< 1 hour`
  );

  // Change Failure Rate
  const cfrEmoji = getLevelEmoji(metrics.changeFailureRate.level);
  const cfrValue = `${metrics.changeFailureRate.value}%`;
  lines.push(
    `  ${cfrEmoji} Change Failure Rate    ${formatValue(cfrValue)}< 5%`
  );

  // MTTR
  const mttrEmoji = getLevelEmoji(metrics.meanTimeToRecovery.level);
  const mttrValue = metrics.meanTimeToRecovery.description;
  lines.push(
    `  ${mttrEmoji} Mean Time to Recovery  ${formatValue(mttrValue)}< 1 hour`
  );

  lines.push('');

  // Progress bar to elite
  const progress = calculateEliteProgress(metrics);
  const barWidth = 20;
  const filled = Math.round((progress / 100) * barWidth);
  const empty = barWidth - filled;
  const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  lines.push(`  [${progressBar}] ${progress}% to Elite`);
  lines.push('');

  // Period info
  const fromDate = metrics.period.start.toLocaleDateString();
  const toDate = metrics.period.end.toLocaleDateString();
  lines.push('\u2500'.repeat(53));
  lines.push(`Period: ${fromDate} - ${toDate} (${metrics.rawData.weeksAnalyzed} weeks)`);
  lines.push('');

  // Raw data summary
  lines.push('Data Summary:');
  lines.push(`  Deploys/Tags: ${metrics.rawData.deployCount}`);
  lines.push(`  Commits: ${metrics.rawData.commitCount}`);
  lines.push(`  Reverts: ${metrics.rawData.revertCount}`);
  lines.push(`  Merges: ${metrics.rawData.mergeCount}`);
  lines.push('');

  // Tips based on weakest area
  lines.push('Recommendations:');

  const weakAreas: { metric: string; level: PerformanceLevel; tip: string }[] = [
    {
      metric: 'Deployment Frequency',
      level: metrics.deploymentFrequency.level,
      tip: 'Consider implementing CI/CD automation and smaller batch sizes.',
    },
    {
      metric: 'Lead Time',
      level: metrics.leadTimeForChanges.level,
      tip: 'Reduce WIP, improve review processes, and automate testing.',
    },
    {
      metric: 'Change Failure Rate',
      level: metrics.changeFailureRate.level,
      tip: 'Add more automated testing and implement feature flags.',
    },
    {
      metric: 'MTTR',
      level: metrics.meanTimeToRecovery.level,
      tip: 'Improve monitoring, alerting, and rollback capabilities.',
    },
  ];

  // Sort by level (worst first)
  const levelOrder: Record<PerformanceLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    elite: 4,
  };

  weakAreas.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // Show tips for non-elite metrics
  const tipsShown = weakAreas.filter((a) => a.level !== 'elite').slice(0, 2);

  if (tipsShown.length === 0) {
    lines.push('  \u2728 All metrics at elite level! Keep up the great work.');
  } else {
    for (const area of tipsShown) {
      lines.push(`  \u2022 ${area.metric}: ${area.tip}`);
    }
  }

  lines.push('');

  return lines.join('\n');
}
