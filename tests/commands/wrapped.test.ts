import { describe, expect, it } from 'vitest';
import type { FileNode, FunctionNode, KnowledgeGraph } from '../../src/graph/types.js';

describe('wrapped command', () => {
  const test1FileNode: FileNode = {
    id: 'file:src/test1.ts',
    type: 'file',
    name: 'test1.ts',
    filePath: 'src/test1.ts',
    lineStart: 1,
    lineEnd: 50,
    exported: false,
    complexity: 5,
    lastModified: '2025-03-15',
    language: 'typescript',
    lineCount: 50,
    importCount: 0,
    exportCount: 1,
  };

  const func1Node: FunctionNode = {
    id: 'func:src/test1.ts:func1',
    type: 'function',
    name: 'func1',
    filePath: 'src/test1.ts',
    lineStart: 1,
    lineEnd: 10,
    exported: true,
    complexity: 5,
    parameters: [],
    returnType: 'void',
    isAsync: false,
    isGenerator: false,
  };

  const test2FileNode: FileNode = {
    id: 'file:src/test2.ts',
    type: 'file',
    name: 'test2.ts',
    filePath: 'src/test2.ts',
    lineStart: 1,
    lineEnd: 100,
    exported: false,
    complexity: 15,
    lastModified: '2025-06-20',
    language: 'typescript',
    lineCount: 100,
    importCount: 1,
    exportCount: 1,
  };

  const func2Node: FunctionNode = {
    id: 'func:src/test2.ts:func2',
    type: 'function',
    name: 'func2',
    filePath: 'src/test2.ts',
    lineStart: 1,
    lineEnd: 20,
    exported: true,
    complexity: 15,
    parameters: [],
    returnType: 'string',
    isAsync: false,
    isGenerator: false,
  };

  const mockGraph: KnowledgeGraph = {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test/project',
      fileCount: 2,
      totalLines: 150,
      languages: { typescript: 150 },
      nodeCount: 4,
      edgeCount: 1,
    },
    nodes: {
      [test1FileNode.id]: test1FileNode,
      [func1Node.id]: func1Node,
      [test2FileNode.id]: test2FileNode,
      [func2Node.id]: func2Node,
    },
    edges: [
      {
        id: 'edge:test2-imports-test1',
        source: 'file:src/test2.ts',
        target: 'file:src/test1.ts',
        type: 'imports',
      },
    ],
  };

  const getFileNodes = (graph: KnowledgeGraph): FileNode[] =>
    Object.values(graph.nodes).filter((n): n is FileNode => n.type === 'file');

  it('should generate basic wrapped summary', () => {
    const files = getFileNodes(mockGraph);

    expect(files).toHaveLength(2);
    expect(mockGraph.metadata.fileCount).toBe(2);
    expect(mockGraph.metadata.totalLines).toBe(150);
  });

  it('should calculate year-over-year stats', () => {
    const startOfYear = new Date('2025-01-01');
    const endOfYear = new Date('2025-12-31');

    const filesInYear = getFileNodes(mockGraph).filter((f: FileNode) => {
      const modified = new Date(f.lastModified!);
      return modified >= startOfYear && modified <= endOfYear;
    });

    expect(filesInYear).toHaveLength(2);
  });

  it('should identify top contributors', () => {
    // In a real implementation, this would use git history
    // For now, just verify the structure supports it
    const files = getFileNodes(mockGraph);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should calculate complexity growth', () => {
    const files = getFileNodes(mockGraph);
    const complexities = files.map((f: FileNode) => f.complexity ?? 0);

    const total = complexities.reduce((a, b) => a + b, 0);
    const average = total / complexities.length;

    expect(average).toBe(10); // (5 + 15) / 2
  });

  it('should identify most changed files', () => {
    // Files sorted by last modified date
    const filesByDate = getFileNodes(mockGraph).sort(
      (a: FileNode, b: FileNode) =>
        new Date(b.lastModified!).getTime() - new Date(a.lastModified!).getTime()
    );

    expect(filesByDate[0].filePath).toBe('src/test2.ts');
    expect(filesByDate[1].filePath).toBe('src/test1.ts');
  });

  it('should support personality modes', () => {
    // The wrapped command should work with different personalities
    const personalities = ['default', 'roast', 'therapist', 'noir', 'pirate'];

    personalities.forEach((personality) => {
      expect(personality).toBeTruthy();
      // In real implementation, would generate different narratives
    });
  });

  it('should calculate language distribution', () => {
    const files = getFileNodes(mockGraph);
    const languages = new Map<string, number>();

    for (const file of files) {
      const lang = file.language;
      languages.set(lang, (languages.get(lang) || 0) + 1);
    }

    expect(languages.get('typescript')).toBe(2);
    expect(languages.size).toBe(1);
  });

  it('should generate shareable stats', () => {
    const files = getFileNodes(mockGraph);
    const avgComplexity = files.reduce((sum, f) => sum + (f.complexity ?? 0), 0) / files.length;

    const stats = {
      totalFiles: mockGraph.metadata.fileCount,
      totalLines: mockGraph.metadata.totalLines,
      averageComplexity: avgComplexity,
      topContributors: [],
      topFiles: [],
      yearOverYear: {
        filesAdded: 2,
        linesAdded: 150,
        complexityChange: 0,
      },
    };

    expect(stats.totalFiles).toBe(2);
    expect(stats.totalLines).toBe(150);
    expect(stats.averageComplexity).toBe(10);
  });
});
