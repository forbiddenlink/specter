/**
 * Snapshot Tests
 *
 * Tests for snapshot creation, comparison, and health calculations.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNode, KnowledgeGraph } from '../../src/graph/types.js';
import type { HealthSnapshot } from '../../src/history/types.js';

// Mock simple-git before importing the module
const mockGit = {
  revparse: vi.fn(),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

import { createSnapshot, diffSnapshots, percentChange } from '../../src/history/snapshot.js';

/**
 * Helper to create a mock knowledge graph for testing
 */
function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: 5,
      totalLines: 500,
      languages: { typescript: 5 },
      nodeCount: 10,
      edgeCount: 15,
    },
    nodes: {},
    edges: [],
    ...overrides,
  };
}

/**
 * Helper to create nodes with complexity values
 */
function createNodesWithComplexity(complexities: number[]): Record<string, GraphNode> {
  const nodes: Record<string, GraphNode> = {};
  for (let i = 0; i < complexities.length; i++) {
    nodes[`func-${i}`] = {
      id: `func-${i}`,
      type: 'function',
      name: `function${i}`,
      filePath: `file${Math.floor(i / 2)}.ts`,
      lineStart: i * 20 + 1,
      lineEnd: i * 20 + 15,
      exported: true,
      complexity: complexities[i],
    };
  }
  return nodes;
}

describe('Snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGit.revparse.mockReset();
  });

  describe('createSnapshot', () => {
    it('should create snapshot with correct metrics', async () => {
      mockGit.revparse.mockResolvedValue('abc12345def67890');

      const graph = createMockGraph({
        nodes: createNodesWithComplexity([5, 10, 15, 20, 25]),
      });

      const snapshot = await createSnapshot(graph);

      expect(snapshot.metrics.fileCount).toBe(5);
      expect(snapshot.metrics.totalLines).toBe(500);
      expect(snapshot.metrics.avgComplexity).toBe(15); // (5+10+15+20+25)/5
      expect(snapshot.metrics.maxComplexity).toBe(25);
    });

    it('should capture git commit hash', async () => {
      mockGit.revparse.mockResolvedValue('abc12345def67890\n');

      const graph = createMockGraph();
      const snapshot = await createSnapshot(graph);

      expect(snapshot.commitHash).toBe('abc12345');
    });

    it('should handle non-git repositories', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));

      const graph = createMockGraph();
      const snapshot = await createSnapshot(graph);

      expect(snapshot.commitHash).toBeUndefined();
    });

    it('should calculate complexity distribution', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      // Create nodes with various complexity levels
      const graph = createMockGraph({
        nodes: createNodesWithComplexity([
          2,
          4, // low (<=5)
          6,
          8,
          10, // medium (6-10)
          12,
          15,
          18, // high (11-20)
          25,
          30, // veryHigh (>20)
        ]),
      });

      const snapshot = await createSnapshot(graph);

      expect(snapshot.distribution.low).toBe(2);
      expect(snapshot.distribution.medium).toBe(3);
      expect(snapshot.distribution.high).toBe(3);
      expect(snapshot.distribution.veryHigh).toBe(2);
    });

    it('should count hotspots correctly', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      // Hotspots are complexity > 15 (COMPLEXITY_THRESHOLDS.high - 5)
      const graph = createMockGraph({
        nodes: createNodesWithComplexity([5, 10, 15, 16, 20, 25]),
      });

      const snapshot = await createSnapshot(graph);

      // 16, 20, 25 are > 15
      expect(snapshot.metrics.hotspotCount).toBe(3);
    });

    it('should calculate health score', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      // Low complexity = high health score
      const healthyGraph = createMockGraph({
        nodes: createNodesWithComplexity([2, 3, 4, 5, 5]),
      });

      const healthySnapshot = await createSnapshot(healthyGraph);

      // Unhealthy graph with high complexity
      const unhealthyGraph = createMockGraph({
        nodes: createNodesWithComplexity([20, 25, 30, 35, 40]),
      });

      const unhealthySnapshot = await createSnapshot(unhealthyGraph);

      expect(healthySnapshot.metrics.healthScore).toBeGreaterThan(
        unhealthySnapshot.metrics.healthScore
      );
    });

    it('should bound health score between 0 and 100', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      // Extremely unhealthy graph
      const unhealthyGraph = createMockGraph({
        nodes: createNodesWithComplexity([50, 60, 70, 80, 90, 100]),
      });

      const snapshot = await createSnapshot(unhealthyGraph);

      expect(snapshot.metrics.healthScore).toBeGreaterThanOrEqual(0);
      expect(snapshot.metrics.healthScore).toBeLessThanOrEqual(100);
    });

    it('should generate valid timestamp ID', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      const graph = createMockGraph();
      const snapshot = await createSnapshot(graph);

      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.id).toBe(snapshot.timestamp);

      // Should be valid ISO timestamp
      const parsed = new Date(snapshot.timestamp);
      expect(parsed.toISOString()).toBe(snapshot.timestamp);
    });

    it('should handle empty graph', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      const graph = createMockGraph({
        metadata: {
          scannedAt: new Date().toISOString(),
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 0,
          totalLines: 0,
          languages: {},
          nodeCount: 0,
          edgeCount: 0,
        },
        nodes: {},
      });

      const snapshot = await createSnapshot(graph);

      expect(snapshot.metrics.avgComplexity).toBe(0);
      expect(snapshot.metrics.maxComplexity).toBe(0);
      expect(snapshot.metrics.hotspotCount).toBe(0);
      expect(snapshot.distribution.low).toBe(0);
      expect(snapshot.distribution.medium).toBe(0);
      expect(snapshot.distribution.high).toBe(0);
      expect(snapshot.distribution.veryHigh).toBe(0);
    });

    it('should exclude file nodes from complexity calculations', async () => {
      mockGit.revparse.mockResolvedValue('abc12345');

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
            complexity: 100, // High complexity on file - should be ignored
          },
          'func-1': {
            id: 'func-1',
            type: 'function',
            name: 'testFunc',
            filePath: 'test.ts',
            lineStart: 10,
            lineEnd: 20,
            exported: true,
            complexity: 5,
          },
        },
      });

      const snapshot = await createSnapshot(graph);

      expect(snapshot.metrics.avgComplexity).toBe(5); // Only function complexity
      expect(snapshot.metrics.maxComplexity).toBe(5);
    });
  });

  describe('diffSnapshots', () => {
    it('should calculate metric changes', () => {
      const older: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        commitHash: 'abc1234',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 8,
          maxComplexity: 20,
          hotspotCount: 3,
          healthScore: 75,
        },
        distribution: { low: 5, medium: 3, high: 1, veryHigh: 1 },
      };

      const newer: HealthSnapshot = {
        id: '2024-01-15T00:00:00Z',
        timestamp: '2024-01-15T00:00:00Z',
        commitHash: 'def5678',
        metrics: {
          fileCount: 12,
          totalLines: 1200,
          avgComplexity: 10,
          maxComplexity: 25,
          hotspotCount: 5,
          healthScore: 70,
        },
        distribution: { low: 6, medium: 3, high: 2, veryHigh: 1 },
      };

      const diff = diffSnapshots(older, newer);

      expect(diff.metricChanges.fileCount).toEqual({
        before: 10,
        after: 12,
        change: 2,
      });
      expect(diff.metricChanges.totalLines).toEqual({
        before: 1000,
        after: 1200,
        change: 200,
      });
      expect(diff.metricChanges.avgComplexity).toEqual({
        before: 8,
        after: 10,
        change: 2,
      });
      expect(diff.metricChanges.healthScore).toEqual({
        before: 75,
        after: 70,
        change: -5,
      });
    });

    it('should calculate distribution changes', () => {
      const older: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 8,
          maxComplexity: 20,
          hotspotCount: 3,
          healthScore: 75,
        },
        distribution: { low: 5, medium: 3, high: 1, veryHigh: 1 },
      };

      const newer: HealthSnapshot = {
        id: '2024-01-15T00:00:00Z',
        timestamp: '2024-01-15T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 8,
          maxComplexity: 20,
          hotspotCount: 3,
          healthScore: 75,
        },
        distribution: { low: 7, medium: 2, high: 0, veryHigh: 1 },
      };

      const diff = diffSnapshots(older, newer);

      expect(diff.distributionChanges.low).toEqual({
        before: 5,
        after: 7,
        change: 2,
      });
      expect(diff.distributionChanges.medium).toEqual({
        before: 3,
        after: 2,
        change: -1,
      });
      expect(diff.distributionChanges.high).toEqual({
        before: 1,
        after: 0,
        change: -1,
      });
    });

    it('should detect improving health', () => {
      const older: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 15,
          maxComplexity: 30,
          hotspotCount: 8,
          healthScore: 50,
        },
        distribution: { low: 2, medium: 3, high: 3, veryHigh: 2 },
      };

      const newer: HealthSnapshot = {
        id: '2024-01-15T00:00:00Z',
        timestamp: '2024-01-15T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 10,
          maxComplexity: 20,
          hotspotCount: 4,
          healthScore: 70, // Improved!
        },
        distribution: { low: 4, medium: 4, high: 1, veryHigh: 1 },
      };

      const diff = diffSnapshots(older, newer);

      expect(diff.isImproving).toBe(true);
    });

    it('should detect declining health', () => {
      const older: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 8,
          maxComplexity: 15,
          hotspotCount: 2,
          healthScore: 85,
        },
        distribution: { low: 6, medium: 3, high: 1, veryHigh: 0 },
      };

      const newer: HealthSnapshot = {
        id: '2024-01-15T00:00:00Z',
        timestamp: '2024-01-15T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 15,
          maxComplexity: 30,
          hotspotCount: 6,
          healthScore: 60, // Declined!
        },
        distribution: { low: 3, medium: 3, high: 2, veryHigh: 2 },
      };

      const diff = diffSnapshots(older, newer);

      expect(diff.isImproving).toBe(false);
    });

    it('should handle stable health (no change)', () => {
      const snapshot: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 10,
          maxComplexity: 20,
          hotspotCount: 3,
          healthScore: 70,
        },
        distribution: { low: 5, medium: 3, high: 1, veryHigh: 1 },
      };

      const diff = diffSnapshots(snapshot, snapshot);

      expect(diff.metricChanges.healthScore.change).toBe(0);
      expect(diff.isImproving).toBe(false); // 0 is not > 0
    });

    it('should handle all metrics in comparison', () => {
      const older: HealthSnapshot = {
        id: '2024-01-01T00:00:00Z',
        timestamp: '2024-01-01T00:00:00Z',
        metrics: {
          fileCount: 10,
          totalLines: 1000,
          avgComplexity: 10,
          maxComplexity: 20,
          hotspotCount: 3,
          healthScore: 70,
        },
        distribution: { low: 5, medium: 3, high: 1, veryHigh: 1 },
      };

      const newer: HealthSnapshot = {
        id: '2024-01-15T00:00:00Z',
        timestamp: '2024-01-15T00:00:00Z',
        metrics: {
          fileCount: 15,
          totalLines: 1500,
          avgComplexity: 12,
          maxComplexity: 25,
          hotspotCount: 5,
          healthScore: 65,
        },
        distribution: { low: 6, medium: 4, high: 3, veryHigh: 2 },
      };

      const diff = diffSnapshots(older, newer);

      // Verify all metrics are tracked
      expect(Object.keys(diff.metricChanges)).toContain('fileCount');
      expect(Object.keys(diff.metricChanges)).toContain('totalLines');
      expect(Object.keys(diff.metricChanges)).toContain('avgComplexity');
      expect(Object.keys(diff.metricChanges)).toContain('maxComplexity');
      expect(Object.keys(diff.metricChanges)).toContain('hotspotCount');
      expect(Object.keys(diff.metricChanges)).toContain('healthScore');

      // Verify all distribution categories are tracked
      expect(Object.keys(diff.distributionChanges)).toContain('low');
      expect(Object.keys(diff.distributionChanges)).toContain('medium');
      expect(Object.keys(diff.distributionChanges)).toContain('high');
      expect(Object.keys(diff.distributionChanges)).toContain('veryHigh');
    });
  });

  describe('percentChange', () => {
    it('should calculate positive percentage change', () => {
      expect(percentChange(100, 150)).toBe(50);
      expect(percentChange(50, 75)).toBe(50);
    });

    it('should calculate negative percentage change', () => {
      expect(percentChange(100, 75)).toBe(-25);
      expect(percentChange(200, 100)).toBe(-50);
    });

    it('should handle zero before value', () => {
      expect(percentChange(0, 100)).toBe(100);
      expect(percentChange(0, 0)).toBe(0);
    });

    it('should handle no change', () => {
      expect(percentChange(100, 100)).toBe(0);
      expect(percentChange(50, 50)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(percentChange(100, 133)).toBe(33);
      expect(percentChange(3, 4)).toBe(33); // 33.33... rounds to 33
    });

    it('should handle small values', () => {
      expect(percentChange(1, 2)).toBe(100);
      expect(percentChange(2, 1)).toBe(-50);
    });

    it('should handle large values', () => {
      expect(percentChange(1000000, 2000000)).toBe(100);
      expect(percentChange(2000000, 1000000)).toBe(-50);
    });
  });

  describe('Integration scenarios', () => {
    it('should track codebase health over multiple snapshots', async () => {
      mockGit.revparse.mockResolvedValue('commit1');

      // Week 1: Healthy codebase
      const week1Graph = createMockGraph({
        nodes: createNodesWithComplexity([3, 4, 5, 6, 7]),
      });
      const week1Snapshot = await createSnapshot(week1Graph);

      // Week 2: Added complex features
      mockGit.revparse.mockResolvedValue('commit2');
      const week2Graph = createMockGraph({
        nodes: createNodesWithComplexity([3, 4, 5, 6, 7, 15, 20, 25]),
      });
      const week2Snapshot = await createSnapshot(week2Graph);

      // Week 3: Refactored high complexity
      mockGit.revparse.mockResolvedValue('commit3');
      const week3Graph = createMockGraph({
        nodes: createNodesWithComplexity([3, 4, 5, 6, 7, 8, 9, 10]),
      });
      const week3Snapshot = await createSnapshot(week3Graph);

      // Verify trend
      const diff1to2 = diffSnapshots(week1Snapshot, week2Snapshot);
      const diff2to3 = diffSnapshots(week2Snapshot, week3Snapshot);

      expect(diff1to2.isImproving).toBe(false); // Week 2 worse than Week 1
      expect(diff2to3.isImproving).toBe(true); // Week 3 better than Week 2

      // Verify overall improvement
      const diff1to3 = diffSnapshots(week1Snapshot, week3Snapshot);
      expect(diff1to3.metricChanges.avgComplexity.change).toBeLessThanOrEqual(2);
    });

    it('should correctly reflect refactoring improvements', async () => {
      mockGit.revparse.mockResolvedValue('before-refactor');

      // Before refactoring: One very complex function
      const beforeGraph = createMockGraph({
        nodes: createNodesWithComplexity([5, 5, 5, 5, 50]),
      });
      const beforeSnapshot = await createSnapshot(beforeGraph);

      mockGit.revparse.mockResolvedValue('after-refactor');

      // After refactoring: Split into smaller functions
      const afterGraph = createMockGraph({
        nodes: createNodesWithComplexity([5, 5, 5, 5, 10, 10, 10, 10, 10]),
      });
      const afterSnapshot = await createSnapshot(afterGraph);

      const diff = diffSnapshots(beforeSnapshot, afterSnapshot);

      expect(diff.metricChanges.maxComplexity.change).toBeLessThan(0); // Lower max
      expect(diff.isImproving).toBe(true);
      expect(diff.distributionChanges.veryHigh.change).toBeLessThanOrEqual(0); // Fewer very high
    });
  });
});
