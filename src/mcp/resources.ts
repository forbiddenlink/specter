/**
 * MCP Resource Registrations
 *
 * Registers all Specter resources with the MCP server.
 * Resources provide live data endpoints for AI assistants.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as getCodebaseSummary from '../tools/get-codebase-summary.js';
import * as getComplexityHotspots from '../tools/get-complexity-hotspots.js';
import { getGraph } from './core.js';

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: McpServer): void {
  // Resource: specter://summary - Live codebase summary
  server.resource(
    'specter://summary',
    'Live codebase summary with statistics and personality',
    async (uri) => {
      try {
        const graph = await getGraph();
        const result = getCodebaseSummary.execute(graph);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: 'No knowledge graph available. Run "specter scan" first.',
            },
          ],
        };
      }
    }
  );

  // Resource: specter://health - Current health score and metrics
  server.resource(
    'specter://health',
    'Current codebase health score and complexity metrics',
    async (uri) => {
      try {
        const graph = await getGraph();
        const hotspots = getComplexityHotspots.execute(graph, { limit: 10 });

        // Calculate health score
        const avgComplexity =
          hotspots.hotspots.length > 0
            ? hotspots.hotspots.reduce((sum, h) => sum + h.complexity, 0) / hotspots.hotspots.length
            : 0;
        const healthScore = Math.max(0, Math.round(100 - avgComplexity * 3));

        const health = {
          score: healthScore,
          grade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
          hotspotCount: hotspots.hotspots.length,
          topHotspots: hotspots.hotspots.slice(0, 5).map((h) => ({
            file: h.filePath,
            name: h.name,
            complexity: h.complexity,
          })),
          recommendation:
            healthScore >= 80
              ? "I'm in great shape!"
              : healthScore >= 60
                ? 'Some areas could use refactoring.'
                : 'I have significant complexity issues that need attention.',
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(health, null, 2),
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: 'No knowledge graph available. Run "specter scan" first.',
            },
          ],
        };
      }
    }
  );

  // Resource: specter://hotspots - Complexity hotspots
  server.resource(
    'specter://hotspots',
    'List of complexity hotspots that need attention',
    async (uri) => {
      try {
        const graph = await getGraph();
        const result = getComplexityHotspots.execute(graph, { limit: 20, threshold: 8 });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(result.hotspots, null, 2),
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: 'No knowledge graph available. Run "specter scan" first.',
            },
          ],
        };
      }
    }
  );

  // Resource: specter://architecture - Directory structure overview
  server.resource(
    'specter://architecture',
    'High-level architecture and directory structure',
    async (uri) => {
      try {
        const graph = await getGraph();

        // Build directory statistics
        const dirStats = new Map<string, { files: number; lines: number; avgComplexity: number }>();

        for (const node of Object.values(graph.nodes)) {
          if (node.type === 'file') {
            const parts = node.filePath.split('/');
            const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

            if (!dirStats.has(dir)) {
              dirStats.set(dir, { files: 0, lines: 0, avgComplexity: 0 });
            }
            const stats = dirStats.get(dir)!;
            stats.files++;
            stats.lines += node.lineEnd || 0;
          }
        }

        const architecture = {
          rootDir: graph.metadata.rootDir,
          totalFiles: graph.metadata.fileCount,
          totalLines: graph.metadata.totalLines,
          directories: Array.from(dirStats.entries())
            .map(([path, stats]) => ({ path, ...stats }))
            .sort((a, b) => b.files - a.files)
            .slice(0, 10),
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(architecture, null, 2),
            },
          ],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'text/plain',
              text: 'No knowledge graph available. Run "specter scan" first.',
            },
          ],
        };
      }
    }
  );
}
