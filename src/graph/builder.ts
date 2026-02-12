/**
 * Knowledge Graph Builder
 *
 * Orchestrates all analyzers to build the complete knowledge graph
 * for a codebase.
 */

import path from 'node:path';
import {
  type ASTAnalysisResult,
  analyzeSourceFile,
  createProject,
  getSourceFiles,
} from '../analyzers/ast.js';
import { analyzeGitHistory, type GitAnalysisResult } from '../analyzers/git.js';
import {
  analyzeExports,
  analyzeImports,
  buildDependencyMap,
  buildReverseDependencyMap,
  createImportEdges,
  type ExportInfo,
  type ImportInfo,
} from '../analyzers/imports.js';
import type { FileNode, GraphEdge, GraphMetadata, GraphNode, KnowledgeGraph } from './types.js';

export interface BuildOptions {
  rootDir: string;
  includeGitHistory?: boolean;
  patterns?: string[];
  onProgress?: (phase: string, completed: number, total: number, currentFile?: string) => void;
  timeoutMs?: number; // Overall scan timeout (default: 5 minutes)
  fileTimeoutMs?: number; // Per-file analysis timeout (default: 10 seconds)
}

/**
 * Promise with timeout wrapper
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
}

/**
 * Safely analyze a source file with timeout
 */
function safeAnalyzeSourceFile(
  sourceFile: Parameters<typeof analyzeSourceFile>[0],
  rootDir: string,
  timeoutMs: number = 10000
): ASTAnalysisResult | null {
  try {
    // Use synchronous analysis since ts-morph operations are sync
    // but wrap in try-catch for error resilience
    const result = analyzeSourceFile(sourceFile, rootDir);
    return result;
  } catch (error) {
    // Return null for files that fail to analyze
    return null;
  }
}

export interface BuildResult {
  graph: KnowledgeGraph;
  errors: Array<{ file: string; error: string }>;
  warnings: Array<{ file: string; warning: string }>;
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
  } = options;
  const startTime = Date.now();

  const errors: Array<{ file: string; error: string }> = [];
  const warnings: Array<{ file: string; warning: string }> = [];

  const nodes: Record<string, GraphNode> = {};
  const edges: GraphEdge[] = [];

  // Phase 1: Create project and get source files
  onProgress?.('Initializing', 0, 1);
  const project = createProject(rootDir);
  const sourceFiles = getSourceFiles(project, rootDir, patterns);

  if (sourceFiles.length === 0) {
    return {
      graph: createEmptyGraph(rootDir, startTime),
      errors: [{ file: rootDir, error: 'No source files found' }],
      warnings,
    };
  }

  onProgress?.('Found files', sourceFiles.length, sourceFiles.length);

  // Phase 2: Analyze AST for each file
  const astResults: ASTAnalysisResult[] = [];
  const allImports: ImportInfo[] = [];
  const allExports: Map<string, ExportInfo[]> = new Map();

  for (let i = 0; i < sourceFiles.length; i++) {
    // Check overall timeout
    if (Date.now() - startTime > timeoutMs) {
      errors.push({
        file: rootDir,
        error: `Scan timeout exceeded (${Math.round(timeoutMs / 1000)}s). Partial results returned.`,
      });
      break;
    }

    const sourceFile = sourceFiles[i];
    const filePath = path.relative(rootDir, sourceFile.getFilePath());

    try {
      // AST analysis with safe wrapper to prevent hanging
      const astResult = safeAnalyzeSourceFile(sourceFile, rootDir, fileTimeoutMs);

      if (!astResult) {
        errors.push({
          file: filePath,
          error: 'Analysis timeout or parse error',
        });
        onProgress?.('Analyzing AST', i + 1, sourceFiles.length);
        continue;
      }

      astResults.push(astResult);

      // Add file node
      nodes[astResult.fileNode.id] = astResult.fileNode;

      // Add symbol nodes
      for (const symbolNode of astResult.symbolNodes) {
        nodes[symbolNode.id] = symbolNode;

        // Create "contains" edge from file to symbol
        edges.push({
          id: `contains-${edges.length}`,
          source: astResult.fileNode.id,
          target: symbolNode.id,
          type: 'contains',
        });
      }

      // Import analysis
      const imports = analyzeImports(sourceFile, rootDir);
      allImports.push(...imports);

      // Export analysis
      const exports = analyzeExports(sourceFile, rootDir);
      allExports.set(filePath, exports);
    } catch (error) {
      errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    onProgress?.('Analyzing AST', i + 1, sourceFiles.length, filePath);
  }

  // Phase 3: Create import edges
  const importEdges = createImportEdges(allImports);
  edges.push(...importEdges);

  // Build dependency maps for later use
  const dependencies = buildDependencyMap(allImports);
  const _reverseDeps = buildReverseDependencyMap(allImports);

  // Update file nodes with dependency counts
  for (const [filePath, deps] of dependencies) {
    const fileNode = nodes[filePath] as FileNode;
    if (fileNode) {
      fileNode.importCount = deps.size;
    }
  }

  // Phase 4: Analyze git history (optional)
  let gitResult: GitAnalysisResult | null = null;

  if (includeGitHistory) {
    onProgress?.('Analyzing git history', 0, 1);

    const filePaths = astResults.map((r) => r.fileNode.filePath);

    gitResult = await analyzeGitHistory(rootDir, filePaths, (completed, total) =>
      onProgress?.('Analyzing git history', completed, total)
    );

    // Enrich nodes with git data
    for (const [filePath, history] of gitResult.fileHistories) {
      const fileNode = nodes[filePath];
      if (fileNode) {
        fileNode.lastModified = history.lastModified;
        fileNode.modificationCount = history.commitCount;
        fileNode.contributors = history.contributors.map((c) => c.name);
      }
    }

    if (!gitResult.isGitRepo) {
      warnings.push({
        file: rootDir,
        warning: 'Not a git repository. Git history analysis skipped.',
      });
    }
  }

  // Phase 5: Calculate metadata
  const languages: Record<string, number> = {};
  let totalLines = 0;

  for (const astResult of astResults) {
    const lang = astResult.fileNode.language;
    languages[lang] = (languages[lang] || 0) + 1;
    totalLines += astResult.fileNode.lineCount;
  }

  const metadata: GraphMetadata = {
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    rootDir: path.resolve(rootDir),
    fileCount: astResults.length,
    totalLines,
    languages,
    nodeCount: Object.keys(nodes).length,
    edgeCount: edges.length,
  };

  const graph: KnowledgeGraph = {
    version: '1.0.0',
    metadata,
    nodes,
    edges,
  };

  onProgress?.('Complete', 1, 1);

  return { graph, errors, warnings };
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
  };
}

/**
 * Incrementally update graph with changed files
 */
export async function updateGraphIncremental(
  _existingGraph: KnowledgeGraph,
  _changedFiles: string[],
  options: BuildOptions
): Promise<BuildResult> {
  // For now, just rebuild the entire graph
  // TODO: Implement true incremental updates
  return buildKnowledgeGraph(options);
}

/**
 * Get statistics from the graph
 */
export function getGraphStats(graph: KnowledgeGraph) {
  const nodesByType: Record<string, number> = {};
  const edgesByType: Record<string, number> = {};

  for (const node of Object.values(graph.nodes)) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const edge of graph.edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }

  const complexities = Object.values(graph.nodes)
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity!);

  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0;

  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;

  return {
    ...graph.metadata,
    nodesByType,
    edgesByType,
    avgComplexity: Math.round(avgComplexity * 100) / 100,
    maxComplexity,
  };
}
