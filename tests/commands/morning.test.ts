/**
 * Morning Command Tests
 *
 * Tests for the morning command which generates daily standup summaries.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';
import type { MorningBriefing } from '../../src/morning.js';

// Mock dependencies before importing the module
vi.mock('../../src/graph/persistence.js', () => ({
  loadGraph: vi.fn(),
}));

vi.mock('../../src/morning.js', () => ({
  generateMorning: vi.fn(),
  formatMorning: vi.fn(),
}));

vi.mock('../../src/json-output.js', () => ({
  outputJson: vi.fn(),
  outputJsonError: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      yellow: (s: string) => s,
      cyan: (s: string) => s,
    }),
    yellow: (s: string) => s,
    green: (s: string) => s,
    white: (s: string) => s,
    dim: (s: string) => s,
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

import { loadGraph } from '../../src/graph/persistence.js';
import { outputJson, outputJsonError } from '../../src/json-output.js';
import { formatMorning, generateMorning } from '../../src/morning.js';

/**
 * Helper to create a mock knowledge graph
 */
function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test/my-project',
      fileCount: 50,
      totalLines: 10000,
      languages: { typescript: 50 },
      nodeCount: 200,
      edgeCount: 150,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'app.ts',
        filePath: 'src/app.ts',
        lineStart: 1,
        lineEnd: 200,
        exported: true,
        complexity: 8,
      },
    },
    edges: [],
    ...overrides,
  };
}

/**
 * Helper to create a mock morning briefing
 */
function createMockBriefing(overrides: Partial<MorningBriefing> = {}): MorningBriefing {
  return {
    codebaseName: 'my-project',
    date: 'Monday, January 15',
    greeting: "Good morning! Here's your codebase briefing.",
    health: {
      score: 75,
      trend: 'stable',
      summary: 'Looking good! Codebase is in healthy shape.',
    },
    recentActivity: {
      commits: 5,
      filesChanged: 12,
      contributors: ['Alice', 'Bob'],
    },
    hotFiles: [
      {
        path: 'src/app.ts',
        changes: 8,
        reason: 'Hotspot - many recent changes',
      },
    ],
    alerts: [],
    todaysFocus: ['Review recent changes before starting new work'],
    ...overrides,
  };
}

describe('Morning Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Graph Loading', () => {
    it('should show error when no graph exists', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test']);

      expect(loadGraph).toHaveBeenCalledWith('/test');
    });

    it('should output JSON error when no graph exists with --json flag', async () => {
      vi.mocked(loadGraph).mockResolvedValue(null);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJsonError).toHaveBeenCalledWith(
        'morning',
        expect.stringContaining('No graph found')
      );
    });
  });

  describe('Morning Briefing Generation', () => {
    it('should generate morning briefing for a valid graph', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing();

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);
      vi.mocked(formatMorning).mockReturnValue('Formatted morning output');

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test']);

      expect(generateMorning).toHaveBeenCalledWith(mockGraph, '/test');
      expect(formatMorning).toHaveBeenCalledWith(mockBriefing);
    });

    it('should pass correct root directory to generateMorning', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing();

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);
      vi.mocked(formatMorning).mockReturnValue('Output');

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/custom/path']);

      expect(generateMorning).toHaveBeenCalledWith(mockGraph, '/custom/path');
    });
  });

  describe('JSON Output', () => {
    it('should output JSON when --json flag is set', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing();

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith('morning', mockBriefing);
      // formatMorning should not be called for JSON output
      expect(formatMorning).not.toHaveBeenCalled();
    });

    it('should include all briefing data in JSON output', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        health: {
          score: 85,
          trend: 'improving',
          summary: 'Great progress!',
        },
        recentActivity: {
          commits: 10,
          filesChanged: 25,
          contributors: ['Alice', 'Bob', 'Charlie'],
        },
        hotFiles: [
          { path: 'src/core.ts', changes: 15, reason: 'Heavy activity' },
          { path: 'src/api.ts', changes: 8, reason: 'Active development' },
        ],
        alerts: ['High complexity detected', 'Bus factor risk'],
        todaysFocus: ['Review PRs', 'Refactor core module'],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith('morning', mockBriefing);
    });
  });

  describe('Console Output Formatting', () => {
    it('should display formatted output to console', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing();
      const formattedOutput = `
MORNING BRIEFING
================
Monday, January 15
Good morning! Here's your codebase briefing.

CODEBASE HEALTH
---------------
75% - Looking good!

LAST 24 HOURS
-------------
5 commits, 12 files changed
Active: Alice, Bob
`;

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);
      vi.mocked(formatMorning).mockReturnValue(formattedOutput);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test']);

      // Should have printed output lines
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should apply styling to different output types', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        alerts: ['Warning: High complexity'],
      });
      const formattedOutput = `
GOOD MORNING!
Today: Some tasks
Completed
attention needed
`;

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);
      vi.mocked(formatMorning).mockReturnValue(formattedOutput);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test']);

      // Verify console.log was called (styling is applied internally)
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Health Information', () => {
    it('should handle high health score', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        health: {
          score: 90,
          trend: 'improving',
          summary: 'Excellent health!',
        },
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          health: expect.objectContaining({
            score: 90,
            trend: 'improving',
          }),
        })
      );
    });

    it('should handle low health score', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        health: {
          score: 30,
          trend: 'declining',
          summary: 'Health needs attention.',
        },
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          health: expect.objectContaining({
            score: 30,
            trend: 'declining',
          }),
        })
      );
    });
  });

  describe('Activity Information', () => {
    it('should handle no recent commits', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        recentActivity: {
          commits: 0,
          filesChanged: 0,
          contributors: [],
        },
        alerts: ['No commits in the last 24 hours'],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          recentActivity: expect.objectContaining({
            commits: 0,
          }),
          alerts: expect.arrayContaining(['No commits in the last 24 hours']),
        })
      );
    });

    it('should handle many active contributors', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        recentActivity: {
          commits: 25,
          filesChanged: 50,
          contributors: ['Alice', 'Bob', 'Charlie'],
        },
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          recentActivity: expect.objectContaining({
            commits: 25,
            contributors: ['Alice', 'Bob', 'Charlie'],
          }),
        })
      );
    });
  });

  describe('Hot Files', () => {
    it('should include hot files in output', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        hotFiles: [
          { path: 'src/core.ts', changes: 15, reason: 'Hotspot - many recent changes' },
          { path: 'src/api.ts', changes: 10, reason: 'Heavy activity this week' },
          { path: 'src/utils.ts', changes: 5, reason: 'Active development' },
        ],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          hotFiles: expect.arrayContaining([
            expect.objectContaining({ path: 'src/core.ts', changes: 15 }),
          ]),
        })
      );
    });

    it('should handle no hot files', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        hotFiles: [],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          hotFiles: [],
        })
      );
    });
  });

  describe('Alerts and Focus', () => {
    it('should include alerts in output', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        alerts: [
          'src/core.ts has been very active - check for conflicts',
          '5 files have high complexity',
        ],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          alerts: expect.arrayContaining([
            expect.stringContaining('active'),
            expect.stringContaining('complexity'),
          ]),
        })
      );
    });

    it('should include focus items in output', async () => {
      const mockGraph = createMockGraph();
      const mockBriefing = createMockBriefing({
        todaysFocus: [
          'Review recent changes before starting new work',
          'Check src/core.ts for potential conflicts',
          'Consider refactoring high-complexity areas',
        ],
      });

      vi.mocked(loadGraph).mockResolvedValue(mockGraph);
      vi.mocked(generateMorning).mockResolvedValue(mockBriefing);

      const { register } = await import('../../src/commands/workflow/morning.js');
      const { Command } = await import('commander');

      const program = new Command();
      register(program);

      await program.parseAsync(['node', 'test', 'morning', '-d', '/test', '--json']);

      expect(outputJson).toHaveBeenCalledWith(
        'morning',
        expect.objectContaining({
          todaysFocus: expect.arrayContaining([
            expect.stringContaining('Review'),
            expect.stringContaining('conflicts'),
            expect.stringContaining('refactoring'),
          ]),
        })
      );
    });
  });
});
