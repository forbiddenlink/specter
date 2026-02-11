/**
 * get_call_chain Tool
 *
 * Traces the dependency path between two files or symbols.
 * Answers "How does file A relate to file B?"
 */

import { z } from 'zod';
import type { KnowledgeGraph } from '../graph/types.js';

export const schema = {
  from: z.string().describe('Starting file path or symbol name'),
  to: z.string().describe('Target file path or symbol name'),
  maxDepth: z.number().optional().describe('Maximum chain length to search'),
};

export interface Input {
  from: string;
  to: string;
  maxDepth?: number;
}

export interface CallChainResult {
  found: boolean;
  path: string[];
  depth: number;
  summary: string;
}

export function execute(graph: KnowledgeGraph, input: Input): CallChainResult {
  const { from, to, maxDepth = 5 } = input;

  // Normalize inputs - could be file paths or symbol names
  const startNode = findNode(graph, from);
  const endNode = findNode(graph, to);

  if (!startNode) {
    return {
      found: false,
      path: [],
      depth: 0,
      summary: `Could not find "${from}" in the codebase. Try using the full file path or exact symbol name.`,
    };
  }

  if (!endNode) {
    return {
      found: false,
      path: [],
      depth: 0,
      summary: `Could not find "${to}" in the codebase. Try using the full file path or exact symbol name.`,
    };
  }

  // BFS to find shortest path
  const path = findPath(graph, startNode, endNode, maxDepth);

  if (!path) {
    return {
      found: false,
      path: [],
      depth: 0,
      summary: generateNoPathSummary(from, to, maxDepth),
    };
  }

  return {
    found: true,
    path,
    depth: path.length - 1,
    summary: generatePathSummary(path),
  };
}

function findNode(graph: KnowledgeGraph, query: string): string | null {
  // First try exact match on node ID (file path)
  if (graph.nodes[query]) {
    return query;
  }

  // Try to find by name
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.name === query || node.filePath === query) {
      return id;
    }
  }

  // Try partial match on file path
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.type === 'file' && id.endsWith(query)) {
      return id;
    }
  }

  return null;
}

function findPath(
  graph: KnowledgeGraph,
  start: string,
  end: string,
  maxDepth: number
): string[] | null {
  if (start === end) {
    return [start];
  }

  // Build adjacency list from edges
  const adjacency = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports' || edge.type === 'contains') {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);

      // Also add reverse for bidirectional search
      if (!adjacency.has(edge.target)) {
        adjacency.set(edge.target, new Set());
      }
      adjacency.get(edge.target)!.add(edge.source);
    }
  }

  // BFS
  const queue: Array<{ node: string; path: string[] }> = [
    { node: start, path: [start] },
  ];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (path.length > maxDepth + 1) {
      continue;
    }

    const neighbors = adjacency.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (neighbor === end) {
        return [...path, neighbor];
      }

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null;
}

function generatePathSummary(path: string[]): string {
  const parts: string[] = [];

  parts.push(`Found a connection in **${path.length - 1} step${path.length > 2 ? 's' : ''}**:`);
  parts.push('');

  // ASCII dependency tree visualization
  parts.push('```');
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    if (i === 0) {
      parts.push(node);
    } else {
      const indent = '    '.repeat(i - 1);
      const connector = i === path.length - 1 ? '└── ' : '├── ';
      const verticals = i > 1 ? '│   '.repeat(i - 1).slice(0, -4) + connector : connector;
      parts.push(verticals + node);
    }
  }
  parts.push('```');

  parts.push('');

  // Describe the relationship
  if (path.length === 2) {
    parts.push(`Direct relationship: \`${path[0]}\` imports from \`${path[1]}\`.`);
  } else {
    parts.push(`These are connected through ${path.length - 2} intermediate file${path.length > 3 ? 's' : ''}.`);
  }

  return parts.join('\n');
}

function generateNoPathSummary(from: string, to: string, maxDepth: number): string {
  const parts: string[] = [];

  parts.push(`No connection found between \`${from}\` and \`${to}\` within ${maxDepth} steps.`);
  parts.push('');
  parts.push('This could mean:');
  parts.push('- They are in completely separate parts of the codebase');
  parts.push('- The connection exists but is longer than the search depth');
  parts.push('- They are only connected through external dependencies');
  parts.push('');
  parts.push('Try increasing `maxDepth` or checking if the paths are correct.');

  return parts.join('\n');
}
