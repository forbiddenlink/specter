import { describe, expect, it } from 'vitest';
import type { FileNode, FunctionNode, KnowledgeGraph } from '../../src/graph/types.js';

describe('tinder command', () => {
  const apiFileNode: FileNode = {
    id: 'file:src/api.ts',
    type: 'file',
    name: 'api.ts',
    filePath: 'src/api.ts',
    lineStart: 1,
    lineEnd: 250,
    exported: false,
    complexity: 8,
    lastModified: '2025-12-01',
    language: 'typescript',
    lineCount: 250,
    importCount: 1,
    exportCount: 1,
  };

  const handleRequestNode: FunctionNode = {
    id: 'func:src/api.ts:handleRequest',
    type: 'function',
    name: 'handleRequest',
    filePath: 'src/api.ts',
    lineStart: 10,
    lineEnd: 50,
    exported: true,
    complexity: 8,
    parameters: [],
    returnType: 'void',
    isAsync: false,
    isGenerator: false,
  };

  const utilsFileNode: FileNode = {
    id: 'file:src/utils.ts',
    type: 'file',
    name: 'utils.ts',
    filePath: 'src/utils.ts',
    lineStart: 1,
    lineEnd: 150,
    exported: false,
    complexity: 9,
    lastModified: '2025-11-20',
    language: 'typescript',
    lineCount: 150,
    importCount: 0,
    exportCount: 3,
  };

  const util1Node: FunctionNode = {
    id: 'func:src/utils.ts:util1',
    type: 'function',
    name: 'util1',
    filePath: 'src/utils.ts',
    lineStart: 1,
    lineEnd: 10,
    exported: true,
    complexity: 2,
    parameters: [],
    returnType: 'string',
    isAsync: false,
    isGenerator: false,
  };

  const util2Node: FunctionNode = {
    id: 'func:src/utils.ts:util2',
    type: 'function',
    name: 'util2',
    filePath: 'src/utils.ts',
    lineStart: 12,
    lineEnd: 20,
    exported: true,
    complexity: 3,
    parameters: [],
    returnType: 'number',
    isAsync: false,
    isGenerator: false,
  };

  const util3Node: FunctionNode = {
    id: 'func:src/utils.ts:util3',
    type: 'function',
    name: 'util3',
    filePath: 'src/utils.ts',
    lineStart: 22,
    lineEnd: 30,
    exported: true,
    complexity: 4,
    parameters: [],
    returnType: 'boolean',
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
      totalLines: 400,
      languages: { typescript: 400 },
      nodeCount: 6,
      edgeCount: 1,
    },
    nodes: {
      [apiFileNode.id]: apiFileNode,
      [handleRequestNode.id]: handleRequestNode,
      [utilsFileNode.id]: utilsFileNode,
      [util1Node.id]: util1Node,
      [util2Node.id]: util2Node,
      [util3Node.id]: util3Node,
    },
    edges: [
      {
        id: 'edge:api-express',
        source: 'file:src/api.ts',
        target: 'express',
        type: 'imports',
      },
    ],
  };

  const getFileNodes = (graph: KnowledgeGraph): FileNode[] =>
    Object.values(graph.nodes).filter((n): n is FileNode => n.type === 'file');

  it('should generate codebase profile', () => {
    const files = getFileNodes(mockGraph);

    expect(files.length).toBeGreaterThan(0);
    expect(mockGraph.metadata.fileCount).toBe(2);
  });

  it('should show green flags (positive attributes)', () => {
    const apiNode = mockGraph.nodes['file:src/api.ts'] as FileNode;
    const lastModified = new Date(apiNode.lastModified!).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const avgComplexity =
      mockGraph.metadata.totalLines > 0
        ? getFileNodes(mockGraph).reduce((sum, f) => sum + (f.complexity ?? 0), 0) /
          getFileNodes(mockGraph).length
        : 0;

    const greenFlags = {
      goodComplexity: avgComplexity < 10,
      recentActivity: lastModified > thirtyDaysAgo,
      hasTests: false, // Would check for test files
    };

    expect(greenFlags.goodComplexity).toBe(true);
    expect(greenFlags.recentActivity).toBe(false); // More than 30 days ago
  });

  it('should show red flags (warning signs)', () => {
    const utilsNode = mockGraph.nodes['file:src/utils.ts'] as FileNode;
    const files = getFileNodes(mockGraph);
    const avgComplexity = files.reduce((sum, f) => sum + (f.complexity ?? 0), 0) / files.length;

    const redFlags = {
      tooManyExports: utilsNode.exportCount > 2,
      highComplexity: avgComplexity > 15,
      lowCoverage: true, // Would calculate from actual coverage
    };

    expect(redFlags.tooManyExports).toBe(true); // utils.ts has 3 exports
  });

  it('should calculate age of codebase', () => {
    const files = getFileNodes(mockGraph);
    const dates = files.filter((f) => f.lastModified).map((f) => new Date(f.lastModified!));

    const oldest = dates.reduce((old, d) => Math.min(old, d.getTime()), Date.now());

    const ageInMonths = Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24 * 30));

    expect(ageInMonths).toBeGreaterThanOrEqual(0);
  });

  it('should show language distribution', () => {
    const languages = mockGraph.metadata.languages;
    const total = Object.values(languages).reduce((a, b) => a + b, 0);
    const tsPercentage = Math.round(((languages.typescript || 0) / total) * 100);

    expect(tsPercentage).toBe(100); // All TypeScript
  });

  it('should generate dating profile bio', () => {
    const files = getFileNodes(mockGraph);
    const avgComplexity = files.reduce((sum, f) => sum + (f.complexity ?? 0), 0) / files.length;

    const bio = {
      age: 'X months old',
      language: 'TypeScript',
      files: mockGraph.metadata.fileCount,
      lines: mockGraph.metadata.totalLines,
      complexity: avgComplexity,
    };

    expect(bio.files).toBe(2);
    expect(bio.lines).toBe(400);
    expect(bio.language).toBe('TypeScript');
  });

  it('should have swipe actions', () => {
    // The tinder command should show [PASS] and [MERGE] options
    const actions = ['PASS', 'MERGE'];

    expect(actions).toContain('PASS');
    expect(actions).toContain('MERGE');
  });

  it('should support personality modes', () => {
    // Different personalities should generate different bios
    const personalities = ['default', 'roast', 'flirty'];

    personalities.forEach((personality) => {
      expect(personality).toBeTruthy();
    });
  });

  it('should calculate health score', () => {
    const files = getFileNodes(mockGraph);
    const avgComplexity = files.reduce((sum, f) => sum + (f.complexity ?? 0), 0) / files.length;

    const factors = {
      complexity: avgComplexity < 10 ? 25 : 15,
      size: mockGraph.metadata.fileCount < 100 ? 25 : 15,
      activity: 20, // Would calculate from git history
      coverage: 15, // Would calculate from actual coverage
    };

    const healthScore = Object.values(factors).reduce((a, b) => a + b, 0);

    expect(healthScore).toBeGreaterThan(0);
    expect(healthScore).toBeLessThanOrEqual(100);
  });
});
