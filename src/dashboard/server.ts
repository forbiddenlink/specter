/**
 * Dashboard HTTP Server
 *
 * Serves the interactive web dashboard using Fastify.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { getConfig } from '../config/index.js';
import { registerApiRoutes } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DashboardOptions {
  port?: number;
  host?: string;
  rootDir: string;
}

export async function startDashboard(
  options: DashboardOptions
): Promise<{ url: string; close: () => Promise<void> }> {
  const config = getConfig(options.rootDir);
  const { port = config.dashboard.port, host = config.dashboard.host, rootDir } = options;

  const app = Fastify({ logger: false });

  // Enable CORS for local development
  await app.register(fastifyCors, { origin: true });

  // Serve static files
  await app.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/',
  });

  // Register API routes
  registerApiRoutes(app, rootDir);

  // Start server
  const address = await app.listen({ port, host });

  return {
    url: address,
    close: () => app.close(),
  };
}
