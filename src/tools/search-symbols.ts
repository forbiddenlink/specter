/**
 * search_symbols Tool
 *
 * Search for functions, classes, interfaces, and other symbols by name.
 */

import { z } from 'zod';
import type { KnowledgeGraph, GraphNode, NodeType } from '../graph/types.js';

export const schema = {
  query: z.string().describe('Search query (supports partial matches)'),
  type: z.enum(['function', 'class', 'interface', 'type', 'variable', 'enum', 'all']).optional().describe('Filter by symbol type'),
  limit: z.number().optional().describe('Maximum number of results'),
  exportedOnly: z.boolean().optional().describe('Only show exported symbols'),
};

export interface Input {
  query: string;
  type?: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum' | 'all';
  limit?: number;
  exportedOnly?: boolean;
}

export interface SearchResult {
  name: string;
  type: NodeType;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  complexity?: number;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy';
}

export interface SearchSymbolsResult {
  results: SearchResult[];
  totalMatches: number;
  summary: string;
}

export function execute(graph: KnowledgeGraph, input: Input): SearchSymbolsResult {
  const { query, type = 'all', limit = 20, exportedOnly = false } = input;

  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const node of Object.values(graph.nodes)) {
    // Skip files
    if (node.type === 'file') continue;

    // Filter by type
    if (type !== 'all' && node.type !== type) continue;

    // Filter exported only
    if (exportedOnly && !node.exported) continue;

    // Match against name
    const nameLower = node.name.toLowerCase();
    let matchType: SearchResult['matchType'] | null = null;

    if (nameLower === queryLower) {
      matchType = 'exact';
    } else if (nameLower.startsWith(queryLower)) {
      matchType = 'prefix';
    } else if (nameLower.includes(queryLower)) {
      matchType = 'contains';
    } else if (fuzzyMatch(queryLower, nameLower)) {
      matchType = 'fuzzy';
    }

    if (matchType) {
      results.push({
        name: node.name,
        type: node.type,
        filePath: node.filePath,
        lineStart: node.lineStart,
        lineEnd: node.lineEnd,
        exported: node.exported,
        complexity: node.complexity,
        matchType,
      });
    }
  }

  // Sort by match quality, then by name
  const matchOrder = { exact: 0, prefix: 1, contains: 2, fuzzy: 3 };
  results.sort((a, b) => {
    const orderDiff = matchOrder[a.matchType] - matchOrder[b.matchType];
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  const totalMatches = results.length;
  const limitedResults = results.slice(0, limit);

  // Generate summary
  const summary = generateSummary(query, type, limitedResults, totalMatches);

  return {
    results: limitedResults,
    totalMatches,
    summary,
  };
}

/**
 * Simple fuzzy matching - checks if all characters of query appear in order
 */
function fuzzyMatch(query: string, target: string): boolean {
  let queryIndex = 0;

  for (const char of target) {
    if (char === query[queryIndex]) {
      queryIndex++;
      if (queryIndex === query.length) return true;
    }
  }

  return false;
}

function generateSummary(
  query: string,
  type: string,
  results: SearchResult[],
  totalMatches: number
): string {
  const parts: string[] = [];

  if (totalMatches === 0) {
    parts.push(`No ${type === 'all' ? 'symbols' : type + 's'} found matching "${query}".`);
    parts.push('');
    parts.push('Try:');
    parts.push('- A shorter or different search term');
    parts.push('- Searching without type filter');
    return parts.join('\n');
  }

  // Header
  const typeLabel = type === 'all' ? 'symbol' : type;
  parts.push(`Found **${totalMatches} ${typeLabel}${totalMatches > 1 ? 's' : ''}** matching "${query}".`);

  // Exact matches first
  const exactMatches = results.filter(r => r.matchType === 'exact');
  if (exactMatches.length > 0) {
    parts.push('\n**Exact matches:**');
    for (const r of exactMatches) {
      const exportBadge = r.exported ? '📤' : '';
      parts.push(`- ${exportBadge} \`${r.name}\` (${r.type}) — ${r.filePath}:${r.lineStart}`);
    }
  }

  // Other matches
  const otherMatches = results.filter(r => r.matchType !== 'exact');
  if (otherMatches.length > 0) {
    parts.push('\n**Other matches:**');
    for (const r of otherMatches.slice(0, 10)) {
      const exportBadge = r.exported ? '📤' : '';
      parts.push(`- ${exportBadge} \`${r.name}\` (${r.type}) — ${r.filePath}:${r.lineStart}`);
    }
  }

  if (totalMatches > results.length) {
    parts.push(`\n...and ${totalMatches - results.length} more matches.`);
  }

  return parts.join('\n');
}
