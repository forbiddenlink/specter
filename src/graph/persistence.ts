/**
 * Graph Persistence
 *
 * Handles saving and loading the knowledge graph to/from disk.
 * Graphs are stored in .specter/ directory in the project root.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createSnapshot } from '../history/snapshot.js';
import { saveSnapshot } from '../history/storage.js';
import type { GraphMetadata, KnowledgeGraph } from './types.js';

const SPECTER_DIR = '.specter';
const GRAPH_FILE = 'graph.json';
const METADATA_FILE = 'metadata.json';

/**
 * Ensure .specter directory exists
 */
async function ensureSpecterDir(rootDir: string): Promise<string> {
  const specterDir = path.join(rootDir, SPECTER_DIR);

  try {
    await fs.access(specterDir);
  } catch {
    await fs.mkdir(specterDir, { recursive: true });
  }

  return specterDir;
}

/**
 * Save the knowledge graph to disk
 */
export async function saveGraph(graph: KnowledgeGraph, rootDir: string): Promise<void> {
  const specterDir = await ensureSpecterDir(rootDir);

  // Save full graph
  const graphPath = path.join(specterDir, GRAPH_FILE);
  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8');

  // Save metadata separately for quick access
  const metadataPath = path.join(specterDir, METADATA_FILE);
  await fs.writeFile(metadataPath, JSON.stringify(graph.metadata, null, 2), 'utf-8');

  // Add .specter to .gitignore if not already there
  await addToGitignore(rootDir);

  // Auto-create health snapshot for trend tracking
  try {
    const snapshot = await createSnapshot(graph);
    await saveSnapshot(rootDir, snapshot);
  } catch {
    // Snapshot creation is non-critical, don't fail the save
  }
}

/**
 * Load the knowledge graph from disk
 */
export async function loadGraph(rootDir: string): Promise<KnowledgeGraph | null> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const graphPath = path.join(specterDir, GRAPH_FILE);

  try {
    const content = await fs.readFile(graphPath, 'utf-8');
    return JSON.parse(content) as KnowledgeGraph;
  } catch {
    return null;
  }
}

/**
 * Load only metadata (faster for quick checks)
 */
export async function loadMetadata(rootDir: string): Promise<GraphMetadata | null> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const metadataPath = path.join(specterDir, METADATA_FILE);

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content) as GraphMetadata;
  } catch {
    return null;
  }
}

/**
 * Check if a graph exists for this project
 */
export async function graphExists(rootDir: string): Promise<boolean> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const graphPath = path.join(specterDir, GRAPH_FILE);

  try {
    await fs.access(graphPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete the cached graph
 */
export async function deleteGraph(rootDir: string): Promise<void> {
  const specterDir = path.join(rootDir, SPECTER_DIR);

  try {
    await fs.rm(specterDir, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
}

/**
 * Check if graph is stale (files have changed since last scan)
 */
export async function isGraphStale(rootDir: string): Promise<boolean> {
  const metadata = await loadMetadata(rootDir);

  if (!metadata) {
    return true;
  }

  // Check if any source files have been modified since scan
  const scanTime = new Date(metadata.scannedAt).getTime();

  try {
    const files = await getSourceFilePaths(rootDir);

    for (const file of files) {
      const stats = await fs.stat(path.join(rootDir, file));
      if (stats.mtimeMs > scanTime) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Get paths to all source files (quick check, no parsing)
 */
async function getSourceFilePaths(rootDir: string): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const ignoreDirs = ['node_modules', 'dist', 'build', '.git', '.specter', 'coverage'];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(relativePath);
        }
      }
    }
  }

  await walk(rootDir);
  return files;
}

/**
 * Add .specter to .gitignore
 */
async function addToGitignore(rootDir: string): Promise<void> {
  const gitignorePath = path.join(rootDir, '.gitignore');

  try {
    let content = '';

    try {
      content = await fs.readFile(gitignorePath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    if (!content.includes('.specter')) {
      const newContent = `${content.trim()}\n\n# Specter knowledge graph cache\n.specter/\n`;
      await fs.writeFile(gitignorePath, newContent, 'utf-8');
    }
  } catch {
    // Ignore errors updating gitignore
  }
}

/**
 * Get the specter directory path
 */
export function getSpecterDir(rootDir: string): string {
  return path.join(rootDir, SPECTER_DIR);
}

/**
 * Export graph to a portable format (for sharing)
 */
export async function exportGraph(
  rootDir: string,
  outputPath: string,
  options: { format?: 'json' | 'summary' } = {}
): Promise<void> {
  const graph = await loadGraph(rootDir);

  if (!graph) {
    throw new Error('No graph found. Run specter scan first.');
  }

  const { format = 'json' } = options;

  if (format === 'json') {
    await fs.writeFile(outputPath, JSON.stringify(graph, null, 2), 'utf-8');
  } else {
    // Summary format
    const summary = {
      scannedAt: graph.metadata.scannedAt,
      files: graph.metadata.fileCount,
      lines: graph.metadata.totalLines,
      nodes: graph.metadata.nodeCount,
      edges: graph.metadata.edgeCount,
      languages: graph.metadata.languages,
    };
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
  }
}
