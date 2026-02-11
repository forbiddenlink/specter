/**
 * get_file_relationships Tool
 *
 * Returns imports, exports, and dependencies for a specific file.
 */

import { z } from 'zod';
import type { KnowledgeGraph, NodeType } from '../graph/types.js';

export const schema = {
  filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface FileRelationshipsResult {
  filePath: string;
  exists: boolean;
  imports: Array<{
    source: string;
    symbols: string[];
  }>;
  importedBy: Array<{
    filePath: string;
    symbols: string[];
  }>;
  exports: Array<{
    name: string;
    type: NodeType;
    lineStart: number;
  }>;
  couplingScore: number;
  summary: string;
}

export function execute(graph: KnowledgeGraph, input: Input): FileRelationshipsResult {
  const { filePath } = input;

  // Check if file exists in graph
  const fileNode = graph.nodes[filePath];

  if (!fileNode || fileNode.type !== 'file') {
    return {
      filePath,
      exists: false,
      imports: [],
      importedBy: [],
      exports: [],
      couplingScore: 0,
      summary: `File "${filePath}" not found in the knowledge graph. Make sure to run specter scan first.`,
    };
  }

  // Find imports (edges where this file is the source)
  const importEdges = graph.edges.filter((e) => e.source === filePath && e.type === 'imports');

  const imports = importEdges.map((e) => ({
    source: e.target,
    symbols: (e.metadata?.symbols as string[]) || [],
  }));

  // Find importedBy (edges where this file is the target)
  const importedByEdges = graph.edges.filter((e) => e.target === filePath && e.type === 'imports');

  const importedBy = importedByEdges.map((e) => ({
    filePath: e.source,
    symbols: (e.metadata?.symbols as string[]) || [],
  }));

  // Find exports (symbols contained in this file that are exported)
  const containsEdges = graph.edges.filter((e) => e.source === filePath && e.type === 'contains');

  const exports = containsEdges
    .map((e) => graph.nodes[e.target])
    .filter((n) => n?.exported)
    .map((n) => ({
      name: n.name,
      type: n.type,
      lineStart: n.lineStart,
    }));

  // Calculate coupling score
  const totalConnections = imports.length + importedBy.length;
  const couplingScore = Math.min(1, totalConnections / 20);

  // Generate summary
  const summary = generateSummary(filePath, imports, importedBy, exports, couplingScore);

  return {
    filePath,
    exists: true,
    imports,
    importedBy,
    exports,
    couplingScore: Math.round(couplingScore * 100) / 100,
    summary,
  };
}

function generateSummary(
  filePath: string,
  imports: Array<{ source: string; symbols: string[] }>,
  importedBy: Array<{ filePath: string; symbols: string[] }>,
  exports: Array<{ name: string; type: NodeType; lineStart: number }>,
  couplingScore: number
): string {
  const parts: string[] = [];

  // File identity
  parts.push(`**${filePath}**`);

  // Import summary
  if (imports.length === 0) {
    parts.push('I have no dependencies on other local files.');
  } else if (imports.length === 1) {
    parts.push(`I depend on 1 other file: ${imports[0].source}`);
  } else {
    parts.push(`I depend on ${imports.length} other files.`);
    const topImports = imports
      .slice(0, 3)
      .map((i) => i.source)
      .join(', ');
    parts.push(`Key dependencies: ${topImports}`);
  }

  // ImportedBy summary
  if (importedBy.length === 0) {
    parts.push('Nobody imports me directly.');
  } else if (importedBy.length === 1) {
    parts.push(`1 file depends on me: ${importedBy[0].filePath}`);
  } else {
    parts.push(`${importedBy.length} files depend on me.`);
    if (importedBy.length > 5) {
      parts.push("I'm a widely-used module.");
    }
  }

  // Export summary
  if (exports.length > 0) {
    const exportNames = exports
      .slice(0, 5)
      .map((e) => e.name)
      .join(', ');
    parts.push(
      `I export: ${exportNames}${exports.length > 5 ? ` and ${exports.length - 5} more` : ''}`
    );
  }

  // Coupling assessment
  if (couplingScore > 0.7) {
    parts.push('⚠️ High coupling - changes here may have wide impact.');
  } else if (couplingScore > 0.4) {
    parts.push('Moderate coupling - be mindful of dependencies.');
  }

  return parts.join('\n');
}
