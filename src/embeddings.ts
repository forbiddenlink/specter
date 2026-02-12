/**
 * Embeddings - Semantic Code Search with TF-IDF
 *
 * Provides semantic search capabilities using TF-IDF vectors.
 * Works locally without requiring any external API keys.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeGraph, NodeType } from './graph/types.js';

const SPECTER_DIR = '.specter';
const EMBEDDINGS_FILE = 'embeddings.json';

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  model: 'local' | 'openai'; // Currently only local is implemented
  dimensions: number;
}

/**
 * A chunk of code that can be searched
 */
export interface CodeChunk {
  id: string;
  filePath: string;
  type: NodeType | 'comment';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
}

/**
 * The embedding index stored on disk
 */
export interface EmbeddingIndex {
  chunks: CodeChunk[];
  vocabulary: string[];
  idf: number[];
  version: string;
  createdAt: string;
  chunkCount: number;
  vocabularySize: number;
}

/**
 * Tokenize text into words for TF-IDF
 */
function tokenize(text: string): string[] {
  // Convert camelCase and PascalCase to separate words
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

  // Split by non-alphanumeric characters and filter short tokens
  return expanded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/**
 * Calculate term frequency for a document
 */
function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by total terms
  for (const [term, count] of tf.entries()) {
    tf.set(term, count / totalTerms);
  }

  return tf;
}

/**
 * Build vocabulary and calculate IDF from all documents
 */
function buildVocabularyAndIDF(documents: string[][]): {
  vocabulary: string[];
  idf: Map<string, number>;
} {
  const docFrequency = new Map<string, number>();
  const allTerms = new Set<string>();

  // Count document frequency for each term
  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      allTerms.add(term);
      docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
    }
  }

  // Sort vocabulary for consistent ordering
  const vocabulary = Array.from(allTerms).sort();

  // Calculate IDF: log(N / df)
  const N = documents.length;
  const idf = new Map<string, number>();

  for (const term of vocabulary) {
    const df = docFrequency.get(term) || 1;
    idf.set(term, Math.log(N / df));
  }

  return { vocabulary, idf };
}

/**
 * Generate a TF-IDF embedding vector for text
 */
export function generateTFIDFVector(
  text: string,
  vocabulary: string[],
  idf: Map<string, number>
): number[] {
  const tokens = tokenize(text);
  const tf = calculateTF(tokens);

  // Create vector with TF-IDF values
  const vector = new Array<number>(vocabulary.length).fill(0);

  for (let i = 0; i < vocabulary.length; i++) {
    const term = vocabulary[i];
    const tfValue = tf.get(term) || 0;
    const idfValue = idf.get(term) || 0;
    vector[i] = tfValue * idfValue;
  }

  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dot / magnitude;
}

/**
 * Generate content string for a graph node
 */
function generateNodeContent(
  node: {
    name: string;
    type: NodeType;
    filePath: string;
    documentation?: string;
  },
  graph: KnowledgeGraph
): string {
  const parts: string[] = [];

  // Add name (important for matching)
  parts.push(node.name);

  // Add type
  parts.push(node.type);

  // Add file path components
  const pathParts = node.filePath.split('/').filter((p) => p.length > 0);
  parts.push(...pathParts);

  // Add documentation if available
  if (node.documentation) {
    parts.push(node.documentation);
  }

  // For functions, add parameter information
  if (node.type === 'function') {
    const funcNode = node as {
      parameters?: string[];
      returnType?: string;
      isAsync?: boolean;
    } & typeof node;
    if (funcNode.parameters) {
      parts.push(...funcNode.parameters);
    }
    if (funcNode.returnType) {
      parts.push(funcNode.returnType);
    }
    if (funcNode.isAsync) {
      parts.push('async');
    }
  }

  // For classes, add extends/implements
  if (node.type === 'class') {
    const classNode = node as {
      extends?: string;
      implements?: string[];
    } & typeof node;
    if (classNode.extends) {
      parts.push('extends', classNode.extends);
    }
    if (classNode.implements) {
      parts.push('implements', ...classNode.implements);
    }
  }

  // Add related node names (edges)
  const nodeId = `${node.filePath}::${node.name}`;
  const relatedEdges = graph.edges.filter((e) => e.source === nodeId || e.target === nodeId);
  for (const edge of relatedEdges.slice(0, 10)) {
    // Limit to avoid huge content
    const relatedId = edge.source === nodeId ? edge.target : edge.source;
    const relatedNode = graph.nodes[relatedId];
    if (relatedNode) {
      parts.push(relatedNode.name);
    }
  }

  return parts.join(' ');
}

/**
 * Build embedding index from knowledge graph
 */
export async function buildEmbeddingIndex(graph: KnowledgeGraph): Promise<EmbeddingIndex> {
  const chunks: CodeChunk[] = [];

  // Extract chunks from all nodes
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const content = generateNodeContent(node, graph);

    chunks.push({
      id: nodeId,
      filePath: node.filePath,
      type: node.type,
      name: node.name,
      content,
      startLine: node.lineStart,
      endLine: node.lineEnd,
    });
  }

  // Tokenize all documents
  const documents = chunks.map((chunk) => tokenize(chunk.content));

  // Build vocabulary and IDF
  const { vocabulary, idf } = buildVocabularyAndIDF(documents);

  // Convert IDF map to array for storage
  const idfArray = vocabulary.map((term) => idf.get(term) || 0);

  // Generate embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = generateTFIDFVector(chunks[i].content, vocabulary, idf);
  }

  return {
    chunks,
    vocabulary,
    idf: idfArray,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    chunkCount: chunks.length,
    vocabularySize: vocabulary.length,
  };
}

/**
 * Ensure .specter directory exists
 */
async function ensureSpecterDir(rootDir: string): Promise<string> {
  const specterDir = path.join(rootDir, SPECTER_DIR);

  try {
    await fs.access(specterDir);
  } catch {
    await fs.mkdir(specterDir, { recursive: true });
  }

  return specterDir;
}

/**
 * Save embedding index to disk
 */
export async function saveEmbeddingIndex(rootDir: string, index: EmbeddingIndex): Promise<void> {
  const specterDir = await ensureSpecterDir(rootDir);
  const embeddingsPath = path.join(specterDir, EMBEDDINGS_FILE);

  // Compress embeddings to reduce file size
  // Only store non-zero values with their indices
  const compressedIndex = {
    ...index,
    chunks: index.chunks.map((chunk) => ({
      ...chunk,
      embedding: compressEmbedding(chunk.embedding || []),
    })),
  };

  await fs.writeFile(embeddingsPath, JSON.stringify(compressedIndex, null, 2), 'utf-8');
}

/**
 * Compress embedding by storing only non-zero values
 */
function compressEmbedding(embedding: number[]): Array<[number, number]> | undefined {
  if (!embedding || embedding.length === 0) {
    return undefined;
  }

  const sparse: Array<[number, number]> = [];
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] !== 0) {
      sparse.push([i, embedding[i]]);
    }
  }

  return sparse;
}

/**
 * Decompress sparse embedding back to dense vector
 */
function decompressEmbedding(sparse: Array<[number, number]> | undefined, size: number): number[] {
  const embedding = new Array<number>(size).fill(0);

  if (!sparse) {
    return embedding;
  }

  for (const [index, value] of sparse) {
    embedding[index] = value;
  }

  return embedding;
}

/**
 * Load embedding index from disk
 */
export async function loadEmbeddingIndex(rootDir: string): Promise<EmbeddingIndex | null> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const embeddingsPath = path.join(specterDir, EMBEDDINGS_FILE);

  try {
    const content = await fs.readFile(embeddingsPath, 'utf-8');
    const compressed = JSON.parse(content);

    // Decompress embeddings
    const vocabSize = compressed.vocabulary.length;
    const index: EmbeddingIndex = {
      ...compressed,
      chunks: compressed.chunks.map(
        (chunk: { embedding: Array<[number, number]> | undefined; [key: string]: unknown }) => ({
          ...chunk,
          embedding: decompressEmbedding(chunk.embedding, vocabSize),
        })
      ),
    };

    return index;
  } catch {
    return null;
  }
}

/**
 * Check if embedding index exists
 */
export async function embeddingIndexExists(rootDir: string): Promise<boolean> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const embeddingsPath = path.join(specterDir, EMBEDDINGS_FILE);

  try {
    await fs.access(embeddingsPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if embedding index is stale (older than the graph)
 */
export async function isEmbeddingIndexStale(rootDir: string): Promise<boolean> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const embeddingsPath = path.join(specterDir, EMBEDDINGS_FILE);
  const graphPath = path.join(specterDir, 'graph.json');

  try {
    const [embeddingsStats, graphStats] = await Promise.all([
      fs.stat(embeddingsPath),
      fs.stat(graphPath),
    ]);

    // Index is stale if graph is newer
    return graphStats.mtimeMs > embeddingsStats.mtimeMs;
  } catch {
    return true;
  }
}

/**
 * Search results from semantic search
 */
export interface SemanticSearchResult {
  chunk: CodeChunk;
  similarity: number;
}

/**
 * Search the embedding index using a query
 */
export function searchEmbeddingIndex(
  query: string,
  index: EmbeddingIndex,
  limit: number = 10
): SemanticSearchResult[] {
  // Convert IDF array back to map for vector generation
  const idfMap = new Map<string, number>();
  for (let i = 0; i < index.vocabulary.length; i++) {
    idfMap.set(index.vocabulary[i], index.idf[i]);
  }

  // Generate query embedding
  const queryEmbedding = generateTFIDFVector(query, index.vocabulary, idfMap);

  // Calculate similarity with each chunk
  const results: SemanticSearchResult[] = [];

  for (const chunk of index.chunks) {
    if (!chunk.embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (similarity > 0) {
      results.push({ chunk, similarity });
    }
  }

  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity);

  // Return top results
  return results.slice(0, limit);
}

/**
 * Delete the embedding index
 */
export async function deleteEmbeddingIndex(rootDir: string): Promise<void> {
  const specterDir = path.join(rootDir, SPECTER_DIR);
  const embeddingsPath = path.join(specterDir, EMBEDDINGS_FILE);

  try {
    await fs.unlink(embeddingsPath);
  } catch {
    // File doesn't exist, that's fine
  }
}
