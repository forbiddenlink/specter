/**
 * Trend Calculation
 *
 * Analyzes snapshots to identify patterns and trends.
 */

import type { HealthSnapshot, HealthTrend, TrendAnalysis } from './types.js';
import { diffSnapshots, percentChange } from './snapshot.js';

/**
 * Get snapshots from a specific period
 */
export function filterByPeriod(
  snapshots: HealthSnapshot[],
  period: 'day' | 'week' | 'month'
): HealthSnapshot[] {
  const now = Date.now();
  const periodMs = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  const cutoff = now - periodMs[period];

  return snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);
}

/**
 * Calculate trend for a specific period
 */
export function calculateTrend(
  snapshots: HealthSnapshot[],
  period: 'day' | 'week' | 'month' | 'all'
): HealthTrend {
  // Filter snapshots for the period (unless 'all')
  const periodSnapshots = period === 'all'
    ? snapshots
    : filterByPeriod(snapshots, period);

  // Sort by timestamp, oldest first
  const sorted = [...periodSnapshots].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return {
      period,
      direction: 'stable',
      changePercent: 0,
      insights: ['No data available for this period.'],
      snapshots: [],
    };
  }

  if (sorted.length === 1) {
    return {
      period,
      direction: 'stable',
      changePercent: 0,
      insights: ['Only one snapshot available - need more data to identify trends.'],
      snapshots: sorted,
    };
  }

  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];

  // Calculate change
  const healthChange = newest.metrics.healthScore - oldest.metrics.healthScore;
  const changePercent = percentChange(oldest.metrics.healthScore, newest.metrics.healthScore);

  // Determine direction
  let direction: 'improving' | 'stable' | 'declining';
  if (healthChange > 2) {
    direction = 'improving';
  } else if (healthChange < -2) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }

  // Generate insights
  const insights = generateInsights(oldest, newest);

  return {
    period,
    direction,
    changePercent,
    insights,
    snapshots: sorted,
  };
}

/**
 * Full trend analysis
 */
export function analyzeTrends(snapshots: HealthSnapshot[]): TrendAnalysis {
  // Sort by timestamp, newest first
  const sorted = [...snapshots].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const current = sorted[0] || null;
  const previous = sorted[1] || null;

  // Calculate trends for each period
  const trends: TrendAnalysis['trends'] = {};

  if (sorted.length >= 1) {
    // Only calculate day/week/month trends if we have recent data
    const daySnapshots = filterByPeriod(sorted, 'day');
    if (daySnapshots.length > 0) {
      trends.day = calculateTrend(sorted, 'day');
    }

    const weekSnapshots = filterByPeriod(sorted, 'week');
    if (weekSnapshots.length > 0) {
      trends.week = calculateTrend(sorted, 'week');
    }

    const monthSnapshots = filterByPeriod(sorted, 'month');
    if (monthSnapshots.length > 0) {
      trends.month = calculateTrend(sorted, 'month');
    }

    trends.all = calculateTrend(sorted, 'all');
  }

  // Generate first-person summary
  const summary = generateSummary(current, previous, trends);

  return {
    current,
    previous,
    trends,
    summary,
  };
}

/**
 * Generate trend insights comparing two snapshots
 */
function generateInsights(older: HealthSnapshot, newer: HealthSnapshot): string[] {
  const insights: string[] = [];
  const diff = diffSnapshots(older, newer);

  // Health score change
  const healthChange = diff.metricChanges.healthScore;
  if (healthChange && healthChange.change !== 0) {
    const direction = healthChange.change > 0 ? 'improved' : 'declined';
    const absChange = Math.abs(healthChange.change);
    insights.push(`My health score ${direction} by ${absChange} points (${healthChange.before} -> ${healthChange.after}).`);
  }

  // Complexity change
  const complexityChange = diff.metricChanges.avgComplexity;
  if (complexityChange && Math.abs(complexityChange.change) >= 0.5) {
    const direction = complexityChange.change < 0 ? 'down' : 'up';
    const pct = Math.abs(percentChange(complexityChange.before, complexityChange.after));
    insights.push(`My average complexity is ${direction} ${pct}% (${complexityChange.before.toFixed(1)} -> ${complexityChange.after.toFixed(1)}).`);
  }

  // File count change
  const fileChange = diff.metricChanges.fileCount;
  if (fileChange && fileChange.change !== 0) {
    const verb = fileChange.change > 0 ? 'gained' : 'lost';
    const count = Math.abs(fileChange.change);
    insights.push(`I ${verb} ${count} file${count !== 1 ? 's' : ''}.`);
  }

  // Lines change
  const lineChange = diff.metricChanges.totalLines;
  if (lineChange && Math.abs(lineChange.change) >= 100) {
    const verb = lineChange.change > 0 ? 'grew by' : 'shrank by';
    const count = Math.abs(lineChange.change);
    insights.push(`I ${verb} ${count.toLocaleString()} lines of code.`);
  }

  // Hotspot change
  const hotspotChange = diff.metricChanges.hotspotCount;
  if (hotspotChange && hotspotChange.change !== 0) {
    if (hotspotChange.change < 0) {
      insights.push(`I cleaned up ${Math.abs(hotspotChange.change)} complexity hotspot${Math.abs(hotspotChange.change) !== 1 ? 's' : ''}!`);
    } else {
      insights.push(`I developed ${hotspotChange.change} new complexity hotspot${hotspotChange.change !== 1 ? 's' : ''}.`);
    }
  }

  // Distribution changes
  const veryHighChange = diff.distributionChanges.veryHigh;
  if (veryHighChange && veryHighChange.change !== 0) {
    if (veryHighChange.change < 0) {
      insights.push(`${Math.abs(veryHighChange.change)} very-high-complexity function${Math.abs(veryHighChange.change) !== 1 ? 's were' : ' was'} refactored.`);
    } else {
      insights.push(`${veryHighChange.change} function${veryHighChange.change !== 1 ? 's' : ''} crossed into very-high complexity territory.`);
    }
  }

  return insights;
}

/**
 * Generate first-person summary for the codebase
 */
function generateSummary(
  current: HealthSnapshot | null,
  previous: HealthSnapshot | null,
  trends: TrendAnalysis['trends']
): string {
  if (!current) {
    return "I don't have any health history yet. Run `specter scan` to create my first snapshot.";
  }

  const parts: string[] = [];

  // Current state
  const grade = getGrade(current.metrics.healthScore);
  parts.push(`I'm currently at ${current.metrics.healthScore}/100 health (Grade ${grade}).`);

  // Comparison with previous
  if (previous) {
    const diff = current.metrics.healthScore - previous.metrics.healthScore;
    if (diff > 0) {
      parts.push(`That's up ${diff} points from my last scan!`);
    } else if (diff < 0) {
      parts.push(`That's down ${Math.abs(diff)} points from my last scan.`);
    } else {
      parts.push(`Same as my last scan.`);
    }
  }

  // Weekly trend
  if (trends.week) {
    const weekTrend = trends.week;
    if (weekTrend.direction === 'improving') {
      parts.push(`This week I've been getting healthier - up ${weekTrend.changePercent}%.`);
    } else if (weekTrend.direction === 'declining') {
      parts.push(`This week has been rough - my health is down ${Math.abs(weekTrend.changePercent)}%.`);
    } else if (weekTrend.snapshots.length >= 2) {
      parts.push(`My health has been stable this week.`);
    }
  }

  // Overall trend
  if (trends.all && trends.all.snapshots.length >= 3) {
    const allTrend = trends.all;
    if (allTrend.direction === 'improving') {
      parts.push(`Overall, I'm on an upward trajectory.`);
    } else if (allTrend.direction === 'declining') {
      parts.push(`Overall, I've been accumulating technical debt.`);
    }
  }

  // Specific metrics
  if (current.metrics.hotspotCount > 0) {
    parts.push(`I have ${current.metrics.hotspotCount} complexity hotspot${current.metrics.hotspotCount !== 1 ? 's' : ''} that could use attention.`);
  } else {
    parts.push(`I'm happy to report no major complexity hotspots.`);
  }

  return parts.join(' ');
}

/**
 * Get letter grade from health score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get time span description
 */
export function getTimeSpan(snapshots: HealthSnapshot[]): string {
  if (snapshots.length === 0) return 'no history';
  if (snapshots.length === 1) return '1 snapshot';

  const sorted = [...snapshots].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const oldest = new Date(sorted[0].timestamp);
  const newest = new Date(sorted[sorted.length - 1].timestamp);
  const diffMs = newest.getTime() - oldest.getTime();

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? 's' : ''}`;
  if (days < 365) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''}`;
  return `${Math.floor(days / 365)} year${days >= 730 ? 's' : ''}`;
}
