/**
 * Neo4j Client
 *
 * Manages Neo4j driver connections with proper lifecycle management,
 * connection pooling, and health checks.
 */

import neo4j, { type Driver, type Session, type ServerInfo } from 'neo4j-driver';
import { logger } from '../../lib/logger.js';
import {
  DEFAULT_NEO4J_CONFIG,
  DEFAULT_POOL_CONFIG,
  NEO4J_ENV_VARS,
  type ConnectionPoolConfig,
  type Neo4jClient,
  type Neo4jConnectionConfig,
  type Neo4jHealthCheck,
} from './types.js';

// Singleton driver instance
let driverInstance: Driver | null = null;
let currentConfig: Neo4jConnectionConfig | null = null;

/**
 * Get Neo4j configuration from environment variables
 */
export function getConfigFromEnv(): Neo4jConnectionConfig | null {
  const uri = process.env[NEO4J_ENV_VARS.URI];
  const username = process.env[NEO4J_ENV_VARS.USERNAME];
  const password = process.env[NEO4J_ENV_VARS.PASSWORD];
  const database = process.env[NEO4J_ENV_VARS.DATABASE];

  if (!uri || !username || !password) {
    return null;
  }

  return {
    uri,
    username,
    password,
    database: database || DEFAULT_NEO4J_CONFIG.database,
  };
}

/**
 * Initialize the Neo4j driver with the given configuration
 */
export async function initializeDriver(
  config: Neo4jConnectionConfig,
  poolConfig: Partial<ConnectionPoolConfig> = {}
): Promise<Driver> {
  // Merge with defaults
  const pool = { ...DEFAULT_POOL_CONFIG, ...poolConfig };

  const driver = neo4j.driver(
    config.uri,
    neo4j.auth.basic(config.username, config.password),
    {
      maxConnectionPoolSize: pool.maxConnectionPoolSize,
      connectionAcquisitionTimeout: pool.connectionAcquisitionTimeout,
      maxTransactionRetryTime: pool.maxTransactionRetryTime,
      connectionLivenessCheckTimeout: pool.connectionLivenessCheckTimeout,
      ...config.driverConfig,
    }
  );

  // Verify connectivity
  try {
    await driver.verifyConnectivity();
    const serverInfo = await driver.getServerInfo();
    logger.info(
      { address: serverInfo.address, agent: serverInfo.agent },
      'Neo4j driver connected'
    );
  } catch (error) {
    await driver.close();
    throw new Error(
      `Failed to connect to Neo4j: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return driver;
}

/**
 * Get or create the singleton Neo4j driver
 */
export async function getDriver(config?: Neo4jConnectionConfig): Promise<Driver> {
  // Use provided config, env config, or fail
  const resolvedConfig = config || getConfigFromEnv();

  if (!resolvedConfig) {
    throw new Error(
      'Neo4j configuration not provided. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables.'
    );
  }

  // If driver exists and config hasn't changed, return existing driver
  if (driverInstance && currentConfig) {
    const configMatch =
      currentConfig.uri === resolvedConfig.uri &&
      currentConfig.username === resolvedConfig.username &&
      currentConfig.database === resolvedConfig.database;

    if (configMatch) {
      return driverInstance;
    }

    // Config changed, close old driver
    await closeDriver();
  }

  // Create new driver
  driverInstance = await initializeDriver(resolvedConfig);
  currentConfig = resolvedConfig;

  return driverInstance;
}

/**
 * Close the Neo4j driver and clean up resources
 */
export async function closeDriver(): Promise<void> {
  if (driverInstance) {
    try {
      await driverInstance.close();
      logger.info('Neo4j driver closed');
    } catch (error) {
      logger.error({ err: error }, 'Error closing Neo4j driver');
    } finally {
      driverInstance = null;
      currentConfig = null;
    }
  }
}

/**
 * Create a new session for database operations
 */
export function createSession(driver: Driver, database?: string): Session {
  const db = database || currentConfig?.database || DEFAULT_NEO4J_CONFIG.database;
  return driver.session({ database: db });
}

/**
 * Perform a health check on the Neo4j connection
 */
export async function healthCheck(driver?: Driver): Promise<Neo4jHealthCheck> {
  const startTime = Date.now();

  try {
    const d = driver || driverInstance;

    if (!d) {
      return {
        connected: false,
        latencyMs: Date.now() - startTime,
        error: 'No driver instance available',
      };
    }

    await d.verifyConnectivity();
    const serverInfo: ServerInfo = await d.getServerInfo();

    // Extract protocol version as number (handle ProtocolVersion type)
    let protocolVersionNum = 0;
    if (serverInfo.protocolVersion) {
      const pv = serverInfo.protocolVersion;
      // ProtocolVersion may be an object with major/minor or a number
      if (typeof pv === 'number') {
        protocolVersionNum = pv;
      } else if (typeof pv === 'object' && 'major' in pv) {
        protocolVersionNum = (pv as unknown as { major: number; minor?: number }).major;
      }
    }

    return {
      connected: true,
      serverInfo: {
        address: serverInfo.address || 'unknown',
        agent: serverInfo.agent || 'unknown',
        protocolVersion: protocolVersionNum,
      },
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if Neo4j is available (env vars configured)
 */
export function isNeo4jConfigured(): boolean {
  const config = getConfigFromEnv();
  return config !== null;
}

/**
 * Check if driver is currently connected
 */
export function isConnected(): boolean {
  return driverInstance !== null;
}

/**
 * Create a high-level Neo4j client object
 */
export async function createNeo4jClient(
  config?: Neo4jConnectionConfig
): Promise<Neo4jClient> {
  const driver = await getDriver(config);

  return {
    driver,
    session(database?: string) {
      return createSession(driver, database);
    },
    async close() {
      await closeDriver();
    },
    async healthCheck() {
      return healthCheck(driver);
    },
    isConnected() {
      return isConnected();
    },
  };
}

/**
 * Execute a read transaction with automatic session management
 */
export async function executeRead<T>(
  driver: Driver,
  work: (tx: neo4j.ManagedTransaction) => Promise<T>,
  database?: string
): Promise<T> {
  const session = createSession(driver, database);
  try {
    return await session.executeRead(work);
  } finally {
    await session.close();
  }
}

/**
 * Execute a write transaction with automatic session management
 */
export async function executeWrite<T>(
  driver: Driver,
  work: (tx: neo4j.ManagedTransaction) => Promise<T>,
  database?: string
): Promise<T> {
  const session = createSession(driver, database);
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  await closeDriver();
});

process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDriver();
  process.exit(0);
});
