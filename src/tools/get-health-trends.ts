/**
 * Get Health Trends Tool
 *
 * MCP tool for analyzing health trends over time.
 */

import { z } from 'zod';
import type { KnowledgeGraph } from '../graph/types.js';
import { loadSnapshots } from '../history/storage.js';
import { analyzeTrends, getTimeSpan } from '../history/trends.js';
import type { TrendAnalysis, HealthTrend } from '../history/types.js';
import { coloredSparkline, healthBar } from '../ui/index.js';

export const schema = {
  period: z.enum(['day', 'week', 'month', 'all']).optional()
    .describe('Time period to analyze (default: all)'),
};

export interface Input {
  period?: 'day' | 'week' | 'month' | 'all';
}

export interface GetHealthTrendsResult {
  analysis: TrendAnalysis;
  summary: string;
}

export async function execute(
  graph: KnowledgeGraph,
  input: Input
): Promise<GetHealthTrendsResult> {
  const { period = 'all' } = input;

  // Load all snapshots
  const snapshots = await loadSnapshots(graph.metadata.rootDir);

  // Analyze trends
  const analysis = analyzeTrends(snapshots);

  // Generate formatted summary
  const summary = generateTrendSummary(analysis, period);

  return {
    analysis,
    summary,
  };
}

/**
 * Generate a formatted summary string
 */
function generateTrendSummary(analysis: TrendAnalysis, requestedPeriod: string): string {
  const parts: string[] = [];

  // Header
  parts.push('## Health Trends\n');

  // Current status
  if (analysis.current) {
    const { healthScore, avgComplexity, hotspotCount, fileCount, totalLines } = analysis.current.metrics;
    const grade = getGrade(healthScore);

    parts.push(`**Current Health:** ${healthScore}/100 (Grade ${grade})`);
    parts.push(`${healthBar(healthScore, 30)}\n`);

    parts.push(`**Metrics:**`);
    parts.push(`- Files: ${fileCount}`);
    parts.push(`- Lines: ${totalLines.toLocaleString()}`);
    parts.push(`- Avg Complexity: ${avgComplexity.toFixed(1)}`);
    parts.push(`- Hotspots: ${hotspotCount}`);

    if (analysis.current.commitHash) {
      parts.push(`- Commit: \`${analysis.current.commitHash}\``);
    }
    parts.push('');
  } else {
    parts.push('No health data available. Run `specter scan` to create a snapshot.\n');
    return parts.join('\n');
  }

  // Sparkline of health scores
  const allSnapshots = analysis.trends.all?.snapshots || [];
  if (allSnapshots.length >= 2) {
    const scores = allSnapshots.map(s => s.metrics.healthScore);
    const sparkline = coloredSparkline(scores, true);
    const timeSpan = getTimeSpan(allSnapshots);
    parts.push(`**Trend (${timeSpan}):** ${sparkline}`);
    parts.push('');
  }

  // Period-specific analysis
  const selectedTrend = analysis.trends[requestedPeriod as keyof typeof analysis.trends];
  if (selectedTrend) {
    parts.push(formatTrendSection(selectedTrend));
  }

  // All available trends summary
  if (requestedPeriod === 'all') {
    const trendSummaries: string[] = [];

    if (analysis.trends.day && analysis.trends.day.snapshots.length >= 2) {
      trendSummaries.push(`- **Today:** ${formatDirection(analysis.trends.day)}`);
    }

    if (analysis.trends.week && analysis.trends.week.snapshots.length >= 2) {
      trendSummaries.push(`- **This week:** ${formatDirection(analysis.trends.week)}`);
    }

    if (analysis.trends.month && analysis.trends.month.snapshots.length >= 2) {
      trendSummaries.push(`- **This month:** ${formatDirection(analysis.trends.month)}`);
    }

    if (trendSummaries.length > 0) {
      parts.push('**Summary by Period:**');
      parts.push(...trendSummaries);
      parts.push('');
    }
  }

  // First-person summary
  parts.push('---');
  parts.push(`*${analysis.summary}*`);

  return parts.join('\n');
}

/**
 * Format a trend section with insights
 */
function formatTrendSection(trend: HealthTrend): string {
  const parts: string[] = [];

  const periodLabel = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time',
  }[trend.period];

  parts.push(`### ${periodLabel}`);
  parts.push('');

  // Direction indicator
  const directionEmoji = {
    improving: '\u2197\uFE0F',
    stable: '\u2192\uFE0F',
    declining: '\u2198\uFE0F',
  }[trend.direction];

  const directionText = {
    improving: 'Improving',
    stable: 'Stable',
    declining: 'Declining',
  }[trend.direction];

  parts.push(`**Direction:** ${directionEmoji} ${directionText}`);

  if (trend.changePercent !== 0) {
    const sign = trend.changePercent > 0 ? '+' : '';
    parts.push(`**Change:** ${sign}${trend.changePercent}%`);
  }

  parts.push(`**Snapshots:** ${trend.snapshots.length}`);
  parts.push('');

  // Insights
  if (trend.insights.length > 0) {
    parts.push('**Insights:**');
    for (const insight of trend.insights) {
      parts.push(`- ${insight}`);
    }
  }

  return parts.join('\n');
}

/**
 * Format trend direction for summary
 */
function formatDirection(trend: HealthTrend): string {
  const emoji = {
    improving: '\u2197\uFE0F',
    stable: '\u2192\uFE0F',
    declining: '\u2198\uFE0F',
  }[trend.direction];

  if (trend.changePercent === 0) {
    return `${emoji} Stable`;
  }

  const sign = trend.changePercent > 0 ? '+' : '';
  return `${emoji} ${sign}${trend.changePercent}%`;
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
