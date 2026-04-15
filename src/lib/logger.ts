import { randomUUID } from 'node:crypto'
import pino from 'pino'

/**
 * Pino structured logging for Specter
 *
 * Usage:
 *   import { logger, scanLogger, graphLogger, mcpLogger } from './lib/logger.js';
 *   logger.info({ repoPath }, 'Starting scan');
 *   scanLogger.debug({ fileCount: 100 }, 'Processing files');
 *   graphLogger.info({ nodes: 50, edges: 120 }, 'Graph built');
 *   mcpLogger.error({ err, tool: 'analyze' }, 'Tool execution failed');
 *
 * Request-scoped logging with correlation IDs:
 *   const reqLogger = createRequestLogger();
 *   reqLogger.info({ toolName: 'scan' }, 'Processing MCP request');
 */

const isDevelopment = process.env['NODE_ENV'] === 'development'

export const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: isDevelopment ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  base: {
    service: 'specter',
    env: process.env['NODE_ENV'] || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

// Module-specific child loggers
export const scanLogger = logger.child({ module: 'scanner' })
export const graphLogger = logger.child({ module: 'graph' })
export const mcpLogger = logger.child({ module: 'mcp' })
export const analysisLogger = logger.child({ module: 'analysis' })
export const dashboardLogger = logger.child({ module: 'dashboard' })

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
}

/**
 * Create a child logger with correlation ID for request tracing
 */
export function createRequestLogger(correlationId?: string) {
  return logger.child({
    correlationId: correlationId || generateCorrelationId(),
  })
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context?: Record<string, unknown>
): void {
  const level = durationMs > 5000 ? 'warn' : 'info'
  logger[level]({ operation, durationMs, ...context }, `Performance: ${operation}`)
}

/**
 * Request logging middleware for Fastify
 */
export function createFastifyRequestLogger() {
  return {
    onRequest: (
      request: { id: string; method: string; url: string },
      _reply: unknown,
      done: () => void
    ) => {
      const correlationId = generateCorrelationId()
      ;(request as { correlationId?: string }).correlationId = correlationId
      logger.info({ correlationId, method: request.method, url: request.url }, 'Request started')
      done()
    },
    onResponse: (
      request: { id: string; method: string; url: string; correlationId?: string },
      reply: { statusCode: number; elapsedTime: number },
      done: () => void
    ) => {
      logger.info(
        {
          correlationId: request.correlationId,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          durationMs: Math.round(reply.elapsedTime),
        },
        'Request completed'
      )
      done()
    },
  }
}

export default logger
