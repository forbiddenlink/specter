/**
 * get_complexity_hotspots Tool
 *
 * Returns the most complex files and functions in the codebase.
 */

import { z } from 'zod';
import type { KnowledgeGraph, ComplexityHotspot } from '../graph/types.js';
import { findComplexityHotspots, getComplexityEmoji, COMPLEXITY_THRESHOLDS } from '../analyzers/complexity.js';

export const schema = {
  limit: z.number().optional().describe('Maximum number of hotspots to return'),
  threshold: z.number().optional().describe('Minimum complexity to be considered a hotspot'),
  includeFiles: z.boolean().optional().describe('Include file-level complexity'),
};

export interface Input {
  limit?: number;
  threshold?: number;
  includeFiles?: boolean;
}

export interface ComplexityHotspotsResult {
  hotspots: Array<ComplexityHotspot & { emoji: string }>;
  summary: string;
  stats: {
    total: number;
    avgComplexity: number;
    maxComplexity: number;
  };
}

export function execute(graph: KnowledgeGraph, input: Input): ComplexityHotspotsResult {
  const { limit = 10, threshold = 10, includeFiles = false } = input;

  const hotspots = findComplexityHotspots(graph, { limit, threshold, includeFiles });

  // Calculate stats
  const allComplexities = Object.values(graph.nodes)
    .filter(n => n.type !== 'file' && n.complexity !== undefined)
    .map(n => n.complexity!);

  const total = allComplexities.length;
  const avgComplexity = total > 0
    ? Math.round((allComplexities.reduce((a, b) => a + b, 0) / total) * 100) / 100
    : 0;
  const maxComplexity = total > 0 ? Math.max(...allComplexities) : 0;

  // Add emoji to hotspots
  const hotspotsWithEmoji = hotspots.map(h => ({
    ...h,
    emoji: getComplexityEmoji(h.complexity),
  }));

  // Generate summary
  const summary = generateSummary(hotspotsWithEmoji, { total, avgComplexity, maxComplexity }, threshold);

  return {
    hotspots: hotspotsWithEmoji,
    summary,
    stats: { total, avgComplexity, maxComplexity },
  };
}

function generateSummary(
  hotspots: Array<ComplexityHotspot & { emoji: string }>,
  stats: { total: number; avgComplexity: number; maxComplexity: number },
  threshold: number
): string {
  const parts: string[] = [];

  // Overall assessment
  if (hotspots.length === 0) {
    parts.push(`Great news! I have no functions with complexity above ${threshold}.`);
    parts.push(`My average complexity is ${stats.avgComplexity}, which is ${stats.avgComplexity <= 5 ? 'excellent' : 'reasonable'}.`);
  } else {
    parts.push(`I found ${hotspots.length} complexity hotspot${hotspots.length > 1 ? 's' : ''} above threshold ${threshold}.`);

    // Worst offender
    if (hotspots.length > 0) {
      const worst = hotspots[0];
      parts.push(`\nMy most complex ${worst.type} is **${worst.name}** in ${worst.filePath}:`);
      parts.push(`- Complexity: ${worst.emoji} ${worst.complexity}`);
      parts.push(`- Lines: ${worst.lineStart}-${worst.lineEnd}`);

      if (worst.complexity > COMPLEXITY_THRESHOLDS.high) {
        parts.push(`\n⚠️ This is concerningly high. Consider breaking it into smaller functions.`);
      }
    }

    // List others
    if (hotspots.length > 1) {
      parts.push(`\nOther hotspots:`);
      for (const h of hotspots.slice(1, 5)) {
        parts.push(`- ${h.emoji} ${h.name} (${h.filePath}) — ${h.complexity}`);
      }
      if (hotspots.length > 5) {
        parts.push(`- ...and ${hotspots.length - 5} more`);
      }
    }
  }

  // Overall stats
  parts.push(`\n**Overall Stats:**`);
  parts.push(`- Total functions/methods: ${stats.total}`);
  parts.push(`- Average complexity: ${stats.avgComplexity}`);
  parts.push(`- Maximum complexity: ${stats.maxComplexity}`);

  return parts.join('\n');
}
