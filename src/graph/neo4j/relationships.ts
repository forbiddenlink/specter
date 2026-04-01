/**
 * Neo4j Relationship Operations
 *
 * CRUD operations for graph relationships with full TypeScript support.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead, executeWrite } from './client.js';
import type { CreateRelationshipOptions, Relationship } from './types.js';

/**
 * Create a relationship between two nodes
 */
export async function createRelationship(
  driver: Driver,
  options: CreateRelationshipOptions,
  database?: string
): Promise<Relationship> {
  const { type, startNodeId, endNodeId, properties = {}, merge = false } = options;
  const clause = merge ? 'MERGE' : 'CREATE';

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (a) WHERE elementId(a) = $startId
        MATCH (b) WHERE elementId(b) = $endId
        ${clause} (a)-[r:${type}]->(b)
        SET r += $props
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { startId: startNodeId, endId: endNodeId, props: properties }
      );
      const record = result.records[0];
      if (!record) {
        throw new Error('Failed to create relationship');
      }
      const rel = record.get('r');
      return {
        id: record.get('id') as string,
        type: rel.type as string,
        startNode: record.get('startNode') as string,
        endNode: record.get('endNode') as string,
        properties: rel.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Get a relationship by its element ID
 */
export async function getRelationship(
  driver: Driver,
  relationshipId: string,
  database?: string
): Promise<Relationship | null> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (a)-[r]->(b)
        WHERE elementId(r) = $id
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { id: relationshipId }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const rel = record.get('r');
      return {
        id: record.get('id') as string,
        type: rel.type as string,
        startNode: record.get('startNode') as string,
        endNode: record.get('endNode') as string,
        properties: rel.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Update a relationship's properties
 */
export async function updateRelationship(
  driver: Driver,
  relationshipId: string,
  properties: Record<string, unknown>,
  options: { replace?: boolean } = {},
  database?: string
): Promise<Relationship | null> {
  const { replace = false } = options;
  const setClause = replace ? 'r = $props' : 'r += $props';

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (a)-[r]->(b)
        WHERE elementId(r) = $id
        SET ${setClause}
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { id: relationshipId, props: properties }
      );
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const rel = record.get('r');
      return {
        id: record.get('id') as string,
        type: rel.type as string,
        startNode: record.get('startNode') as string,
        endNode: record.get('endNode') as string,
        properties: rel.properties as Record<string, unknown>,
      };
    },
    database
  );
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(
  driver: Driver,
  relationshipId: string,
  database?: string
): Promise<boolean> {
  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `MATCH ()-[r]->() WHERE elementId(r) = $id DELETE r`,
        { id: relationshipId }
      );
      const counters = result.summary.counters.updates();
      return counters.relationshipsDeleted > 0;
    },
    database
  );
}

/**
 * Get all relationships between two nodes
 */
export async function getRelationshipsBetween(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: { type?: string; direction?: 'out' | 'in' | 'both' } = {},
  database?: string
): Promise<Relationship[]> {
  const { type, direction = 'both' } = options;
  const typeClause = type ? `:${type}` : '';

  let pattern: string;
  switch (direction) {
    case 'out':
      pattern = `(a)-[r${typeClause}]->(b)`;
      break;
    case 'in':
      pattern = `(a)<-[r${typeClause}]-(b)`;
      break;
    default:
      pattern = `(a)-[r${typeClause}]-(b)`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(
        `
        MATCH (a) WHERE elementId(a) = $startId
        MATCH (b) WHERE elementId(b) = $endId
        MATCH ${pattern}
        RETURN r, elementId(r) as id, elementId(startNode(r)) as startNode, elementId(endNode(r)) as endNode
        `,
        { startId: startNodeId, endId: endNodeId }
      );
      return result.records.map((record) => {
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          type: rel.type as string,
          startNode: record.get('startNode') as string,
          endNode: record.get('endNode') as string,
          properties: rel.properties as Record<string, unknown>,
        };
      });
    },
    database
  );
}

/**
 * Get all relationships for a node
 */
export async function getNodeRelationships(
  driver: Driver,
  nodeId: string,
  options: { type?: string; direction?: 'out' | 'in' | 'both'; limit?: number } = {},
  database?: string
): Promise<Relationship[]> {
  const { type, direction = 'both', limit } = options;
  const typeClause = type ? `:${type}` : '';

  let pattern: string;
  switch (direction) {
    case 'out':
      pattern = `(n)-[r${typeClause}]->(m)`;
      break;
    case 'in':
      pattern = `(n)<-[r${typeClause}]-(m)`;
      break;
    default:
      pattern = `(n)-[r${typeClause}]-(m)`;
  }

  let query = `
    MATCH (n) WHERE elementId(n) = $nodeId
    MATCH ${pattern}
    RETURN r, elementId(r) as id, elementId(startNode(r)) as startNode, elementId(endNode(r)) as endNode
  `;
  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query, { nodeId });
      return result.records.map((record) => {
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          type: rel.type as string,
          startNode: record.get('startNode') as string,
          endNode: record.get('endNode') as string,
          properties: rel.properties as Record<string, unknown>,
        };
      });
    },
    database
  );
}

/**
 * Create a relationship only if it doesn't already exist
 */
export async function createRelationshipIfNotExists(
  driver: Driver,
  options: CreateRelationshipOptions,
  database?: string
): Promise<{ relationship: Relationship; created: boolean }> {
  const { type, startNodeId, endNodeId, properties = {} } = options;

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      // Check if relationship exists
      const checkResult = await tx.run(
        `
        MATCH (a) WHERE elementId(a) = $startId
        MATCH (b) WHERE elementId(b) = $endId
        MATCH (a)-[r:${type}]->(b)
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { startId: startNodeId, endId: endNodeId }
      );

      if (checkResult.records.length > 0) {
        const record = checkResult.records[0]!;
        const rel = record.get('r');
        return {
          relationship: {
            id: record.get('id') as string,
            type: rel.type as string,
            startNode: record.get('startNode') as string,
            endNode: record.get('endNode') as string,
            properties: rel.properties as Record<string, unknown>,
          },
          created: false,
        };
      }

      // Create the relationship
      const createResult = await tx.run(
        `
        MATCH (a) WHERE elementId(a) = $startId
        MATCH (b) WHERE elementId(b) = $endId
        CREATE (a)-[r:${type} $props]->(b)
        RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
        `,
        { startId: startNodeId, endId: endNodeId, props: properties }
      );

      const record = createResult.records[0];
      if (!record) {
        throw new Error('Failed to create relationship');
      }
      const rel = record.get('r');
      return {
        relationship: {
          id: record.get('id') as string,
          type: rel.type as string,
          startNode: record.get('startNode') as string,
          endNode: record.get('endNode') as string,
          properties: rel.properties as Record<string, unknown>,
        },
        created: true,
      };
    },
    database
  );
}

/**
 * Bulk create relationships
 */
export async function bulkCreateRelationships(
  driver: Driver,
  relationships: CreateRelationshipOptions[],
  database?: string
): Promise<{ created: number; errors: Array<{ index: number; error: string }> }> {
  const errors: Array<{ index: number; error: string }> = [];
  let created = 0;

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      for (let i = 0; i < relationships.length; i++) {
        const rel = relationships[i];
        if (!rel) continue;
        try {
          const clause = rel.merge ? 'MERGE' : 'CREATE';
          await tx.run(
            `
            MATCH (a) WHERE elementId(a) = $startId
            MATCH (b) WHERE elementId(b) = $endId
            ${clause} (a)-[r:${rel.type}]->(b)
            SET r += $props
            RETURN r
            `,
            { startId: rel.startNodeId, endId: rel.endNodeId, props: rel.properties || {} }
          );
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
 * Get relationships by type
 */
export async function getRelationshipsByType(
  driver: Driver,
  type: string,
  options: { limit?: number; skip?: number } = {},
  database?: string
): Promise<Relationship[]> {
  const { limit, skip } = options;

  let query = `
    MATCH (a)-[r:${type}]->(b)
    RETURN r, elementId(r) as id, elementId(a) as startNode, elementId(b) as endNode
  `;
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
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          type: rel.type as string,
          startNode: record.get('startNode') as string,
          endNode: record.get('endNode') as string,
          properties: rel.properties as Record<string, unknown>,
        };
      });
    },
    database
  );
}

/**
 * Count relationships by type
 */
export async function countRelationshipsByType(
  driver: Driver,
  type: string,
  database?: string
): Promise<number> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(`MATCH ()-[r:${type}]->() RETURN count(r) as count`);
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
