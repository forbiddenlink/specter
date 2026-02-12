/**
 * Risk Scorer Tests
 *
 * Tests for risk score calculation accuracy, weight verification,
 * and recommendation generation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';
import { calculateRiskScore } from '../../src/risk/scorer.js';
import type { DiffFile } from '../../src/risk/types.js';

// Mock the diff-analyzer module
vi.mock('../../src/risk/diff-analyzer.js', () => ({
  getStagedChanges: vi.fn(),
  getBranchChanges: vi.fn(),
  getCommitChanges: vi.fn(),
  analyzeDiffSize: vi.fn((files: DiffFile[]) => {
    let totalAdditions = 0;
    let totalDeletions = 0;
    let largestFile: DiffFile | null = null;
    let largestFileSize = 0;

    for (const file of files) {
      totalAdditions += file.additions;
      totalDeletions += file.deletions;
      const fileSize = file.additions + file.deletions;
      if (fileSize > largestFileSize) {
        largestFileSize = fileSize;
        largestFile = file;
      }
    }

    return { totalFiles: files.length, totalAdditions, totalDeletions, largestFile };
  }),
}));

// Import the mocked module
import * as diffAnalyzer from '../../src/risk/diff-analyzer.js';

/**
 * Helper to create a mock knowledge graph
 */
function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: 1,
      totalLines: 100,
      languages: { typescript: 1 },
      nodeCount: 2,
      edgeCount: 0,
    },
    nodes: {},
    edges: [],
    ...overrides,
  };
}

/**
 * Helper to create mock diff files
 */
function createDiffFiles(configs: Partial<DiffFile>[]): DiffFile[] {
  return configs.map((config, i) => ({
    filePath: config.filePath || `src/file${i}.ts`,
    status: config.status || 'modified',
    additions: config.additions ?? 10,
    deletions: config.deletions ?? 5,
    isBinary: config.isBinary ?? false,
    ...config,
  }));
}

describe('Risk Scorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Weight Verification', () => {
    it('should have weights that sum to 1.0', async () => {
      // Calculate risk to get the factors
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 10, deletions: 5 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      const totalWeight = Object.values(score.factors).reduce((sum, f) => sum + f.weight, 0);

      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    it('should apply correct weights to each factor', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 10, deletions: 5 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.filesChanged.weight).toBe(0.15);
      expect(score.factors.linesChanged.weight).toBe(0.15);
      expect(score.factors.complexityTouched.weight).toBe(0.25);
      expect(score.factors.dependentImpact.weight).toBe(0.25);
      expect(score.factors.busFactorRisk.weight).toBe(0.1);
      expect(score.factors.testCoverage.weight).toBe(0.1);
    });
  });

  describe('Empty Changes', () => {
    it('should return zero score for no staged changes', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue([]);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.overall).toBe(0);
      expect(score.level).toBe('low');
      expect(score.summary).toContain('Nothing to analyze');
    });

    it('should return zero score for empty branch changes', async () => {
      vi.mocked(diffAnalyzer.getBranchChanges).mockResolvedValue([]);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph, { branch: 'main' });

      expect(score.overall).toBe(0);
      expect(score.level).toBe('low');
    });

    it('should return zero score for empty commit changes', async () => {
      vi.mocked(diffAnalyzer.getCommitChanges).mockResolvedValue([]);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph, { commit: 'abc123' });

      expect(score.overall).toBe(0);
    });
  });

  describe('Files Changed Risk', () => {
    it('should score low for 1-3 files', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'a.ts' }, { filePath: 'b.ts' }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.filesChanged.score).toBe(10);
      expect(score.factors.filesChanged.details).toContain('2 files');
      expect(score.factors.filesChanged.details).toContain('Small, focused');
    });

    it('should score moderate for 4-10 files', async () => {
      const files = createDiffFiles(
        Array(7)
          .fill(null)
          .map((_, i) => ({ filePath: `file${i}.ts` }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.filesChanged.score).toBe(40);
      expect(score.factors.filesChanged.details).toContain('7 files');
      expect(score.factors.filesChanged.details).toContain('Moderate');
    });

    it('should score high for 11-20 files', async () => {
      const files = createDiffFiles(
        Array(15)
          .fill(null)
          .map((_, i) => ({ filePath: `file${i}.ts` }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.filesChanged.score).toBe(70);
      expect(score.factors.filesChanged.details).toContain('Large change');
    });

    it('should score critical for 21+ files', async () => {
      const files = createDiffFiles(
        Array(25)
          .fill(null)
          .map((_, i) => ({ filePath: `file${i}.ts` }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.filesChanged.score).toBe(100);
      expect(score.factors.filesChanged.details).toContain('Very large');
    });
  });

  describe('Lines Changed Risk', () => {
    it('should score low for minor changes (<=50 lines)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 25, deletions: 15 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.linesChanged.score).toBe(10);
      expect(score.factors.linesChanged.details).toContain('Minor');
    });

    it('should score moderate for 51-200 lines', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 100, deletions: 50 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.linesChanged.score).toBe(30);
      expect(score.factors.linesChanged.details).toContain('Moderate');
    });

    it('should score significant for 201-500 lines', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 300, deletions: 100 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.linesChanged.score).toBe(50);
      expect(score.factors.linesChanged.details).toContain('Significant');
    });

    it('should score high for 501-1000 lines', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 500, deletions: 200 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.linesChanged.score).toBe(75);
      expect(score.factors.linesChanged.details).toContain('Large');
    });

    it('should score critical for 1000+ lines', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 800, deletions: 400 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.linesChanged.score).toBe(100);
      expect(score.factors.linesChanged.details).toContain('Very large');
    });
  });

  describe('Complexity Risk', () => {
    it('should score zero when no complexity data available', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.complexityTouched.score).toBe(0);
      expect(score.factors.complexityTouched.details).toContain('No complexity');
    });

    it('should score low for low complexity code (<=5)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'func-1': {
            id: 'func-1',
            type: 'function',
            name: 'simpleFunc',
            filePath: 'src/test.ts',
            lineStart: 10,
            lineEnd: 20,
            exported: true,
            complexity: 3,
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.complexityTouched.score).toBe(10);
      expect(score.factors.complexityTouched.details).toContain('Low complexity');
    });

    it('should score high for high complexity code (11-20)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'func-1': {
            id: 'func-1',
            type: 'function',
            name: 'complexFunc',
            filePath: 'src/test.ts',
            lineStart: 10,
            lineEnd: 80,
            exported: true,
            complexity: 18,
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.complexityTouched.score).toBe(60);
      expect(score.factors.complexityTouched.details).toContain('High complexity');
    });

    it('should score critical for very high complexity code (>20)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'func-1': {
            id: 'func-1',
            type: 'function',
            name: 'veryComplexFunc',
            filePath: 'src/test.ts',
            lineStart: 10,
            lineEnd: 200,
            exported: true,
            complexity: 35,
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.complexityTouched.score).toBe(90);
      expect(score.factors.complexityTouched.details).toContain('Very high');
    });
  });

  describe('Dependent Impact Risk', () => {
    it('should score zero for no downstream dependencies', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/isolated.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'isolated.ts',
            filePath: 'src/isolated.ts',
            lineStart: 1,
            lineEnd: 50,
            exported: true,
          },
        },
        edges: [],
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.dependentImpact.score).toBe(0);
      expect(score.factors.dependentImpact.details).toContain('No downstream');
    });

    it('should score moderate for moderate ripple effect (4-10 dependents)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/core.ts' }])
      );

      const nodes: KnowledgeGraph['nodes'] = {
        'file-core': {
          id: 'file-core',
          type: 'file',
          name: 'core.ts',
          filePath: 'src/core.ts',
          lineStart: 1,
          lineEnd: 100,
          exported: true,
        },
      };

      const edges: KnowledgeGraph['edges'] = [];

      // Create 6 files that import core.ts
      for (let i = 0; i < 6; i++) {
        nodes[`file-${i}`] = {
          id: `file-${i}`,
          type: 'file',
          name: `consumer${i}.ts`,
          filePath: `src/consumer${i}.ts`,
          lineStart: 1,
          lineEnd: 50,
          exported: true,
        };

        edges.push({
          id: `edge-${i}`,
          source: `file-${i}`,
          target: 'file-core',
          type: 'imports',
        });
      }

      const graph = createMockGraph({ nodes, edges });
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.dependentImpact.score).toBe(40);
      expect(score.factors.dependentImpact.details).toContain('Moderate ripple');
    });
  });

  describe('Bus Factor Risk', () => {
    it('should score zero for no knowledge concentration', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
            contributors: ['alice', 'bob', 'charlie', 'dave'],
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.busFactorRisk.score).toBe(0);
      expect(score.factors.busFactorRisk.details).toContain('No knowledge concentration');
    });

    it('should score higher for single-owner files', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'src/test.ts' }])
      );

      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'test.ts',
            filePath: 'src/test.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
            contributors: ['alice'],
          },
        },
      });

      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.busFactorRisk.score).toBeGreaterThan(0);
      expect(score.factors.busFactorRisk.details).toContain('single-owner');
    });
  });

  describe('Test Coverage Risk', () => {
    it('should score zero when test files are changed alongside source', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([
          { filePath: 'src/feature.ts', additions: 50 },
          { filePath: 'tests/feature.test.ts', additions: 100 },
        ])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.testCoverage.score).toBe(0);
      expect(score.factors.testCoverage.details).toContain('test changes');
    });

    it('should score higher when no test changes accompany source changes', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([
          { filePath: 'src/feature1.ts', additions: 50 },
          { filePath: 'src/feature2.ts', additions: 30 },
          { filePath: 'src/feature3.ts', additions: 20 },
        ])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.testCoverage.score).toBeGreaterThan(50);
      expect(score.factors.testCoverage.details).toContain('No test changes');
    });

    it('should score zero when only test files are changed', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([
          { filePath: 'tests/unit.test.ts', additions: 50 },
          { filePath: 'tests/integration.spec.ts', additions: 30 },
        ])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.factors.testCoverage.score).toBe(0);
      expect(score.factors.testCoverage.details).toContain('No source files');
    });
  });

  describe('Risk Level Calculation', () => {
    it('should classify as low risk (0-25)', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 5, deletions: 2 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.level).toBe('low');
    });

    it('should classify as medium risk (26-50)', async () => {
      // Need more files and lines to reach medium threshold
      const files = createDiffFiles(
        Array(15)
          .fill(null)
          .map((_, i) => ({ filePath: `src/file${i}.ts`, additions: 100, deletions: 50 }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      // Add graph with complexity data to push score higher
      const nodes: KnowledgeGraph['nodes'] = {};
      for (let i = 0; i < 15; i++) {
        nodes[`file-${i}`] = {
          id: `file-${i}`,
          type: 'file',
          name: `file${i}.ts`,
          filePath: `src/file${i}.ts`,
          lineStart: 1,
          lineEnd: 100,
          exported: true,
        };
        nodes[`func-${i}`] = {
          id: `func-${i}`,
          type: 'function',
          name: `func${i}`,
          filePath: `src/file${i}.ts`,
          lineStart: 10,
          lineEnd: 50,
          exported: true,
          complexity: 12, // High complexity
        };
      }

      const graph = createMockGraph({ nodes });
      const score = await calculateRiskScore('/test', graph);

      expect(score.overall).toBeGreaterThanOrEqual(26);
      expect(score.overall).toBeLessThanOrEqual(50);
      expect(score.level).toBe('medium');
    });

    it('should classify as critical risk (76+)', async () => {
      // Change only a few core files, but have many dependents
      const files = createDiffFiles(
        Array(30)
          .fill(null)
          .map((_, i) => ({ filePath: `src/core${i}.ts`, additions: 500, deletions: 200 }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      // Add graph with very high complexity, many dependents NOT in change set
      const nodes: KnowledgeGraph['nodes'] = {};
      const edges: KnowledgeGraph['edges'] = [];

      // Changed files with high complexity
      for (let i = 0; i < 30; i++) {
        nodes[`file-core-${i}`] = {
          id: `file-core-${i}`,
          type: 'file',
          name: `core${i}.ts`,
          filePath: `src/core${i}.ts`,
          lineStart: 1,
          lineEnd: 500,
          exported: true,
          contributors: ['alice'], // Single owner = bus factor risk
        };
        nodes[`func-core-${i}`] = {
          id: `func-core-${i}`,
          type: 'function',
          name: `coreFunc${i}`,
          filePath: `src/core${i}.ts`,
          lineStart: 10,
          lineEnd: 400,
          exported: true,
          complexity: 35, // Very high complexity
        };
      }

      // Add 50 dependent files NOT in the change set that import core files
      for (let i = 0; i < 50; i++) {
        nodes[`file-dep-${i}`] = {
          id: `file-dep-${i}`,
          type: 'file',
          name: `dependent${i}.ts`,
          filePath: `src/features/dependent${i}.ts`,
          lineStart: 1,
          lineEnd: 100,
          exported: true,
        };

        // Each dependent imports a core file
        edges.push({
          id: `edge-${i}`,
          source: `file-dep-${i}`,
          target: `file-core-${i % 30}`,
          type: 'imports',
        });
      }

      const graph = createMockGraph({ nodes, edges });
      const score = await calculateRiskScore('/test', graph);

      expect(score.overall).toBeGreaterThan(75);
      expect(score.level).toBe('critical');
    });
  });

  describe('Recommendations', () => {
    it('should recommend splitting large changes', async () => {
      const files = createDiffFiles(
        Array(25)
          .fill(null)
          .map((_, i) => ({ filePath: `file${i}.ts` }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.recommendations.some((r) => r.includes('splitting'))).toBe(true);
    });

    it('should recommend adding tests when coverage is poor', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([
          { filePath: 'src/a.ts' },
          { filePath: 'src/b.ts' },
          { filePath: 'src/c.ts' },
        ])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.recommendations.some((r) => r.toLowerCase().includes('test'))).toBe(true);
    });

    it('should provide positive feedback for safe changes', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([
          { filePath: 'src/test.ts', additions: 5, deletions: 2 },
          { filePath: 'tests/test.test.ts', additions: 20 },
        ])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.recommendations.some((r) => r.includes('safe') || r.includes('Nice'))).toBe(
        true
      );
    });
  });

  describe('Summary Generation', () => {
    it('should generate first-person summary for low risk', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 5, deletions: 2 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.summary).toContain('safe');
      expect(score.summary).toContain('Low risk');
    });

    it('should generate warning summary for high risk', async () => {
      // Need substantial files with high complexity to reach high risk
      const files = createDiffFiles(
        Array(25)
          .fill(null)
          .map((_, i) => ({ filePath: `src/file${i}.ts`, additions: 200, deletions: 100 }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      // Add graph with high complexity to push into high risk
      const nodes: KnowledgeGraph['nodes'] = {};
      const edges: KnowledgeGraph['edges'] = [];

      for (let i = 0; i < 25; i++) {
        nodes[`file-${i}`] = {
          id: `file-${i}`,
          type: 'file',
          name: `file${i}.ts`,
          filePath: `src/file${i}.ts`,
          lineStart: 1,
          lineEnd: 300,
          exported: true,
          contributors: ['alice'], // Single owner
        };
        nodes[`func-${i}`] = {
          id: `func-${i}`,
          type: 'function',
          name: `func${i}`,
          filePath: `src/file${i}.ts`,
          lineStart: 10,
          lineEnd: 200,
          exported: true,
          complexity: 25, // Very high complexity
        };
      }

      // Add import edges for dependent impact
      for (let i = 1; i < 25; i++) {
        edges.push({
          id: `edge-${i}`,
          source: `file-${i}`,
          target: 'file-0',
          type: 'imports',
        });
      }

      const graph = createMockGraph({ nodes, edges });
      const score = await calculateRiskScore('/test', graph);

      // Should be high or critical risk, which triggers warning
      expect(score.summary).toMatch(/Warning|high-risk|review carefully|CRITICAL/i);
    });
  });

  describe('Option Handling', () => {
    it('should use staged changes by default', async () => {
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts' }])
      );

      const graph = createMockGraph();
      await calculateRiskScore('/test', graph);

      expect(diffAnalyzer.getStagedChanges).toHaveBeenCalledWith('/test');
      expect(diffAnalyzer.getBranchChanges).not.toHaveBeenCalled();
      expect(diffAnalyzer.getCommitChanges).not.toHaveBeenCalled();
    });

    it('should use branch changes when branch option provided', async () => {
      vi.mocked(diffAnalyzer.getBranchChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts' }])
      );

      const graph = createMockGraph();
      await calculateRiskScore('/test', graph, { branch: 'main' });

      expect(diffAnalyzer.getBranchChanges).toHaveBeenCalledWith('/test', 'main');
      expect(diffAnalyzer.getStagedChanges).not.toHaveBeenCalled();
    });

    it('should use commit changes when commit option provided', async () => {
      vi.mocked(diffAnalyzer.getCommitChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts' }])
      );

      const graph = createMockGraph();
      await calculateRiskScore('/test', graph, { commit: 'abc123' });

      expect(diffAnalyzer.getCommitChanges).toHaveBeenCalledWith('/test', 'abc123');
      expect(diffAnalyzer.getStagedChanges).not.toHaveBeenCalled();
    });
  });

  describe('Overall Score Calculation', () => {
    it('should calculate weighted average correctly', async () => {
      // Create a scenario where we can predict the exact score
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(
        createDiffFiles([{ filePath: 'test.ts', additions: 10, deletions: 5 }])
      );

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      // Verify overall is weighted sum
      const calculatedOverall = Math.round(
        Object.values(score.factors).reduce((sum, f) => sum + f.score * f.weight, 0)
      );

      expect(score.overall).toBe(calculatedOverall);
    });

    it('should bound overall score between 0 and 100', async () => {
      // Even with extreme inputs, score should be bounded
      const files = createDiffFiles(
        Array(100)
          .fill(null)
          .map((_, i) => ({ filePath: `file${i}.ts`, additions: 500, deletions: 500 }))
      );
      vi.mocked(diffAnalyzer.getStagedChanges).mockResolvedValue(files);

      const graph = createMockGraph();
      const score = await calculateRiskScore('/test', graph);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });
});
