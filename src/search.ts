/**
 * Search - Natural Language Code Search
 *
 * Allows natural language queries to find relevant code
 * using the knowledge graph structure for intelligent matching.
 */

import type { EmbeddingIndex } from './embeddings.js';
import { searchEmbeddingIndex } from './embeddings.js';
import type { KnowledgeGraph, NodeType } from './graph/types.js';

/**
 * Search mode for the search operation
 */
export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

/**
 * Options for semantic search
 */
export interface SemanticSearchOptions {
  mode: SearchMode;
  limit: number;
}

export interface SearchResult {
  file: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum';
  name: string;
  relevance: number; // 0-100
  context: string; // Surrounding code or description
  line?: number;
  matchReason: string; // Why this matched
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalMatches: number;
  searchTime: number; // ms
  suggestions?: string[]; // Related queries
  mode?: SearchMode; // Search mode used
}

/**
 * Synonym map for common development terms
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // Authentication
  user: ['user', 'auth', 'account', 'profile', 'member'],
  auth: ['auth', 'authentication', 'login', 'session', 'token', 'jwt', 'oauth'],
  login: ['login', 'signin', 'sign-in', 'authenticate', 'auth'],
  session: ['session', 'cookie', 'token', 'auth'],

  // API
  api: ['api', 'route', 'handler', 'endpoint', 'controller', 'rest'],
  endpoint: ['endpoint', 'route', 'handler', 'api', 'controller'],
  handler: ['handler', 'controller', 'route', 'endpoint', 'action'],
  route: ['route', 'router', 'path', 'endpoint', 'api'],

  // Database
  database: ['db', 'database', 'model', 'schema', 'entity', 'repository', 'store'],
  model: ['model', 'schema', 'entity', 'type', 'interface', 'dto'],
  schema: ['schema', 'model', 'entity', 'definition', 'type'],
  entity: ['entity', 'model', 'record', 'row', 'document'],

  // Data
  data: ['data', 'store', 'state', 'cache', 'storage'],
  store: ['store', 'state', 'storage', 'cache', 'repository'],
  cache: ['cache', 'memo', 'store', 'buffer'],

  // Components
  component: ['component', 'widget', 'element', 'ui', 'view'],
  ui: ['ui', 'component', 'view', 'interface', 'display'],
  view: ['view', 'page', 'screen', 'template', 'component'],
  page: ['page', 'view', 'screen', 'route'],

  // Testing
  test: ['test', 'spec', 'mock', 'fixture', 'assert'],
  mock: ['mock', 'stub', 'fake', 'spy', 'test'],

  // Utilities
  util: ['util', 'utils', 'helper', 'helpers', 'common', 'shared'],
  helper: ['helper', 'helpers', 'util', 'utils', 'tool'],

  // Config
  config: ['config', 'configuration', 'settings', 'options', 'env'],
  settings: ['settings', 'config', 'preferences', 'options'],

  // Types
  type: ['type', 'types', 'interface', 'interfaces', 'definition'],
  interface: ['interface', 'interfaces', 'type', 'types', 'contract'],

  // Error handling
  error: ['error', 'exception', 'throw', 'catch', 'handle'],
  exception: ['exception', 'error', 'throw', 'catch'],

  // Hooks/Events
  hook: ['hook', 'hooks', 'event', 'listener', 'callback'],
  event: ['event', 'listener', 'handler', 'emit', 'subscribe'],

  // Services
  service: ['service', 'provider', 'manager', 'controller'],
  provider: ['provider', 'service', 'factory', 'builder'],

  // State
  state: ['state', 'store', 'redux', 'context', 'atom'],

  // Graph/Analysis
  graph: ['graph', 'node', 'edge', 'tree', 'network'],
  analysis: ['analysis', 'analyzer', 'parse', 'inspect', 'examine'],
};

/**
 * Parse a natural language query into searchable keywords
 */
function parseQuery(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim();

  // Split by common separators
  const words = normalizedQuery.split(/[\s,._\-/]+/).filter((w) => w.length > 1);

  // Expand with synonyms
  const expanded = new Set<string>();

  for (const word of words) {
    expanded.add(word);

    // Check if word is a key or value in synonym map
    if (SYNONYM_MAP[word]) {
      for (const synonym of SYNONYM_MAP[word]) {
        expanded.add(synonym);
      }
    }

    // Check if word matches any synonym values
    for (const [, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (synonyms.includes(word)) {
        for (const synonym of synonyms) {
          expanded.add(synonym);
        }
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Calculate relevance score for a match
 */
function calculateRelevance(
  name: string,
  filePath: string,
  keywords: string[],
  _nodeType: NodeType,
  graph: KnowledgeGraph,
  nodeId: string
): { score: number; reason: string } {
  const nameLower = name.toLowerCase();
  const pathLower = filePath.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  for (const keyword of keywords) {
    // Exact name match = 100
    if (nameLower === keyword) {
      score = Math.max(score, 100);
      reasons.push(`Exact name match: "${keyword}"`);
    }
    // Name starts with keyword = 85
    else if (nameLower.startsWith(keyword)) {
      score = Math.max(score, 85);
      reasons.push(`Name starts with: "${keyword}"`);
    }
    // Name ends with keyword = 80
    else if (nameLower.endsWith(keyword)) {
      score = Math.max(score, 80);
      reasons.push(`Name ends with: "${keyword}"`);
    }
    // Partial name match = 70
    else if (nameLower.includes(keyword)) {
      score = Math.max(score, 70);
      reasons.push(`Name contains: "${keyword}"`);
    }
    // File path contains keyword = 50
    else if (pathLower.includes(keyword)) {
      score = Math.max(score, 50);
      reasons.push(`Path contains: "${keyword}"`);
    }
  }

  // Only apply bonuses if there was a text match
  if (score > 0) {
    // Bonus for exported symbols
    const node = graph.nodes[nodeId];
    if (node?.exported) {
      score = Math.min(100, score + 5);
      reasons.push('Exported symbol');
    }

    // Bonus for high connectivity (imported by others)
    const importedBy = graph.edges.filter(
      (e) => e.type === 'imports' && e.target === nodeId
    ).length;
    if (importedBy > 3) {
      score = Math.min(100, score + 10);
      reasons.push(`Used by ${importedBy} files`);
    } else if (importedBy > 0) {
      score = Math.min(100, score + 5);
    }
  }

  // Pick the most relevant reason
  const mainReason = reasons[0] || 'Related match';

  return { score, reason: mainReason };
}

/**
 * Generate context for a search result
 */
function generateContext(
  node: {
    name: string;
    type: NodeType;
    filePath: string;
    lineStart: number;
    lineEnd: number;
    documentation?: string;
  },
  _graph: KnowledgeGraph
): string {
  // Use documentation if available
  if (node.documentation) {
    return node.documentation.slice(0, 100) + (node.documentation.length > 100 ? '...' : '');
  }

  // Generate context based on type
  switch (node.type) {
    case 'function': {
      const funcNode = node as {
        parameters?: string[];
        returnType?: string;
        isAsync?: boolean;
      } & typeof node;
      const params = funcNode.parameters?.join(', ') || '';
      const returnType = funcNode.returnType ? `: ${funcNode.returnType}` : '';
      const asyncPrefix = funcNode.isAsync ? 'async ' : '';
      return `${asyncPrefix}${node.name}(${params})${returnType}`;
    }
    case 'class': {
      const classNode = node as { extends?: string; memberCount?: number } & typeof node;
      const ext = classNode.extends ? ` extends ${classNode.extends}` : '';
      const members = classNode.memberCount ? ` (${classNode.memberCount} members)` : '';
      return `class ${node.name}${ext}${members}`;
    }
    case 'interface':
    case 'type':
      return `${node.type} ${node.name} definition`;
    case 'enum':
      return `enum ${node.name}`;
    case 'variable':
      return `variable ${node.name}`;
    case 'file': {
      const fileNode = node as { lineCount?: number; language?: string } & typeof node;
      const lines = fileNode.lineCount ? `${fileNode.lineCount} lines` : '';
      const lang = fileNode.language ? ` (${fileNode.language})` : '';
      return `File: ${lines}${lang}`;
    }
    default:
      return `${node.type}: ${node.name}`;
  }
}

/**
 * Search the codebase using natural language query
 */
export function searchCodebase(query: string, graph: KnowledgeGraph): SearchResponse {
  const startTime = Date.now();

  // Parse query into keywords
  const keywords = parseQuery(query);

  const results: SearchResult[] = [];
  const seenIds = new Set<string>();

  // Search through all nodes
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const { score, reason } = calculateRelevance(
      node.name,
      node.filePath,
      keywords,
      node.type,
      graph,
      nodeId
    );

    if (score > 0 && !seenIds.has(nodeId)) {
      seenIds.add(nodeId);

      results.push({
        file: node.filePath,
        type: node.type,
        name: node.name,
        relevance: score,
        context: generateContext(node, graph),
        line: node.lineStart,
        matchReason: reason,
      });
    }
  }

  // Sort by relevance (highest first)
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    // Secondary sort by name
    return a.name.localeCompare(b.name);
  });

  // Generate query suggestions
  const suggestions = generateSuggestions(query, keywords, results);

  const searchTime = Date.now() - startTime;

  return {
    query,
    results,
    totalMatches: results.length,
    searchTime,
    suggestions,
  };
}

/**
 * Generate suggestions for refining the query
 */
function generateSuggestions(
  originalQuery: string,
  _keywords: string[],
  results: SearchResult[]
): string[] {
  const suggestions: string[] = [];

  if (results.length === 0) {
    // No results - suggest alternatives
    suggestions.push('Try broader terms like "util", "handler", or "service"');
    suggestions.push('Search for specific file types with "component", "model", or "test"');
  } else if (results.length > 50) {
    // Too many results - suggest narrowing
    suggestions.push('Add more specific terms to narrow results');

    // Suggest filtering by type
    const types = new Set(results.map((r) => r.type));
    if (types.size > 1) {
      const typeList = Array.from(types).slice(0, 3).join(', ');
      suggestions.push(`Filter by type: ${typeList}`);
    }
  } else if (results.length > 0) {
    // Good results - suggest related searches
    const topResult = results[0];

    // Suggest exploring the file
    if (topResult.type !== 'file') {
      const fileName = topResult.file.split('/').pop();
      suggestions.push(`Explore file: "${fileName}"`);
    }

    // Suggest type-specific searches
    if (!originalQuery.toLowerCase().includes(topResult.type)) {
      suggestions.push(`Search "${originalQuery} ${topResult.type}"`);
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Format search results for display
 */
export function formatSearch(response: SearchResponse, limit = 10): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  🔍 CODE SEARCH                                   ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');
  lines.push(`Query: "${response.query}"`);
  lines.push(`Found: ${response.totalMatches} matches in ${response.searchTime}ms`);
  lines.push('');

  if (response.results.length === 0) {
    lines.push('No matches found.');
    lines.push('');
    if (response.suggestions && response.suggestions.length > 0) {
      lines.push('SUGGESTIONS');
      lines.push('─'.repeat(50));
      for (const suggestion of response.suggestions) {
        lines.push(`  💡 ${suggestion}`);
      }
    }
    return lines.join('\n');
  }

  // Group results by relevance tiers
  const topResults = response.results.filter((r) => r.relevance >= 80);
  const goodResults = response.results.filter((r) => r.relevance >= 50 && r.relevance < 80);
  const otherResults = response.results.filter((r) => r.relevance < 50);

  let shown = 0;

  if (topResults.length > 0) {
    lines.push('TOP MATCHES');
    lines.push('─'.repeat(50));
    for (const result of topResults.slice(0, Math.min(5, limit - shown))) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  if (goodResults.length > 0 && shown < limit) {
    lines.push('GOOD MATCHES');
    lines.push('─'.repeat(50));
    for (const result of goodResults.slice(0, limit - shown)) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  if (otherResults.length > 0 && shown < limit) {
    lines.push('OTHER MATCHES');
    lines.push('─'.repeat(50));
    for (const result of otherResults.slice(0, limit - shown)) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  // Show count of remaining
  const remaining = response.totalMatches - shown;
  if (remaining > 0) {
    lines.push(`... and ${remaining} more matches`);
    lines.push('');
  }

  // Suggestions
  if (response.suggestions && response.suggestions.length > 0) {
    lines.push('SUGGESTIONS');
    lines.push('─'.repeat(50));
    for (const suggestion of response.suggestions) {
      lines.push(`  💡 ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(51));

  return lines.join('\n');
}

/**
 * Format a single search result
 */
function formatResult(result: SearchResult): string {
  const relevanceBar = createRelevanceBar(result.relevance);
  const typeIcon = getTypeIcon(result.type);
  const lines: string[] = [];

  // First line: icon, name, type, relevance
  const line1 = `${typeIcon} ${result.name} (${result.type})`;
  lines.push(`${line1}  ${relevanceBar} ${result.relevance}%`);

  // Second line: file path with line number
  const location = result.line ? `${result.file}:${result.line}` : result.file;
  lines.push(`   📍 ${location}`);

  // Third line: context
  if (result.context) {
    lines.push(`   📝 ${result.context}`);
  }

  // Fourth line: match reason
  lines.push(`   ✓ ${result.matchReason}`);

  return lines.join('\n');
}

/**
 * Create a visual relevance bar
 */
function createRelevanceBar(relevance: number): string {
  const barWidth = 10;
  const filled = Math.round((relevance / 100) * barWidth);
  const empty = barWidth - filled;

  // Use different characters based on relevance level
  const fillChar = relevance >= 80 ? '█' : relevance >= 50 ? '▓' : '░';

  return `[${fillChar.repeat(filled)}${'·'.repeat(empty)}]`;
}

/**
 * Get icon for node type
 */
function getTypeIcon(type: SearchResult['type']): string {
  switch (type) {
    case 'file':
      return '📁';
    case 'function':
      return '🔣';
    case 'class':
      return '📦';
    case 'interface':
      return '📋';
    case 'type':
      return '📝';
    case 'enum':
      return '🔢';
    case 'variable':
      return '📌';
    default:
      return '•';
  }
}

/**
 * Perform semantic search using the embedding index
 */
export function semanticSearch(
  query: string,
  graph: KnowledgeGraph,
  index: EmbeddingIndex,
  options: SemanticSearchOptions = { mode: 'hybrid', limit: 20 }
): SearchResponse {
  const startTime = Date.now();
  const { mode, limit } = options;

  let results: SearchResult[] = [];

  if (mode === 'keyword') {
    // Pure keyword search (existing behavior)
    const response = searchCodebase(query, graph);
    return { ...response, mode: 'keyword' };
  }

  if (mode === 'semantic') {
    // Pure semantic search using embeddings
    const semanticResults = searchEmbeddingIndex(query, index, limit * 2);

    for (const sr of semanticResults) {
      const node = graph.nodes[sr.chunk.id];
      if (!node) continue;

      // Convert similarity (0-1) to relevance (0-100)
      const relevance = Math.round(sr.similarity * 100);

      results.push({
        file: sr.chunk.filePath,
        type: sr.chunk.type as SearchResult['type'],
        name: sr.chunk.name,
        relevance,
        context: generateContext(node, graph),
        line: sr.chunk.startLine,
        matchReason: `Semantic similarity: ${relevance}%`,
      });
    }
  } else {
    // Hybrid search - combine keyword and semantic results
    const keywordResponse = searchCodebase(query, graph);
    const semanticResults = searchEmbeddingIndex(query, index, limit * 2);

    // Create a map for merging results
    const resultMap = new Map<string, SearchResult>();

    // Add keyword results
    for (const kr of keywordResponse.results) {
      const key = `${kr.file}::${kr.name}`;
      resultMap.set(key, kr);
    }

    // Merge semantic results
    for (const sr of semanticResults) {
      const key = sr.chunk.id;
      const semanticRelevance = Math.round(sr.similarity * 100);

      if (resultMap.has(key)) {
        // Boost score if found by both methods
        const existing = resultMap.get(key)!;
        const boostedScore = Math.min(100, Math.max(existing.relevance, semanticRelevance) + 10);
        existing.relevance = boostedScore;
        existing.matchReason += ` + Semantic match`;
      } else {
        // Add new semantic result
        const node = graph.nodes[sr.chunk.id];
        if (!node) continue;

        resultMap.set(key, {
          file: sr.chunk.filePath,
          type: sr.chunk.type as SearchResult['type'],
          name: sr.chunk.name,
          relevance: semanticRelevance,
          context: generateContext(node, graph),
          line: sr.chunk.startLine,
          matchReason: `Semantic similarity: ${semanticRelevance}%`,
        });
      }
    }

    results = Array.from(resultMap.values());
  }

  // Sort by relevance
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) {
      return b.relevance - a.relevance;
    }
    return a.name.localeCompare(b.name);
  });

  // Apply limit
  results = results.slice(0, limit);

  const searchTime = Date.now() - startTime;

  // Generate suggestions
  const keywords = parseQuery(query);
  const suggestions = generateSuggestions(query, keywords, results);

  return {
    query,
    results,
    totalMatches: results.length,
    searchTime,
    suggestions,
    mode,
  };
}

/**
 * Format search results with mode indicator
 */
export function formatSearchWithMode(response: SearchResponse, limit = 10): string {
  const lines: string[] = [];

  // Header with mode indicator
  const modeLabel =
    response.mode === 'semantic'
      ? '🧠 SEMANTIC'
      : response.mode === 'hybrid'
        ? '🔀 HYBRID'
        : '🔤 KEYWORD';

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push(`${`┃  🔍 CODE SEARCH (${modeLabel})`.padEnd(52)}┃`);
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');
  lines.push(`Query: "${response.query}"`);
  lines.push(`Found: ${response.totalMatches} matches in ${response.searchTime}ms`);
  lines.push('');

  if (response.results.length === 0) {
    lines.push('No matches found.');
    lines.push('');
    if (response.suggestions && response.suggestions.length > 0) {
      lines.push('SUGGESTIONS');
      lines.push('─'.repeat(50));
      for (const suggestion of response.suggestions) {
        lines.push(`  💡 ${suggestion}`);
      }
    }
    return lines.join('\n');
  }

  // Group results by relevance tiers
  const topResults = response.results.filter((r) => r.relevance >= 80);
  const goodResults = response.results.filter((r) => r.relevance >= 50 && r.relevance < 80);
  const otherResults = response.results.filter((r) => r.relevance < 50);

  let shown = 0;

  if (topResults.length > 0) {
    lines.push('TOP MATCHES');
    lines.push('─'.repeat(50));
    for (const result of topResults.slice(0, Math.min(5, limit - shown))) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  if (goodResults.length > 0 && shown < limit) {
    lines.push('GOOD MATCHES');
    lines.push('─'.repeat(50));
    for (const result of goodResults.slice(0, limit - shown)) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  if (otherResults.length > 0 && shown < limit) {
    lines.push('OTHER MATCHES');
    lines.push('─'.repeat(50));
    for (const result of otherResults.slice(0, limit - shown)) {
      shown++;
      lines.push(formatResult(result));
      lines.push('');
    }
  }

  // Show count of remaining
  const remaining = response.totalMatches - shown;
  if (remaining > 0) {
    lines.push(`... and ${remaining} more matches`);
    lines.push('');
  }

  // Suggestions
  if (response.suggestions && response.suggestions.length > 0) {
    lines.push('SUGGESTIONS');
    lines.push('─'.repeat(50));
    for (const suggestion of response.suggestions) {
      lines.push(`  💡 ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(51));

  return lines.join('\n');
}
