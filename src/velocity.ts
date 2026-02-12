/**
 * Velocity - Complexity Velocity Tracking
 *
 * Tracks the rate of complexity/debt growth over time using historical snapshots.
 * Shows which areas are getting worse fastest and projects future state.
 */

import { loadSnapshots } from './history/storage.js';
import type { HealthSnapshot } from './history/types.js';
import type { KnowledgeGraph, GraphNode } from './graph/types.js';

// Types
export type VelocityTrend = 'improving' | 'stable' | 'degrading' | 'critical';

export interface FileVelocity {
  path: string;
  currentComplexity: number;
  previousComplexity: number;
  delta: number; // Change in complexity
  velocityPerWeek: number; // Projected weekly change
  trend: VelocityTrend;
}

export interface VelocityResult {
  files: FileVelocity[];
  overallVelocity: number; // Aggregate trend (-100 to +100, negative = improving)
  trend: VelocityTrend;
  fastestGrowing: FileVelocity[]; // Top 5 getting worse
  fastestImproving: FileVelocity[]; // Top 5 getting better
  projectedDebtIn30Days: number;
  snapshotCount: number;
  timeSpanDays: number;
  currentMetrics: {
    avgComplexity: number;
    totalComplexity: number;
    hotspotCount: number;
    fileCount: number;
  };
}

/**
 * Determine trend based on velocity
 */
function getTrend(velocity: number): VelocityTrend {
  if (velocity <= -5) return 'improving';
  if (velocity <= 2) return 'stable';
  if (velocity <= 10) return 'degrading';
  return 'critical';
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(date1.getTime() - date2.getTime()) / msPerDay;
}

/**
 * Get file complexity from graph
 */
function getFileComplexities(graph: KnowledgeGraph): Map<string, number> {
  const complexities = new Map<string, number>();

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file' && node.complexity !== undefined) {
      complexities.set(node.filePath, node.complexity);
    }
  }

  return complexities;
}

/**
 * Estimate previous file complexities from snapshot metrics
 * Since snapshots don't store per-file data, we estimate based on ratios
 */
function estimatePreviousComplexities(
  currentComplexities: Map<string, number>,
  currentSnapshot: HealthSnapshot,
  previousSnapshot: HealthSnapshot
): Map<string, number> {
  const estimates = new Map<string, number>();

  // Calculate the ratio of complexity change
  const currentAvg = currentSnapshot.metrics.avgComplexity;
  const previousAvg = previousSnapshot.metrics.avgComplexity;

  if (currentAvg === 0) {
    return currentComplexities;
  }

  const ratio = previousAvg / currentAvg;

  // Apply ratio to each file (simple linear estimation)
  for (const [path, complexity] of currentComplexities) {
    estimates.set(path, Math.round(complexity * ratio * 100) / 100);
  }

  return estimates;
}

/**
 * Analyze complexity velocity
 */
export async function analyzeVelocity(
  rootDir: string,
  graph: KnowledgeGraph
): Promise<VelocityResult> {
  const snapshots = await loadSnapshots(rootDir);
  const currentComplexities = getFileComplexities(graph);

  // Calculate current metrics
  const fileCount = currentComplexities.size;
  let totalComplexity = 0;
  let hotspotCount = 0;

  for (const complexity of currentComplexities.values()) {
    totalComplexity += complexity;
    if (complexity > 15) hotspotCount++;
  }

  const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;

  // Default result if no history
  if (snapshots.length < 2) {
    return {
      files: [],
      overallVelocity: 0,
      trend: 'stable',
      fastestGrowing: [],
      fastestImproving: [],
      projectedDebtIn30Days: totalComplexity,
      snapshotCount: snapshots.length,
      timeSpanDays: 0,
      currentMetrics: {
        avgComplexity,
        totalComplexity,
        hotspotCount,
        fileCount,
      },
    };
  }

  // Get current and previous snapshots
  const currentSnapshot = snapshots[0];
  const previousSnapshot = snapshots[snapshots.length - 1];

  // Calculate time span
  const currentDate = new Date(currentSnapshot.timestamp);
  const previousDate = new Date(previousSnapshot.timestamp);
  let timeSpanDays = daysBetween(currentDate, previousDate);

  // Ensure minimum time span of 1 day to avoid division issues
  // If snapshots are from the same day, treat as 1 day span
  if (timeSpanDays < 1) {
    timeSpanDays = 1;
  }

  // Estimate previous complexities
  const previousComplexities = estimatePreviousComplexities(
    currentComplexities,
    currentSnapshot,
    previousSnapshot
  );

  // Calculate per-file velocity
  const fileVelocities: FileVelocity[] = [];

  for (const [path, currentComplexity] of currentComplexities) {
    const previousComplexity = previousComplexities.get(path) ?? currentComplexity;
    const delta = currentComplexity - previousComplexity;

    // Calculate weekly velocity
    const weeksElapsed = timeSpanDays / 7;
    const velocityPerWeek =
      weeksElapsed > 0 ? Math.round((delta / weeksElapsed) * 100) / 100 : 0;

    fileVelocities.push({
      path,
      currentComplexity,
      previousComplexity: Math.round(previousComplexity * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      velocityPerWeek,
      trend: getTrend(velocityPerWeek),
    });
  }

  // Sort by velocity (worst first)
  fileVelocities.sort((a, b) => b.velocityPerWeek - a.velocityPerWeek);

  // Get fastest growing (positive velocity)
  const fastestGrowing = fileVelocities
    .filter((f) => f.velocityPerWeek > 0)
    .slice(0, 5);

  // Get fastest improving (negative velocity)
  const fastestImproving = fileVelocities
    .filter((f) => f.velocityPerWeek < 0)
    .sort((a, b) => a.velocityPerWeek - b.velocityPerWeek)
    .slice(0, 5);

  // Calculate overall velocity
  const totalDelta = fileVelocities.reduce((sum, f) => sum + f.delta, 0);
  const weeksElapsed = timeSpanDays / 7;
  const overallVelocity =
    weeksElapsed > 0 ? Math.round((totalDelta / weeksElapsed) * 100) / 100 : 0;

  // Project debt in 30 days (4.3 weeks)
  const weeksIn30Days = 30 / 7;
  const projectedIncrease = overallVelocity * weeksIn30Days;
  const projectedDebtIn30Days = Math.round(totalComplexity + projectedIncrease);

  return {
    files: fileVelocities,
    overallVelocity,
    trend: getTrend(overallVelocity),
    fastestGrowing,
    fastestImproving,
    projectedDebtIn30Days,
    snapshotCount: snapshots.length,
    timeSpanDays: Math.round(timeSpanDays),
    currentMetrics: {
      avgComplexity: Math.round(avgComplexity * 100) / 100,
      totalComplexity: Math.round(totalComplexity),
      hotspotCount,
      fileCount,
    },
  };
}

/**
 * Generate a simple sparkline for velocity trend
 */
function velocitySparkline(velocity: number): string {
  if (velocity <= -10) return '▼▼▼';
  if (velocity <= -5) return '▼▼';
  if (velocity < 0) return '▼';
  if (velocity === 0) return '─';
  if (velocity <= 2) return '▲';
  if (velocity <= 5) return '▲▲';
  return '▲▲▲';
}

/**
 * Get velocity arrow indicator
 */
function getVelocityArrow(velocity: number): string {
  if (velocity <= -5) return '↓↓';
  if (velocity < 0) return '↓';
  if (velocity === 0) return '→';
  if (velocity <= 5) return '↑';
  return '↑↑';
}

/**
 * Get color indicator for trend
 */
function getTrendColor(trend: VelocityTrend): string {
  switch (trend) {
    case 'improving':
      return '🟢';
    case 'stable':
      return '🟡';
    case 'degrading':
      return '🟠';
    case 'critical':
      return '🔴';
  }
}

/**
 * Format velocity result for display
 */
export function formatVelocity(result: VelocityResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  COMPLEXITY VELOCITY ANALYSIS                     ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  // Check for insufficient data
  if (result.snapshotCount < 2) {
    lines.push('INSUFFICIENT DATA');
    lines.push('─'.repeat(50));
    lines.push('');
    lines.push('  Need at least 2 snapshots to calculate velocity.');
    lines.push('  Run `specter scan` periodically to build history.');
    lines.push('');
    lines.push('  Current metrics:');
    lines.push(`    Files:      ${result.currentMetrics.fileCount}`);
    lines.push(`    Complexity: ${result.currentMetrics.totalComplexity}`);
    lines.push(`    Hotspots:   ${result.currentMetrics.hotspotCount}`);
    lines.push('');
    return lines.join('\n');
  }

  // Overall velocity
  const trendEmoji = getTrendColor(result.trend);
  const arrow = getVelocityArrow(result.overallVelocity);
  const sparkline = velocitySparkline(result.overallVelocity);

  lines.push('OVERALL VELOCITY');
  lines.push('─'.repeat(50));
  lines.push(`  ${trendEmoji} ${result.trend.toUpperCase()} ${arrow}`);
  lines.push('');
  lines.push(`  Weekly change:  ${result.overallVelocity >= 0 ? '+' : ''}${result.overallVelocity} complexity/week`);
  lines.push(`  Trend:          ${sparkline}`);
  lines.push(`  Time span:      ${result.timeSpanDays} days (${result.snapshotCount} snapshots)`);
  lines.push('');

  // Current metrics
  lines.push('📊 CURRENT STATE');
  lines.push('─'.repeat(50));
  lines.push(`  Total complexity: ${result.currentMetrics.totalComplexity}`);
  lines.push(`  Average:          ${result.currentMetrics.avgComplexity}`);
  lines.push(`  Files:            ${result.currentMetrics.fileCount}`);
  lines.push(`  Hotspots:         ${result.currentMetrics.hotspotCount}`);
  lines.push('');

  // 30-day projection
  const projectionDiff = result.projectedDebtIn30Days - result.currentMetrics.totalComplexity;
  const projectionTrend =
    projectionDiff < 0 ? '📉' : projectionDiff === 0 ? '➡️' : '📈';

  lines.push('🔮 30-DAY PROJECTION');
  lines.push('─'.repeat(50));
  lines.push(`  ${projectionTrend} Projected complexity: ${result.projectedDebtIn30Days}`);
  if (projectionDiff !== 0) {
    lines.push(`     (${projectionDiff >= 0 ? '+' : ''}${projectionDiff} from current)`);
  }
  lines.push('');

  // Fastest growing files
  if (result.fastestGrowing.length > 0) {
    lines.push('🔥 FASTEST GROWING (needs attention)');
    lines.push('─'.repeat(50));

    for (const file of result.fastestGrowing) {
      const shortPath =
        file.path.length > 40 ? '...' + file.path.slice(-37) : file.path;
      const velocityStr = `+${file.velocityPerWeek}/wk`;
      const trendIcon = getTrendColor(file.trend);

      lines.push(`  ${trendIcon} ${shortPath}`);
      lines.push(`     ${file.previousComplexity} → ${file.currentComplexity} (${velocityStr})`);
    }
    lines.push('');
  }

  // Fastest improving files
  if (result.fastestImproving.length > 0) {
    lines.push('✨ FASTEST IMPROVING (great work!)');
    lines.push('─'.repeat(50));

    for (const file of result.fastestImproving) {
      const shortPath =
        file.path.length > 40 ? '...' + file.path.slice(-37) : file.path;
      const velocityStr = `${file.velocityPerWeek}/wk`;
      const trendIcon = getTrendColor(file.trend);

      lines.push(`  ${trendIcon} ${shortPath}`);
      lines.push(`     ${file.previousComplexity} → ${file.currentComplexity} (${velocityStr})`);
    }
    lines.push('');
  }

  // Summary insight
  lines.push('💡 INSIGHTS');
  lines.push('─'.repeat(50));

  if (result.trend === 'improving') {
    lines.push('  Your codebase complexity is decreasing. Keep it up!');
  } else if (result.trend === 'stable') {
    lines.push('  Complexity is stable. Watch the growing files above.');
  } else if (result.trend === 'degrading') {
    lines.push('  Complexity is growing. Consider addressing hotspots.');
  } else {
    lines.push('  Complexity is growing rapidly! Schedule refactoring time.');
  }

  if (result.fastestGrowing.length > 0) {
    lines.push(`  Focus on: ${result.fastestGrowing[0].path.split('/').pop()}`);
  }

  lines.push('');
  lines.push('━'.repeat(51));

  return lines.join('\n');
}
