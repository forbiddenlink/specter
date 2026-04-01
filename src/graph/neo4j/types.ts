/**
 * Neo4j Graph Database Types
 *
 * TypeScript types for Neo4j integration with the Specter knowledge graph.
 * Follows patterns from Memory MCP server for knowledge graphs.
 */

import type { Driver, Session, Config as Neo4jConfig } from 'neo4j-driver';

/**
 * Neo4j connection configuration
 */
export interface Neo4jConnectionConfig {
  /** Neo4j connection URI (e.g., 'neo4j://localhost:7687') */
  uri: string;
  /** Database username */
  username: string;
  /** Database password */
  password: string;
  /** Target database name (optional, defaults to 'neo4j') */
  database?: string;
  /** Additional driver configuration */
  driverConfig?: Partial<Neo4jConfig>;
}

/**
 * Environment variable names for Neo4j configuration
 */
export const NEO4J_ENV_VARS = {
  URI: 'NEO4J_URI',
  USERNAME: 'NEO4J_USERNAME',
  PASSWORD: 'NEO4J_PASSWORD',
  DATABASE: 'NEO4J_DATABASE',
} as const;

/**
 * Default Neo4j configuration
 */
export const DEFAULT_NEO4J_CONFIG: Partial<Neo4jConnectionConfig> = {
  uri: 'neo4j://localhost:7687',
  username: 'neo4j',
  database: 'neo4j',
};

/**
 * Connection pool settings for the Neo4j driver
 */
export interface ConnectionPoolConfig {
  /** Maximum connections in the pool */
  maxConnectionPoolSize: number;
  /** Timeout for acquiring a connection from the pool (ms) */
  connectionAcquisitionTimeout: number;
  /** Maximum time for transaction retries (ms) */
  maxTransactionRetryTime: number;
  /** Liveness check timeout for connections (ms) */
  connectionLivenessCheckTimeout: number;
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnectionPoolSize: 50,
  connectionAcquisitionTimeout: 60000,
  maxTransactionRetryTime: 30000,
  connectionLivenessCheckTimeout: 60000,
};

/**
 * Neo4j node labels for the knowledge graph
 */
export const NODE_LABELS = {
  FILE: 'File',
  FUNCTION: 'Function',
  CLASS: 'Class',
  INTERFACE: 'Interface',
  TYPE: 'Type',
  VARIABLE: 'Variable',
  ENUM: 'Enum',
  CODEBASE: 'Codebase',
  CONTRIBUTOR: 'Contributor',
} as const;

export type NodeLabel = (typeof NODE_LABELS)[keyof typeof NODE_LABELS];

/**
 * Neo4j relationship types for the knowledge graph
 */
export const RELATIONSHIP_TYPES = {
  IMPORTS: 'IMPORTS',
  EXPORTS: 'EXPORTS',
  CALLS: 'CALLS',
  EXTENDS: 'EXTENDS',
  IMPLEMENTS: 'IMPLEMENTS',
  USES: 'USES',
  CONTAINS: 'CONTAINS',
  CONTRIBUTED_TO: 'CONTRIBUTED_TO',
  BELONGS_TO: 'BELONGS_TO',
} as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[keyof typeof RELATIONSHIP_TYPES];

/**
 * Query result for a node with its relationships
 */
export interface NodeWithRelations {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  relationships: Array<{
    type: string;
    direction: 'in' | 'out';
    targetId: string;
    properties: Record<string, unknown>;
  }>;
}

/**
 * Query result for path-based queries
 */
export interface GraphPath {
  nodes: Array<{
    id: string;
    labels: string[];
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    type: string;
    startNodeId: string;
    endNodeId: string;
    properties: Record<string, unknown>;
  }>;
}

/**
 * Result of a graph traversal query
 */
export interface TraversalResult {
  paths: GraphPath[];
  totalPaths: number;
  depth: number;
}

/**
 * Impact analysis result from Neo4j
 */
export interface Neo4jImpactResult {
  directDependents: string[];
  indirectDependents: string[];
  totalImpactedFiles: number;
  impactPaths: GraphPath[];
}

/**
 * Centrality metrics from graph algorithms
 */
export interface CentralityMetrics {
  nodeId: string;
  name: string;
  filePath: string;
  pageRank?: number;
  betweenness?: number;
  degree?: number;
  inDegree?: number;
  outDegree?: number;
}

/**
 * Community detection result
 */
export interface Community {
  id: number;
  members: Array<{
    nodeId: string;
    name: string;
    filePath: string;
    nodeType: string;
  }>;
  size: number;
}

/**
 * Health check result for Neo4j connection
 */
export interface Neo4jHealthCheck {
  connected: boolean;
  serverInfo?: {
    address: string;
    agent: string;
    protocolVersion: number;
  };
  latencyMs: number;
  error?: string;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  nodesCreated: number;
  nodesUpdated: number;
  relationshipsCreated: number;
  relationshipsUpdated: number;
  errors: Array<{ item: string; error: string }>;
  durationMs: number;
}

/**
 * Query execution statistics
 */
export interface QueryStats {
  nodesCreated: number;
  nodesDeleted: number;
  relationshipsCreated: number;
  relationshipsDeleted: number;
  propertiesSet: number;
  labelsAdded: number;
  labelsRemoved: number;
  indexesAdded: number;
  indexesRemoved: number;
  constraintsAdded: number;
  constraintsRemoved: number;
}

/**
 * Neo4j client interface
 */
export interface Neo4jClient {
  driver: Driver;
  session(database?: string): Session;
  close(): Promise<void>;
  healthCheck(): Promise<Neo4jHealthCheck>;
  isConnected(): boolean;
}

/**
 * Generic graph node for Neo4j operations
 */
export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

/**
 * Generic relationship for Neo4j operations
 */
export interface Relationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, unknown>;
}

/**
 * Options for creating a node
 */
export interface CreateNodeOptions {
  labels: string[];
  properties: Record<string, unknown>;
  /** If true, merge instead of create */
  merge?: boolean;
  /** Property key to use for merge matching */
  mergeKey?: string;
}

/**
 * Options for creating a relationship
 */
export interface CreateRelationshipOptions {
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties?: Record<string, unknown>;
  /** If true, merge instead of create */
  merge?: boolean;
}

/**
 * Options for traversal queries
 */
export interface TraversalOptions {
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Relationship types to follow */
  relationshipTypes?: string[];
  /** Direction to traverse: 'in', 'out', or 'both' */
  direction?: 'in' | 'out' | 'both';
  /** Node labels to include */
  nodeLabels?: string[];
  /** Limit number of results */
  limit?: number;
}

/**
 * Visualization format types
 */
export type VisualizationFormat = 'cytoscape' | 'd3' | 'graphviz' | 'vis' | 'sigma';

/**
 * Visualization node format
 */
export interface VisualizationNode {
  id: string;
  label?: string;
  type?: string;
  group?: string | number;
  properties?: Record<string, unknown>;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}

/**
 * Visualization edge format
 */
export interface VisualizationEdge {
  id?: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  weight?: number;
  properties?: Record<string, unknown>;
}

/**
 * Unified visualization data format
 */
export interface VisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata?: Record<string, unknown>;
}

/**
 * Cytoscape.js format
 */
export interface CytoscapeData {
  elements: {
    nodes: Array<{ data: Record<string, unknown>; position?: { x: number; y: number } }>;
    edges: Array<{ data: Record<string, unknown> }>;
  };
}

/**
 * D3.js force graph format
 */
export interface D3ForceData {
  nodes: Array<{ id: string; group?: number; [key: string]: unknown }>;
  links: Array<{ source: string; target: string; value?: number; [key: string]: unknown }>;
}

/**
 * Graph diff result for sync operations
 */
export interface GraphDiff {
  nodesToCreate: GraphNode[];
  nodesToUpdate: Array<{ id: string; properties: Record<string, unknown> }>;
  nodesToDelete: string[];
  relationshipsToCreate: Relationship[];
  relationshipsToUpdate: Array<{ id: string; properties: Record<string, unknown> }>;
  relationshipsToDelete: string[];
}

/**
 * Cypher query result
 */
export interface CypherResult<T = Record<string, unknown>> {
  records: T[];
  summary: {
    counters: QueryStats;
    query: string;
    parameters: Record<string, unknown>;
    queryType: string;
    plan?: unknown;
    profile?: unknown;
  };
}

/**
 * Schema information
 */
export interface Neo4jSchema {
  labels: string[];
  relationshipTypes: string[];
  constraints: Array<{
    name: string;
    type: string;
    entityType: string;
    properties: string[];
  }>;
  indexes: Array<{
    name: string;
    type: string;
    entityType: string;
    properties: string[];
    state: string;
  }>;
}
