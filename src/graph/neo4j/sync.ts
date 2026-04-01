/**
 * Neo4j Graph Sync Operations
 *
 * Synchronize the in-memory KnowledgeGraph with Neo4j persistence.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead, executeWrite } from './client.js';
import type {
  GraphDiff,
  GraphNode,
  Relationship,
  SyncResult,
  NODE_LABELS,
  RELATIONSHIP_TYPES,
} from './types.js';
import type { KnowledgeGraph, GraphNode as SpecterNode, GraphEdge } from '../types.js';

/**
 * Sync a Specter KnowledgeGraph to Neo4j
 */
export async function syncKnowledgeGraph(
  driver: Driver,
  graph: KnowledgeGraph,
  options: { clearExisting?: boolean; upsert?: boolean } = {},
  database?: string
): Promise<SyncResult> {
  const { clearExisting = false, upsert = true } = options;
  const startTime = Date.now();
  const errors: Array<{ item: string; error: string }> = [];

  let nodesCreated = 0;
  let nodesUpdated = 0;
  let relationshipsCreated = 0;
  let relationshipsUpdated = 0;

  await executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      // Optionally clear existing data
      if (clearExisting) {
        await tx.run('MATCH (n) DETACH DELETE n');
      }

      // Create codebase node
      const codebaseName = graph.metadata.rootDir.split('/').pop() || 'codebase';
      await tx.run(
        `
        MERGE (cb:Codebase {name: $name})
        SET cb.scannedAt = $scannedAt,
            cb.fileCount = $fileCount,
            cb.totalLines = $totalLines,
            cb.nodeCount = $nodeCount,
            cb.edgeCount = $edgeCount
        `,
        {
          name: codebaseName,
          scannedAt: graph.metadata.scannedAt,
          fileCount: graph.metadata.fileCount,
          totalLines: graph.metadata.totalLines,
          nodeCount: graph.metadata.nodeCount,
          edgeCount: graph.metadata.edgeCount,
        }
      );

      // Sync nodes
      for (const [nodeId, node] of Object.entries(graph.nodes)) {
        try {
          const label = getNodeLabel(node.type);
          const clause = upsert ? 'MERGE' : 'CREATE';

          const result = await tx.run(
            `
            ${clause} (n:${label} {id: $id})
            ON CREATE SET n += $props
            ON MATCH SET n += $props
            RETURN n,
                   CASE WHEN n.created IS NULL THEN 'created' ELSE 'updated' END as action
            `,
            {
              id: nodeId,
              props: {
                id: nodeId,
                name: node.name,
                type: node.type,
                filePath: node.filePath,
                lineStart: node.lineStart,
                lineEnd: node.lineEnd,
                exported: node.exported,
                complexity: node.complexity,
                lastModified: node.lastModified,
                modificationCount: node.modificationCount,
                contributors: node.contributors,
                documentation: node.documentation,
              },
            }
          );

          const record = result.records[0];
          if (record?.get('action') === 'created') {
            nodesCreated++;
          } else {
            nodesUpdated++;
          }

          // Create BELONGS_TO relationship to codebase
          await tx.run(
            `
            MATCH (n {id: $nodeId})
            MATCH (cb:Codebase {name: $codebase})
            MERGE (n)-[:BELONGS_TO]->(cb)
            `,
            { nodeId, codebase: codebaseName }
          );
        } catch (error) {
          errors.push({
            item: `node:${nodeId}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync edges
      for (const edge of graph.edges) {
        try {
          const relType = getRelationshipType(edge.type);
          const clause = upsert ? 'MERGE' : 'CREATE';

          const result = await tx.run(
            `
            MATCH (source {id: $sourceId})
            MATCH (target {id: $targetId})
            ${clause} (source)-[r:${relType}]->(target)
            ON CREATE SET r += $props
            ON MATCH SET r += $props
            RETURN r,
                   CASE WHEN r.created IS NULL THEN 'created' ELSE 'updated' END as action
            `,
            {
              sourceId: edge.source,
              targetId: edge.target,
              props: {
                id: edge.id,
                weight: edge.weight,
                ...edge.metadata,
              },
            }
          );

          const record = result.records[0];
          if (record?.get('action') === 'created') {
            relationshipsCreated++;
          } else {
            relationshipsUpdated++;
          }
        } catch (error) {
          errors.push({
            item: `edge:${edge.id}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
    database
  );

  return {
    nodesCreated,
    nodesUpdated,
    relationshipsCreated,
    relationshipsUpdated,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Compute the diff between two graphs
 */
export function diffGraphs(
  oldGraph: { nodes: Record<string, GraphNode>; relationships: Relationship[] },
  newGraph: { nodes: Record<string, GraphNode>; relationships: Relationship[] }
): GraphDiff {
  const nodesToCreate: GraphNode[] = [];
  const nodesToUpdate: Array<{ id: string; properties: Record<string, unknown> }> = [];
  const nodesToDelete: string[] = [];
  const relationshipsToCreate: Relationship[] = [];
  const relationshipsToUpdate: Array<{ id: string; properties: Record<string, unknown> }> = [];
  const relationshipsToDelete: string[] = [];

  const oldNodeIds = new Set(Object.keys(oldGraph.nodes));
  const newNodeIds = new Set(Object.keys(newGraph.nodes));

  // Find nodes to create
  for (const id of newNodeIds) {
    if (!oldNodeIds.has(id)) {
      const node = newGraph.nodes[id];
      if (node) {
        nodesToCreate.push(node);
      }
    }
  }

  // Find nodes to delete
  for (const id of oldNodeIds) {
    if (!newNodeIds.has(id)) {
      nodesToDelete.push(id);
    }
  }

  // Find nodes to update
  for (const id of newNodeIds) {
    if (oldNodeIds.has(id)) {
      const oldNode = oldGraph.nodes[id];
      const newNode = newGraph.nodes[id];
      if (oldNode && newNode && !nodesEqual(oldNode, newNode)) {
        nodesToUpdate.push({ id, properties: newNode.properties });
      }
    }
  }

  // Build relationship maps
  const oldRelMap = new Map<string, Relationship>();
  for (const rel of oldGraph.relationships) {
    oldRelMap.set(rel.id, rel);
  }

  const newRelMap = new Map<string, Relationship>();
  for (const rel of newGraph.relationships) {
    newRelMap.set(rel.id, rel);
  }

  // Find relationships to create
  for (const [id, rel] of newRelMap) {
    if (!oldRelMap.has(id)) {
      relationshipsToCreate.push(rel);
    }
  }

  // Find relationships to delete
  for (const [id] of oldRelMap) {
    if (!newRelMap.has(id)) {
      relationshipsToDelete.push(id);
    }
  }

  // Find relationships to update
  for (const [id, newRel] of newRelMap) {
    const oldRel = oldRelMap.get(id);
    if (oldRel && !relationshipsEqual(oldRel, newRel)) {
      relationshipsToUpdate.push({ id, properties: newRel.properties });
    }
  }

  return {
    nodesToCreate,
    nodesToUpdate,
    nodesToDelete,
    relationshipsToCreate,
    relationshipsToUpdate,
    relationshipsToDelete,
  };
}

/**
 * Merge two graphs (union operation)
 */
export function mergeGraphs(
  graph1: { nodes: Record<string, GraphNode>; relationships: Relationship[] },
  graph2: { nodes: Record<string, GraphNode>; relationships: Relationship[] }
): { nodes: Record<string, GraphNode>; relationships: Relationship[] } {
  const nodes: Record<string, GraphNode> = { ...graph1.nodes };

  // Merge nodes (graph2 takes precedence)
  for (const [id, node] of Object.entries(graph2.nodes)) {
    nodes[id] = node;
  }

  // Merge relationships (dedupe by id)
  const relMap = new Map<string, Relationship>();
  for (const rel of graph1.relationships) {
    relMap.set(rel.id, rel);
  }
  for (const rel of graph2.relationships) {
    relMap.set(rel.id, rel);
  }

  return {
    nodes,
    relationships: Array.from(relMap.values()),
  };
}

/**
 * Load graph from Neo4j
 */
export async function loadGraphFromNeo4j(
  driver: Driver,
  options: { codebase?: string } = {},
  database?: string
): Promise<{ nodes: Record<string, GraphNode>; relationships: Relationship[] }> {
  const { codebase } = options;

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      let nodeQuery = 'MATCH (n) WHERE NOT n:Codebase';
      if (codebase) {
        nodeQuery = `
          MATCH (cb:Codebase {name: $codebase})
          MATCH (n)-[:BELONGS_TO]->(cb)
        `;
      }
      nodeQuery += ' RETURN n, elementId(n) as id, labels(n) as nodeLabels';

      const nodesResult = await tx.run(nodeQuery, { codebase });
      const nodes: Record<string, GraphNode> = {};

      for (const record of nodesResult.records) {
        const node = record.get('n');
        const id = record.get('id') as string;
        nodes[id] = {
          id,
          labels: record.get('nodeLabels') as string[],
          properties: node.properties as Record<string, unknown>,
        };
      }

      const nodeIds = Object.keys(nodes);

      const relsResult = await tx.run(
        `
        MATCH (a)-[r]->(b)
        WHERE elementId(a) IN $nodeIds AND elementId(b) IN $nodeIds
          AND NOT type(r) = 'BELONGS_TO'
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode, type(r) as relType
        `,
        { nodeIds }
      );

      const relationships: Relationship[] = relsResult.records.map((record) => {
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          type: record.get('relType') as string,
          startNode: record.get('startNode') as string,
          endNode: record.get('endNode') as string,
          properties: rel.properties as Record<string, unknown>,
        };
      });

      return { nodes, relationships };
    },
    database
  );
}

// Helper functions

function getNodeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    file: 'File',
    function: 'Function',
    class: 'Class',
    interface: 'Interface',
    type: 'Type',
    variable: 'Variable',
    enum: 'Enum',
  };
  return labelMap[type] || 'Node';
}

function getRelationshipType(type: string): string {
  const typeMap: Record<string, string> = {
    imports: 'IMPORTS',
    exports: 'EXPORTS',
    calls: 'CALLS',
    extends: 'EXTENDS',
    implements: 'IMPLEMENTS',
    uses: 'USES',
    contains: 'CONTAINS',
  };
  return typeMap[type] || type.toUpperCase();
}

function nodesEqual(a: GraphNode, b: GraphNode): boolean {
  if (a.id !== b.id) return false;
  if (JSON.stringify(a.labels.sort()) !== JSON.stringify(b.labels.sort())) return false;
  return JSON.stringify(a.properties) === JSON.stringify(b.properties);
}

function relationshipsEqual(a: Relationship, b: Relationship): boolean {
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;
  if (a.startNode !== b.startNode) return false;
  if (a.endNode !== b.endNode) return false;
  return JSON.stringify(a.properties) === JSON.stringify(b.properties);
}
