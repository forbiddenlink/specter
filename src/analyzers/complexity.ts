/**
 * Complexity Analyzer
 *
 * Provides utilities for calculating and analyzing code complexity
 * across the codebase.
 */

import type { GraphNode, ComplexityHotspot, KnowledgeGraph } from '../graph/types.js';

export interface ComplexityReport {
  averageComplexity: number;
  maxComplexity: number;
  totalComplexity: number;
  hotspots: ComplexityHotspot[];
  distribution: {
    low: number;      // 1-5
    medium: number;   // 6-10
    high: number;     // 11-20
    veryHigh: number; // 21+
  };
}

/**
 * Complexity thresholds
 */
export const COMPLEXITY_THRESHOLDS = {
  low: 5,
  medium: 10,
  high: 20,
} as const;

/**
 * Get complexity category
 */
export function getComplexityCategory(complexity: number): 'low' | 'medium' | 'high' | 'veryHigh' {
  if (complexity <= COMPLEXITY_THRESHOLDS.low) return 'low';
  if (complexity <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  if (complexity <= COMPLEXITY_THRESHOLDS.high) return 'high';
  return 'veryHigh';
}

/**
 * Get complexity emoji indicator
 */
export function getComplexityEmoji(complexity: number): string {
  const category = getComplexityCategory(complexity);
  switch (category) {
    case 'low': return '🟢';
    case 'medium': return '🟡';
    case 'high': return '🟠';
    case 'veryHigh': return '🔴';
  }
}

/**
 * Find complexity hotspots in the graph
 */
export function findComplexityHotspots(
  graph: KnowledgeGraph,
  options: {
    limit?: number;
    threshold?: number;
    includeFiles?: boolean;
  } = {}
): ComplexityHotspot[] {
  const { limit = 10, threshold = COMPLEXITY_THRESHOLDS.medium, includeFiles = false } = options;

  const hotspots: ComplexityHotspot[] = [];

  for (const node of Object.values(graph.nodes)) {
    if (!node.complexity || node.complexity < threshold) continue;

    // Skip file nodes unless explicitly included
    if (node.type === 'file' && !includeFiles) continue;

    hotspots.push({
      filePath: node.filePath,
      name: node.name,
      type: node.type,
      complexity: node.complexity,
      lineStart: node.lineStart,
      lineEnd: node.lineEnd,
    });
  }

  return hotspots
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, limit);
}

/**
 * Generate complexity report for a codebase
 */
export function generateComplexityReport(graph: KnowledgeGraph): ComplexityReport {
  const nodesWithComplexity = Object.values(graph.nodes)
    .filter(n => n.type !== 'file' && n.complexity !== undefined);

  if (nodesWithComplexity.length === 0) {
    return {
      averageComplexity: 0,
      maxComplexity: 0,
      totalComplexity: 0,
      hotspots: [],
      distribution: { low: 0, medium: 0, high: 0, veryHigh: 0 },
    };
  }

  const complexities = nodesWithComplexity.map(n => n.complexity!);
  const totalComplexity = complexities.reduce((sum, c) => sum + c, 0);
  const averageComplexity = totalComplexity / complexities.length;
  const maxComplexity = Math.max(...complexities);

  const distribution = {
    low: 0,
    medium: 0,
    high: 0,
    veryHigh: 0,
  };

  for (const complexity of complexities) {
    const category = getComplexityCategory(complexity);
    distribution[category]++;
  }

  const hotspots = findComplexityHotspots(graph, { limit: 20 });

  return {
    averageComplexity: Math.round(averageComplexity * 100) / 100,
    maxComplexity,
    totalComplexity,
    hotspots,
    distribution,
  };
}

/**
 * Compare complexity between two versions of a graph
 */
export function compareComplexity(
  before: KnowledgeGraph,
  after: KnowledgeGraph
): {
  improved: ComplexityHotspot[];
  worsened: ComplexityHotspot[];
  unchanged: number;
} {
  const improved: ComplexityHotspot[] = [];
  const worsened: ComplexityHotspot[] = [];
  let unchanged = 0;

  for (const nodeId of Object.keys(after.nodes)) {
    const beforeNode = before.nodes[nodeId];
    const afterNode = after.nodes[nodeId];

    if (!beforeNode || !afterNode.complexity || !beforeNode.complexity) continue;

    const diff = afterNode.complexity - beforeNode.complexity;

    if (diff > 0) {
      worsened.push({
        filePath: afterNode.filePath,
        name: afterNode.name,
        type: afterNode.type,
        complexity: afterNode.complexity,
        lineStart: afterNode.lineStart,
        lineEnd: afterNode.lineEnd,
      });
    } else if (diff < 0) {
      improved.push({
        filePath: afterNode.filePath,
        name: afterNode.name,
        type: afterNode.type,
        complexity: afterNode.complexity,
        lineStart: afterNode.lineStart,
        lineEnd: afterNode.lineEnd,
      });
    } else {
      unchanged++;
    }
  }

  return { improved, worsened, unchanged };
}

/**
 * Get complexity by directory
 */
export function getComplexityByDirectory(
  graph: KnowledgeGraph
): Map<string, { totalComplexity: number; fileCount: number; avgComplexity: number }> {
  const dirStats = new Map<string, { totalComplexity: number; fileCount: number }>();

  for (const node of Object.values(graph.nodes)) {
    if (node.type !== 'file' || !node.complexity) continue;

    const dir = node.filePath.split('/').slice(0, -1).join('/') || '.';

    const existing = dirStats.get(dir) || { totalComplexity: 0, fileCount: 0 };
    existing.totalComplexity += node.complexity;
    existing.fileCount++;
    dirStats.set(dir, existing);
  }

  const result = new Map<string, { totalComplexity: number; fileCount: number; avgComplexity: number }>();

  for (const [dir, stats] of dirStats) {
    result.set(dir, {
      ...stats,
      avgComplexity: Math.round((stats.totalComplexity / stats.fileCount) * 100) / 100,
    });
  }

  return result;
}

/**
 * Suggest refactoring targets based on complexity
 */
export function suggestRefactoringTargets(graph: KnowledgeGraph): Array<{
  node: GraphNode;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{
    node: GraphNode;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') continue;
    if (!node.complexity) continue;

    // Very high complexity
    if (node.complexity > COMPLEXITY_THRESHOLDS.high) {
      suggestions.push({
        node,
        reason: `Cyclomatic complexity of ${node.complexity} is very high. Consider breaking into smaller functions.`,
        priority: 'high',
      });
    }
    // High complexity
    else if (node.complexity > COMPLEXITY_THRESHOLDS.medium) {
      suggestions.push({
        node,
        reason: `Cyclomatic complexity of ${node.complexity} is above recommended threshold.`,
        priority: 'medium',
      });
    }

    // Long functions (rough heuristic: >50 lines with moderate complexity)
    const lineCount = node.lineEnd - node.lineStart;
    if (lineCount > 50 && node.complexity > COMPLEXITY_THRESHOLDS.low) {
      suggestions.push({
        node,
        reason: `Function spans ${lineCount} lines. Consider extracting helper functions.`,
        priority: 'medium',
      });
    }
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
