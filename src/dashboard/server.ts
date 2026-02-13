/**
 * Dashboard HTTP Server
 *
 * Serves the interactive web dashboard using Fastify.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
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

  // Rate limiting to prevent abuse
  await app.register(fastifyRateLimit, {
    max: 100, // 100 requests per minute
    timeWindow: '1 minute',
  });

  // Enable CORS - restrict to localhost for security
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return cb(null, true);
      // Allow localhost origins only
      const localhostPatterns = [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/\[::1\](:\d+)?$/,
      ];
      if (localhostPatterns.some((p) => p.test(origin))) {
        return cb(null, true);
      }
      return cb(new Error('CORS not allowed'), false);
    },
  });

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
