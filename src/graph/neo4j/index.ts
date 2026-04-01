/**
 * Neo4j Graph Database Module
 *
 * Complete Neo4j integration for Specter knowledge graph persistence.
 */

// Core client and connection management
export {
  getDriver,
  closeDriver,
  createSession,
  createNeo4jClient,
  healthCheck,
  isNeo4jConfigured,
  isConnected,
  executeRead,
  executeWrite,
  getConfigFromEnv,
  initializeDriver,
} from './client.js';

// Type exports
export * from './types.js';
