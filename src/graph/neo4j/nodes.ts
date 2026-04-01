/**
 * Neo4j Node Operations
 *
 * CRUD operations for graph nodes with full TypeScript support.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead, executeWrite } from './client.js';
import type { CreateNodeOptions, GraphNode, QueryStats } from './types.js';

/**
 * Create a new node in the graph
 */
export async function createNode(
  driver: Driver,
  options: CreateNodeOptions,
  database?: string
): Promise<GraphNode> {
  const { labels, properties, merge = false, mergeKey } = options;
  const labelStr = labels.map((l) => `:${l}`).join('');

  let query: string;
  if (merge && mergeKey && properties[mergeKey] !== undefined) {
    query = `
      MERGE (n${labelStr} {${mergeKey}: $mergeValue})
      ON CREATE SET n = $props
      ON MATCH SET n += $props
      RETURN n, elementId(n) as id
    `;
  } else if (merge) {
    query = `
      MERGE (n${labelStr} $props)
      RETURN n, elementId(n) as id
    `;
  } else {
    query = `
      CREATE (n${labelStr} $props)
      RETURN n, elementId(n) as id
    `;
  }

  const params = {
    props: properties,
    mergeValue: mergeKey ? properties[mergeKey] : undefined,
  };

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query, params);
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create node');
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Get a node by its element ID
 */
export async function getNodeById(
  driver: Driver,
  nodeId: string,
  database?: string
): Promise<GraphNode | null> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n) WHERE elementId(n) = $id RETURN n, elementId(n) as id`,
        { id: nodeId }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Get a node by property value
 */
export async function getNode(
  driver: Driver,
  labels: string[],
  propertyKey: string,
  propertyValue: unknown,
  database?: string
): Promise<GraphNode | null> {
  const labelStr = labels.length > 0 ? labels.map((l) => `:${l}`).join('') : '';

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n${labelStr}) WHERE n[$key] = $value RETURN n, elementId(n) as id LIMIT 1`,
        { key: propertyKey, value: propertyValue }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Update a node's properties
 */
export async function updateNode(
  driver: Driver,
  nodeId: string,
  properties: Record<string, unknown>,
  options: { replace?: boolean } = {},
  database?: string
): Promise<GraphNode | null> {
  const { replace = false } = options;
  const setClause = replace ? 'n = $props' : 'n += $props';

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n) WHERE elementId(n) = $id SET ${setClause} RETURN n, elementId(n) as id`,
        { id: nodeId, props: properties }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Delete a node (and optionally its relationships)
 */
export async function deleteNode(
  driver: Driver,
  nodeId: string,
  options: { detach?: boolean } = {},
  database?: string
): Promise<boolean> {
  const { detach = true } = options;
  const deleteClause = detach ? 'DETACH DELETE n' : 'DELETE n';

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n) WHERE elementId(n) = $id ${deleteClause}`,
        { id: nodeId }
      );
      const counters = result.summary.counters.updates();
      return counters.nodesDeleted > 0;
    },
    database
  );
}

/**
 * Upsert a node (create if not exists, update if exists)
 */
export async function upsertNode(
  driver: Driver,
  labels: string[],
  matchProperties: Record<string, unknown>,
  setProperties: Record<string, unknown>,
  database?: string
): Promise<GraphNode> {
  const labelStr = labels.map((l) => `:${l}`).join('');

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MERGE (n${labelStr} $matchProps)
        ON CREATE SET n += $setProps
        ON MATCH SET n += $setProps
        RETURN n, elementId(n) as id
        `,
        { matchProps: matchProperties, setProps: setProperties }
      );
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to upsert node');
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Get all nodes with specific labels
 */
export async function getNodesByLabel(
  driver: Driver,
  labels: string[],
  options: { limit?: number; skip?: number; orderBy?: string; orderDir?: 'ASC' | 'DESC' } = {},
  database?: string
): Promise<GraphNode[]> {
  const { limit, skip, orderBy, orderDir = 'ASC' } = options;
  const labelStr = labels.map((l) => `:${l}`).join('');

  let query = `MATCH (n${labelStr}) RETURN n, elementId(n) as id`;
  if (orderBy) {
    query += ` ORDER BY n.${orderBy} ${orderDir}`;
  }
  if (skip !== undefined) {
    query += ` SKIP ${skip}`;
  }
  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query);
      return result.records.map((record) => {
        const node = record.get('n');
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
 * Get nodes by property value
 */
export async function getNodesByProperty(
  driver: Driver,
  labels: string[],
  propertyKey: string,
  propertyValue: unknown,
  options: { limit?: number } = {},
  database?: string
): Promise<GraphNode[]> {
  const { limit } = options;
  const labelStr = labels.length > 0 ? labels.map((l) => `:${l}`).join('') : '';

  let query = `MATCH (n${labelStr}) WHERE n[$key] = $value RETURN n, elementId(n) as id`;
  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query, { key: propertyKey, value: propertyValue });
      return result.records.map((record) => {
        const node = record.get('n');
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
 * Count nodes by label
 */
export async function countNodesByLabel(
  driver: Driver,
  labels: string[],
  database?: string
): Promise<number> {
  const labelStr = labels.map((l) => `:${l}`).join('');

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(`MATCH (n${labelStr}) RETURN count(n) as count`);
      const record = result.records[0];
      if (!record) {
        return 0;
      }
      const count = record.get('count');
      return typeof count === 'object' && 'toNumber' in count
        ? (count as { toNumber: () => number }).toNumber()
        : Number(count);
    },
    database
  );
}

/**
 * Check if a node exists
 */
export async function nodeExists(
  driver: Driver,
  labels: string[],
  propertyKey: string,
  propertyValue: unknown,
  database?: string
): Promise<boolean> {
  const labelStr = labels.length > 0 ? labels.map((l) => `:${l}`).join('') : '';

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n${labelStr}) WHERE n[$key] = $value RETURN count(n) > 0 as exists`,
        { key: propertyKey, value: propertyValue }
      );
      const record = result.records[0];
      return record ? (record.get('exists') as boolean) : false;
    },
    database
  );
}

/**
 * Bulk create nodes
 */
export async function bulkCreateNodes(
  driver: Driver,
  nodes: CreateNodeOptions[],
  database?: string
): Promise<{ created: number; errors: Array<{ index: number; error: string }> }> {
  const errors: Array<{ index: number; error: string }> = [];
  let created = 0;

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        try {
          const labelStr = node.labels.map((l) => `:${l}`).join('');
          const query = node.merge
            ? `MERGE (n${labelStr} $props) RETURN n`
            : `CREATE (n${labelStr} $props) RETURN n`;
          await tx.run(query, { props: node.properties });
          created++;
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return { created, errors };
    },
    database
  );
}

/**
 * Add labels to a node
 */
export async function addLabels(
  driver: Driver,
  nodeId: string,
  labels: string[],
  database?: string
): Promise<GraphNode | null> {
  const labelStr = labels.map((l) => `:${l}`).join('');

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n) WHERE elementId(n) = $id SET n${labelStr} RETURN n, elementId(n) as id`,
        { id: nodeId }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Remove labels from a node
 */
export async function removeLabels(
  driver: Driver,
  nodeId: string,
  labels: string[],
  database?: string
): Promise<GraphNode | null> {
  const labelStr = labels.map((l) => `:${l}`).join('');

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH (n) WHERE elementId(n) = $id REMOVE n${labelStr} RETURN n, elementId(n) as id`,
        { id: nodeId }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const node = record.get('n');
      return {
        id: record.get('id') as string,
        labels: node.labels as string[],
        properties: node.properties as Record<string, unknown>,
      };
    },
    database
  );
}
