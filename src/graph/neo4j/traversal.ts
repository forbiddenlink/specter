/**
 * Neo4j Graph Traversal Operations
 *
 * Path finding, pattern matching, and graph traversal algorithms.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead } from './client.js';
import type { GraphNode, GraphPath, TraversalOptions, TraversalResult } from './types.js';

/**
 * Find the shortest path between two nodes
 */
export async function findShortestPath(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: TraversalOptions = {},
  database?: string
): Promise<GraphPath | null> {
  const { maxDepth = 10, relationshipTypes, direction = 'both' } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  let dirPattern: string;
  switch (direction) {
    case 'out':
      dirPattern = `-[r${relPattern}*1..${maxDepth}]->`;
      break;
    case 'in':
      dirPattern = `<-[r${relPattern}*1..${maxDepth}]-`;
      break;
    default:
      dirPattern = `-[r${relPattern}*1..${maxDepth}]-`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH (end) WHERE elementId(end) = $endId
        MATCH p = shortestPath((start)${dirPattern}(end))
        RETURN p, nodes(p) as pathNodes, relationships(p) as pathRels
        `,
        { startId: startNodeId, endId: endNodeId }
      );

      const record = result.records[0];
      if (!record) {
        return null;
      }

      const pathNodes = record.get('pathNodes') as Array<{
        labels: string[];
        properties: Record<string, unknown>;
      }>;
      const pathRels = record.get('pathRels') as Array<{
        type: string;
        properties: Record<string, unknown>;
      }>;

      return {
        nodes: pathNodes.map((n, i) => ({
          id: `node-${i}`, // Neo4j doesn't expose element IDs in path nodes easily
          labels: n.labels,
          properties: n.properties,
        })),
        relationships: pathRels.map((r, i) => ({
          type: r.type,
          startNodeId: `node-${i}`,
          endNodeId: `node-${i + 1}`,
          properties: r.properties,
        })),
      };
    },
    database
  );
}

/**
 * Find all paths between two nodes
 */
export async function findAllPaths(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: TraversalOptions = {},
  database?: string
): Promise<TraversalResult> {
  const { maxDepth = 5, relationshipTypes, direction = 'both', limit = 100 } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  let dirPattern: string;
  switch (direction) {
    case 'out':
      dirPattern = `-[r${relPattern}*1..${maxDepth}]->`;
      break;
    case 'in':
      dirPattern = `<-[r${relPattern}*1..${maxDepth}]-`;
      break;
    default:
      dirPattern = `-[r${relPattern}*1..${maxDepth}]-`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH (end) WHERE elementId(end) = $endId
        MATCH p = (start)${dirPattern}(end)
        RETURN p, nodes(p) as pathNodes, relationships(p) as pathRels, length(p) as pathLength
        LIMIT ${limit}
        `,
        { startId: startNodeId, endId: endNodeId }
      );

      const paths: GraphPath[] = result.records.map((record) => {
        const pathNodes = record.get('pathNodes') as Array<{
          labels: string[];
          properties: Record<string, unknown>;
        }>;
        const pathRels = record.get('pathRels') as Array<{
          type: string;
          properties: Record<string, unknown>;
        }>;

        return {
          nodes: pathNodes.map((n, i) => ({
            id: `node-${i}`,
            labels: n.labels,
            properties: n.properties,
          })),
          relationships: pathRels.map((r, i) => ({
            type: r.type,
            startNodeId: `node-${i}`,
            endNodeId: `node-${i + 1}`,
            properties: r.properties,
          })),
        };
      });

      const maxPathDepth = paths.reduce((max, path) => {
        return Math.max(max, path.relationships.length);
      }, 0);

      return {
        paths,
        totalPaths: paths.length,
        depth: maxPathDepth,
      };
    },
    database
  );
}

/**
 * Find all nodes connected to a starting node
 */
export async function findConnectedNodes(
  driver: Driver,
  startNodeId: string,
  options: TraversalOptions = {},
  database?: string
): Promise<GraphNode[]> {
  const { maxDepth = 3, relationshipTypes, direction = 'both', nodeLabels, limit = 1000 } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  const labelPattern = nodeLabels?.length
    ? nodeLabels.map((l) => `:${l}`).join('')
    : '';

  let dirPattern: string;
  switch (direction) {
    case 'out':
      dirPattern = `-[${relPattern}*1..${maxDepth}]->`;
      break;
    case 'in':
      dirPattern = `<-[${relPattern}*1..${maxDepth}]-`;
      break;
    default:
      dirPattern = `-[${relPattern}*1..${maxDepth}]-`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH (start)${dirPattern}(connected${labelPattern})
        WHERE connected <> start
        RETURN DISTINCT connected, elementId(connected) as id
        LIMIT ${limit}
        `,
        { startId: startNodeId }
      );

      return result.records.map((record) => {
        const node = record.get('connected');
        return {
          id: record.get('id') as string,
          labels: node.labels as string[],
          properties: node.properties as Record<string, unknown>,
        };
      });
    },
    database
  );
}

/**
 * Find dependency chain from a node (follows IMPORTS/CALLS relationships)
 */
export async function findDependencyChain(
  driver: Driver,
  startNodeId: string,
  options: { maxDepth?: number; direction?: 'dependencies' | 'dependents' } = {},
  database?: string
): Promise<GraphPath[]> {
  const { maxDepth = 5, direction = 'dependencies' } = options;

  const relTypes = 'IMPORTS|CALLS|USES';
  const dirPattern = direction === 'dependencies'
    ? `-[:${relTypes}*1..${maxDepth}]->`
    : `<-[:${relTypes}*1..${maxDepth}]-`;

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH p = (start)${dirPattern}(end)
        RETURN p, nodes(p) as pathNodes, relationships(p) as pathRels
        LIMIT 100
        `,
        { startId: startNodeId }
      );

      return result.records.map((record) => {
        const pathNodes = record.get('pathNodes') as Array<{
          labels: string[];
          properties: Record<string, unknown>;
        }>;
        const pathRels = record.get('pathRels') as Array<{
          type: string;
          properties: Record<string, unknown>;
        }>;

        return {
          nodes: pathNodes.map((n, i) => ({
            id: `node-${i}`,
            labels: n.labels,
            properties: n.properties,
          })),
          relationships: pathRels.map((r, i) => ({
            type: r.type,
            startNodeId: `node-${i}`,
            endNodeId: `node-${i + 1}`,
            properties: r.properties,
          })),
        };
      });
    },
    database
  );
}

/**
 * Find all nodes that would be impacted by changes to a given node
 */
export async function findImpactedNodes(
  driver: Driver,
  startNodeId: string,
  options: { maxDepth?: number } = {},
  database?: string
): Promise<{ directDependents: GraphNode[]; indirectDependents: GraphNode[]; totalCount: number }> {
  const { maxDepth = 5 } = options;

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      // Direct dependents (one hop away)
      const directResult = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH (dependent)-[:IMPORTS|CALLS|USES]->(start)
        RETURN DISTINCT dependent, elementId(dependent) as id
        `,
        { startId: startNodeId }
      );

      const directDependents: GraphNode[] = directResult.records.map((record) => {
        const node = record.get('dependent');
        return {
          id: record.get('id') as string,
          labels: node.labels as string[],
          properties: node.properties as Record<string, unknown>,
        };
      });

      // Indirect dependents (2+ hops away)
      const indirectResult = await tx.run(
        `
        MATCH (start) WHERE elementId(start) = $startId
        MATCH (dependent)-[:IMPORTS|CALLS|USES*2..${maxDepth}]->(start)
        WHERE NOT (dependent)-[:IMPORTS|CALLS|USES]->(start)
        RETURN DISTINCT dependent, elementId(dependent) as id
        `,
        { startId: startNodeId }
      );

      const indirectDependents: GraphNode[] = indirectResult.records.map((record) => {
        const node = record.get('dependent');
        return {
          id: record.get('id') as string,
          labels: node.labels as string[],
          properties: node.properties as Record<string, unknown>,
        };
      });

      return {
        directDependents,
        indirectDependents,
        totalCount: directDependents.length + indirectDependents.length,
      };
    },
    database
  );
}

/**
 * Find cycles in the graph
 */
export async function findCycles(
  driver: Driver,
  options: { relationshipTypes?: string[]; minLength?: number; maxLength?: number; limit?: number } = {},
  database?: string
): Promise<GraphPath[]> {
  const { relationshipTypes, minLength = 2, maxLength = 5, limit = 50 } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH p = (n)-[${relPattern}*${minLength}..${maxLength}]->(n)
        RETURN p, nodes(p) as pathNodes, relationships(p) as pathRels
        LIMIT ${limit}
        `,
        {}
      );

      return result.records.map((record) => {
        const pathNodes = record.get('pathNodes') as Array<{
          labels: string[];
          properties: Record<string, unknown>;
        }>;
        const pathRels = record.get('pathRels') as Array<{
          type: string;
          properties: Record<string, unknown>;
        }>;

        return {
          nodes: pathNodes.map((n, i) => ({
            id: `node-${i}`,
            labels: n.labels,
            properties: n.properties,
          })),
          relationships: pathRels.map((r, i) => ({
            type: r.type,
            startNodeId: `node-${i}`,
            endNodeId: `node-${(i + 1) % pathNodes.length}`,
            properties: r.properties,
          })),
        };
      });
    },
    database
  );
}

/**
 * Get a subgraph centered on a node
 */
export async function getSubgraph(
  driver: Driver,
  centerNodeId: string,
  options: TraversalOptions = {},
  database?: string
): Promise<{ nodes: GraphNode[]; relationships: Array<{ id: string; type: string; startNode: string; endNode: string; properties: Record<string, unknown> }> }> {
  const { maxDepth = 2, relationshipTypes, direction = 'both' } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  let dirPattern: string;
  switch (direction) {
    case 'out':
      dirPattern = `-[r${relPattern}*0..${maxDepth}]->`;
      break;
    case 'in':
      dirPattern = `<-[r${relPattern}*0..${maxDepth}]-`;
      break;
    default:
      dirPattern = `-[r${relPattern}*0..${maxDepth}]-`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      // Get all nodes in the subgraph
      const nodesResult = await tx.run(
        `
        MATCH (center) WHERE elementId(center) = $centerId
        MATCH (center)${dirPattern}(n)
        RETURN DISTINCT n, elementId(n) as id
        `,
        { centerId: centerNodeId }
      );

      const nodes: GraphNode[] = nodesResult.records.map((record) => {
        const node = record.get('n');
        return {
          id: record.get('id') as string,
          labels: node.labels as string[],
          properties: node.properties as Record<string, unknown>,
        };
      });

      const nodeIds = nodes.map((n) => n.id);

      // Get all relationships between nodes in the subgraph
      const relsResult = await tx.run(
        `
        MATCH (a)-[r]->(b)
        WHERE elementId(a) IN $nodeIds AND elementId(b) IN $nodeIds
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { nodeIds }
      );

      const relationships = relsResult.records.map((record) => {
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          type: rel.type as string,
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

/**
 * Find common ancestors of two nodes
 */
export async function findCommonAncestors(
  driver: Driver,
  nodeId1: string,
  nodeId2: string,
  options: { maxDepth?: number; relationshipTypes?: string[] } = {},
  database?: string
): Promise<GraphNode[]> {
  const { maxDepth = 5, relationshipTypes } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (n1) WHERE elementId(n1) = $id1
        MATCH (n2) WHERE elementId(n2) = $id2
        MATCH (n1)-[${relPattern}*1..${maxDepth}]->(ancestor)<-[${relPattern}*1..${maxDepth}]-(n2)
        RETURN DISTINCT ancestor, elementId(ancestor) as id
        `,
        { id1: nodeId1, id2: nodeId2 }
      );

      return result.records.map((record) => {
        const node = record.get('ancestor');
        return {
          id: record.get('id') as string,
          labels: node.labels as string[],
          properties: node.properties as Record<string, unknown>,
        };
      });
    },
    database
  );
}

/**
 * Get the immediate neighborhood of a node
 */
export async function getNeighborhood(
  driver: Driver,
  nodeId: string,
  options: { relationshipTypes?: string[]; direction?: 'in' | 'out' | 'both' } = {},
  database?: string
): Promise<{
  node: GraphNode;
  neighbors: Array<{ node: GraphNode; relationship: { type: string; direction: 'in' | 'out'; properties: Record<string, unknown> } }>;
}> {
  const { relationshipTypes, direction = 'both' } = options;

  const relPattern = relationshipTypes?.length
    ? `:${relationshipTypes.join('|')}`
    : '';

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      // Get the center node
      const centerResult = await tx.run(
        `MATCH (n) WHERE elementId(n) = $nodeId RETURN n, elementId(n) as id`,
        { nodeId }
      );

      const centerRecord = centerResult.records[0];
      if (!centerRecord) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      const centerNode = centerRecord.get('n');
      const node: GraphNode = {
        id: centerRecord.get('id') as string,
        labels: centerNode.labels as string[],
        properties: centerNode.properties as Record<string, unknown>,
      };

      // Get neighbors based on direction
      const queries: string[] = [];
      if (direction === 'out' || direction === 'both') {
        queries.push(`
          MATCH (center) WHERE elementId(center) = $nodeId
          MATCH (center)-[r${relPattern}]->(neighbor)
          RETURN neighbor, elementId(neighbor) as id, r, type(r) as relType, 'out' as direction
        `);
      }
      if (direction === 'in' || direction === 'both') {
        queries.push(`
          MATCH (center) WHERE elementId(center) = $nodeId
          MATCH (center)<-[r${relPattern}]-(neighbor)
          RETURN neighbor, elementId(neighbor) as id, r, type(r) as relType, 'in' as direction
        `);
      }

      const neighbors: Array<{
        node: GraphNode;
        relationship: { type: string; direction: 'in' | 'out'; properties: Record<string, unknown> };
      }> = [];

      for (const query of queries) {
        const result = await tx.run(query, { nodeId });
        for (const record of result.records) {
          const neighborNode = record.get('neighbor');
          const rel = record.get('r');
          neighbors.push({
            node: {
              id: record.get('id') as string,
              labels: neighborNode.labels as string[],
              properties: neighborNode.properties as Record<string, unknown>,
            },
            relationship: {
              type: record.get('relType') as string,
              direction: record.get('direction') as 'in' | 'out',
              properties: rel.properties as Record<string, unknown>,
            },
          });
        }
      }

      return { node, neighbors };
    },
    database
  );
}
