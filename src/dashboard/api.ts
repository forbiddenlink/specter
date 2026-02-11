/**
 * Dashboard REST API
 *
 * API endpoints for the web dashboard.
 */

import type { FastifyInstance } from 'fastify';
import { loadGraph } from '../graph/persistence.js';
import { loadSnapshots } from '../history/storage.js';
import { analyzeTrends } from '../history/trends.js';
import * as getCodebaseSummary from '../tools/get-codebase-summary.js';
import * as getComplexityHotspots from '../tools/get-complexity-hotspots.js';

export function registerApiRoutes(app: FastifyInstance, rootDir: string): void {
  // GET /api/graph - Full graph for visualization
  app.get('/api/graph', async (_request, reply) => {
    const graph = await loadGraph(rootDir);
    if (!graph) {
      return reply.code(404).send({ error: 'No graph found' });
    }
    // Return nodes and edges formatted for Cytoscape.js
    return {
      nodes: Object.values(graph.nodes).map(n => ({
        data: {
          id: n.id,
          label: n.name,
          type: n.type,
          filePath: n.filePath,
          complexity: n.complexity || 0,
          lineStart: n.lineStart,
          lineEnd: n.lineEnd,
        }
      })),
      edges: graph.edges.map(e => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        }
      })),
    };
  });

  // GET /api/summary - Codebase stats
  app.get('/api/summary', async (_request, reply) => {
    const graph = await loadGraph(rootDir);
    if (!graph) return reply.code(404).send({ error: 'No graph found' });
    return getCodebaseSummary.execute(graph);
  });

  // GET /api/health - Health score and metrics
  app.get('/api/health', async (_request, reply) => {
    const graph = await loadGraph(rootDir);
    if (!graph) return reply.code(404).send({ error: 'No graph found' });
    const hotspots = getComplexityHotspots.execute(graph, { limit: 10 });
    // Calculate health score
    const avgComplexity = hotspots.hotspots.length > 0
      ? hotspots.hotspots.reduce((sum, h) => sum + h.complexity, 0) / hotspots.hotspots.length
      : 0;
    const healthScore = Math.max(0, Math.round(100 - avgComplexity * 3));
    return {
      score: healthScore,
      grade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
      metrics: graph.metadata,
      hotspots: hotspots.hotspots.slice(0, 5),
    };
  });

  // GET /api/hotspots - Complexity hotspots
  app.get('/api/hotspots', async (_request, reply) => {
    const graph = await loadGraph(rootDir);
    if (!graph) return reply.code(404).send({ error: 'No graph found' });
    return getComplexityHotspots.execute(graph, { limit: 20 });
  });

  // GET /api/trends - Historical trends
  app.get('/api/trends', async () => {
    const snapshots = await loadSnapshots(rootDir);
    return analyzeTrends(snapshots);
  });

  // GET /api/file/:path - File details
  app.get('/api/file/*', async (request, reply) => {
    const filePath = (request.params as { '*': string })['*'];
    const graph = await loadGraph(rootDir);
    if (!graph) return reply.code(404).send({ error: 'No graph found' });

    const node = Object.values(graph.nodes).find(n => n.filePath === filePath && n.type === 'file');
    if (!node) return reply.code(404).send({ error: 'File not found' });

    const related = graph.edges.filter(e => e.source === node.id || e.target === node.id);
    return { file: node, edges: related };
  });
}
