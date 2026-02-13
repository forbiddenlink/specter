/**
 * Roast Command Tests
 *
 * Tests for the roast command which provides comedic analysis of the codebase.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';

// Mock dependencies before importing the module
vi.mock('../../src/graph/persistence.js', () => ({
  loadGraph: vi.fn(),
}));

vi.mock('../../src/analyzers/complexity.js', () => ({
  generateComplexityReport: vi.fn(() => ({
    averageComplexity: 8,
    maxComplexity: 25,
    totalComplexity: 100,
    hotspots: [],
    distribution: { low: 10, medium: 5, high: 2, veryHigh: 1 },
  })),
}));

vi.mock('../../src/tools/get-dead-code.js', () => ({
  execute: vi.fn(() => ({
    totalCount: 5,
    items: [{ filePath: 'src/unused.ts', name: 'unusedFunc', type: 'function' }],
  })),
}));

vi.mock('../../src/tools/get-bus-factor.js', () => ({
  execute: vi.fn(() =>
    Promise.resolve({
      analyzed: true,
      overallBusFactor: 2,
      topOwners: [{ name: 'Alice', percentage: 45, filesOwned: 10 }],
      criticalAreas: [],
    })
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

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      red: (s: string) => s,
      cyan: (s: string) => s,
      gray: (s: string) => s,
      magenta: (s: string) => s,
      yellow: (s: string) => s,
    }),
    yellow: (s: string) => s,
    white: (s: string) => s,
    dim: (s: string) => s,
    italic: (s: string) => s,
    red: (s: string) => s,
  },
}));

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
      rootDir: '/test/project',
      fileCount: 25,
      totalLines: 5000,
      languages: { typescript: 25 },
      nodeCount: 100,
      edgeCount: 80,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'utils.ts',
        filePath: 'src/utils.ts',
        lineStart: 1,
        lineEnd: 100,
        exported: true,
      },
      'file-2': {
        id: 'file-2',
        type: 'file',
        name: 'helpers.ts',
        filePath: 'src/helpers.ts',
        lineStart: 1,
        lineEnd: 200,
        exported: true,
      },
      'func-1': {
        id: 'func-1',
        type: 'function',
        name: 'complexFunction',
        filePath: 'src/complex.ts',
        lineStart: 10,
        lineEnd: 80,
        exported: true,
        complexity: 25,
      },
    },
    edges: [],
    ...overrides,
  };
}

describe('Roast Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Graph Loading', () => {
    it('should show error when no graph exists', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      expect(loadGraph).toHaveBeenCalledWith('/test');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No graph found'));
    });

    it('should output JSON error when no graph exists with --json flag', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test', '--json']);

      expect(outputJsonError).toHaveBeenCalledWith(
        'roast',
        expect.stringContaining('No graph found')
      );
    });
  });

  describe('Roast Generation', () => {
    it('should generate roast output for a valid graph', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      // Should have called console.log with roast output
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('CODEBASE ROAST');
    });

    it('should include stats roast based on file count', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('25 files');
      expect(output).toContain('opportunities for bugs');
    });
  });

  describe('JSON Output', () => {
    it('should output JSON with roast data when --json flag is set', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'roast',
        expect.objectContaining({
          fileCount: 25,
          totalLines: 5000,
          averageComplexity: expect.any(Number),
        })
      );
    });

    it('should include hotspots in JSON output', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return hotspots
      const { generateComplexityReport } = await import('../../src/analyzers/complexity.js');
      vi.mocked(generateComplexityReport).mockReturnValue({
        averageComplexity: 8,
        maxComplexity: 25,
        totalComplexity: 100,
        hotspots: [
          {
            filePath: 'src/complex.ts',
            name: 'complexFunc',
            type: 'function',
            complexity: 25,
            lineStart: 10,
            lineEnd: 50,
          },
        ],
        distribution: { low: 10, medium: 5, high: 2, veryHigh: 1 },
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'roast',
        expect.objectContaining({
          hotspots: expect.arrayContaining([
            expect.objectContaining({
              filePath: 'src/complex.ts',
              complexity: 25,
            }),
          ]),
        })
      );
    });

    it('should include dead code info in JSON output', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'roast',
        expect.objectContaining({
          deadCode: expect.any(Array),
        })
      );
    });

    it('should include bus factor info in JSON output', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'roast',
        expect.objectContaining({
          busFactor: expect.any(Array),
        })
      );
    });
  });

  describe('Naming Crimes Detection', () => {
    it('should detect files with suspicious naming patterns', async () => {
      const mockGraph = createMockGraph({
        nodes: {
          'file-helper': {
            id: 'file-helper',
            type: 'file',
            name: 'helpers.ts',
            filePath: 'src/helpers.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'file-util': {
            id: 'file-util',
            type: 'file',
            name: 'utils.ts',
            filePath: 'src/utils.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'file-misc': {
            id: 'file-misc',
            type: 'file',
            name: 'misc.ts',
            filePath: 'src/misc.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
        },
      });
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      // Should detect naming crimes
      expect(output).toContain('Naming Crimes');
    });
  });

  describe('Complexity Crimes Detection', () => {
    it('should call out functions with very high complexity', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return high complexity distribution
      const { generateComplexityReport } = await import('../../src/analyzers/complexity.js');
      vi.mocked(generateComplexityReport).mockReturnValue({
        averageComplexity: 12,
        maxComplexity: 35,
        totalComplexity: 200,
        hotspots: [],
        distribution: { low: 10, medium: 5, high: 3, veryHigh: 5 },
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Complexity Crimes');
      expect(output).toContain('5 functions have complexity over 20');
    });
  });

  describe('Dead Code Roast', () => {
    it('should roast dead code when found', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Dead Code');
      expect(output).toContain('5 unused exports');
    });
  });

  describe('Bus Factor Roast', () => {
    it('should roast bus factor issues', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Bus Factor');
    });

    it('should warn about high ownership concentration', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return high ownership
      const { execute: getBusFactor } = await import('../../src/tools/get-bus-factor.js');
      vi.mocked(getBusFactor).mockResolvedValue({
        analyzed: true,
        overallBusFactor: 1,
        topOwners: [{ name: 'Solo Dev', percentage: 75, filesOwned: 50 }],
        criticalAreas: [],
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('75%');
      expect(output).toContain('Solo Dev');
    });
  });

  describe('Hotspot Roasts', () => {
    it('should roast helper/util files appropriately', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return a helper file hotspot
      const { generateComplexityReport } = await import('../../src/analyzers/complexity.js');
      vi.mocked(generateComplexityReport).mockReturnValue({
        averageComplexity: 8,
        maxComplexity: 15,
        totalComplexity: 100,
        hotspots: [
          {
            filePath: 'src/helpers.ts',
            name: 'helperFunc',
            type: 'function',
            complexity: 12,
            lineStart: 10,
            lineEnd: 50,
          },
        ],
        distribution: { low: 10, medium: 5, high: 2, veryHigh: 0 },
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('junk drawer');
    });

    it('should roast index files appropriately', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return an index file hotspot
      const { generateComplexityReport } = await import('../../src/analyzers/complexity.js');
      vi.mocked(generateComplexityReport).mockReturnValue({
        averageComplexity: 8,
        maxComplexity: 15,
        totalComplexity: 100,
        hotspots: [
          {
            filePath: 'src/index.ts',
            name: 'main',
            type: 'function',
            complexity: 10,
            lineStart: 1,
            lineEnd: 100,
          },
        ],
        distribution: { low: 10, medium: 5, high: 2, veryHigh: 0 },
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('organize this later');
    });

    it('should roast very high complexity as job security', async () => {
      const mockGraph = createMockGraph();
      vi.mocked(loadGraph).mockResolvedValue(mockGraph);

      // Reset the mock to return a very high complexity hotspot
      const { generateComplexityReport } = await import('../../src/analyzers/complexity.js');
      vi.mocked(generateComplexityReport).mockReturnValue({
        averageComplexity: 15,
        maxComplexity: 35,
        totalComplexity: 200,
        hotspots: [
          {
            filePath: 'src/monster.ts',
            name: 'monsterFunction',
            type: 'function',
            complexity: 35,
            lineStart: 1,
            lineEnd: 500,
          },
        ],
        distribution: { low: 5, medium: 3, high: 2, veryHigh: 2 },
      });

      const { register } = await import('../../src/commands/fun/roast.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'roast', '-d', '/test']);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('job security');
    });
  });
});
