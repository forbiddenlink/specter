/**
 * Trajectory - Health Trajectory Projection
 *
 * Projects future codebase health based on historical trends.
 * Shows where the codebase is heading (improving, stable, declining).
 * Predicts health score at specific future dates.
 */

import type { KnowledgeGraph } from './graph/types.js';
import { loadSnapshots } from './history/storage.js';
import type { HealthSnapshot } from './history/types.js';

// Types
export type TrajectoryTrend = 'improving' | 'stable' | 'declining' | 'critical';
export type Scenario = 'best' | 'likely' | 'worst';

export interface ProjectedState {
  date: Date;
  projectedHealth: number; // 0-100
  confidence: number; // 0-100 (lower for further dates)
  scenario: Scenario;
}

export interface TrajectoryResult {
  currentHealth: number;
  trend: TrajectoryTrend;
  rateOfChange: number; // Health points per week
  projections: {
    oneWeek: ProjectedState;
    oneMonth: ProjectedState;
    threeMonths: ProjectedState;
  };
  riskFactors: string[];
  recommendations: string[];
  snapshotCount: number;
  timeSpanDays: number;
  healthHistory: number[]; // Recent health scores for sparkline
}

/**
 * Calculate linear regression slope and intercept
 * Returns [slope, intercept] where y = slope * x + intercept
 */
function linearRegression(points: Array<{ x: number; y: number }>): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;

  if (n === 0) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  if (n === 1) {
    return { slope: 0, intercept: points[0].y, r2: 1 };
  }

  // Calculate means
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope
  let numerator = 0;
  let denominator = 0;

  for (const p of points) {
    numerator += (p.x - meanX) * (p.y - meanY);
    denominator += (p.x - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared (coefficient of determination)
  let ssRes = 0;
  let ssTot = 0;

  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 1;

  return { slope, intercept, r2 };
}

/**
 * Determine trend based on rate of change
 */
function getTrend(rateOfChange: number): TrajectoryTrend {
  if (rateOfChange >= 2) return 'improving';
  if (rateOfChange >= -1) return 'stable';
  if (rateOfChange >= -5) return 'declining';
  return 'critical';
}

/**
 * Clamp health score to valid range
 */
function clampHealth(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate confidence level based on data quality and projection distance
 */
function calculateConfidence(
  weeksAhead: number,
  snapshotCount: number,
  r2: number,
  timeSpanDays: number
): number {
  // Base confidence from data quality
  let confidence = 90;

  // Reduce confidence for fewer snapshots
  if (snapshotCount < 5) {
    confidence -= (5 - snapshotCount) * 10;
  }

  // Reduce confidence for shorter time span (less than 2 weeks)
  if (timeSpanDays < 14) {
    confidence -= Math.max(0, (14 - timeSpanDays) * 2);
  }

  // Reduce confidence for low R-squared (poor fit)
  if (r2 < 0.7) {
    confidence -= (0.7 - r2) * 30;
  }

  // Reduce confidence for projections further in the future
  confidence -= weeksAhead * 5;

  return Math.max(10, Math.min(100, Math.round(confidence)));
}

/**
 * Project health at a future date
 */
function projectHealth(
  currentHealth: number,
  rateOfChange: number,
  weeksAhead: number,
  snapshotCount: number,
  r2: number,
  timeSpanDays: number,
  scenario: Scenario
): ProjectedState {
  const date = new Date();
  date.setDate(date.getDate() + weeksAhead * 7);

  // Calculate base projection
  let projectedHealth = currentHealth + rateOfChange * weeksAhead;

  // Adjust for scenario
  const variance = Math.abs(rateOfChange) * 0.5 * weeksAhead;

  switch (scenario) {
    case 'best':
      projectedHealth += variance;
      break;
    case 'worst':
      projectedHealth -= variance;
      break;
    // 'likely' uses base projection
  }

  const confidence = calculateConfidence(weeksAhead, snapshotCount, r2, timeSpanDays);

  return {
    date,
    projectedHealth: clampHealth(projectedHealth),
    confidence,
    scenario,
  };
}

/**
 * Identify risk factors based on current state and trends
 */
function identifyRiskFactors(
  currentHealth: number,
  rateOfChange: number,
  snapshots: HealthSnapshot[]
): string[] {
  const risks: string[] = [];

  // Low current health
  if (currentHealth < 50) {
    risks.push('Health score below 50 indicates significant technical debt');
  } else if (currentHealth < 70) {
    risks.push('Health score below 70 suggests accumulating issues');
  }

  // Declining trend
  if (rateOfChange < -5) {
    risks.push('Rapid decline in health score (-5+ points/week)');
  } else if (rateOfChange < -2) {
    risks.push('Health score declining steadily');
  }

  // Check for complexity hotspots trend
  if (snapshots.length >= 2) {
    const current = snapshots[0];
    const oldest = snapshots[snapshots.length - 1];

    if (current.metrics.hotspotCount > oldest.metrics.hotspotCount) {
      const increase = current.metrics.hotspotCount - oldest.metrics.hotspotCount;
      risks.push(`Complexity hotspots increased by ${increase}`);
    }

    // Check for code growth outpacing cleanup
    const lineGrowth = current.metrics.totalLines - oldest.metrics.totalLines;
    const complexityGrowth = current.metrics.avgComplexity - oldest.metrics.avgComplexity;

    if (lineGrowth > 0 && complexityGrowth > 0) {
      risks.push('Code growth accompanied by complexity increase');
    }
  }

  // Check for high complexity average
  if (snapshots.length > 0) {
    const current = snapshots[0];
    if (current.metrics.avgComplexity > 10) {
      risks.push('Average complexity above sustainable threshold');
    }
    if (current.metrics.hotspotCount > 5) {
      risks.push(`${current.metrics.hotspotCount} active complexity hotspots`);
    }
  }

  // Insufficient data risk
  if (snapshots.length < 3) {
    risks.push('Limited historical data for accurate projections');
  }

  return risks;
}

/**
 * Generate recommendations based on trajectory analysis
 */
function generateRecommendations(
  trend: TrajectoryTrend,
  currentHealth: number,
  riskFactors: string[],
  snapshots: HealthSnapshot[]
): string[] {
  const recommendations: string[] = [];

  // Based on trend
  switch (trend) {
    case 'critical':
      recommendations.push('Schedule immediate refactoring sprint');
      recommendations.push('Pause new features to address tech debt');
      break;
    case 'declining':
      recommendations.push('Allocate 20% of sprint time to tech debt');
      recommendations.push('Review and address largest complexity hotspots');
      break;
    case 'stable':
      recommendations.push('Maintain current practices');
      recommendations.push('Consider proactive refactoring of hotspots');
      break;
    case 'improving':
      recommendations.push('Keep up the good work!');
      recommendations.push('Document successful patterns for team');
      break;
  }

  // Based on current health
  if (currentHealth < 50) {
    recommendations.push('Run `specter hotspots` to identify critical areas');
    recommendations.push('Consider automated complexity checks in CI');
  }

  // Based on specific risks
  if (riskFactors.some((r) => r.includes('hotspots increased'))) {
    recommendations.push('Run `specter zones --danger` to find problem areas');
  }

  if (riskFactors.some((r) => r.includes('Limited historical data'))) {
    recommendations.push('Run `specter scan` regularly to build trend data');
  }

  // Check metrics
  if (snapshots.length > 0) {
    const current = snapshots[0];
    if (current.metrics.hotspotCount > 0) {
      recommendations.push(
        `Address ${current.metrics.hotspotCount} hotspot${current.metrics.hotspotCount !== 1 ? 's' : ''} with complexity > 15`
      );
    }
  }

  // Deduplicate and limit
  const unique = [...new Set(recommendations)];
  return unique.slice(0, 5);
}

/**
 * Calculate health score using the same formula as snapshot.ts
 */
function calculateHealthScore(graph: KnowledgeGraph): number {
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
  const complexities = fileNodes.map((n) => n.complexity ?? 0).filter((c) => c > 0);

  if (complexities.length === 0) {
    return 100;
  }

  const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
  const hotspotCount = complexities.filter((c) => c > 15).length;
  const veryHighCount = complexities.filter((c) => c > 20).length;

  // Match formula from snapshot.ts
  let healthScore = 100;
  healthScore -= avgComplexity * 3; // Subtract 3 points per avg complexity
  healthScore -= hotspotCount * 2; // Subtract 2 points per hotspot
  healthScore -= veryHighCount * 5; // Penalize very high complexity functions

  return clampHealth(healthScore);
}

/**
 * Main function to project health trajectory
 */
export async function projectTrajectory(
  rootDir: string,
  graph: KnowledgeGraph
): Promise<TrajectoryResult> {
  const snapshots = await loadSnapshots(rootDir);

  // Use the most recent snapshot's health score if available,
  // otherwise calculate from the graph
  let currentHealth: number;
  if (snapshots.length > 0) {
    currentHealth = snapshots[0].metrics.healthScore;
  } else {
    currentHealth = calculateHealthScore(graph);
  }

  // Default result if no history
  if (snapshots.length === 0) {
    return {
      currentHealth,
      trend: 'stable',
      rateOfChange: 0,
      projections: {
        oneWeek: {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          projectedHealth: currentHealth,
          confidence: 20,
          scenario: 'likely',
        },
        oneMonth: {
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          projectedHealth: currentHealth,
          confidence: 10,
          scenario: 'likely',
        },
        threeMonths: {
          date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          projectedHealth: currentHealth,
          confidence: 10,
          scenario: 'likely',
        },
      },
      riskFactors: ['No historical data available'],
      recommendations: [
        'Run `specter scan` periodically to build trend data',
        'Schedule weekly scans to track health trajectory',
      ],
      snapshotCount: 0,
      timeSpanDays: 0,
      healthHistory: [currentHealth],
    };
  }

  // Sort snapshots by timestamp, oldest first
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate time span
  const oldestDate = new Date(sorted[0].timestamp);
  const newestDate = new Date(sorted[sorted.length - 1].timestamp);
  const timeSpanMs = newestDate.getTime() - oldestDate.getTime();
  const timeSpanDays = Math.max(1, Math.floor(timeSpanMs / (24 * 60 * 60 * 1000)));

  // Build data points for regression
  const points: Array<{ x: number; y: number }> = [];
  const baseTime = oldestDate.getTime();

  for (const snapshot of sorted) {
    const time = new Date(snapshot.timestamp).getTime();
    const weeksFromStart = (time - baseTime) / (7 * 24 * 60 * 60 * 1000);
    points.push({
      x: weeksFromStart,
      y: snapshot.metrics.healthScore,
    });
  }

  // Run linear regression
  const { slope: rawRateOfChange, r2 } = linearRegression(points);

  // Clamp rate of change to reasonable bounds (-50 to +50 pts/week)
  // Extreme values typically indicate insufficient time span
  const rateOfChange = Math.max(-50, Math.min(50, rawRateOfChange));

  // Determine trend
  const trend = getTrend(rateOfChange);

  // Extract health history for sparkline (most recent 10)
  const healthHistory = sorted.slice(-10).map((s) => s.metrics.healthScore);

  // Add current health if different from last snapshot
  const lastSnapshotHealth = healthHistory[healthHistory.length - 1];
  if (Math.abs(currentHealth - lastSnapshotHealth) > 1) {
    healthHistory.push(currentHealth);
  }

  // Generate projections
  const projections = {
    oneWeek: projectHealth(
      currentHealth,
      rateOfChange,
      1,
      snapshots.length,
      r2,
      timeSpanDays,
      'likely'
    ),
    oneMonth: projectHealth(
      currentHealth,
      rateOfChange,
      4,
      snapshots.length,
      r2,
      timeSpanDays,
      'likely'
    ),
    threeMonths: projectHealth(
      currentHealth,
      rateOfChange,
      12,
      snapshots.length,
      r2,
      timeSpanDays,
      'likely'
    ),
  };

  // Identify risks and recommendations
  const riskFactors = identifyRiskFactors(currentHealth, rateOfChange, sorted);
  const recommendations = generateRecommendations(trend, currentHealth, riskFactors, sorted);

  return {
    currentHealth,
    trend,
    rateOfChange: Math.round(rateOfChange * 100) / 100,
    projections,
    riskFactors,
    recommendations,
    snapshotCount: snapshots.length,
    timeSpanDays,
    healthHistory,
  };
}

/**
 * Generate health sparkline from history
 */
function healthSparkline(values: number[]): string {
  if (values.length === 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const sparkBars = [
    '\u2581',
    '\u2582',
    '\u2583',
    '\u2584',
    '\u2585',
    '\u2586',
    '\u2587',
    '\u2588',
  ];

  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (sparkBars.length - 1));
      return sparkBars[idx];
    })
    .join('');
}

/**
 * Get trend emoji (arrow)
 */
function getTrendEmoji(trend: TrajectoryTrend): string {
  switch (trend) {
    case 'improving':
      return '\u2191';
    case 'stable':
      return '\u2192';
    case 'declining':
      return '\u2193';
    case 'critical':
      return '\u2193\u2193';
  }
}

/**
 * Get color indicator for trend
 */
function getTrendColor(trend: TrajectoryTrend): string {
  switch (trend) {
    case 'improving':
      return '🟢';
    case 'stable':
      return '🟡';
    case 'declining':
      return '🟠';
    case 'critical':
      return '🔴';
  }
}

/**
 * Format trajectory result for display
 */
export function formatTrajectory(result: TrajectoryResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  HEALTH TRAJECTORY PROJECTION                     ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  // Check for insufficient data
  if (result.snapshotCount < 2) {
    lines.push('INSUFFICIENT DATA');
    lines.push('─'.repeat(50));
    lines.push('');
    lines.push('  Need at least 2 snapshots to project trajectory.');
    lines.push('  Run `specter scan` periodically to build history.');
    lines.push('');
    lines.push(`  Current health: ${result.currentHealth}/100`);
    lines.push('');

    if (result.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS');
      lines.push('─'.repeat(50));
      for (const rec of result.recommendations) {
        lines.push(`  • ${rec}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // Current state
  const trendColor = getTrendColor(result.trend);
  const trendArrow = getTrendEmoji(result.trend);

  lines.push('CURRENT STATE');
  lines.push('─'.repeat(50));
  lines.push(
    `  ${trendColor} Health: ${result.currentHealth}/100  ${trendArrow} ${result.trend.toUpperCase()}`
  );
  lines.push(
    `  Change rate: ${result.rateOfChange >= 0 ? '+' : ''}${result.rateOfChange} pts/week`
  );
  lines.push(`  Based on: ${result.snapshotCount} snapshots over ${result.timeSpanDays} days`);

  // Warning for short time spans
  if (result.timeSpanDays < 7) {
    lines.push('');
    lines.push('  Note: Short time span - projections may be less accurate.');
    lines.push('  Run scans over multiple days for better trend analysis.');
  }
  lines.push('');

  // Health history sparkline
  if (result.healthHistory.length > 1) {
    const sparkline = healthSparkline(result.healthHistory);
    lines.push(`  History: ${sparkline}`);
    lines.push('');
  }

  // Projections
  lines.push('🔮 PROJECTIONS');
  lines.push('─'.repeat(50));

  const proj1W = result.projections.oneWeek;
  const proj1M = result.projections.oneMonth;
  const proj3M = result.projections.threeMonths;

  const formatProj = (proj: ProjectedState, label: string): string => {
    const delta = proj.projectedHealth - result.currentHealth;
    const sign = delta >= 0 ? '+' : '';
    const confidence = proj.confidence >= 70 ? '  ' : proj.confidence >= 40 ? ' ~' : ' ?';
    return `  ${label}: ${proj.projectedHealth}/100 (${sign}${delta})${confidence} [${proj.confidence}% conf]`;
  };

  lines.push(formatProj(proj1W, '1 week '));
  lines.push(formatProj(proj1M, '1 month'));
  lines.push(formatProj(proj3M, '3 month'));
  lines.push('');

  // Visual timeline
  lines.push('📈 TRAJECTORY');
  lines.push('─'.repeat(50));

  // Simple ASCII chart
  const chartWidth = 40;
  const chartValues = [
    result.currentHealth,
    proj1W.projectedHealth,
    proj1M.projectedHealth,
    proj3M.projectedHealth,
  ];
  const chartMin = Math.min(...chartValues) - 5;
  const chartMax = Math.max(...chartValues) + 5;
  const chartRange = chartMax - chartMin || 1;

  const valueToPos = (v: number): number => Math.round(((v - chartMin) / chartRange) * chartWidth);

  // Draw horizontal bar chart
  lines.push(`  NOW   [${'█'.repeat(valueToPos(result.currentHealth))}] ${result.currentHealth}`);
  lines.push(
    `  +1W   [${'░'.repeat(valueToPos(proj1W.projectedHealth))}] ${proj1W.projectedHealth}`
  );
  lines.push(
    `  +1M   [${'░'.repeat(valueToPos(proj1M.projectedHealth))}] ${proj1M.projectedHealth}`
  );
  lines.push(
    `  +3M   [${'░'.repeat(valueToPos(proj3M.projectedHealth))}] ${proj3M.projectedHealth}`
  );
  lines.push('');

  // Risk factors
  if (result.riskFactors.length > 0) {
    lines.push('⚠️  RISK FACTORS');
    lines.push('─'.repeat(50));
    for (const risk of result.riskFactors) {
      lines.push(`  • ${risk}`);
    }
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(50));
    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  // Summary insight
  lines.push('📊 OUTLOOK');
  lines.push('─'.repeat(50));

  if (result.trend === 'improving') {
    lines.push('  Your codebase health is on an upward trajectory.');
    lines.push('  Keep up the great work!');
  } else if (result.trend === 'stable') {
    lines.push('  Your codebase health is stable.');
    lines.push('  Consider proactive improvements to push it higher.');
  } else if (result.trend === 'declining') {
    lines.push('  Your codebase health is trending downward.');
    lines.push('  Address the risk factors above to reverse the trend.');
  } else {
    lines.push('  Your codebase health is in critical decline.');
    lines.push('  Immediate intervention recommended.');
  }

  lines.push('');
  lines.push('━'.repeat(51));

  return lines.join('\n');
}
