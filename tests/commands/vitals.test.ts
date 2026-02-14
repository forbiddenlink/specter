/**
 * Vitals Command Tests
 *
 * Tests for the vitals command which shows codebase vital signs.
 * Includes regression tests for ESM import fix (commit 0c44a93).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';

// Mock dependencies before importing the module
vi.mock('../../src/graph/persistence.js', () => ({
  loadGraph: vi.fn(),
}));

vi.mock('../../src/analyzers/complexity.js', () => ({
  generateComplexityReport: vi.fn(),
}));

vi.mock('../../src/analyzers/knowledge.js', () => ({
  analyzeKnowledgeDistribution: vi.fn(),
}));

vi.mock('../../src/history/storage.js', () => ({
  loadSnapshots: vi.fn(),
}));

vi.mock('../../src/json-output.js', () => ({
  outputJson: vi.fn(),
  outputJsonError: vi.fn(),
}));

vi.mock('../../src/cli-utils.js', () => ({
  showNextSteps: vi.fn(),
}));

vi.mock('../../src/ui/index.js', () => ({
  coloredSparkline: vi.fn(() => '▁▂▃▄▅▆▇█'),
}));

// Mock chalk - this is the key regression test for ESM import fix
vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      magenta: (s: string) => s,
      white: (s: string) => s,
    }),
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import type { ComplexityReport } from '../../src/analyzers/complexity.js';
import { generateComplexityReport } from '../../src/analyzers/complexity.js';
import { analyzeKnowledgeDistribution } from '../../src/analyzers/knowledge.js';
import { loadGraph } from '../../src/graph/persistence.js';
import { loadSnapshots } from '../../src/history/storage.js';
import { outputJson, outputJsonError } from '../../src/json-output.js';

function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: 10,
      totalLines: 1000,
      languages: { typescript: 10 },
      nodeCount: 50,
      edgeCount: 30,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'test.ts',
        filePath: 'src/test.ts',
        complexity: 5,
      },
    },
    edges: [],
    ...overrides,
  };
}

function createMockComplexityReport(overrides: Partial<ComplexityReport> = {}): ComplexityReport {
  return {
    averageComplexity: 5,
    maxComplexity: 15,
    totalComplexity: 50,
    hotspots: [],
    distribution: {
      low: 30,
      medium: 15,
      high: 4,
      veryHigh: 1,
    },
    ...overrides,
  };
}

describe('Vitals Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Graph Loading', () => {
    it('should show error when no graph exists', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test']);

      expect(loadGraph).toHaveBeenCalledWith('/test');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No graph found'));
    });

    it('should output JSON error when no graph exists with --json flag', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test', '--json']);

      expect(outputJsonError).toHaveBeenCalledWith(
        'vitals',
        expect.stringContaining('No graph found')
      );
    });
  });

  describe('Vitals Display', () => {
    it('should display vitals dashboard with valid graph', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport();

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);
      vi.mocked(analyzeKnowledgeDistribution).mockResolvedValue({
        overallBusFactor: 2.5,
        files: [],
      });
      vi.mocked(loadSnapshots).mockResolvedValue([]);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test']);

      expect(generateComplexityReport).toHaveBeenCalledWith(mockGraph);
      expect(analyzeKnowledgeDistribution).toHaveBeenCalled();
      // Verify dashboard output contains expected sections
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SPECTER VITAL SIGNS'));
    });

    it('should output JSON with vitals data when --json flag is set', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 4 });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);
      vi.mocked(analyzeKnowledgeDistribution).mockResolvedValue({
        overallBusFactor: 3,
        files: [],
      });
      vi.mocked(loadSnapshots).mockResolvedValue([]);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test', '--json']);

      // Health score = 100 - 4*5 = 80
      expect(outputJson).toHaveBeenCalledWith(
        'vitals',
        expect.objectContaining({
          healthScore: 80,
          pulseStatus: 'STABLE',
          avgComplexity: 4,
          busFactor: 3,
        })
      );
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate correct health score from complexity', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 8 });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);
      vi.mocked(analyzeKnowledgeDistribution).mockResolvedValue({
        overallBusFactor: 2,
        files: [],
      });
      vi.mocked(loadSnapshots).mockResolvedValue([]);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test', '--json']);

      // Health score = 100 - 8*5 = 60
      expect(outputJson).toHaveBeenCalledWith(
        'vitals',
        expect.objectContaining({
          healthScore: 60,
          pulseStatus: 'ELEVATED',
        })
      );
    });

    it('should not return health score below 0', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 30 });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);
      vi.mocked(analyzeKnowledgeDistribution).mockResolvedValue({
        overallBusFactor: 1,
        files: [],
      });
      vi.mocked(loadSnapshots).mockResolvedValue([]);

      const { register } = await import('../../src/commands/analysis/vitals.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'vitals', '-d', '/test', '--json']);

      // Health score = max(0, 100 - 30*5) = max(0, -50) = 0
      expect(outputJson).toHaveBeenCalledWith(
        'vitals',
        expect.objectContaining({
          healthScore: 0,
          pulseStatus: 'CRITICAL',
        })
      );
    });
  });
});

describe('Vitals Helpers', () => {
  // These tests verify the helper functions work correctly
  // and indirectly test that chalk ESM import is working

  it('should import vitals-helpers without ESM errors', async () => {
    // This is a regression test for commit 0c44a93
    // The module should import successfully with ESM chalk
    const helpers = await import('../../src/commands/analysis/vitals-helpers.js');

    expect(helpers.getHealthStatus).toBeDefined();
    expect(helpers.getComplexityStatus).toBeDefined();
    expect(helpers.getBusFactorStatus).toBeDefined();
    expect(helpers.getDeadExportsStatus).toBeDefined();
    expect(helpers.getCoverageStatus).toBeDefined();
    expect(helpers.makeBar).toBeDefined();
    expect(helpers.formatHealthIndicator).toBeDefined();
  });

  it('should calculate health status correctly', async () => {
    const { getHealthStatus } = await import('../../src/commands/analysis/vitals-helpers.js');

    expect(getHealthStatus(85).status).toBe('STABLE');
    expect(getHealthStatus(70).status).toBe('ELEVATED');
    expect(getHealthStatus(50).status).toBe('CRITICAL');
  });

  it('should calculate complexity status correctly', async () => {
    const { getComplexityStatus } = await import('../../src/commands/analysis/vitals-helpers.js');

    expect(getComplexityStatus(3).statusText).toBe('healthy');
    expect(getComplexityStatus(7).statusText).toBe('⚠️  warning');
    expect(getComplexityStatus(15).statusText).toBe('critical');
  });

  it('should calculate bus factor status correctly', async () => {
    const { getBusFactorStatus } = await import('../../src/commands/analysis/vitals-helpers.js');

    expect(getBusFactorStatus(4).statusText).toBe('healthy');
    expect(getBusFactorStatus(2.5).statusText).toBe('😰 at risk');
    expect(getBusFactorStatus(1).statusText).toBe('critical');
  });

  it('should generate progress bars correctly', async () => {
    const { makeBar } = await import('../../src/commands/analysis/vitals-helpers.js');

    expect(makeBar(50, 100, 10)).toBe('█████░░░░░');
    expect(makeBar(100, 100, 10)).toBe('██████████');
    expect(makeBar(0, 100, 10)).toBe('░░░░░░░░░░');
  });

  it('should format health indicator correctly', async () => {
    const { formatHealthIndicator } = await import('../../src/commands/analysis/vitals-helpers.js');

    // The result will be colored, but we verify it contains expected content
    const positive = formatHealthIndicator(5);
    expect(positive).toContain('+5');

    const negative = formatHealthIndicator(-3);
    expect(negative).toContain('-3');
  });
});
