/**
 * Health Command Tests
 *
 * Tests for the health command which generates codebase health reports.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';

// Mock dependencies before importing the module
vi.mock('../../src/graph/persistence.js', () => ({
  loadGraph: vi.fn(),
}));

vi.mock('../../src/analyzers/complexity.js', () => ({
  generateComplexityReport: vi.fn(),
  getComplexityEmoji: vi.fn((c: number) =>
    c <= 5 ? '🟢' : c <= 10 ? '🟡' : c <= 20 ? '🟠' : '🔴'
  ),
}));

vi.mock('../../src/export-png.js', () => ({
  isPngExportAvailable: vi.fn(() => Promise.resolve(false)),
  getRepoUrl: vi.fn(() => Promise.resolve(undefined)),
  exportToPng: vi.fn(),
}));

vi.mock('../../src/json-output.js', () => ({
  outputJson: vi.fn(),
  outputJsonError: vi.fn(),
}));

vi.mock('../../src/personality/formatter.js', () => ({
  formatHealthComment: vi.fn((score: number) =>
    score >= 80 ? 'Great health!' : score >= 60 ? 'Could be better.' : 'Needs attention.'
  ),
}));

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      red: (s: string) => s,
      white: (s: string) => s,
      cyan: (s: string) => s,
    }),
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    hex: () => (s: string) => s,
  },
}));

import type { ComplexityReport } from '../../src/analyzers/complexity.js';
import { generateComplexityReport } from '../../src/analyzers/complexity.js';
import { loadGraph } from '../../src/graph/persistence.js';
import { outputJson, outputJsonError } from '../../src/json-output.js';

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
      fileCount: 10,
      totalLines: 1000,
      languages: { typescript: 10 },
      nodeCount: 50,
      edgeCount: 30,
    },
    nodes: {},
    edges: [],
    ...overrides,
  };
}

/**
 * Helper to create a mock complexity report
 */
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

describe('Health Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('Graph Loading', () => {
    it('should show error when no graph exists', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      // Import and get the register function
      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      // Parse the command
      await program.parseAsync(['node', 'test', 'health', '-d', '/test']);

      expect(loadGraph).toHaveBeenCalledWith('/test');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No graph found'));
    });

    it('should output JSON error when no graph exists with --json flag', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test', '--json']);

      expect(outputJsonError).toHaveBeenCalledWith(
        'health',
        expect.stringContaining('No graph found')
      );
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate health score from complexity report', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 4 });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test']);

      expect(generateComplexityReport).toHaveBeenCalledWith(mockGraph);
      // Health score = 100 - averageComplexity * 5 = 100 - 4*5 = 80
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should output JSON with health data when --json flag is set', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({
        averageComplexity: 5,
        maxComplexity: 20,
        hotspots: [
          {
            filePath: 'src/complex.ts',
            name: 'complexFunction',
            type: 'function',
            complexity: 20,
            lineStart: 10,
            lineEnd: 50,
          },
        ],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'health',
        expect.objectContaining({
          healthScore: 75, // 100 - 5*5 = 75
          averageComplexity: 5,
          maxComplexity: 20,
          distribution: mockReport.distribution,
        }),
        expect.any(Object)
      );
    });
  });

  describe('Exit Code Handling', () => {
    it('should exit with code 1 when health score is below threshold with --exit-code', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 15 }); // Health = 25

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync([
        'node',
        'test',
        'health',
        '-d',
        '/test',
        '--exit-code',
        '--threshold',
        '50',
      ]);

      // Health score = 100 - 15*5 = 25, which is below threshold of 50
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should not exit when health score is above threshold', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 5 }); // Health = 75

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync([
        'node',
        'test',
        'health',
        '-d',
        '/test',
        '--exit-code',
        '--threshold',
        '50',
      ]);

      // Health score = 100 - 5*5 = 75, which is above threshold of 50
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with code 1 when health score is below threshold with --json', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 15 }); // Health = 25

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync([
        'node',
        'test',
        'health',
        '-d',
        '/test',
        '--json',
        '--exit-code',
        '--threshold',
        '50',
      ]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Hotspots Display', () => {
    it('should respect the --limit option for hotspots', async () => {
      const mockGraph = createMockGraph();
      const hotspots = Array(15)
        .fill(null)
        .map((_, i) => ({
          filePath: `src/file${i}.ts`,
          name: `func${i}`,
          type: 'function' as const,
          complexity: 20 - i,
          lineStart: 10,
          lineEnd: 50,
        }));

      const mockReport = createMockComplexityReport({ hotspots });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test', '--json', '--limit', '5']);

      expect(outputJson).toHaveBeenCalledWith(
        'health',
        expect.objectContaining({
          hotspots: expect.any(Array),
          totalHotspots: 15,
        }),
        expect.any(Object)
      );

      // Check that only 5 hotspots are included
      const call = vi.mocked(outputJson).mock.calls[0];
      expect(call[1].hotspots.length).toBe(5);
    });
  });

  describe('Health Score Bounds', () => {
    it('should not return health score below 0', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 30 }); // Would be -50

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'health',
        expect.objectContaining({
          healthScore: 0, // Max(0, 100 - 30*5) = Max(0, -50) = 0
        }),
        expect.any(Object)
      );
    });

    it('should cap health score at 100 for low complexity', async () => {
      const mockGraph = createMockGraph();
      const mockReport = createMockComplexityReport({ averageComplexity: 0 });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateComplexityReport).mockReturnValue(mockReport);

      const { register } = await import('../../src/commands/analysis/health.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'health', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'health',
        expect.objectContaining({
          healthScore: 100,
        }),
        expect.any(Object)
      );
    });
  });
});
