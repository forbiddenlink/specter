/**
 * Graph Persistence Tests
 *
 * Tests for saving and loading the knowledge graph to/from disk.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteGraph,
  exportGraph,
  getSpecterDir,
  graphExists,
  isGraphStale,
  loadGraph,
  loadMetadata,
  saveGraph,
} from '../../src/graph/persistence.js';
import type { GraphMetadata, KnowledgeGraph } from '../../src/graph/types.js';

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
      fileCount: 1,
      totalLines: 100,
      languages: { typescript: 1 },
      nodeCount: 2,
      edgeCount: 1,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'test.ts',
        filePath: 'src/test.ts',
        lineStart: 1,
        lineEnd: 100,
        exported: true,
        complexity: 5,
      },
      'func-1': {
        id: 'func-1',
        type: 'function',
        name: 'testFunction',
        filePath: 'src/test.ts',
        lineStart: 10,
        lineEnd: 25,
        exported: true,
        complexity: 3,
      },
    },
    edges: [
      {
        id: 'edge-1',
        source: 'file-1',
        target: 'func-1',
        type: 'contains',
      },
    ],
    ...overrides,
  };
}

describe('Graph Persistence', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specter-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('saveGraph', () => {
    it('should save graph to .specter directory', async () => {
      const graph = createMockGraph();

      await saveGraph(graph, tempDir);

      const specterDir = path.join(tempDir, '.specter');
      const graphPath = path.join(specterDir, 'graph.json');

      const stats = await fs.stat(graphPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should save metadata separately', async () => {
      const graph = createMockGraph();

      await saveGraph(graph, tempDir);

      const metadataPath = path.join(tempDir, '.specter', 'metadata.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content) as GraphMetadata;

      expect(metadata.fileCount).toBe(1);
      expect(metadata.nodeCount).toBe(2);
    });

    it('should create .specter directory if it does not exist', async () => {
      const graph = createMockGraph();

      await saveGraph(graph, tempDir);

      const specterDir = path.join(tempDir, '.specter');
      const stats = await fs.stat(specterDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should add .specter to .gitignore', async () => {
      const graph = createMockGraph();

      await saveGraph(graph, tempDir);

      const gitignorePath = path.join(tempDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toContain('.specter');
    });

    it('should not duplicate .specter in existing .gitignore', async () => {
      // Create existing gitignore with .specter already present
      const gitignorePath = path.join(tempDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n.specter/\n', 'utf-8');

      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      const matches = content.match(/\.specter/g);
      expect(matches?.length).toBe(1);
    });

    it('should preserve complex graph structure', async () => {
      const graph = createMockGraph({
        nodes: {
          'file-1': {
            id: 'file-1',
            type: 'file',
            name: 'complex.ts',
            filePath: 'src/complex.ts',
            lineStart: 1,
            lineEnd: 500,
            exported: true,
            complexity: 25,
            contributors: ['alice', 'bob'],
            documentation: 'A complex module',
          },
          'class-1': {
            id: 'class-1',
            type: 'class',
            name: 'ComplexClass',
            filePath: 'src/complex.ts',
            lineStart: 10,
            lineEnd: 200,
            exported: true,
            complexity: 15,
          },
        },
        edges: [
          { id: 'e1', source: 'file-1', target: 'class-1', type: 'contains' },
          { id: 'e2', source: 'class-1', target: 'file-1', type: 'imports', weight: 1 },
        ],
      });

      await saveGraph(graph, tempDir);
      const loaded = await loadGraph(tempDir);

      expect(loaded?.nodes['file-1'].contributors).toEqual(['alice', 'bob']);
      expect(loaded?.nodes['file-1'].documentation).toBe('A complex module');
      expect(loaded?.edges).toHaveLength(2);
      expect(loaded?.edges[1].weight).toBe(1);
    });
  });

  describe('loadGraph', () => {
    it('should load saved graph with identical content', async () => {
      const original = createMockGraph();

      await saveGraph(original, tempDir);
      const loaded = await loadGraph(tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(original.version);
      expect(loaded?.metadata.fileCount).toBe(original.metadata.fileCount);
      expect(Object.keys(loaded?.nodes || {})).toHaveLength(2);
      expect(loaded?.edges).toHaveLength(1);
    });

    it('should return null when no graph exists', async () => {
      const loaded = await loadGraph(tempDir);
      expect(loaded).toBeNull();
    });

    it('should return null for corrupted graph file', async () => {
      const specterDir = path.join(tempDir, '.specter');
      await fs.mkdir(specterDir, { recursive: true });
      await fs.writeFile(path.join(specterDir, 'graph.json'), 'not valid json', 'utf-8');

      const loaded = await loadGraph(tempDir);
      expect(loaded).toBeNull();
    });

    it('should handle empty graph file', async () => {
      const specterDir = path.join(tempDir, '.specter');
      await fs.mkdir(specterDir, { recursive: true });
      await fs.writeFile(path.join(specterDir, 'graph.json'), '', 'utf-8');

      const loaded = await loadGraph(tempDir);
      expect(loaded).toBeNull();
    });
  });

  describe('loadMetadata', () => {
    it('should load only metadata for quick access', async () => {
      const graph = createMockGraph({
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 250,
          rootDir: '/project',
          fileCount: 50,
          totalLines: 10000,
          languages: { typescript: 40, javascript: 10 },
          nodeCount: 500,
          edgeCount: 1000,
        },
      });

      await saveGraph(graph, tempDir);
      const metadata = await loadMetadata(tempDir);

      expect(metadata).not.toBeNull();
      expect(metadata?.fileCount).toBe(50);
      expect(metadata?.totalLines).toBe(10000);
      expect(metadata?.languages).toEqual({ typescript: 40, javascript: 10 });
    });

    it('should return null when no metadata exists', async () => {
      const metadata = await loadMetadata(tempDir);
      expect(metadata).toBeNull();
    });
  });

  describe('graphExists', () => {
    it('should return true when graph exists', async () => {
      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      const exists = await graphExists(tempDir);
      expect(exists).toBe(true);
    });

    it('should return false when graph does not exist', async () => {
      const exists = await graphExists(tempDir);
      expect(exists).toBe(false);
    });

    it('should return false when only metadata exists', async () => {
      const specterDir = path.join(tempDir, '.specter');
      await fs.mkdir(specterDir, { recursive: true });
      await fs.writeFile(path.join(specterDir, 'metadata.json'), '{}', 'utf-8');

      const exists = await graphExists(tempDir);
      expect(exists).toBe(false);
    });
  });

  describe('deleteGraph', () => {
    it('should delete the entire .specter directory', async () => {
      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      await deleteGraph(tempDir);

      const exists = await graphExists(tempDir);
      expect(exists).toBe(false);

      // Verify directory is gone
      try {
        await fs.stat(path.join(tempDir, '.specter'));
        expect.fail('Directory should not exist');
      } catch (err) {
        expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });

    it('should not throw when no graph exists', async () => {
      // Should not throw
      await expect(deleteGraph(tempDir)).resolves.toBeUndefined();
    });
  });

  describe('isGraphStale', () => {
    it('should return true when no graph exists', async () => {
      const stale = await isGraphStale(tempDir);
      expect(stale).toBe(true);
    });

    it('should return false when graph is fresh', async () => {
      // Create a source file
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(path.join(srcDir, 'test.ts'), 'export const x = 1;', 'utf-8');

      // Wait a moment, then save graph
      await new Promise((resolve) => setTimeout(resolve, 50));

      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      const stale = await isGraphStale(tempDir);
      expect(stale).toBe(false);
    });

    it('should return true when source files are modified after scan', async () => {
      // Create a source file
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });
      const testFile = path.join(srcDir, 'test.ts');
      await fs.writeFile(testFile, 'export const x = 1;', 'utf-8');

      // Save graph
      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      // Wait and modify the file
      await new Promise((resolve) => setTimeout(resolve, 50));
      await fs.writeFile(testFile, 'export const x = 2;', 'utf-8');

      const stale = await isGraphStale(tempDir);
      expect(stale).toBe(true);
    });
  });

  describe('getSpecterDir', () => {
    it('should return correct specter directory path', () => {
      const specterDir = getSpecterDir('/project/root');
      expect(specterDir).toBe('/project/root/.specter');
    });

    it('should handle paths with trailing slash', () => {
      const specterDir = getSpecterDir('/project/root/');
      expect(specterDir).toBe('/project/root/.specter');
    });
  });

  describe('exportGraph', () => {
    it('should export graph as JSON', async () => {
      const graph = createMockGraph();
      await saveGraph(graph, tempDir);

      const exportPath = path.join(tempDir, 'export.json');
      await exportGraph(tempDir, exportPath, { format: 'json' });

      const content = await fs.readFile(exportPath, 'utf-8');
      const exported = JSON.parse(content) as KnowledgeGraph;

      expect(exported.version).toBe(graph.version);
      expect(exported.metadata.nodeCount).toBe(graph.metadata.nodeCount);
    });

    it('should export graph as summary', async () => {
      const graph = createMockGraph({
        metadata: {
          scannedAt: '2024-01-15T10:00:00Z',
          scanDurationMs: 100,
          rootDir: '/test',
          fileCount: 10,
          totalLines: 1000,
          languages: { typescript: 10 },
          nodeCount: 50,
          edgeCount: 100,
        },
      });
      await saveGraph(graph, tempDir);

      const exportPath = path.join(tempDir, 'summary.json');
      await exportGraph(tempDir, exportPath, { format: 'summary' });

      const content = await fs.readFile(exportPath, 'utf-8');
      const summary = JSON.parse(content);

      expect(summary.files).toBe(10);
      expect(summary.lines).toBe(1000);
      expect(summary.nodes).toBe(50);
      expect(summary.edges).toBe(100);
      // Summary should NOT include full nodes/edges
      expect(summary.nodes).not.toBeInstanceOf(Object);
    });

    it('should throw when no graph exists', async () => {
      const exportPath = path.join(tempDir, 'export.json');

      await expect(exportGraph(tempDir, exportPath)).rejects.toThrow('No graph found');
    });
  });

  describe('Save/Load Roundtrip', () => {
    it('should preserve all data types through roundtrip', async () => {
      const original = createMockGraph({
        nodes: {
          'node-1': {
            id: 'node-1',
            type: 'function',
            name: 'testFn',
            filePath: 'test.ts',
            lineStart: 1,
            lineEnd: 10,
            exported: true,
            complexity: 5,
            lastModified: '2024-01-15T10:00:00Z',
            modificationCount: 3,
            contributors: ['alice', 'bob', 'charlie'],
            documentation: 'A test function\nWith multiple lines',
          },
        },
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'calls',
            weight: 0.75,
            metadata: { async: true, optional: false },
          },
        ],
      });

      await saveGraph(original, tempDir);
      const loaded = await loadGraph(tempDir);

      expect(loaded).not.toBeNull();

      const originalNode = original.nodes['node-1'];
      const loadedNode = loaded?.nodes['node-1'];

      expect(loadedNode?.complexity).toBe(originalNode.complexity);
      expect(loadedNode?.lastModified).toBe(originalNode.lastModified);
      expect(loadedNode?.modificationCount).toBe(originalNode.modificationCount);
      expect(loadedNode?.contributors).toEqual(originalNode.contributors);
      expect(loadedNode?.documentation).toBe(originalNode.documentation);

      const loadedEdge = loaded?.edges[0];
      expect(loadedEdge?.weight).toBe(0.75);
      expect(loadedEdge?.metadata).toEqual({ async: true, optional: false });
    });

    it('should handle unicode characters', async () => {
      const original = createMockGraph({
        nodes: {
          'unicode-node': {
            id: 'unicode-node',
            type: 'function',
            name: 'processEmoji',
            filePath: 'src/emoji.ts',
            lineStart: 1,
            lineEnd: 10,
            exported: true,
            documentation: 'Handles emoji: \u{1F600} \u{1F389} \u{1F680}',
          },
        },
      });

      await saveGraph(original, tempDir);
      const loaded = await loadGraph(tempDir);

      expect(loaded?.nodes['unicode-node'].documentation).toBe(
        'Handles emoji: \u{1F600} \u{1F389} \u{1F680}'
      );
    });

    it('should handle large graphs', async () => {
      const nodes: KnowledgeGraph['nodes'] = {};
      const edges: KnowledgeGraph['edges'] = [];

      // Create 1000 nodes
      for (let i = 0; i < 1000; i++) {
        nodes[`node-${i}`] = {
          id: `node-${i}`,
          type: 'function',
          name: `function${i}`,
          filePath: `src/file${Math.floor(i / 10)}.ts`,
          lineStart: (i % 100) * 10,
          lineEnd: (i % 100) * 10 + 9,
          exported: i % 2 === 0,
          complexity: Math.floor(Math.random() * 20) + 1,
        };
      }

      // Create 2000 edges
      for (let i = 0; i < 2000; i++) {
        edges.push({
          id: `edge-${i}`,
          source: `node-${i % 1000}`,
          target: `node-${(i + 1) % 1000}`,
          type: 'calls',
        });
      }

      const original = createMockGraph({
        metadata: {
          scannedAt: new Date().toISOString(),
          scanDurationMs: 5000,
          rootDir: '/large-project',
          fileCount: 100,
          totalLines: 50000,
          languages: { typescript: 100 },
          nodeCount: 1000,
          edgeCount: 2000,
        },
        nodes,
        edges,
      });

      await saveGraph(original, tempDir);
      const loaded = await loadGraph(tempDir);

      expect(loaded).not.toBeNull();
      expect(Object.keys(loaded?.nodes || {})).toHaveLength(1000);
      expect(loaded?.edges).toHaveLength(2000);
    });
  });
});
