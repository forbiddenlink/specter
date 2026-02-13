/**
 * Zod schemas for Knowledge Graph validation
 */

import { z } from 'zod';

export const NodeTypeSchema = z.enum([
  'file',
  'function',
  'class',
  'interface',
  'type',
  'variable',
  'enum',
]);

export const EdgeTypeSchema = z.enum([
  'imports',
  'exports',
  'calls',
  'extends',
  'implements',
  'uses',
  'contains',
]);

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  name: z.string(),
  filePath: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  exported: z.boolean(),
  complexity: z.number().optional(),
  lastModified: z.string().optional(),
  modificationCount: z.number().optional(),
  contributors: z.array(z.string()).optional(),
  documentation: z.string().optional(),
});

export const GraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: EdgeTypeSchema,
  weight: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const GraphMetadataSchema = z.object({
  scannedAt: z.string(),
  scanDurationMs: z.number(),
  rootDir: z.string(),
  fileCount: z.number(),
  totalLines: z.number(),
  languages: z.record(z.string(), z.number()),
  nodeCount: z.number(),
  edgeCount: z.number(),
});

export const KnowledgeGraphSchema = z.object({
  version: z.string(),
  metadata: GraphMetadataSchema,
  nodes: z.record(z.string(), GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type ValidatedKnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;
