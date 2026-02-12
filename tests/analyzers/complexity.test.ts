/**
 * Complexity Analyzer Tests
 *
 * Tests for complexity calculation, reporting, and analysis utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  COMPLEXITY_THRESHOLDS,
  compareComplexity,
  findComplexityHotspots,
  generateComplexityReport,
  getComplexityByDirectory,
  getComplexityCategory,
  getComplexityEmoji,
  suggestRefactoringTargets,
} from '../../src/analyzers/complexity.js';
import type { GraphNode, KnowledgeGraph } from '../../src/graph/types.js';

/**
 * Helper to create a mock knowledge graph for testing
 */
function createMockGraph(nodes: Partial<GraphNode>[]): KnowledgeGraph {
  const nodeMap: Record<string, GraphNode> = {};

  for (const node of nodes) {
    const fullNode: GraphNode = {
      id: node.id || `node-${Math.random().toString(36).slice(2)}`,
      type: node.type || 'function',
      name: node.name || 'testNode',
      filePath: node.filePath || 'test.ts',
      lineStart: node.lineStart || 1,
      lineEnd: node.lineEnd || 10,
      exported: node.exported ?? true,
      complexity: node.complexity,
      ...node,
    };
    nodeMap[fullNode.id] = fullNode;
  }

  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: nodes.filter((n) => n.type === 'file').length || 1,
      totalLines: 100,
      languages: { typescript: 1 },
      nodeCount: nodes.length,
      edgeCount: 0,
    },
    nodes: nodeMap,
    edges: [],
  };
}

describe('Complexity Analyzer', () => {
  describe('COMPLEXITY_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(COMPLEXITY_THRESHOLDS.low).toBe(5);
      expect(COMPLEXITY_THRESHOLDS.medium).toBe(10);
      expect(COMPLEXITY_THRESHOLDS.high).toBe(20);
    });
  });

  describe('getComplexityCategory', () => {
    it('should return "low" for complexity 1-5', () => {
      expect(getComplexityCategory(1)).toBe('low');
      expect(getComplexityCategory(3)).toBe('low');
      expect(getComplexityCategory(5)).toBe('low');
    });

    it('should return "medium" for complexity 6-10', () => {
      expect(getComplexityCategory(6)).toBe('medium');
      expect(getComplexityCategory(8)).toBe('medium');
      expect(getComplexityCategory(10)).toBe('medium');
    });

    it('should return "high" for complexity 11-20', () => {
      expect(getComplexityCategory(11)).toBe('high');
      expect(getComplexityCategory(15)).toBe('high');
      expect(getComplexityCategory(20)).toBe('high');
    });

    it('should return "veryHigh" for complexity > 20', () => {
      expect(getComplexityCategory(21)).toBe('veryHigh');
      expect(getComplexityCategory(50)).toBe('veryHigh');
      expect(getComplexityCategory(100)).toBe('veryHigh');
    });

    it('should handle edge cases', () => {
      expect(getComplexityCategory(0)).toBe('low');
      expect(getComplexityCategory(-1)).toBe('low');
    });
  });

  describe('getComplexityEmoji', () => {
    it('should return green circle emoji for low complexity', () => {
      expect(getComplexityEmoji(1)).toBe('\u{1F7E2}'); // Green circle emoji
    });

    it('should return yellow circle emoji for medium complexity', () => {
      expect(getComplexityEmoji(8)).toBe('\u{1F7E1}'); // Yellow circle emoji
    });

    it('should return orange circle emoji for high complexity', () => {
      expect(getComplexityEmoji(15)).toBe('\u{1F7E0}'); // Orange circle emoji
    });

    it('should return red circle emoji for very high complexity', () => {
      expect(getComplexityEmoji(25)).toBe('\u{1F534}'); // Red circle emoji
    });
  });

  describe('findComplexityHotspots', () => {
    it('should find nodes above threshold', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'simple', complexity: 2 },
        { id: 'f2', name: 'moderate', complexity: 8 },
        { id: 'f3', name: 'complex', complexity: 15 },
        { id: 'f4', name: 'veryComplex', complexity: 25 },
      ]);

      const hotspots = findComplexityHotspots(graph, { threshold: 10 });

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].name).toBe('veryComplex');
      expect(hotspots[1].name).toBe('complex');
    });

    it('should respect limit option', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 15 },
        { id: 'f2', complexity: 20 },
        { id: 'f3', complexity: 25 },
        { id: 'f4', complexity: 30 },
      ]);

      const hotspots = findComplexityHotspots(graph, { limit: 2 });

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].complexity).toBe(30);
      expect(hotspots[1].complexity).toBe(25);
    });

    it('should sort by complexity descending', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 12 },
        { id: 'f2', complexity: 25 },
        { id: 'f3', complexity: 18 },
      ]);

      const hotspots = findComplexityHotspots(graph);

      expect(hotspots[0].complexity).toBe(25);
      expect(hotspots[1].complexity).toBe(18);
      expect(hotspots[2].complexity).toBe(12);
    });

    it('should exclude file nodes by default', () => {
      const graph = createMockGraph([
        { id: 'file1', type: 'file', name: 'file.ts', complexity: 100 },
        { id: 'f1', type: 'function', name: 'func', complexity: 15 },
      ]);

      const hotspots = findComplexityHotspots(graph);

      expect(hotspots).toHaveLength(1);
      expect(hotspots[0].type).toBe('function');
    });

    it('should include file nodes when specified', () => {
      const graph = createMockGraph([
        { id: 'file1', type: 'file', name: 'file.ts', complexity: 100 },
        { id: 'f1', type: 'function', name: 'func', complexity: 15 },
      ]);

      const hotspots = findComplexityHotspots(graph, { includeFiles: true });

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].complexity).toBe(100);
    });

    it('should handle empty graph', () => {
      const graph = createMockGraph([]);
      const hotspots = findComplexityHotspots(graph);
      expect(hotspots).toHaveLength(0);
    });

    it('should handle nodes without complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'noComplexity' },
        { id: 'f2', name: 'hasComplexity', complexity: 15 },
      ]);

      const hotspots = findComplexityHotspots(graph);

      expect(hotspots).toHaveLength(1);
      expect(hotspots[0].name).toBe('hasComplexity');
    });
  });

  describe('generateComplexityReport', () => {
    it('should calculate average complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 5 },
        { id: 'f2', complexity: 10 },
        { id: 'f3', complexity: 15 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.averageComplexity).toBe(10);
    });

    it('should calculate max complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 5 },
        { id: 'f2', complexity: 25 },
        { id: 'f3', complexity: 15 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.maxComplexity).toBe(25);
    });

    it('should calculate total complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 5 },
        { id: 'f2', complexity: 10 },
        { id: 'f3', complexity: 15 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.totalComplexity).toBe(30);
    });

    it('should calculate distribution', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 2 }, // low
        { id: 'f2', complexity: 4 }, // low
        { id: 'f3', complexity: 8 }, // medium
        { id: 'f4', complexity: 15 }, // high
        { id: 'f5', complexity: 25 }, // veryHigh
      ]);

      const report = generateComplexityReport(graph);

      expect(report.distribution.low).toBe(2);
      expect(report.distribution.medium).toBe(1);
      expect(report.distribution.high).toBe(1);
      expect(report.distribution.veryHigh).toBe(1);
    });

    it('should include hotspots', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 15 },
        { id: 'f2', complexity: 25 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.hotspots.length).toBeGreaterThan(0);
    });

    it('should handle empty graph', () => {
      const graph = createMockGraph([]);
      const report = generateComplexityReport(graph);

      expect(report.averageComplexity).toBe(0);
      expect(report.maxComplexity).toBe(0);
      expect(report.totalComplexity).toBe(0);
      expect(report.distribution).toEqual({
        low: 0,
        medium: 0,
        high: 0,
        veryHigh: 0,
      });
    });

    it('should exclude file nodes from calculations', () => {
      const graph = createMockGraph([
        { id: 'file1', type: 'file', complexity: 100 },
        { id: 'f1', type: 'function', complexity: 10 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.averageComplexity).toBe(10);
      expect(report.maxComplexity).toBe(10);
    });

    it('should round average to 2 decimal places', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 3 },
        { id: 'f2', complexity: 7 },
        { id: 'f3', complexity: 11 },
      ]);

      const report = generateComplexityReport(graph);

      expect(report.averageComplexity).toBe(7);
    });
  });

  describe('compareComplexity', () => {
    it('should detect improved complexity', () => {
      const before = createMockGraph([{ id: 'f1', name: 'func1', complexity: 20 }]);
      const after = createMockGraph([{ id: 'f1', name: 'func1', complexity: 10 }]);

      const result = compareComplexity(before, after);

      expect(result.improved).toHaveLength(1);
      expect(result.worsened).toHaveLength(0);
    });

    it('should detect worsened complexity', () => {
      const before = createMockGraph([{ id: 'f1', name: 'func1', complexity: 10 }]);
      const after = createMockGraph([{ id: 'f1', name: 'func1', complexity: 20 }]);

      const result = compareComplexity(before, after);

      expect(result.improved).toHaveLength(0);
      expect(result.worsened).toHaveLength(1);
    });

    it('should count unchanged nodes', () => {
      const before = createMockGraph([
        { id: 'f1', name: 'func1', complexity: 10 },
        { id: 'f2', name: 'func2', complexity: 15 },
      ]);
      const after = createMockGraph([
        { id: 'f1', name: 'func1', complexity: 10 },
        { id: 'f2', name: 'func2', complexity: 15 },
      ]);

      const result = compareComplexity(before, after);

      expect(result.unchanged).toBe(2);
    });

    it('should handle nodes in after but not in before', () => {
      const before = createMockGraph([]);
      const after = createMockGraph([{ id: 'f1', name: 'newFunc', complexity: 10 }]);

      const result = compareComplexity(before, after);

      // New nodes are not compared
      expect(result.improved).toHaveLength(0);
      expect(result.worsened).toHaveLength(0);
      expect(result.unchanged).toBe(0);
    });

    it('should handle nodes without complexity', () => {
      const before = createMockGraph([{ id: 'f1', name: 'func1' }]);
      const after = createMockGraph([{ id: 'f1', name: 'func1', complexity: 10 }]);

      const result = compareComplexity(before, after);

      // Nodes without complexity in before are skipped
      expect(result.improved).toHaveLength(0);
      expect(result.worsened).toHaveLength(0);
    });
  });

  describe('getComplexityByDirectory', () => {
    it('should group complexity by directory', () => {
      const graph = createMockGraph([
        { id: 'f1', type: 'file', filePath: 'src/utils.ts', complexity: 10 },
        { id: 'f2', type: 'file', filePath: 'src/helpers.ts', complexity: 20 },
        { id: 'f3', type: 'file', filePath: 'lib/core.ts', complexity: 15 },
      ]);

      const result = getComplexityByDirectory(graph);

      expect(result.get('src')).toBeDefined();
      expect(result.get('src')!.totalComplexity).toBe(30);
      expect(result.get('src')!.fileCount).toBe(2);

      expect(result.get('lib')).toBeDefined();
      expect(result.get('lib')!.totalComplexity).toBe(15);
      expect(result.get('lib')!.fileCount).toBe(1);
    });

    it('should calculate average complexity per directory', () => {
      const graph = createMockGraph([
        { id: 'f1', type: 'file', filePath: 'src/a.ts', complexity: 10 },
        { id: 'f2', type: 'file', filePath: 'src/b.ts', complexity: 20 },
      ]);

      const result = getComplexityByDirectory(graph);

      expect(result.get('src')!.avgComplexity).toBe(15);
    });

    it('should handle root-level files', () => {
      const graph = createMockGraph([
        { id: 'f1', type: 'file', filePath: 'index.ts', complexity: 10 },
      ]);

      const result = getComplexityByDirectory(graph);

      expect(result.get('.')).toBeDefined();
      expect(result.get('.')!.totalComplexity).toBe(10);
    });

    it('should only include file nodes', () => {
      const graph = createMockGraph([
        { id: 'f1', type: 'file', filePath: 'src/app.ts', complexity: 10 },
        {
          id: 'f2',
          type: 'function',
          filePath: 'src/app.ts',
          complexity: 100,
        },
      ]);

      const result = getComplexityByDirectory(graph);

      expect(result.get('src')!.totalComplexity).toBe(10);
    });

    it('should handle nested directories', () => {
      const graph = createMockGraph([
        {
          id: 'f1',
          type: 'file',
          filePath: 'src/components/Button.ts',
          complexity: 10,
        },
        {
          id: 'f2',
          type: 'file',
          filePath: 'src/components/Input.ts',
          complexity: 15,
        },
      ]);

      const result = getComplexityByDirectory(graph);

      expect(result.get('src/components')).toBeDefined();
      expect(result.get('src/components')!.fileCount).toBe(2);
    });
  });

  describe('suggestRefactoringTargets', () => {
    it('should suggest refactoring for very high complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'complexFunc', complexity: 25, lineStart: 1, lineEnd: 30 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].priority).toBe('high');
      expect(suggestions[0].reason).toContain('25');
    });

    it('should suggest refactoring for high complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'moderateFunc', complexity: 15, lineStart: 1, lineEnd: 30 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].priority).toBe('medium');
    });

    it('should suggest refactoring for long functions', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'longFunc', complexity: 8, lineStart: 1, lineEnd: 60 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].reason).toContain('59 lines');
    });

    it('should not suggest for low complexity short functions', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'simpleFunc', complexity: 3, lineStart: 1, lineEnd: 10 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(0);
    });

    it('should sort suggestions by priority', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'medium', complexity: 15, lineStart: 1, lineEnd: 30 },
        { id: 'f2', name: 'high', complexity: 25, lineStart: 1, lineEnd: 30 },
        { id: 'f3', name: 'long', complexity: 8, lineStart: 1, lineEnd: 60 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions[0].priority).toBe('high');
      expect(suggestions[1].priority).toBe('medium');
    });

    it('should skip file nodes', () => {
      const graph = createMockGraph([
        { id: 'f1', type: 'file', name: 'file.ts', complexity: 100, lineStart: 1, lineEnd: 200 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(0);
    });

    it('should skip nodes without complexity', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'noComplexity', lineStart: 1, lineEnd: 100 },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      expect(suggestions).toHaveLength(0);
    });

    it('should handle multiple issues for same function', () => {
      const graph = createMockGraph([
        {
          id: 'f1',
          name: 'badFunc',
          complexity: 25, // very high
          lineStart: 1,
          lineEnd: 80, // also long
        },
      ]);

      const suggestions = suggestRefactoringTargets(graph);

      // Should have two suggestions for the same function
      expect(suggestions).toHaveLength(2);
    });
  });

  describe('Custom thresholds', () => {
    it('should respect custom thresholds in getComplexityCategory', () => {
      const customThresholds = { low: 3, medium: 6, high: 12 };

      expect(getComplexityCategory(3, customThresholds)).toBe('low');
      expect(getComplexityCategory(4, customThresholds)).toBe('medium');
      expect(getComplexityCategory(6, customThresholds)).toBe('medium');
      expect(getComplexityCategory(7, customThresholds)).toBe('high');
      expect(getComplexityCategory(12, customThresholds)).toBe('high');
      expect(getComplexityCategory(13, customThresholds)).toBe('veryHigh');
    });

    it('should use custom thresholds in getComplexityEmoji', () => {
      const customThresholds = { low: 2, medium: 4, high: 8 };

      expect(getComplexityEmoji(2, customThresholds)).toBe('\u{1F7E2}'); // Green - low
      expect(getComplexityEmoji(3, customThresholds)).toBe('\u{1F7E1}'); // Yellow - medium
      expect(getComplexityEmoji(5, customThresholds)).toBe('\u{1F7E0}'); // Orange - high
      expect(getComplexityEmoji(10, customThresholds)).toBe('\u{1F534}'); // Red - veryHigh
    });

    it('should use custom thresholds in findComplexityHotspots', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'simple', complexity: 3 },
        { id: 'f2', name: 'moderate', complexity: 5 },
        { id: 'f3', name: 'complex', complexity: 8 },
      ]);

      const customThresholds = { low: 2, medium: 4, high: 6 };

      // With custom medium threshold of 4, should find 5 and 8
      const hotspots = findComplexityHotspots(graph, {
        threshold: customThresholds.medium,
        thresholds: customThresholds,
      });

      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].complexity).toBe(8);
      expect(hotspots[1].complexity).toBe(5);
    });

    it('should use custom thresholds in generateComplexityReport', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 2 }, // low with custom
        { id: 'f2', complexity: 4 }, // medium with custom
        { id: 'f3', complexity: 6 }, // high with custom
        { id: 'f4', complexity: 10 }, // veryHigh with custom
      ]);

      const customThresholds = { low: 2, medium: 4, high: 8 };
      const report = generateComplexityReport(graph, customThresholds);

      expect(report.distribution.low).toBe(1);
      expect(report.distribution.medium).toBe(1);
      expect(report.distribution.high).toBe(1);
      expect(report.distribution.veryHigh).toBe(1);
    });

    it('should use custom thresholds in suggestRefactoringTargets', () => {
      const graph = createMockGraph([
        { id: 'f1', name: 'simpleFunc', complexity: 3, lineStart: 1, lineEnd: 10 },
        { id: 'f2', name: 'moderateFunc', complexity: 5, lineStart: 11, lineEnd: 30 },
        { id: 'f3', name: 'complexFunc', complexity: 8, lineStart: 31, lineEnd: 50 },
      ]);

      // With custom thresholds:
      // - complexity 3: not suggested (3 is not > medium 4)
      // - complexity 5: medium priority (5 > medium 4, but not > high 6)
      // - complexity 8: high priority (8 > high 6)
      const customThresholds = { low: 2, medium: 4, high: 6 };
      const suggestions = suggestRefactoringTargets(graph, customThresholds);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].priority).toBe('high');
      expect(suggestions[0].node.name).toBe('complexFunc');
      expect(suggestions[1].priority).toBe('medium');
      expect(suggestions[1].node.name).toBe('moderateFunc');
    });

    it('should handle stricter thresholds', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 2 },
        { id: 'f2', complexity: 3 },
        { id: 'f3', complexity: 5 },
      ]);

      const strictThresholds = { low: 1, medium: 2, high: 4 };
      const report = generateComplexityReport(graph, strictThresholds);

      // With strict thresholds, most functions are high/veryHigh
      expect(report.distribution.low).toBe(0);
      expect(report.distribution.medium).toBe(1); // complexity 2
      expect(report.distribution.high).toBe(1); // complexity 3
      expect(report.distribution.veryHigh).toBe(1); // complexity 5
    });

    it('should handle relaxed thresholds', () => {
      const graph = createMockGraph([
        { id: 'f1', complexity: 10 },
        { id: 'f2', complexity: 20 },
        { id: 'f3', complexity: 30 },
      ]);

      const relaxedThresholds = { low: 15, medium: 25, high: 40 };
      const report = generateComplexityReport(graph, relaxedThresholds);

      // With relaxed thresholds, even high complexity is considered low/medium
      expect(report.distribution.low).toBe(1); // complexity 10
      expect(report.distribution.medium).toBe(1); // complexity 20
      expect(report.distribution.high).toBe(1); // complexity 30
      expect(report.distribution.veryHigh).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle realistic codebase graph', () => {
      const graph = createMockGraph([
        // Files
        { id: 'file1', type: 'file', name: 'utils.ts', filePath: 'src/utils.ts', complexity: 45 },
        { id: 'file2', type: 'file', name: 'api.ts', filePath: 'src/api.ts', complexity: 30 },

        // Functions with varying complexity
        {
          id: 'f1',
          type: 'function',
          name: 'parseData',
          filePath: 'src/utils.ts',
          complexity: 12,
          lineStart: 1,
          lineEnd: 25,
        },
        {
          id: 'f2',
          type: 'function',
          name: 'validateInput',
          filePath: 'src/utils.ts',
          complexity: 18,
          lineStart: 27,
          lineEnd: 60,
        },
        {
          id: 'f3',
          type: 'function',
          name: 'formatOutput',
          filePath: 'src/utils.ts',
          complexity: 5,
          lineStart: 62,
          lineEnd: 80,
        },
        {
          id: 'f4',
          type: 'function',
          name: 'fetchData',
          filePath: 'src/api.ts',
          complexity: 8,
          lineStart: 1,
          lineEnd: 30,
        },
        {
          id: 'f5',
          type: 'function',
          name: 'processResponse',
          filePath: 'src/api.ts',
          complexity: 22,
          lineStart: 32,
          lineEnd: 100,
        },

        // Class with methods
        {
          id: 'c1',
          type: 'class',
          name: 'DataHandler',
          filePath: 'src/utils.ts',
          complexity: 10,
          lineStart: 100,
          lineEnd: 150,
        },
      ]);

      // Test report generation
      const report = generateComplexityReport(graph);
      expect(report.averageComplexity).toBeGreaterThan(0);
      expect(report.maxComplexity).toBe(22);
      expect(report.hotspots.length).toBeGreaterThan(0);

      // Test directory grouping
      const dirStats = getComplexityByDirectory(graph);
      expect(dirStats.get('src')).toBeDefined();

      // Test refactoring suggestions
      const suggestions = suggestRefactoringTargets(graph);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.node.name === 'processResponse')).toBe(true);
    });
  });
});
