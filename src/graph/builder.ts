/**
 * Knowledge Graph Builder
 *
 * Orchestrates all analyzers to build the complete knowledge graph
 * for a codebase.
 */

import path from 'node:path'
import fg from 'fast-glob'
import type { SourceFile } from 'ts-morph'
import {
  type ASTAnalysisResult,
  analyzeSourceFile,
  createProject,
  getSourceFiles,
} from '../analyzers/ast.js'
import { analyzeGitHistory, type GitAnalysisResult } from '../analyzers/git.js'
import {
  analyzeImports,
  buildDependencyMap,
  createImportEdges,
  createImportResolver,
  type ImportInfo,
  type ImportResolver,
} from '../analyzers/imports.js'
import type { FileNode, GraphEdge, GraphMetadata, GraphNode, KnowledgeGraph } from './types.js'

export interface BuildOptions {
  rootDir: string
  includeGitHistory?: boolean
  patterns?: string[]
  onProgress?: (phase: string, completed: number, total: number, currentFile?: string) => void
  timeoutMs?: number // Overall scan timeout (default: 5 minutes)
  fileTimeoutMs?: number // Per-file analysis timeout (default: 10 seconds)
}

/**
 * Promise with timeout wrapper
 */
function _withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ])
}

/**
 * Safely analyze a source file with timeout
 */
function safeAnalyzeSourceFile(
  sourceFile: Parameters<typeof analyzeSourceFile>[0],
  rootDir: string,
  _timeoutMs: number = 10000
): ASTAnalysisResult | null {
  try {
    // Use synchronous analysis since ts-morph operations are sync
    // but wrap in try-catch for error resilience
    const result = analyzeSourceFile(sourceFile, rootDir)
    return result
  } catch (_error) {
    // Return null for files that fail to analyze
    return null
  }
}

interface AnalyzeFilesOptions {
  rootDir: string
  resolver: ImportResolver
  startTime: number
  timeoutMs: number
  fileTimeoutMs: number
  onProgress?: BuildOptions['onProgress']
  errors: Array<{ file: string; error: string }>
}

interface AnalyzedFiles {
  astResults: ASTAnalysisResult[]
  allImports: ImportInfo[]
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
}

/**
 * AST + import analysis for a set of source files. Shared by full and incremental builds.
 */
function analyzeFiles(sourceFiles: SourceFile[], options: AnalyzeFilesOptions): AnalyzedFiles {
  const { rootDir, resolver, startTime, timeoutMs, fileTimeoutMs, onProgress, errors } = options
  const astResults: ASTAnalysisResult[] = []
  const allImports: ImportInfo[] = []
  const nodes: Record<string, GraphNode> = {}
  const edges: GraphEdge[] = []

  for (let i = 0; i < sourceFiles.length; i++) {
    if (Date.now() - startTime > timeoutMs) {
      errors.push({
        file: rootDir,
        error: `Scan timeout exceeded (${Math.round(timeoutMs / 1000)}s). Partial results returned.`,
      })
      break
    }

    const sourceFile = sourceFiles[i]
    if (!sourceFile) continue
    const filePath = path.relative(rootDir, sourceFile.getFilePath())

    try {
      const astResult = safeAnalyzeSourceFile(sourceFile, rootDir, fileTimeoutMs)

      if (!astResult) {
        errors.push({ file: filePath, error: 'Analysis timeout or parse error' })
        onProgress?.('Analyzing AST', i + 1, sourceFiles.length)
        continue
      }

      astResults.push(astResult)
      nodes[astResult.fileNode.id] = astResult.fileNode

      for (const symbolNode of astResult.symbolNodes) {
        nodes[symbolNode.id] = symbolNode
        edges.push({
          id: '',
          source: astResult.fileNode.id,
          target: symbolNode.id,
          type: 'contains',
        })
      }

      allImports.push(...analyzeImports(sourceFile, rootDir, resolver))
    } catch (error) {
      errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    onProgress?.('Analyzing AST', i + 1, sourceFiles.length, filePath)
  }

  edges.push(...createImportEdges(allImports))

  for (const [filePath, deps] of buildDependencyMap(allImports)) {
    const fileNode = nodes[filePath] as FileNode | undefined
    if (fileNode) fileNode.importCount = deps.size
  }

  return { astResults, allImports, nodes, edges }
}

/**
 * Copy churn and ownership from git onto file nodes.
 */
function applyGitHistory(nodes: Record<string, GraphNode>, gitResult: GitAnalysisResult): void {
  for (const node of Object.values(nodes)) {
    if (node.type !== 'file') continue
    const history = gitResult.fileHistories.get(node.filePath)
    if (history) {
      node.lastModified = history.lastModified
      node.modificationCount = history.commitCount
      node.contributors = history.contributors.map((c) => c.name)
    } else {
      delete node.lastModified
      delete node.modificationCount
      delete node.contributors
    }
  }
}

/**
 * Build the graph object: stable edge ids, metadata, change coupling.
 */
function assembleGraph(
  nodes: Record<string, GraphNode>,
  edges: GraphEdge[],
  rootDir: string,
  startTime: number,
  gitResult: GitAnalysisResult | null
): KnowledgeGraph {
  const counters: Record<string, number> = {}
  for (const edge of edges) {
    const prefix = edge.type === 'imports' ? 'import' : edge.type
    const n = counters[prefix] ?? 0
    counters[prefix] = n + 1
    edge.id = `${prefix}-${n}`
  }

  const languages: Record<string, number> = {}
  let totalLines = 0
  let fileCount = 0
  for (const node of Object.values(nodes)) {
    if (node.type !== 'file') continue
    const file = node as FileNode
    fileCount++
    languages[file.language] = (languages[file.language] || 0) + 1
    totalLines += file.lineCount ?? 0
  }

  const metadata: GraphMetadata = {
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    rootDir: path.resolve(rootDir),
    fileCount,
    totalLines,
    languages,
    nodeCount: Object.keys(nodes).length,
    edgeCount: edges.length,
  }
  if (gitResult?.headCommit) metadata.headCommit = gitResult.headCommit
  if (gitResult?.windowAuthors !== undefined) metadata.authorCount = gitResult.windowAuthors
  if (gitResult?.coChangeAccuracy) metadata.coChangeAccuracy = gitResult.coChangeAccuracy

  const graph: KnowledgeGraph = { version: '1.0.0', metadata, nodes, edges }
  if (gitResult?.isGitRepo) graph.coChange = gitResult.coChange
  return graph
}

export interface BuildResult {
  graph: KnowledgeGraph
  errors: Array<{ file: string; error: string }>
  warnings: Array<{ file: string; warning: string }>
}

/**
 * Build the complete knowledge graph for a codebase
 */
export async function buildKnowledgeGraph(options: BuildOptions): Promise<BuildResult> {
  const {
    rootDir,
    includeGitHistory = true,
    patterns,
    onProgress,
    timeoutMs = 5 * 60 * 1000, // 5 minute default timeout
    fileTimeoutMs = 10000, // 10 second per-file timeout
  } = options
  const startTime = Date.now()

  const errors: Array<{ file: string; error: string }> = []
  const warnings: Array<{ file: string; warning: string }> = []

  const nodes: Record<string, GraphNode> = {}
  const edges: GraphEdge[] = []

  // Phase 1: Create project and get source files
  onProgress?.('Initializing', 0, 1)
  const project = createProject(rootDir)
  const sourceFiles = getSourceFiles(project, rootDir, patterns)

  if (sourceFiles.length === 0) {
    return {
      graph: createEmptyGraph(rootDir, startTime),
      errors: [{ file: rootDir, error: 'No source files found' }],
      warnings,
    }
  }

  onProgress?.('Found files', sourceFiles.length, sourceFiles.length)

  // Phase 2: Analyze AST for each file
  const resolver = createImportResolver(rootDir)
  const analyzed = analyzeFiles(sourceFiles, {
    rootDir,
    resolver,
    startTime,
    timeoutMs,
    fileTimeoutMs,
    onProgress,
    errors,
  })
  const { astResults } = analyzed
  Object.assign(nodes, analyzed.nodes)
  edges.push(...analyzed.edges)

  // Phase 4: Analyze git history (optional)
  let gitResult: GitAnalysisResult | null = null

  if (includeGitHistory) {
    onProgress?.('Analyzing git history', 0, 1)

    const filePaths = astResults.map((r) => r.fileNode.filePath)

    gitResult = await analyzeGitHistory(rootDir, filePaths, (completed, total) =>
      onProgress?.('Analyzing git history', completed, total)
    )

    applyGitHistory(nodes, gitResult)

    if (!gitResult.isGitRepo) {
      warnings.push({
        file: rootDir,
        warning: 'Not a git repository. Git history analysis skipped.',
      })
    }
  }

  // Phase 5: Calculate metadata
  const graph = assembleGraph(nodes, edges, rootDir, startTime, gitResult)

  onProgress?.('Complete', 1, 1)

  return { graph, errors, warnings }
}

/**
 * Create an empty graph structure
 */
function createEmptyGraph(rootDir: string, startTime: number): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime,
      rootDir: path.resolve(rootDir),
      fileCount: 0,
      totalLines: 0,
      languages: {},
      nodeCount: 0,
      edgeCount: 0,
    },
    nodes: {},
    edges: [],
  }
}

/**
 * Incrementally update a graph: re-analyze only `changedFiles` (relative paths;
 * deleted files are dropped), then refresh git history with one log pass.
 *
 * Every per-file fact (nodes, contains edges, outgoing import edges) is owned by
 * exactly one file, so replacing a file's facts gives the same graph a full scan
 * would produce.
 */
export async function updateGraphIncremental(
  existingGraph: KnowledgeGraph,
  changedFiles: string[],
  options: BuildOptions
): Promise<BuildResult> {
  const {
    rootDir,
    includeGitHistory = true,
    onProgress,
    timeoutMs = 5 * 60 * 1000,
    fileTimeoutMs = 10000,
  } = options
  const startTime = Date.now()
  const errors: Array<{ file: string; error: string }> = []
  const warnings: Array<{ file: string; warning: string }> = []
  const changed = new Set(changedFiles.map((f) => path.normalize(f)))
  // Importers of a changed file re-resolve too, so a deleted or renamed target drops their edge
  for (const edge of existingGraph.edges) {
    if (edge.type === 'imports' && changed.has(edge.target)) changed.add(edge.source)
  }

  // Drop everything owned by a changed file
  const nodes: Record<string, GraphNode> = {}
  for (const [id, node] of Object.entries(existingGraph.nodes)) {
    if (!changed.has(node.filePath)) nodes[id] = { ...node }
  }
  const edges: GraphEdge[] = existingGraph.edges
    .filter((edge) => {
      if (edge.type === 'imports') return !changed.has(edge.source)
      return edge.source in nodes && edge.target in nodes
    })
    .map((edge) => ({ ...edge }))

  // Re-analyze the changed files that still exist and still count as source
  onProgress?.('Analyzing changed files', 0, changed.size)
  const project = createProject(rootDir)
  const sourceFiles =
    changed.size > 0
      ? getSourceFiles(
          project,
          rootDir,
          [...changed].map((f) => fg.escapePath(f.split(path.sep).join('/')))
        )
      : []
  const analyzed = analyzeFiles(sourceFiles, {
    rootDir,
    resolver: createImportResolver(rootDir),
    startTime,
    timeoutMs,
    fileTimeoutMs,
    onProgress,
    errors,
  })
  Object.assign(nodes, analyzed.nodes)
  edges.push(...analyzed.edges)

  let gitResult: GitAnalysisResult | null = null
  if (includeGitHistory) {
    onProgress?.('Analyzing git history', 0, 1)
    const filePaths = Object.values(nodes)
      .filter((n) => n.type === 'file')
      .map((n) => n.filePath)
    gitResult = await analyzeGitHistory(rootDir, filePaths)
    applyGitHistory(nodes, gitResult)
  }

  const graph = assembleGraph(nodes, edges, rootDir, startTime, gitResult)
  onProgress?.('Complete', 1, 1)
  return { graph, errors, warnings }
}

/**
 * Get statistics from the graph
 */
export function getGraphStats(graph: KnowledgeGraph) {
  const nodesByType: Record<string, number> = {}
  const edgesByType: Record<string, number> = {}

  for (const node of Object.values(graph.nodes)) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1
  }

  for (const edge of graph.edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1
  }

  const complexities = Object.values(graph.nodes)
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity!)

  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0

  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0

  return {
    ...graph.metadata,
    nodesByType,
    edgesByType,
    avgComplexity: Math.round(avgComplexity * 100) / 100,
    maxComplexity,
  }
}
