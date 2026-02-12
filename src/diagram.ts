/**
 * Diagram - Architecture Diagram Generation
 *
 * Generates Mermaid, D2, and ASCII architecture diagrams from the knowledge graph.
 * Shows module relationships, dependencies, and architectural layers.
 */

import fs from 'node:fs/promises';
import type { KnowledgeGraph } from './graph/types.js';

// Types
export type DiagramFormat = 'mermaid' | 'd2' | 'ascii';

export interface DiagramOptions {
  format: DiagramFormat;
  depth: number; // How many directory levels to show
  focus?: string; // Focus on specific file/directory
  showComplexity?: boolean;
  showHealth?: boolean;
}

export interface DiagramResult {
  format: DiagramFormat;
  content: string; // The diagram source
  nodeCount: number;
  edgeCount: number;
  outputPath?: string; // If saved to file
}

interface DiagramNode {
  id: string;
  label: string;
  path: string;
  group: string; // Directory for grouping
  complexity?: number;
  health?: number;
}

interface DiagramEdge {
  source: string;
  target: string;
  label?: string;
}

/**
 * Build diagram nodes and edges from the knowledge graph
 */
function buildDiagramData(
  graph: KnowledgeGraph,
  options: DiagramOptions
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
  const rootDir = graph.metadata.rootDir;

  // Filter by focus if specified
  let filteredNodes = fileNodes;
  if (options.focus) {
    filteredNodes = fileNodes.filter((n) => n.filePath.includes(options.focus!));
  }

  // Group files by directory (respecting depth)
  const nodeMap = new Map<string, DiagramNode>();
  const seenGroups = new Set<string>();

  for (const node of filteredNodes) {
    const relativePath = node.filePath.replace(rootDir, '').replace(/^\//, '');
    const parts = relativePath.split('/');

    // Calculate group based on depth
    const groupParts = parts.slice(0, Math.min(options.depth, parts.length - 1));
    const group = groupParts.length > 0 ? groupParts.join('/') : 'root';
    seenGroups.add(group);

    // Create a clean ID (alphanumeric only for compatibility)
    const id = sanitizeId(relativePath);

    // Calculate health score
    let health: number | undefined;
    if (options.showHealth) {
      const complexity = node.complexity ?? 0;
      health = Math.max(0, 100 - complexity * 5);
    }

    nodeMap.set(node.filePath, {
      id,
      label: parts[parts.length - 1], // filename only
      path: relativePath,
      group,
      complexity: options.showComplexity ? node.complexity : undefined,
      health,
    });
  }

  // Build edges from import relationships
  const edges: DiagramEdge[] = [];
  const seenEdges = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (!sourceNode || !targetNode) continue;

      // Get file paths for the nodes
      const sourceFile = sourceNode.filePath;
      const targetFile = targetNode.filePath;

      const sourceDiagram = nodeMap.get(sourceFile);
      const targetDiagram = nodeMap.get(targetFile);

      if (!sourceDiagram || !targetDiagram) continue;
      if (sourceDiagram.id === targetDiagram.id) continue; // Skip self-references

      const edgeKey = `${sourceDiagram.id}->${targetDiagram.id}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      edges.push({
        source: sourceDiagram.id,
        target: targetDiagram.id,
        label: 'imports',
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

/**
 * Sanitize an identifier for use in diagrams
 */
function sanitizeId(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '');
}

/**
 * Generate Mermaid format diagram
 */
function generateMermaid(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: DiagramOptions
): string {
  const lines: string[] = [];
  lines.push('graph TD');

  // Group nodes by directory
  const groups = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    if (!groups.has(node.group)) {
      groups.set(node.group, []);
    }
    groups.get(node.group)!.push(node);
  }

  // Create subgraphs for each directory
  for (const [group, groupNodes] of groups.entries()) {
    const groupId = sanitizeId(group);
    lines.push(`    subgraph ${groupId}["${group}"]`);

    for (const node of groupNodes) {
      let label = node.label;

      // Add complexity or health indicator
      if (options.showComplexity && node.complexity !== undefined) {
        const emoji = node.complexity > 20 ? '🔴' : node.complexity > 10 ? '🟡' : '🟢';
        label = `${emoji} ${label}`;
      } else if (options.showHealth && node.health !== undefined) {
        const emoji = node.health >= 80 ? '🟢' : node.health >= 60 ? '🟡' : '🔴';
        label = `${emoji} ${label}`;
      }

      lines.push(`        ${node.id}["${label}"]`);
    }

    lines.push('    end');
  }

  // Add edges
  lines.push('');
  for (const edge of edges) {
    lines.push(`    ${edge.source} -->|imports| ${edge.target}`);
  }

  return lines.join('\n');
}

/**
 * Generate D2 format diagram
 */
function generateD2(nodes: DiagramNode[], edges: DiagramEdge[], options: DiagramOptions): string {
  const lines: string[] = [];

  // D2 uses nested structure for groups
  const groups = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    if (!groups.has(node.group)) {
      groups.set(node.group, []);
    }
    groups.get(node.group)!.push(node);
  }

  // Create nested structure
  for (const [group, groupNodes] of groups.entries()) {
    const groupParts = group.split('/');

    // Build nested path
    let prefix = '';
    for (let i = 0; i < groupParts.length; i++) {
      const part = sanitizeId(groupParts[i]);
      if (i === 0) {
        lines.push(`${part}: {`);
        prefix = part;
      } else {
        lines.push(`  ${prefix}.${part}: {`);
        prefix = `${prefix}.${part}`;
      }
    }

    // Add nodes
    for (const node of groupNodes) {
      let label = node.label;

      if (options.showComplexity && node.complexity !== undefined) {
        label = `${label} (C:${node.complexity})`;
      } else if (options.showHealth && node.health !== undefined) {
        label = `${label} (H:${node.health})`;
      }

      lines.push(`    ${node.id}: "${label}"`);
    }

    // Close braces
    for (let i = 0; i < groupParts.length; i++) {
      lines.push('  }');
    }
  }

  // Add edges
  lines.push('');
  for (const edge of edges) {
    lines.push(`${edge.source} -> ${edge.target}`);
  }

  return lines.join('\n');
}

/**
 * Generate ASCII art diagram
 */
function generateAscii(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: DiagramOptions
): string {
  const lines: string[] = [];

  // Group nodes by directory
  const groups = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    if (!groups.has(node.group)) {
      groups.set(node.group, []);
    }
    groups.get(node.group)!.push(node);
  }

  // Calculate max width needed
  const maxNodeWidth = Math.max(...nodes.map((n) => n.label.length + 4));
  const boxWidth = Math.max(maxNodeWidth, 20);

  // Track node positions for drawing connections
  const nodePositions = new Map<string, { group: string; index: number }>();
  let groupIndex = 0;

  // Draw each group as a box
  for (const [group, groupNodes] of groups.entries()) {
    // Group header
    const title = group || 'root';
    const headerPadding = Math.max(0, boxWidth - title.length - 4);
    const leftPad = Math.floor(headerPadding / 2);
    const rightPad = headerPadding - leftPad;

    lines.push(`┌${'─'.repeat(boxWidth)}┐`);
    lines.push(`│${' '.repeat(leftPad + 2)}${title}${' '.repeat(rightPad + 2)}│`);
    lines.push(`├${'─'.repeat(boxWidth)}┤`);

    // Draw each node in the group
    for (let i = 0; i < groupNodes.length; i++) {
      const node = groupNodes[i];
      nodePositions.set(node.id, { group, index: groupIndex });

      const label = node.label;
      let indicator = '';

      if (options.showComplexity && node.complexity !== undefined) {
        indicator = node.complexity > 20 ? ' !' : node.complexity > 10 ? ' ~' : ' +';
      } else if (options.showHealth && node.health !== undefined) {
        indicator = node.health >= 80 ? ' +' : node.health >= 60 ? ' ~' : ' !';
      }

      const displayLabel = `${label}${indicator}`;
      const nodePadding = Math.max(0, boxWidth - displayLabel.length - 4);

      lines.push(`│  ${displayLabel}${' '.repeat(nodePadding)}  │`);
    }

    lines.push(`└${'─'.repeat(boxWidth)}┘`);
    lines.push('');

    groupIndex++;
  }

  // Draw a summary of connections
  if (edges.length > 0) {
    lines.push('');
    lines.push('─'.repeat(boxWidth + 2));
    lines.push('  CONNECTIONS');
    lines.push('─'.repeat(boxWidth + 2));

    // Find the actual node labels for better readability
    const nodeIdToLabel = new Map<string, string>();
    for (const node of nodes) {
      nodeIdToLabel.set(node.id, node.label);
    }

    // Group edges by source for cleaner display
    const edgesBySource = new Map<string, string[]>();
    for (const edge of edges) {
      const sourceLabel = nodeIdToLabel.get(edge.source) || edge.source;
      const targetLabel = nodeIdToLabel.get(edge.target) || edge.target;

      if (!edgesBySource.has(sourceLabel)) {
        edgesBySource.set(sourceLabel, []);
      }
      edgesBySource.get(sourceLabel)!.push(targetLabel);
    }

    for (const [source, targets] of edgesBySource.entries()) {
      // Truncate if too many targets
      const displayTargets = targets.slice(0, 3);
      const more = targets.length > 3 ? ` (+${targets.length - 3})` : '';
      lines.push(`  ${source} → ${displayTargets.join(', ')}${more}`);
    }

    lines.push('─'.repeat(boxWidth + 2));
  }

  // Add legend
  if (options.showComplexity || options.showHealth) {
    lines.push('');
    lines.push('  Legend: + good, ~ warning, ! critical');
  }

  return lines.join('\n');
}

/**
 * Main function to generate a diagram
 */
export function generateDiagram(graph: KnowledgeGraph, options: DiagramOptions): DiagramResult {
  const { nodes, edges } = buildDiagramData(graph, options);

  let content: string;

  switch (options.format) {
    case 'mermaid':
      content = generateMermaid(nodes, edges, options);
      break;
    case 'd2':
      content = generateD2(nodes, edges, options);
      break;
    case 'ascii':
      content = generateAscii(nodes, edges, options);
      break;
    default:
      content = generateMermaid(nodes, edges, options);
  }

  return {
    format: options.format,
    content,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

/**
 * Save diagram to file
 */
export async function saveDiagram(
  result: DiagramResult,
  outputPath: string
): Promise<DiagramResult> {
  await fs.writeFile(outputPath, result.content, 'utf-8');
  return {
    ...result,
    outputPath,
  };
}

/**
 * Format diagram output for display
 */
export function formatDiagramOutput(result: DiagramResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  ARCHITECTURE DIAGRAM                             ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  lines.push(`Format: ${result.format.toUpperCase()}`);
  lines.push(`Nodes:  ${result.nodeCount}`);
  lines.push(`Edges:  ${result.edgeCount}`);

  if (result.outputPath) {
    lines.push(`Saved:  ${result.outputPath}`);
  }

  lines.push('');
  lines.push('─'.repeat(51));
  lines.push('');
  lines.push(result.content);
  lines.push('');
  lines.push('─'.repeat(51));

  if (result.format === 'mermaid') {
    lines.push('');
    lines.push('Paste into GitHub markdown or https://mermaid.live');
  } else if (result.format === 'd2') {
    lines.push('');
    lines.push('Render with: d2 diagram.d2 diagram.svg');
  }

  return lines.join('\n');
}

/**
 * Get file extension for diagram format
 */
export function getDiagramExtension(format: DiagramFormat): string {
  switch (format) {
    case 'mermaid':
      return '.mmd';
    case 'd2':
      return '.d2';
    case 'ascii':
      return '.txt';
    default:
      return '.txt';
  }
}
