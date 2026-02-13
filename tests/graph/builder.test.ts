/**
 * Graph Builder Tests
 *
 * Tests for knowledge graph orchestration and building.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '../../src/graph/types.js';

// Mock dependencies before importing the module
const mockProject = {
  getSourceFiles: vi.fn(() => []),
};

const mockSourceFile = {
  getFilePath: vi.fn(() => '/test/src/test.ts'),
  getFullText: vi.fn(() => 'const x = 1;'),
};

vi.mock('../../src/analyzers/ast.js', () => ({
  createProject: vi.fn(() => mockProject),
  getSourceFiles: vi.fn(() => []),
  analyzeSourceFile: vi.fn(() => ({
    fileNode: {
      id: 'test.ts',
      type: 'file',
      name: 'test.ts',
      filePath: 'test.ts',
      lineStart: 1,
      lineEnd: 10,
      exported: true,
      language: 'typescript',
      lineCount: 10,
      importCount: 0,
      exportCount: 0,
    },
    symbolNodes: [
      {
        id: 'func-1',
        type: 'function',
        name: 'testFunc',
        filePath: 'test.ts',
        lineStart: 1,
        lineEnd: 5,
        exported: true,
        complexity: 3,
      },
    ],
    complexity: 3,
  })),
}));

vi.mock('../../src/analyzers/git.js', () => ({
  analyzeGitHistory: vi.fn(() =>
    Promise.resolve({
      isGitRepo: true,
      fileHistories: new Map(),
      repoStats: { totalCommits: 100, totalContributors: 5 },
    })
  ),
}));

vi.mock('../../src/analyzers/imports.js', () => ({
  analyzeImports: vi.fn(() => []),
  analyzeExports: vi.fn(() => []),
  createImportEdges: vi.fn(() => []),
  buildDependencyMap: vi.fn(() => new Map()),
  buildReverseDependencyMap: vi.fn(() => new Map()),
}));

import { analyzeSourceFile, createProject, getSourceFiles } from '../../src/analyzers/ast.js';
import { analyzeGitHistory } from '../../src/analyzers/git.js';
import {
  buildKnowledgeGraph,
  getGraphStats,
  updateGraphIncremental,
} from '../../src/graph/builder.js';

describe('Graph Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([]);
  });

  describe('buildKnowledgeGraph', () => {
    it('should return empty graph when no source files found', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.graph.metadata.fileCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('No source files found');
    });

    it('should build graph from source files', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.graph.nodes['test.ts']).toBeDefined();
      expect(result.graph.metadata.fileCount).toBe(1);
      expect(createProject).toHaveBeenCalledWith('/test');
    });

    it('should create contains edges from file to symbols', async () => {
      const fileNode = {
        id: 'test.ts',
        type: 'file',
        name: 'test.ts',
        filePath: 'test.ts',
        lineStart: 1,
        lineEnd: 50,
        exported: true,
        language: 'typescript',
        lineCount: 50,
        importCount: 0,
        exportCount: 1,
      };

      const symbolNode = {
        id: 'func-testFunc',
        type: 'function',
        name: 'testFunc',
        filePath: 'test.ts',
        lineStart: 5,
        lineEnd: 15,
        exported: true,
        complexity: 3,
      };

      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode,
        symbolNodes: [symbolNode],
        complexity: 3,
      });

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.graph.nodes['test.ts']).toBeDefined();
      expect(result.graph.nodes['func-testFunc']).toBeDefined();

      const containsEdge = result.graph.edges.find(
        (e) => e.type === 'contains' && e.source === 'test.ts' && e.target === 'func-testFunc'
      );
      expect(containsEdge).toBeDefined();
    });

    it('should call progress callback', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });

      const onProgress = vi.fn();
      await buildKnowledgeGraph({ rootDir: '/test', onProgress });

      expect(onProgress).toHaveBeenCalled();
      // Should have progress for: Initializing, Found files, Analyzing AST, Analyzing git, Complete
      const phases = onProgress.mock.calls.map((call) => call[0]);
      expect(phases).toContain('Initializing');
      expect(phases).toContain('Complete');
    });

    it('should skip git history when disabled', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });

      await buildKnowledgeGraph({ rootDir: '/test', includeGitHistory: false });

      expect(analyzeGitHistory).not.toHaveBeenCalled();
    });

    it('should include git history when enabled', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });

      await buildKnowledgeGraph({ rootDir: '/test', includeGitHistory: true });

      expect(analyzeGitHistory).toHaveBeenCalled();
    });

    it('should add warning for non-git repo', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });
      (analyzeGitHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        isGitRepo: false,
        fileHistories: new Map(),
        repoStats: { totalCommits: 0, totalContributors: 0 },
      });

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].warning).toContain('Not a git repository');
    });

    it('should handle analysis errors gracefully', async () => {
      const badSourceFile = {
        getFilePath: vi.fn(() => '/test/src/bad.ts'),
      };

      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([badSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('parse error');
    });

    it('should handle null analysis results', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('timeout');
    });

    it('should respect overall timeout', async () => {
      // Create many mock files to trigger timeout
      const manySourceFiles = Array(100)
        .fill(null)
        .map((_, i) => ({
          getFilePath: vi.fn(() => `/test/src/file${i}.ts`),
        }));

      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue(manySourceFiles);

      // Make analysis slow
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 10) {
          // busy wait
        }
        return {
          fileNode: {
            id: 'file.ts',
            type: 'file',
            name: 'file.ts',
            filePath: 'file.ts',
            lineStart: 1,
            lineEnd: 10,
            exported: true,
            language: 'typescript',
            lineCount: 10,
            importCount: 0,
            exportCount: 0,
          },
          symbolNodes: [],
          complexity: 1,
        };
      });

      const result = await buildKnowledgeGraph({
        rootDir: '/test',
        timeoutMs: 50, // Very short timeout
        includeGitHistory: false,
      });

      // Should have partial results or timeout error
      expect(
        result.graph.metadata.fileCount < 100 ||
          result.errors.some((e) => e.error.includes('timeout'))
      ).toBe(true);
    });

    it('should calculate correct metadata', async () => {
      const files = [
        {
          getFilePath: vi.fn(() => '/test/src/a.ts'),
        },
        {
          getFilePath: vi.fn(() => '/test/src/b.ts'),
        },
      ];

      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue(files);

      let callCount = 0;
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return {
          fileNode: {
            id: `file${callCount}.ts`,
            type: 'file',
            name: `file${callCount}.ts`,
            filePath: `file${callCount}.ts`,
            lineStart: 1,
            lineEnd: 100,
            exported: true,
            language: 'typescript',
            lineCount: 100,
            importCount: 0,
            exportCount: 0,
          },
          symbolNodes: [
            {
              id: `func-${callCount}`,
              type: 'function',
              name: `func${callCount}`,
              filePath: `file${callCount}.ts`,
              lineStart: 10,
              lineEnd: 20,
              exported: true,
              complexity: 5,
            },
          ],
          complexity: 5,
        };
      });

      const result = await buildKnowledgeGraph({
        rootDir: '/test',
        includeGitHistory: false,
      });

      expect(result.graph.metadata.fileCount).toBe(2);
      expect(result.graph.metadata.totalLines).toBe(200);
      expect(result.graph.metadata.languages.typescript).toBe(2);
      expect(result.graph.metadata.nodeCount).toBe(4); // 2 files + 2 functions
    });

    it('should enrich nodes with git data', async () => {
      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([mockSourceFile]);
      (analyzeSourceFile as ReturnType<typeof vi.fn>).mockReturnValue({
        fileNode: {
          id: 'test.ts',
          type: 'file',
          name: 'test.ts',
          filePath: 'test.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          language: 'typescript',
          lineCount: 10,
          importCount: 0,
          exportCount: 0,
        },
        symbolNodes: [],
        complexity: 5,
      });

      const gitHistoryMap = new Map([
        [
          'test.ts',
          {
            filePath: 'test.ts',
            lastModified: '2024-01-15T10:00:00Z',
            commitCount: 25,
            contributorCount: 3,
            contributors: [
              { name: 'Alice', email: 'alice@example.com', commits: 15, lastCommit: '2024-01-15' },
              { name: 'Bob', email: 'bob@example.com', commits: 10, lastCommit: '2024-01-10' },
            ],
            recentCommits: [],
          },
        ],
      ]);

      (analyzeGitHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        isGitRepo: true,
        fileHistories: gitHistoryMap,
        repoStats: { totalCommits: 100, totalContributors: 5 },
      });

      const result = await buildKnowledgeGraph({ rootDir: '/test' });

      const fileNode = result.graph.nodes['test.ts'];
      expect(fileNode.lastModified).toBe('2024-01-15T10:00:00Z');
      expect(fileNode.modificationCount).toBe(25);
      expect(fileNode.contributors).toEqual(['Alice', 'Bob']);
    });
  });

  describe('getGraphStats', () => {
    it('should count nodes by type', () => {
      const graph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 2,
          totalLines: 200,
          languages: { typescript: 2 },
          nodeCount: 5,
          edgeCount: 3,
        },
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'a.ts',
            filePath: 'a.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'file-2': {
            id: 'file-2',
            type: 'file',
            name: 'b.ts',
            filePath: 'b.ts',
            lineStart: 1,
            lineEnd: 100,
            exported: true,
          },
          'func-1': {
            id: 'func-1',
            type: 'function',
            name: 'funcA',
            filePath: 'a.ts',
            lineStart: 10,
            lineEnd: 20,
            exported: true,
            complexity: 5,
          },
          'func-2': {
            id: 'func-2',
            type: 'function',
            name: 'funcB',
            filePath: 'b.ts',
            lineStart: 10,
            lineEnd: 20,
            exported: true,
            complexity: 15,
          },
          'class-1': {
            id: 'class-1',
            type: 'class',
            name: 'MyClass',
            filePath: 'a.ts',
            lineStart: 30,
            lineEnd: 50,
            exported: true,
            complexity: 10,
          },
        },
        edges: [
          { id: 'e1', source: 'file-1', target: 'func-1', type: 'contains' },
          { id: 'e2', source: 'file-2', target: 'func-2', type: 'contains' },
          { id: 'e3', source: 'func-1', target: 'func-2', type: 'calls' },
        ],
      };

      const stats = getGraphStats(graph);

      expect(stats.nodesByType.file).toBe(2);
      expect(stats.nodesByType.function).toBe(2);
      expect(stats.nodesByType.class).toBe(1);
    });

    it('should count edges by type', () => {
      const graph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 2,
          totalLines: 100,
          languages: { typescript: 2 },
          nodeCount: 3,
          edgeCount: 5,
        },
        nodes: {
          n1: {
            id: 'n1',
            type: 'file',
            name: 'a.ts',
            filePath: 'a.ts',
            lineStart: 1,
            lineEnd: 50,
            exported: true,
          },
          n2: {
            id: 'n2',
            type: 'function',
            name: 'fn',
            filePath: 'a.ts',
            lineStart: 10,
            lineEnd: 20,
            exported: true,
          },
          n3: {
            id: 'n3',
            type: 'file',
            name: 'b.ts',
            filePath: 'b.ts',
            lineStart: 1,
            lineEnd: 50,
            exported: true,
          },
        },
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', type: 'contains' },
          { id: 'e2', source: 'n1', target: 'n2', type: 'contains' },
          { id: 'e3', source: 'n1', target: 'n3', type: 'imports' },
          { id: 'e4', source: 'n2', target: 'n3', type: 'calls' },
          { id: 'e5', source: 'n3', target: 'n1', type: 'imports' },
        ],
      };

      const stats = getGraphStats(graph);

      expect(stats.edgesByType.contains).toBe(2);
      expect(stats.edgesByType.imports).toBe(2);
      expect(stats.edgesByType.calls).toBe(1);
    });

    it('should calculate complexity statistics', () => {
      const graph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 1,
          totalLines: 100,
          languages: { typescript: 1 },
          nodeCount: 4,
          edgeCount: 0,
        },
        nodes: {
          f1: {
            id: 'f1',
            type: 'function',
            name: 'a',
            filePath: 'test.ts',
            lineStart: 1,
            lineEnd: 10,
            exported: true,
            complexity: 5,
          },
          f2: {
            id: 'f2',
            type: 'function',
            name: 'b',
            filePath: 'test.ts',
            lineStart: 11,
            lineEnd: 20,
            exported: true,
            complexity: 10,
          },
          f3: {
            id: 'f3',
            type: 'function',
            name: 'c',
            filePath: 'test.ts',
            lineStart: 21,
            lineEnd: 30,
            exported: true,
            complexity: 15,
          },
          f4: {
            id: 'f4',
            type: 'function',
            name: 'd',
            filePath: 'test.ts',
            lineStart: 31,
            lineEnd: 40,
            exported: true,
          }, // No complexity
        },
        edges: [],
      };

      const stats = getGraphStats(graph);

      expect(stats.avgComplexity).toBe(10);
      expect(stats.maxComplexity).toBe(15);
    });

    it('should handle empty graph', () => {
      const graph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 0,
          totalLines: 0,
          languages: {},
          nodeCount: 0,
          edgeCount: 0,
        },
        nodes: {},
        edges: [],
      };

      const stats = getGraphStats(graph);

      expect(stats.nodesByType).toEqual({});
      expect(stats.edgesByType).toEqual({});
      expect(stats.avgComplexity).toBe(0);
      expect(stats.maxComplexity).toBe(0);
    });

    it('should include metadata in stats', () => {
      const graph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 500,
          rootDir: '/my/project',
          fileCount: 10,
          totalLines: 5000,
          languages: { typescript: 8, javascript: 2 },
          nodeCount: 50,
          edgeCount: 100,
        },
        nodes: {},
        edges: [],
      };

      const stats = getGraphStats(graph);

      expect(stats.fileCount).toBe(10);
      expect(stats.totalLines).toBe(5000);
      expect(stats.scanDurationMs).toBe(500);
      expect(stats.rootDir).toBe('/my/project');
    });
  });

  describe('updateGraphIncremental', () => {
    it('should rebuild entire graph (current implementation)', async () => {
      const existingGraph: KnowledgeGraph = {
        version: '1.0.0',
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 1,
          totalLines: 100,
          languages: { typescript: 1 },
          nodeCount: 1,
          edgeCount: 0,
        },
        nodes: {},
        edges: [],
      };

      (getSourceFiles as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = await updateGraphIncremental(existingGraph, ['changed.ts'], {
        rootDir: '/test',
      });

      // Current implementation rebuilds full graph
      expect(createProject).toHaveBeenCalled();
      expect(result.graph).toBeDefined();
    });
  });
});
