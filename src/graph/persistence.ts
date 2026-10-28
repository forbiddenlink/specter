/**
 * Graph Persistence
 *
 * Handles saving and loading the knowledge graph to/from disk.
 * Graphs are stored in .specter/ directory in the project root.
 */

import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSnapshot } from '../history/snapshot.js'
import { saveSnapshot } from '../history/storage.js'
import { logger } from '../lib/logger.js'
import { isRecordedGraph, recordGraph } from './provenance.js'
import { KnowledgeGraphSchema } from './schema.js'
import type { GraphMetadata, KnowledgeGraph } from './types.js'

const SPECTER_DIR = '.specter'
const GRAPH_FILE = 'graph.json'
const METADATA_FILE = 'metadata.json'

/**
 * Ensure .specter directory exists
 */
async function ensureSpecterDir(rootDir: string): Promise<string> {
  const specterDir = path.join(rootDir, SPECTER_DIR)

  try {
    // A cloned repo could ship .specter as a symlink to redirect our writes elsewhere
    if ((await fs.lstat(specterDir)).isSymbolicLink()) {
      throw new Error(`${specterDir} is a symlink; refusing to write the graph through it`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await fs.mkdir(specterDir, { recursive: true })
  }

  return specterDir
}

/**
 * Save the knowledge graph to disk
 */
export async function saveGraph(graph: KnowledgeGraph, rootDir: string): Promise<void> {
  const specterDir = await ensureSpecterDir(rootDir)

  // Atomic writes: the edit hook may read the graph while a background scan saves it
  const content = JSON.stringify(graph)
  await writeFileAtomic(path.join(specterDir, GRAPH_FILE), content)
  // Lets the edit hook tell a graph we built from one a repository shipped
  recordGraph(rootDir, content)
  await writeFileAtomic(
    path.join(specterDir, METADATA_FILE),
    JSON.stringify(graph.metadata, null, 2)
  )

  // The cache directory ignores itself, so scanning never edits the project's .gitignore
  await writeFileAtomic(path.join(specterDir, '.gitignore'), '# Specter cache, safe to delete\n*\n')

  // Auto-create health snapshot for trend tracking
  try {
    const snapshot = await createSnapshot(graph)
    await saveSnapshot(rootDir, snapshot)
  } catch {
    // Snapshot creation is non-critical, don't fail the save
  }
}

/**
 * Load the graph only if this machine wrote it (see provenance.ts). Use this as the
 * base for anything that is saved and recorded again, such as an incremental scan,
 * so a graph shipped inside a repository can never be laundered into a trusted one.
 */
export async function loadTrustedGraph(rootDir: string): Promise<KnowledgeGraph | null> {
  try {
    const content = await fs.readFile(path.join(rootDir, SPECTER_DIR, GRAPH_FILE))
    if (!isRecordedGraph(rootDir, content)) return null
    const result = KnowledgeGraphSchema.safeParse(JSON.parse(content.toString('utf-8')))
    return result.success ? (result.data as KnowledgeGraph) : null
  } catch {
    return null
  }
}

/**
 * Load the knowledge graph from disk
 */
export async function loadGraph(rootDir: string): Promise<KnowledgeGraph | null> {
  const specterDir = path.join(rootDir, SPECTER_DIR)
  const graphPath = path.join(specterDir, GRAPH_FILE)

  try {
    const content = await fs.readFile(graphPath, 'utf-8')
    const parsed = JSON.parse(content)
    const result = KnowledgeGraphSchema.safeParse(parsed)
    if (!result.success) {
      logger.warn({ err: result.error }, 'Invalid graph data')
      return null
    }
    return result.data as KnowledgeGraph
  } catch {
    return null
  }
}

/**
 * Load only metadata (faster for quick checks)
 */
export async function loadMetadata(rootDir: string): Promise<GraphMetadata | null> {
  const specterDir = path.join(rootDir, SPECTER_DIR)
  const metadataPath = path.join(specterDir, METADATA_FILE)

  try {
    const content = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(content) as GraphMetadata
  } catch {
    return null
  }
}

/**
 * Check if a graph exists for this project
 */
export async function graphExists(rootDir: string): Promise<boolean> {
  const specterDir = path.join(rootDir, SPECTER_DIR)
  const graphPath = path.join(specterDir, GRAPH_FILE)

  try {
    await fs.access(graphPath)
    return true
  } catch {
    return false
  }
}

/**
 * Delete the cached graph
 */
export async function deleteGraph(rootDir: string): Promise<void> {
  const specterDir = path.join(rootDir, SPECTER_DIR)

  try {
    await fs.rm(specterDir, { recursive: true })
  } catch {
    // Directory doesn't exist, that's fine
  }
}

/**
 * Check if graph is stale (files have changed since last scan)
 */
export async function isGraphStale(rootDir: string): Promise<boolean> {
  const metadata = await loadMetadata(rootDir)

  if (!metadata) {
    return true
  }

  // Check if any source files have been modified since scan
  const scanTime = new Date(metadata.scannedAt).getTime()

  try {
    const files = await getSourceFilePaths(rootDir)
    const graph = await loadGraph(rootDir)

    if (!graph) {
      return true
    }

    const currentFiles = new Set(files)
    const scannedFiles = Object.values(graph.nodes)
      .filter((node) => node.type === 'file')
      .map((node) => node.filePath)

    if (scannedFiles.some((file) => !currentFiles.has(file))) {
      return true
    }

    for (const file of files) {
      const stats = await fs.stat(path.join(rootDir, file))
      if (stats.mtimeMs > scanTime) {
        return true
      }
    }

    return false
  } catch {
    return true
  }
}

/**
 * Get paths to all source files (quick check, no parsing)
 */
async function getSourceFilePaths(rootDir: string): Promise<string[]> {
  const files: string[] = []
  const extensions = ['.ts', '.tsx', '.js', '.jsx']
  const ignoreDirs = ['node_modules', 'dist', 'build', '.git', '.specter', 'coverage']

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(rootDir, fullPath)

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          await walk(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(relativePath)
        }
      }
    }
  }

  await walk(rootDir)
  return files
}

/**
 * Write via an unpredictable temp file opened exclusively, then rename. Exclusive
 * create never follows a planted symlink, and rename replaces a symlink at the
 * target instead of writing through it.
 */
async function writeFileAtomic(target: string, content: string): Promise<void> {
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(temp, content, { encoding: 'utf-8', flag: 'wx' })
    await fs.rename(temp, target)
  } catch (error) {
    await fs.rm(temp, { force: true })
    throw error
  }
}

/**
 * Get the specter directory path
 */
export function getSpecterDir(rootDir: string): string {
  return path.join(rootDir, SPECTER_DIR)
}

/**
 * Export graph to a portable format (for sharing)
 */
export async function exportGraph(
  rootDir: string,
  outputPath: string,
  options: { format?: 'json' | 'summary' } = {}
): Promise<void> {
  const graph = await loadGraph(rootDir)

  if (!graph) {
    throw new Error('No graph found. Run specter scan first.')
  }

  const { format = 'json' } = options

  if (format === 'json') {
    await fs.writeFile(outputPath, JSON.stringify(graph, null, 2), 'utf-8')
  } else {
    // Summary format
    const summary = {
      scannedAt: graph.metadata.scannedAt,
      files: graph.metadata.fileCount,
      lines: graph.metadata.totalLines,
      nodes: graph.metadata.nodeCount,
      edges: graph.metadata.edgeCount,
      languages: graph.metadata.languages,
    }
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8')
  }
}
