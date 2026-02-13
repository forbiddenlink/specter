/**
 * Snapshot Creation and Comparison
 *
 * Creates point-in-time snapshots of codebase health.
 */

import { simpleGit } from 'simple-git';
import { COMPLEXITY_THRESHOLDS, getComplexityCategory } from '../analyzers/complexity.js';
import type { KnowledgeGraph } from '../graph/types.js';
import type { HealthSnapshot } from './types.js';

/**
 * Create a snapshot from current graph state
 */
export async function createSnapshot(graph: KnowledgeGraph): Promise<HealthSnapshot> {
  // Get current git commit hash if available
  const git = simpleGit(graph.metadata.rootDir);
  let commitHash: string | undefined;
  try {
    const status = await git.revparse(['HEAD']);
    commitHash = status.trim().substring(0, 8);
  } catch {
    // Not a git repo, that's fine
  }

  // Calculate metrics from graph
  const nodesWithComplexity = Object.values(graph.nodes).filter(
    (n) => n.type !== 'file' && n.complexity !== undefined
  );

  const complexities = nodesWithComplexity.map((n) => n.complexity!);
  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length : 0;
  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;

  // Count complexity distribution
  const distribution = {
    low: 0, // 1-5
    medium: 0, // 6-10
    high: 0, // 11-20
    veryHigh: 0, // 21+
  };

  for (const complexity of complexities) {
    const category = getComplexityCategory(complexity);
    distribution[category]++;
  }

  // Count hotspots (complexity > 15)
  const hotspotCount = complexities.filter((c) => c > COMPLEXITY_THRESHOLDS.high - 5).length;

  // Calculate health score (0-100)
  // Formula: Start at 100, subtract based on complexity and hotspots
  let healthScore = 100;
  healthScore -= avgComplexity * 3; // Subtract 3 points per avg complexity
  healthScore -= hotspotCount * 2; // Subtract 2 points per hotspot
  healthScore -= distribution.veryHigh * 5; // Penalize very high complexity functions
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  const now = new Date();
  const timestamp = now.toISOString();

  return {
    id: timestamp,
    timestamp,
    commitHash,
    metrics: {
      fileCount: graph.metadata.fileCount,
      totalLines: graph.metadata.totalLines,
      avgComplexity: Math.round(avgComplexity * 100) / 100,
      maxComplexity,
      hotspotCount,
      healthScore,
    },
    distribution,
  };
}

/**
 * Compare two snapshots and return differences
 */
export function diffSnapshots(
  older: HealthSnapshot,
  newer: HealthSnapshot
): {
  metricChanges: Record<string, { before: number; after: number; change: number }>;
  distributionChanges: Record<string, { before: number; after: number; change: number }>;
  isImproving: boolean;
} {
  const metricChanges: Record<string, { before: number; after: number; change: number }> = {};
  const distributionChanges: Record<string, { before: number; after: number; change: number }> = {};

  // Compare metrics
  for (const key of Object.keys(older.metrics) as (keyof HealthSnapshot['metrics'])[]) {
    const before = older.metrics[key];
    const after = newer.metrics[key];
    metricChanges[key] = {
      before,
      after,
      change: after - before,
    };
  }

  // Compare distribution
  for (const key of Object.keys(older.distribution) as (keyof HealthSnapshot['distribution'])[]) {
    const before = older.distribution[key];
    const after = newer.distribution[key];
    distributionChanges[key] = {
      before,
      after,
      change: after - before,
    };
  }

  // Determine if improving based on health score change
  const healthChange = metricChanges['healthScore']?.change ?? 0;
  const isImproving = healthChange > 0;

  return {
    metricChanges,
    distributionChanges,
    isImproving,
  };
}

/**
 * Calculate percentage change between two values
 */
export function percentChange(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : 100;
  return Math.round(((after - before) / before) * 100);
}
