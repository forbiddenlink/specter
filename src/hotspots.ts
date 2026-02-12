/**
 * Hotspots - Complexity x Churn Visualization
 *
 * Identifies files that are BOTH complex AND frequently changed.
 * These are the highest priority for refactoring.
 * Inspired by CodeScene's hotspot analysis.
 */

import { simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface Hotspot {
  file: string;
  complexity: number; // 0-100 normalized
  churn: number; // Number of changes in time period
  churnRate: number; // Changes per week
  hotspotScore: number; // complexity x churn (normalized 0-100)
  priority: 'critical' | 'high' | 'medium' | 'low';
  lastModified: Date;
  topContributors: string[];
}

export interface HotspotsResult {
  hotspots: Hotspot[];
  summary: {
    criticalCount: number;
    highCount: number;
    totalDebtHours: number; // Estimated refactoring time
  };
  quadrants: {
    // For visualization
    highComplexityHighChurn: Hotspot[]; // DANGER ZONE
    highComplexityLowChurn: Hotspot[]; // Legacy debt
    lowComplexityHighChurn: Hotspot[]; // Active development
    lowComplexityLowChurn: Hotspot[]; // Healthy
  };
  timeRange: {
    since: Date;
    until: Date;
    weeks: number;
  };
}

interface FileChurnData {
  commitCount: number;
  lastModified: Date;
  contributors: string[];
}

/**
 * Get churn data from git history
 */
async function getChurnData(
  rootDir: string,
  since: string
): Promise<Map<string, FileChurnData>> {
  const git = simpleGit(rootDir);
  const churnMap = new Map<string, FileChurnData>();

  try {
    // Get all commits since the date
    const log = await git.log({
      '--since': since,
      '--name-only': null,
      format: {
        hash: '%H',
        date: '%aI',
        author: '%an',
      },
    });

    // Process each commit
    for (const commit of log.all) {
      const date = new Date(commit.date);
      const author = commit.author;

      // Get files changed in this commit
      const diffResult = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        commit.hash,
      ]);

      const files = diffResult
        .trim()
        .split('\n')
        .filter((f) => f && f.match(/\.(ts|tsx|js|jsx)$/));

      for (const file of files) {
        const existing = churnMap.get(file);
        if (existing) {
          existing.commitCount++;
          if (date > existing.lastModified) {
            existing.lastModified = date;
          }
          if (!existing.contributors.includes(author)) {
            existing.contributors.push(author);
          }
        } else {
          churnMap.set(file, {
            commitCount: 1,
            lastModified: date,
            contributors: [author],
          });
        }
      }
    }
  } catch (error) {
    // Not a git repo or other error - return empty map
  }

  return churnMap;
}

/**
 * Normalize a value to 0-100 scale using percentile ranking
 */
function normalizeToPercentile(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;
  return Math.round((rank / sorted.length) * 100);
}

/**
 * Get complexity for a file from the graph
 */
function getFileComplexity(graph: KnowledgeGraph, filePath: string): number {
  // Find the file node and get its complexity
  const fileNode = Object.values(graph.nodes).find(
    (n) => n.type === 'file' && n.filePath === filePath
  );

  if (fileNode?.complexity !== undefined) {
    return fileNode.complexity;
  }

  // Calculate aggregate complexity from functions in the file
  const functionNodes = Object.values(graph.nodes).filter(
    (n) => n.type === 'function' && n.filePath === filePath && n.complexity !== undefined
  );

  if (functionNodes.length === 0) return 0;

  // Use max complexity as the file's complexity indicator
  return Math.max(...functionNodes.map((n) => n.complexity!));
}

/**
 * Determine priority based on hotspot score
 */
function getPriority(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Estimate refactoring hours based on complexity and file size
 */
function estimateRefactoringHours(hotspot: Hotspot): number {
  // Base estimate: 1 hour per 10 complexity points
  // Adjusted by priority multiplier
  const priorityMultiplier =
    hotspot.priority === 'critical'
      ? 2
      : hotspot.priority === 'high'
        ? 1.5
        : hotspot.priority === 'medium'
          ? 1
          : 0.5;

  return Math.round((hotspot.complexity / 10) * priorityMultiplier);
}

/**
 * Analyze hotspots in the codebase
 */
export async function analyzeHotspots(
  rootDir: string,
  graph: KnowledgeGraph,
  options: { since?: string; top?: number } = {}
): Promise<HotspotsResult> {
  const since = options.since || '3 months ago';
  const top = options.top || 20;

  // Calculate time range
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

  const weeks = Math.ceil(
    (Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
  );

  // Get churn data from git
  const churnData = await getChurnData(rootDir, since);

  // Get all file paths from the graph
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');

  // Collect raw values for normalization
  const allComplexities: number[] = [];
  const allChurns: number[] = [];

  for (const node of fileNodes) {
    const complexity = getFileComplexity(graph, node.filePath);
    const churn = churnData.get(node.filePath)?.commitCount || 0;
    allComplexities.push(complexity);
    allChurns.push(churn);
  }

  // Build hotspot data
  const hotspots: Hotspot[] = [];

  for (const node of fileNodes) {
    const rawComplexity = getFileComplexity(graph, node.filePath);
    const churnInfo = churnData.get(node.filePath);
    const rawChurn = churnInfo?.commitCount || 0;

    // Skip files with no churn or no complexity
    if (rawChurn === 0 && rawComplexity === 0) continue;

    // Normalize to 0-100
    const complexity = normalizeToPercentile(allComplexities, rawComplexity);
    const churn = normalizeToPercentile(allChurns, rawChurn);

    // Calculate hotspot score (geometric mean gives balanced weighting)
    const hotspotScore = Math.round(Math.sqrt(complexity * churn));

    const churnRate = rawChurn / Math.max(weeks, 1);

    hotspots.push({
      file: node.filePath,
      complexity,
      churn,
      churnRate: Math.round(churnRate * 10) / 10,
      hotspotScore,
      priority: getPriority(hotspotScore),
      lastModified: churnInfo?.lastModified || new Date(0),
      topContributors: churnInfo?.contributors.slice(0, 3) || [],
    });
  }

  // Sort by hotspot score
  hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore);

  // Categorize into quadrants (using 50 as midpoint)
  const highComplexityHighChurn = hotspots.filter(
    (h) => h.complexity >= 50 && h.churn >= 50
  );
  const highComplexityLowChurn = hotspots.filter(
    (h) => h.complexity >= 50 && h.churn < 50
  );
  const lowComplexityHighChurn = hotspots.filter(
    (h) => h.complexity < 50 && h.churn >= 50
  );
  const lowComplexityLowChurn = hotspots.filter(
    (h) => h.complexity < 50 && h.churn < 50
  );

  // Calculate summary
  const topHotspots = hotspots.slice(0, top);
  const criticalCount = topHotspots.filter((h) => h.priority === 'critical').length;
  const highCount = topHotspots.filter((h) => h.priority === 'high').length;
  const totalDebtHours = topHotspots.reduce(
    (sum, h) => sum + estimateRefactoringHours(h),
    0
  );

  return {
    hotspots: topHotspots,
    summary: {
      criticalCount,
      highCount,
      totalDebtHours,
    },
    quadrants: {
      highComplexityHighChurn,
      highComplexityLowChurn,
      lowComplexityHighChurn,
      lowComplexityLowChurn,
    },
    timeRange: {
      since: sinceDate,
      until: new Date(),
      weeks,
    },
  };
}

/**
 * Generate ASCII scatter plot
 */
function generateScatterPlot(hotspots: Hotspot[]): string[] {
  const lines: string[] = [];
  const width = 50;
  const height = 15;

  // Create grid
  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(' ');
  }

  // Plot files as dots
  const plotted = new Map<string, { file: string; x: number; y: number }>();

  for (const hotspot of hotspots.slice(0, 30)) {
    // Map to grid coordinates
    const x = Math.min(Math.floor((hotspot.churn / 100) * (width - 1)), width - 1);
    const y = Math.min(
      Math.floor((1 - hotspot.complexity / 100) * (height - 1)),
      height - 1
    );

    const key = `${x},${y}`;
    if (!plotted.has(key)) {
      // Choose symbol based on priority
      const symbol =
        hotspot.priority === 'critical'
          ? '\u25CF' // filled circle
          : hotspot.priority === 'high'
            ? '\u25CB' // empty circle
            : hotspot.priority === 'medium'
              ? '\u25E6' // small circle
              : '\u00B7'; // dot

      grid[y][x] = symbol;
      plotted.set(key, { file: hotspot.file, x, y });
    }
  }

  // Draw y-axis and grid
  lines.push('Complexity');
  lines.push('    \u25B2');

  for (let y = 0; y < height; y++) {
    let label = '';
    if (y === 0) label = '100';
    else if (y === Math.floor(height / 2)) label = ' 50';
    else if (y === height - 1) label = '  0';
    else label = '   ';

    const row = grid[y].join('');
    const midPoint = Math.floor(width / 2);

    // Add quadrant divider at middle
    let displayRow = row;
    if (y === Math.floor(height / 2)) {
      displayRow = row.substring(0, midPoint) + '\u253C' + row.substring(midPoint + 1);
    }

    lines.push(`${label} \u2502${displayRow}`);
  }

  // Draw x-axis
  lines.push('    \u2514' + '\u2500'.repeat(width) + '\u25B6 Churn');
  lines.push('    0' + ' '.repeat(Math.floor(width / 2) - 3) + '50' + ' '.repeat(Math.floor(width / 2) - 2) + '100');

  return lines;
}

/**
 * Format hotspots for display
 */
export function formatHotspots(result: HotspotsResult): string {
  const lines: string[] = [];

  // Header
  lines.push('\u250F' + '\u2501'.repeat(58) + '\u2513');
  lines.push(
    '\u2503  \uD83D\uDD25 HOTSPOT ANALYSIS                                       \u2503'
  );
  lines.push(
    '\u2503  Complexity x Churn = Refactoring Priority                \u2503'
  );
  lines.push('\u2517' + '\u2501'.repeat(58) + '\u251B');
  lines.push('');

  // Time range
  const fromDate = result.timeRange.since.toLocaleDateString();
  const toDate = result.timeRange.until.toLocaleDateString();
  lines.push(`Period: ${fromDate} to ${toDate} (${result.timeRange.weeks} weeks)`);
  lines.push('');

  // Scatter plot
  lines.push('SCATTER PLOT');
  lines.push('\u2500'.repeat(58));
  lines.push('');
  lines.push(...generateScatterPlot(result.hotspots));
  lines.push('');
  lines.push('Legend: \u25CF CRITICAL  \u25CB HIGH  \u25E6 MEDIUM  \u00B7 LOW');
  lines.push('');

  // Quadrant summary
  lines.push('QUADRANT ANALYSIS');
  lines.push('\u2500'.repeat(58));
  lines.push('');

  const dangerCount = result.quadrants.highComplexityHighChurn.length;
  const legacyCount = result.quadrants.highComplexityLowChurn.length;
  const activeCount = result.quadrants.lowComplexityHighChurn.length;
  const healthyCount = result.quadrants.lowComplexityLowChurn.length;

  lines.push(
    `  \uD83D\uDD34 DANGER ZONE (high complexity + high churn): ${dangerCount} files`
  );
  lines.push(
    `  \uD83D\uDFE0 Legacy Debt (high complexity + low churn):  ${legacyCount} files`
  );
  lines.push(
    `  \uD83D\uDFE1 Active Dev (low complexity + high churn):   ${activeCount} files`
  );
  lines.push(
    `  \uD83D\uDFE2 Healthy (low complexity + low churn):       ${healthyCount} files`
  );
  lines.push('');

  // Summary stats
  lines.push('SUMMARY');
  lines.push('\u2500'.repeat(58));
  lines.push('');
  lines.push(
    `  Critical hotspots: ${result.summary.criticalCount}`
  );
  lines.push(`  High-risk hotspots: ${result.summary.highCount}`);
  lines.push(
    `  Estimated debt: ~${result.summary.totalDebtHours} hours of refactoring`
  );
  lines.push('');

  // Top hotspots list
  lines.push('TOP HOTSPOTS');
  lines.push('\u2500'.repeat(58));
  lines.push('');

  for (const hotspot of result.hotspots.slice(0, 10)) {
    const priorityBadge =
      hotspot.priority === 'critical'
        ? '\uD83D\uDD34 CRITICAL'
        : hotspot.priority === 'high'
          ? '\uD83D\uDFE0 HIGH'
          : hotspot.priority === 'medium'
            ? '\uD83D\uDFE1 MEDIUM'
            : '\uD83D\uDFE2 LOW';

    lines.push(`${priorityBadge} ${hotspot.file}`);

    // Score bar
    const barWidth = 20;
    const filled = Math.floor((hotspot.hotspotScore / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    lines.push(`   Score: ${bar} ${hotspot.hotspotScore}/100`);

    lines.push(
      `   Complexity: ${hotspot.complexity}%  |  Churn: ${hotspot.churn}% (${hotspot.churnRate}/wk)`
    );

    if (hotspot.topContributors.length > 0) {
      lines.push(`   Contributors: ${hotspot.topContributors.join(', ')}`);
    }

    const hours = estimateRefactoringHours(hotspot);
    lines.push(`   Estimated effort: ~${hours}h`);
    lines.push('');
  }

  if (result.hotspots.length > 10) {
    lines.push(`... and ${result.hotspots.length - 10} more hotspots`);
    lines.push('');
  }

  // Recommendations
  lines.push('RECOMMENDATIONS');
  lines.push('\u2500'.repeat(58));
  lines.push('');

  if (dangerCount > 0) {
    lines.push(
      `  \uD83D\uDEA8 ${dangerCount} files in the DANGER ZONE need immediate attention.`
    );
    lines.push(
      '     These are frequently changed AND complex - highest ROI for refactoring.'
    );
  }

  if (legacyCount > 5) {
    lines.push(
      `  \u26A0\uFE0F  ${legacyCount} complex files rarely change - legacy debt.`
    );
    lines.push('     Consider refactoring when next touching these files.');
  }

  if (result.summary.totalDebtHours > 40) {
    lines.push('');
    lines.push(
      `  \uD83D\uDCCA Total estimated refactoring debt: ${result.summary.totalDebtHours} hours`
    );
    lines.push(
      '     Consider allocating 10-20% of sprint capacity to debt reduction.'
    );
  }

  lines.push('');

  return lines.join('\n');
}
