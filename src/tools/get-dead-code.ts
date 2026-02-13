/**
 * get_dead_code Tool
 *
 * Finds exported symbols that are not imported anywhere in the codebase.
 */

import { z } from 'zod';
import type { KnowledgeGraph, NodeType } from '../graph/types.js';

export const schema = {
  directory: z.string().optional().describe('Limit search to a specific directory'),
  limit: z.number().optional().describe('Maximum number of results'),
};

export interface Input {
  directory?: string;
  limit?: number;
}

export interface DeadCodeItem {
  name: string;
  type: NodeType;
  filePath: string;
  lineStart: number;
  exportedAs: 'named' | 'default';
}

export interface DeadCodeResult {
  items: DeadCodeItem[];
  totalCount: number;
  summary: string;
}

export function execute(graph: KnowledgeGraph, input: Input): DeadCodeResult {
  const { directory, limit = 20 } = input;

  const deadCode: DeadCodeItem[] = [];

  // Build a set of all imported symbols
  const importedSymbols = new Set<string>();
  for (const edge of graph.edges) {
    const symbols = edge.metadata?.['symbols'] as string[] | undefined;
    if (edge.type === 'imports' && symbols) {
      for (const symbol of symbols) {
        // Handle aliased imports like "foo as bar"
        const originalName = symbol.split(' as ')[0]?.trim();
        if (originalName) {
          importedSymbols.add(originalName);
        }
      }
    }
  }

  // Find exported symbols that aren't imported
  for (const node of Object.values(graph.nodes)) {
    // Skip files
    if (node.type === 'file') continue;

    // Skip non-exported
    if (!node.exported) continue;

    // Filter by directory if specified
    if (directory && !node.filePath.startsWith(directory)) continue;

    // Check if this export is used
    const isUsed =
      importedSymbols.has(node.name) || (importedSymbols.has('default') && node.name === 'default');

    if (!isUsed) {
      deadCode.push({
        name: node.name,
        type: node.type,
        filePath: node.filePath,
        lineStart: node.lineStart,
        exportedAs: node.name === 'default' ? 'default' : 'named',
      });
    }
  }

  // Sort by file path for grouping
  deadCode.sort((a, b) => a.filePath.localeCompare(b.filePath));

  const totalCount = deadCode.length;
  const items = deadCode.slice(0, limit);

  // Generate summary
  const summary = generateSummary(items, totalCount, directory);

  return {
    items,
    totalCount,
    summary,
  };
}

function generateSummary(items: DeadCodeItem[], totalCount: number, directory?: string): string {
  const parts: string[] = [];

  if (totalCount === 0) {
    if (directory) {
      parts.push(`No dead code found in \`${directory}/\`. All exports are being used!`);
    } else {
      parts.push(`No dead code found. All my exports are being imported somewhere.`);
    }
    return parts.join('\n');
  }

  // Header
  if (directory) {
    parts.push(
      `Found **${totalCount} unused export${totalCount > 1 ? 's' : ''}** in \`${directory}/\`.`
    );
  } else {
    parts.push(
      `Found **${totalCount} unused export${totalCount > 1 ? 's' : ''}** across the codebase.`
    );
  }

  // Group by file
  const byFile = new Map<string, DeadCodeItem[]>();
  for (const item of items) {
    const existing = byFile.get(item.filePath) || [];
    existing.push(item);
    byFile.set(item.filePath, existing);
  }

  parts.push('');

  // Show grouped results
  for (const [filePath, fileItems] of byFile) {
    parts.push(`**${filePath}:**`);
    for (const item of fileItems) {
      parts.push(`  - \`${item.name}\` (${item.type}, line ${item.lineStart})`);
    }
  }

  if (totalCount > items.length) {
    parts.push(`\n...and ${totalCount - items.length} more.`);
  }

  // Advice
  parts.push('');
  parts.push('💡 These exports might be:');
  parts.push('- Truly unused (safe to remove)');
  parts.push('- Used via dynamic imports or external consumers');
  parts.push('- Part of a public API');
  parts.push('');
  parts.push('Review each case before removing.');

  return parts.join('\n');
}
