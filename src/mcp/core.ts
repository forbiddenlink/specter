/**
 * MCP Core Utilities
 *
 * Shared state and utilities for the MCP server including
 * graph caching, error handling, and timeout management.
 */

import { loadGraph } from '../graph/persistence.js';
import type { KnowledgeGraph } from '../graph/types.js';

// Global graph cache
let cachedGraph: KnowledgeGraph | null = null;
let graphLoadError: string | null = null;

// Error tracking for monitoring
interface ErrorMetrics {
  toolErrors: Map<string, number>;
  lastError: Date | null;
  totalErrors: number;
}

const errorMetrics: ErrorMetrics = {
  toolErrors: new Map(),
  lastError: null,
  totalErrors: 0,
};

/**
 * Log error to stderr for debugging
 */
export function logError(toolName: string, error: Error): void {
  console.error(`[MCP Error] ${toolName}: ${error.message}`, {
    timestamp: new Date().toISOString(),
    stack: error.stack,
  });

  // Track metrics
  errorMetrics.totalErrors++;
  errorMetrics.lastError = new Date();
  errorMetrics.toolErrors.set(toolName, (errorMetrics.toolErrors.get(toolName) || 0) + 1);
}

/**
 * Get or load the knowledge graph with enhanced error handling
 */
export async function getGraph(): Promise<KnowledgeGraph> {
  if (cachedGraph) {
    return cachedGraph;
  }

  const cwd = process.cwd();

  try {
    const graph = await loadGraph(cwd);

    if (!graph) {
      graphLoadError = `No knowledge graph found in ${cwd}. Run 'specter scan' first to build the knowledge graph.`;
      throw new Error(graphLoadError);
    }

    cachedGraph = graph;
    return graph;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error loading graph';
    logError('getGraph', new Error(message));
    throw new Error(`Failed to load knowledge graph: ${message}`);
  }
}

/**
 * Wrap tool execution with timeout and error handling
 */
export async function executeTool<T>(
  toolName: string,
  executor: () => Promise<T>,
  timeoutMs = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([executor(), timeoutPromise]);
  } catch (error) {
    logError(toolName, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get current error metrics (for diagnostics)
 */
export function getErrorMetrics(): ErrorMetrics {
  return errorMetrics;
}

/**
 * Clear the cached graph (useful for testing or forced reload)
 */
export function clearGraphCache(): void {
  cachedGraph = null;
  graphLoadError = null;
}
