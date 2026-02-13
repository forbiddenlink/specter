/**
 * Leaderboard - Team Gamification Stats
 *
 * Analyzes git history to rank contributors by their impact on codebase health.
 * Tracks who's improving vs degrading the codebase through:
 * - Complexity changes (reduced = good, increased = bad)
 * - Commit activity
 * - Bus factor improvements (knowledge sharing)
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface ContributorStats {
  email: string;
  name: string;
  commits: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  complexityDelta: number; // negative = improved (reduced complexity)
  busFactor: number; // areas where they share ownership
  lastActive: Date;
}

export interface LeaderboardEntry {
  rank: number;
  email: string;
  name: string;
  points: number;
  title: string;
  commits: number;
  complexityDelta: number;
  busFactor: number;
  progressBar: string;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  teamStats: {
    totalCommits: number;
    netComplexity: number;
    activeContributors: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  timeRange: {
    since: Date;
    until: Date;
  };
}

export interface LeaderboardOptions {
  since?: string;
  limit?: number;
}

// Scoring constants
const POINTS_PER_COMMIT = 10;
const POINTS_PER_COMPLEXITY_REDUCED = 5;
const POINTS_PER_COMPLEXITY_ADDED = -5;
const POINTS_PER_BUS_FACTOR = 50;

// Title thresholds and names
const TITLES = [
  { minPoints: 800, title: 'Health Hero' },
  { minPoints: 500, title: 'Code Guardian' },
  { minPoints: 300, title: 'Hotspot Hunter' },
  { minPoints: 100, title: 'Rising Star' },
  { minPoints: 0, title: 'Apprentice' },
];

/**
 * Get title based on points
 */
function getTitle(points: number): string {
  for (const tier of TITLES) {
    if (points >= tier.minPoints) {
      return tier.title;
    }
  }
  return 'Apprentice';
}

/**
 * Generate progress bar
 */
function generateProgressBar(points: number, maxPoints: number): string {
  const width = 20;
  const filled = Math.min(Math.round((points / Math.max(maxPoints, 1)) * width), width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

/**
 * Parse date string like "30 days ago" or ISO date
 */
function parseSince(since: string): Date {
  const date = new Date();
  const match = since.match(/(\d+)\s*(day|week|month|year)s?\s*ago/i);

  if (match?.[1] && match[2]) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 'day':
        date.setDate(date.getDate() - amount);
        break;
      case 'week':
        date.setDate(date.getDate() - amount * 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - amount);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - amount);
        break;
    }
  } else {
    // Try to parse as ISO date
    const parsed = new Date(since);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return date;
}

/**
 * Estimate complexity change from diff stats
 * This is a heuristic based on typical patterns
 */
function estimateComplexityChange(
  linesAdded: number,
  linesRemoved: number,
  filesChanged: number
): number {
  // Net lines is a rough proxy for complexity
  // Removing more than adding = reducing complexity
  const netLines = linesAdded - linesRemoved;

  // Normalize to a reasonable scale
  // Large additions increase complexity, large removals decrease it
  const complexityPerFile = netLines / Math.max(filesChanged, 1);

  // Scale to reasonable range (-100 to 100 per file on average)
  return Math.round(complexityPerFile / 10);
}

/**
 * Calculate bus factor contribution
 * Returns count of areas where this contributor shares ownership
 */
function calculateBusFactorContribution(
  contributorFiles: Set<string>,
  allContributorFiles: Map<string, Set<string>>
): number {
  // Count files where this contributor works with others
  let sharedAreas = 0;

  for (const file of contributorFiles) {
    // Count how many other contributors work on this file
    let otherContributors = 0;
    for (const [_email, files] of allContributorFiles) {
      if (files.has(file) && files !== contributorFiles) {
        otherContributors++;
      }
    }

    // If file has 2+ contributors, it's a shared area
    if (otherContributors >= 1) {
      sharedAreas++;
    }
  }

  // Normalize to a reasonable scale (max ~5 points)
  return Math.min(Math.floor(sharedAreas / 10), 5);
}

/**
 * Analyze git history and generate leaderboard
 */
export async function generateLeaderboard(
  rootDir: string,
  _graph: KnowledgeGraph,
  options: LeaderboardOptions = {}
): Promise<LeaderboardResult> {
  const since = options.since || '30 days ago';
  const limit = options.limit || 10;
  const sinceDate = parseSince(since);

  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      entries: [],
      teamStats: {
        totalCommits: 0,
        netComplexity: 0,
        activeContributors: 0,
        trend: 'stable',
      },
      timeRange: {
        since: sinceDate,
        until: new Date(),
      },
    };
  }

  // Get commit log with stats
  const contributorStats = new Map<string, ContributorStats>();
  const contributorFiles = new Map<string, Set<string>>();

  try {
    // Get detailed commit info with numstat
    const rawLog = await git.raw([
      'log',
      `--since=${sinceDate.toISOString()}`,
      '--numstat',
      '--format=%H|%ae|%an|%aI',
    ]);

    let currentEmail = '';
    let currentName = '';
    let currentDate = new Date();

    for (const line of rawLog.split('\n')) {
      if (line.includes('|') && line.split('|').length >= 4) {
        const parts = line.split('|');
        const emailPart = parts[1];
        const namePart = parts[2];
        const datePart = parts[3];
        if (!emailPart || !namePart || !datePart) continue;

        currentEmail = emailPart.toLowerCase();
        currentName = namePart;
        currentDate = new Date(datePart);

        // Initialize contributor if new
        if (!contributorStats.has(currentEmail)) {
          contributorStats.set(currentEmail, {
            email: currentEmail,
            name: currentName,
            commits: 0,
            filesChanged: 0,
            linesAdded: 0,
            linesRemoved: 0,
            complexityDelta: 0,
            busFactor: 0,
            lastActive: currentDate,
          });
          contributorFiles.set(currentEmail, new Set());
        }

        // Increment commit count
        const stats = contributorStats.get(currentEmail)!;
        stats.commits++;
        if (currentDate > stats.lastActive) {
          stats.lastActive = currentDate;
        }
      } else if (line.match(/^\d+\s+\d+\s+.+/) || line.match(/^-\s+-\s+.+/)) {
        // numstat line: additions deletions filename
        const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)/);
        if (match && currentEmail && match[1] && match[2] && match[3]) {
          const added = match[1] === '-' ? 0 : parseInt(match[1], 10);
          const removed = match[2] === '-' ? 0 : parseInt(match[2], 10);
          const file = match[3];

          // Only count source files
          if (file.match(/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs|cpp|c|h)$/)) {
            const stats = contributorStats.get(currentEmail)!;
            stats.linesAdded += added;
            stats.linesRemoved += removed;
            stats.filesChanged++;

            // Track files for bus factor calculation
            contributorFiles.get(currentEmail)!.add(file);
          }
        }
      }
    }
  } catch {
    // Git log failed, return empty result
    return {
      entries: [],
      teamStats: {
        totalCommits: 0,
        netComplexity: 0,
        activeContributors: 0,
        trend: 'stable',
      },
      timeRange: {
        since: sinceDate,
        until: new Date(),
      },
    };
  }

  // Calculate complexity deltas and bus factor for each contributor
  for (const [email, stats] of contributorStats) {
    stats.complexityDelta = estimateComplexityChange(
      stats.linesAdded,
      stats.linesRemoved,
      stats.filesChanged
    );

    const files = contributorFiles.get(email)!;
    stats.busFactor = calculateBusFactorContribution(files, contributorFiles);
  }

  // Calculate points and create entries
  const entries: LeaderboardEntry[] = [];
  let totalCommits = 0;
  let netComplexity = 0;

  for (const stats of contributorStats.values()) {
    totalCommits += stats.commits;
    netComplexity += stats.complexityDelta;

    // Calculate points
    let points = 0;
    points += stats.commits * POINTS_PER_COMMIT;

    // Complexity: negative delta = reduced complexity = positive points
    if (stats.complexityDelta < 0) {
      points += Math.abs(stats.complexityDelta) * POINTS_PER_COMPLEXITY_REDUCED;
    } else {
      points += stats.complexityDelta * POINTS_PER_COMPLEXITY_ADDED;
    }

    // Bus factor bonus
    points += stats.busFactor * POINTS_PER_BUS_FACTOR;

    // Ensure points don't go negative
    points = Math.max(points, 0);

    entries.push({
      rank: 0, // Will be assigned after sorting
      email: stats.email,
      name: stats.name,
      points: Math.round(points),
      title: '', // Will be assigned after sorting
      commits: stats.commits,
      complexityDelta: stats.complexityDelta,
      busFactor: stats.busFactor,
      progressBar: '', // Will be generated after sorting
    });
  }

  // Sort by points and assign ranks
  entries.sort((a, b) => b.points - a.points);

  const maxPoints = entries[0]?.points || 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry) {
      entry.rank = i + 1;
      entry.title = getTitle(entry.points);
      entry.progressBar = generateProgressBar(entry.points, maxPoints);
    }
  }

  // Determine trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (netComplexity < -10) {
    trend = 'improving';
  } else if (netComplexity > 10) {
    trend = 'declining';
  }

  return {
    entries: entries.slice(0, limit),
    teamStats: {
      totalCommits,
      netComplexity,
      activeContributors: entries.length,
      trend,
    },
    timeRange: {
      since: sinceDate,
      until: new Date(),
    },
  };
}

/**
 * Format leaderboard for CLI display
 */
export function formatLeaderboard(result: LeaderboardResult): string {
  const lines: string[] = [];
  const W = 56;

  // Header
  lines.push('');
  lines.push('  \uD83C\uDFC6 SPECTER LEADERBOARD');
  lines.push('');
  lines.push("  Who's improving the codebase?");
  lines.push('');
  lines.push(`  ${'\u2550'.repeat(W)}`);
  lines.push('');

  if (result.entries.length === 0) {
    lines.push('  No contributors found in the specified time range.');
    lines.push('');
    return lines.join('\n');
  }

  // Medal emojis for top 3
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  for (const entry of result.entries) {
    const medal = entry.rank <= 3 ? medals[entry.rank - 1] : '  ';
    const rankStr = `#${entry.rank}`.padEnd(4);

    // Format name (truncate if too long)
    const displayName = entry.name.length > 30 ? `${entry.name.substring(0, 27)}...` : entry.name;

    // Format points
    const pointsStr = `+${entry.points} pts`.padStart(10);

    // First line: rank, name, points
    lines.push(`  ${medal} ${rankStr}${displayName.padEnd(32)}${pointsStr}`);

    // Second line: progress bar and title
    lines.push(`      ${entry.progressBar} ${entry.title}`);

    // Third line: stats
    const commitStr = `${entry.commits} commits`;
    const complexityStr =
      entry.complexityDelta <= 0
        ? `${entry.complexityDelta} complexity`
        : `+${entry.complexityDelta} complexity`;
    const busFactorStr =
      entry.busFactor > 0 ? `+${entry.busFactor} bus factor` : `${entry.busFactor} bus factor`;

    lines.push(`      ${commitStr} \u2502 ${complexityStr} \u2502 ${busFactorStr}`);
    lines.push('');
  }

  // Divider
  lines.push(`  ${'\u2500'.repeat(W)}`);
  lines.push('');

  // Team stats
  const trendEmoji =
    result.teamStats.trend === 'improving'
      ? '\uD83D\uDCC8'
      : result.teamStats.trend === 'declining'
        ? '\uD83D\uDCC9'
        : '\u2796';

  const trendText =
    result.teamStats.netComplexity <= 0
      ? `${result.teamStats.netComplexity} (improving!)`
      : `+${result.teamStats.netComplexity} (needs attention)`;

  // Format date range
  const fromDate = result.timeRange.since.toLocaleDateString();
  const toDate = result.timeRange.until.toLocaleDateString();

  lines.push(`  \uD83D\uDCCA Team Stats (${fromDate} - ${toDate}):`);
  lines.push(`     Total commits: ${result.teamStats.totalCommits}`);
  lines.push(`     Net complexity: ${trendText} ${trendEmoji}`);
  lines.push(`     Active contributors: ${result.teamStats.activeContributors}`);
  lines.push('');

  return lines.join('\n');
}
