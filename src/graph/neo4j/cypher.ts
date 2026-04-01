/**
 * Neo4j Cypher Query Operations
 *
 * Raw Cypher query support with query building helpers.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead, executeWrite } from './client.js';
import type { CypherResult, Neo4jSchema, QueryStats } from './types.js';

/**
 * Run a read-only Cypher query
 */
export async function runCypher<T = Record<string, unknown>>(
  driver: Driver,
  query: string,
  params: Record<string, unknown> = {},
  database?: string
): Promise<T[]> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query, params);
      return result.records.map((record) => {
        const obj: Record<string, unknown> = {};
        for (const key of record.keys) {
          if (typeof key === 'string') {
            obj[key] = record.get(key);
          }
        }
        return obj as T;
      });
    },
    database
  );
}

/**
 * Run a Cypher query and return results with statistics
 */
export async function runCypherWithStats<T = Record<string, unknown>>(
  driver: Driver,
  query: string,
  params: Record<string, unknown> = {},
  options: { write?: boolean } = {},
  database?: string
): Promise<CypherResult<T>> {
  const { write = false } = options;
  const executor = write ? executeWrite : executeRead;

  return executor(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(query, params);
      const updates = result.summary.counters.updates();

      const records = result.records.map((record) => {
        const obj: Record<string, unknown> = {};
        for (const key of record.keys) {
          if (typeof key === 'string') {
            obj[key] = record.get(key);
          }
        }
        return obj as T;
      });

      const stats: QueryStats = {
        nodesCreated: updates.nodesCreated,
        nodesDeleted: updates.nodesDeleted,
        relationshipsCreated: updates.relationshipsCreated,
        relationshipsDeleted: updates.relationshipsDeleted,
        propertiesSet: updates.propertiesSet,
        labelsAdded: updates.labelsAdded,
        labelsRemoved: updates.labelsRemoved,
        indexesAdded: updates.indexesAdded,
        indexesRemoved: updates.indexesRemoved,
        constraintsAdded: updates.constraintsAdded,
        constraintsRemoved: updates.constraintsRemoved,
      };

      return {
        records,
        summary: {
          counters: stats,
          query,
          parameters: params,
          queryType: result.summary.queryType,
          plan: result.summary.plan,
          profile: result.summary.profile,
        },
      };
    },
    database
  );
}

/**
 * Run multiple Cypher statements in a batch
 */
export async function runBatchCypher(
  driver: Driver,
  queries: Array<{ query: string; params?: Record<string, unknown> }>,
  database?: string
): Promise<{ results: Array<Record<string, unknown>[]>; totalStats: QueryStats }> {
  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const results: Array<Record<string, unknown>[]> = [];
      const totalStats: QueryStats = {
        nodesCreated: 0,
        nodesDeleted: 0,
        relationshipsCreated: 0,
        relationshipsDeleted: 0,
        propertiesSet: 0,
        labelsAdded: 0,
        labelsRemoved: 0,
        indexesAdded: 0,
        indexesRemoved: 0,
        constraintsAdded: 0,
        constraintsRemoved: 0,
      };

      for (const { query, params = {} } of queries) {
        const result = await tx.run(query, params);
        const updates = result.summary.counters.updates();

        totalStats.nodesCreated += updates.nodesCreated;
        totalStats.nodesDeleted += updates.nodesDeleted;
        totalStats.relationshipsCreated += updates.relationshipsCreated;
        totalStats.relationshipsDeleted += updates.relationshipsDeleted;
        totalStats.propertiesSet += updates.propertiesSet;
        totalStats.labelsAdded += updates.labelsAdded;
        totalStats.labelsRemoved += updates.labelsRemoved;
        totalStats.indexesAdded += updates.indexesAdded;
        totalStats.indexesRemoved += updates.indexesRemoved;
        totalStats.constraintsAdded += updates.constraintsAdded;
        totalStats.constraintsRemoved += updates.constraintsRemoved;

        results.push(
          result.records.map((record) => {
            const obj: Record<string, unknown> = {};
            for (const key of record.keys) {
              if (typeof key === 'string') {
                obj[key] = record.get(key);
              }
            }
            return obj;
          })
        );
      }

      return { results, totalStats };
    },
    database
  );
}

/**
 * Create constraints for the knowledge graph schema
 */
export async function createConstraints(
  driver: Driver,
  database?: string
): Promise<{ created: string[]; errors: Array<{ constraint: string; error: string }> }> {
  const constraints = [
    { name: 'file_path_unique', query: 'CREATE CONSTRAINT file_path_unique IF NOT EXISTS FOR (f:File) REQUIRE f.filePath IS UNIQUE' },
    { name: 'function_id_unique', query: 'CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (fn:Function) REQUIRE fn.id IS UNIQUE' },
    { name: 'class_id_unique', query: 'CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE' },
    { name: 'interface_id_unique', query: 'CREATE CONSTRAINT interface_id_unique IF NOT EXISTS FOR (i:Interface) REQUIRE i.id IS UNIQUE' },
    { name: 'codebase_name_unique', query: 'CREATE CONSTRAINT codebase_name_unique IF NOT EXISTS FOR (cb:Codebase) REQUIRE cb.name IS UNIQUE' },
    { name: 'contributor_email_unique', query: 'CREATE CONSTRAINT contributor_email_unique IF NOT EXISTS FOR (c:Contributor) REQUIRE c.email IS UNIQUE' },
  ];

  const created: string[] = [];
  const errors: Array<{ constraint: string; error: string }> = [];

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      for (const { name, query } of constraints) {
        try {
          await tx.run(query);
          created.push(name);
        } catch (error) {
          errors.push({
            constraint: name,
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
 * Create indexes for common query patterns
 */
export async function createIndexes(
  driver: Driver,
  database?: string
): Promise<{ created: string[]; errors: Array<{ index: string; error: string }> }> {
  const indexes = [
    { name: 'file_name_index', query: 'CREATE INDEX file_name_index IF NOT EXISTS FOR (f:File) ON (f.name)' },
    { name: 'function_name_index', query: 'CREATE INDEX function_name_index IF NOT EXISTS FOR (fn:Function) ON (fn.name)' },
    { name: 'class_name_index', query: 'CREATE INDEX class_name_index IF NOT EXISTS FOR (c:Class) ON (c.name)' },
    { name: 'node_type_index', query: 'CREATE INDEX node_type_index IF NOT EXISTS FOR (n:Node) ON (n.type)' },
    { name: 'complexity_index', query: 'CREATE INDEX complexity_index IF NOT EXISTS FOR (n:Node) ON (n.complexity)' },
    { name: 'last_modified_index', query: 'CREATE INDEX last_modified_index IF NOT EXISTS FOR (n:Node) ON (n.lastModified)' },
  ];

  const created: string[] = [];
  const errors: Array<{ index: string; error: string }> = [];

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      for (const { name, query } of indexes) {
        try {
          await tx.run(query);
          created.push(name);
        } catch (error) {
          errors.push({
            index: name,
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
 * Drop all data from the database (use with caution!)
 */
export async function dropAllData(
  driver: Driver,
  database?: string
): Promise<QueryStats> {
  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run('MATCH (n) DETACH DELETE n');
      const updates = result.summary.counters.updates();
      return {
        nodesCreated: updates.nodesCreated,
        nodesDeleted: updates.nodesDeleted,
        relationshipsCreated: updates.relationshipsCreated,
        relationshipsDeleted: updates.relationshipsDeleted,
        propertiesSet: updates.propertiesSet,
        labelsAdded: updates.labelsAdded,
        labelsRemoved: updates.labelsRemoved,
        indexesAdded: updates.indexesAdded,
        indexesRemoved: updates.indexesRemoved,
        constraintsAdded: updates.constraintsAdded,
        constraintsRemoved: updates.constraintsRemoved,
      };
    },
    database
  );
}

/**
 * Get the current schema (labels, relationship types, constraints, indexes)
 */
export async function getSchema(driver: Driver, database?: string): Promise<Neo4jSchema> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      // Get labels
      const labelsResult = await tx.run('CALL db.labels()');
      const labels = labelsResult.records.map((r) => r.get('label') as string);

      // Get relationship types
      const relsResult = await tx.run('CALL db.relationshipTypes()');
      const relationshipTypes = relsResult.records.map((r) => r.get('relationshipType') as string);

      // Get constraints
      const constraintsResult = await tx.run('SHOW CONSTRAINTS');
      const constraints = constraintsResult.records.map((r) => ({
        name: r.get('name') as string,
        type: r.get('type') as string,
        entityType: r.get('entityType') as string,
        properties: r.get('properties') as string[],
      }));

      // Get indexes
      const indexesResult = await tx.run('SHOW INDEXES');
      const indexes = indexesResult.records.map((r) => ({
        name: r.get('name') as string,
        type: r.get('type') as string,
        entityType: r.get('entityType') as string,
        properties: r.get('properties') as string[],
        state: r.get('state') as string,
      }));

      return { labels, relationshipTypes, constraints, indexes };
    },
    database
  );
}

/**
 * Explain a query plan without executing it
 */
export async function explainQuery(
  driver: Driver,
  query: string,
  params: Record<string, unknown> = {},
  database?: string
): Promise<{ plan: unknown; profile?: unknown }> {
  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      const result = await tx.run(`EXPLAIN ${query}`, params);
      return {
        plan: result.summary.plan,
        profile: result.summary.profile,
      };
    },
    database
  );
}

/**
 * Cypher query builder for constructing complex queries
 */
export interface CypherBuilder {
  match(pattern: string): CypherBuilder;
  optionalMatch(pattern: string): CypherBuilder;
  where(condition: string): CypherBuilder;
  andWhere(condition: string): CypherBuilder;
  orWhere(condition: string): CypherBuilder;
  with(...expressions: string[]): CypherBuilder;
  create(pattern: string): CypherBuilder;
  merge(pattern: string): CypherBuilder;
  set(assignments: string): CypherBuilder;
  delete(variables: string): CypherBuilder;
  detachDelete(variables: string): CypherBuilder;
  return(...expressions: string[]): CypherBuilder;
  orderBy(expression: string, direction?: 'ASC' | 'DESC'): CypherBuilder;
  skip(count: number): CypherBuilder;
  limit(count: number): CypherBuilder;
  union(): CypherBuilder;
  unionAll(): CypherBuilder;
  param(name: string, value: unknown): CypherBuilder;
  build(): { query: string; params: Record<string, unknown> };
  toString(): string;
}

/**
 * Create a new Cypher query builder
 */
export function cypherBuilder(): CypherBuilder {
  const parts: string[] = [];
  const params: Record<string, unknown> = {};
  let whereStarted = false;

  const builder: CypherBuilder = {
    match(pattern: string) {
      parts.push(`MATCH ${pattern}`);
      whereStarted = false;
      return builder;
    },
    optionalMatch(pattern: string) {
      parts.push(`OPTIONAL MATCH ${pattern}`);
      whereStarted = false;
      return builder;
    },
    where(condition: string) {
      parts.push(`WHERE ${condition}`);
      whereStarted = true;
      return builder;
    },
    andWhere(condition: string) {
      if (whereStarted) {
        parts.push(`AND ${condition}`);
      } else {
        parts.push(`WHERE ${condition}`);
        whereStarted = true;
      }
      return builder;
    },
    orWhere(condition: string) {
      if (whereStarted) {
        parts.push(`OR ${condition}`);
      } else {
        parts.push(`WHERE ${condition}`);
        whereStarted = true;
      }
      return builder;
    },
    with(...expressions: string[]) {
      parts.push(`WITH ${expressions.join(', ')}`);
      whereStarted = false;
      return builder;
    },
    create(pattern: string) {
      parts.push(`CREATE ${pattern}`);
      return builder;
    },
    merge(pattern: string) {
      parts.push(`MERGE ${pattern}`);
      return builder;
    },
    set(assignments: string) {
      parts.push(`SET ${assignments}`);
      return builder;
    },
    delete(variables: string) {
      parts.push(`DELETE ${variables}`);
      return builder;
    },
    detachDelete(variables: string) {
      parts.push(`DETACH DELETE ${variables}`);
      return builder;
    },
    return(...expressions: string[]) {
      parts.push(`RETURN ${expressions.join(', ')}`);
      return builder;
    },
    orderBy(expression: string, direction: 'ASC' | 'DESC' = 'ASC') {
      parts.push(`ORDER BY ${expression} ${direction}`);
      return builder;
    },
    skip(count: number) {
      parts.push(`SKIP ${count}`);
      return builder;
    },
    limit(count: number) {
      parts.push(`LIMIT ${count}`);
      return builder;
    },
    union() {
      parts.push('UNION');
      whereStarted = false;
      return builder;
    },
    unionAll() {
      parts.push('UNION ALL');
      whereStarted = false;
      return builder;
    },
    param(name: string, value: unknown) {
      params[name] = value;
      return builder;
    },
    build() {
      return { query: parts.join('\n'), params };
    },
    toString() {
      return parts.join('\n');
    },
  };

  return builder;
}

/**
 * Build a Cypher query from a template (convenience function)
 */
export function buildCypher(
  template: string,
  params: Record<string, unknown> = {}
): { query: string; params: Record<string, unknown> } {
  return { query: template, params };
}
