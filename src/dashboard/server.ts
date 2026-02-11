/**
 * Dashboard HTTP Server
 *
 * Serves the interactive web dashboard using Fastify.
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerApiRoutes } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DashboardOptions {
  port?: number;
  host?: string;
  rootDir: string;
}

export async function startDashboard(options: DashboardOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const { port = 3333, host = 'localhost', rootDir } = options;

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
