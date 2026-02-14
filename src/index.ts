#!/usr/bin/env node
/**
 * Specter MCP Server
 *
 * Model Context Protocol server that exposes the knowledge graph
 * to GitHub Copilot CLI and other MCP clients.
 *
 * Implements MCP best practices:
 * - Outcome-oriented tools (not operation-oriented)
 * - Proper error handling with context
 * - Request timeout handling
 * - Structured error responses
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPrompts, registerResources, registerTools } from './mcp/index.js';

/**
 * Create the MCP server with all tools, prompts, and resources
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: 'specter',
    version: '1.0.0',
  });

  // Register all MCP components
  registerTools(server);
  registerPrompts(server);
  registerResources(server);

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start Specter MCP server:', error);
  process.exit(1);
});
