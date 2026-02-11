#!/usr/bin/env node
/**
 * Specter MCP Server
 *
 * Model Context Protocol server that exposes the knowledge graph
 * to GitHub Copilot CLI and other MCP clients.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadGraph } from './graph/persistence.js';
import type { KnowledgeGraph } from './graph/types.js';

// Import tool implementations
import * as getFileRelationships from './tools/get-file-relationships.js';
import * as getComplexityHotspots from './tools/get-complexity-hotspots.js';
import * as getCodebaseSummary from './tools/get-codebase-summary.js';
import * as getFileHistory from './tools/get-file-history.js';
import * as getDeadCode from './tools/get-dead-code.js';
import * as searchSymbols from './tools/search-symbols.js';
import * as getCallChain from './tools/get-call-chain.js';
import * as getArchitecture from './tools/get-architecture.js';
import * as getChangeCoupling from './tools/get-change-coupling.js';
import * as getImpactAnalysis from './tools/get-impact-analysis.js';
import * as getBusFactor from './tools/get-bus-factor.js';
import * as getArchaeology from './tools/get-archaeology.js';

// Global graph cache
let cachedGraph: KnowledgeGraph | null = null;
let graphLoadError: string | null = null;

/**
 * Get or load the knowledge graph
 */
async function getGraph(): Promise<KnowledgeGraph> {
  if (cachedGraph) {
    return cachedGraph;
  }

  const cwd = process.cwd();
  const graph = await loadGraph(cwd);

  if (!graph) {
    graphLoadError = `No knowledge graph found in ${cwd}. Run 'specter scan' first.`;
    throw new Error(graphLoadError);
  }

  cachedGraph = graph;
  return graph;
}

/**
 * Create the MCP server with all tools
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: 'specter',
    version: '1.0.0',
  });

  // Tool: get_file_relationships
  server.tool(
    'get_file_relationships',
    'Get imports, exports, and dependencies for a specific file. Returns what the file imports, what imports it, and what it exports.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getFileRelationships.execute(graph, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Tool: get_complexity_hotspots
  server.tool(
    'get_complexity_hotspots',
    'Find the most complex functions and classes in the codebase. High complexity indicates code that may be difficult to understand or maintain.',
    {
      limit: z.number().optional().describe('Maximum number of hotspots to return (default: 10)'),
      threshold: z.number().optional().describe('Minimum complexity to be considered a hotspot (default: 10)'),
      includeFiles: z.boolean().optional().describe('Include file-level complexity (default: false)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getComplexityHotspots.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_codebase_summary
  server.tool(
    'get_codebase_summary',
    'Get high-level statistics and overview of the entire codebase including file count, lines of code, languages, complexity metrics, and top directories.',
    {},
    async () => {
      const graph = await getGraph();
      const result = getCodebaseSummary.execute(graph);
      return {
        content: [
          { type: 'text', text: result.personality + '\n\n' + result.summary },
        ],
      };
    }
  );

  // Tool: get_file_history
  server.tool(
    'get_file_history',
    'Get git history and change patterns for a specific file including last modified date, commit count, contributors, and churn score.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getFileHistory.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_dead_code
  server.tool(
    'get_dead_code',
    'Find exported symbols (functions, classes, variables) that are not imported anywhere in the codebase. These may be safe to remove.',
    {
      directory: z.string().optional().describe('Limit search to a specific directory'),
      limit: z.number().optional().describe('Maximum number of results (default: 20)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getDeadCode.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: search_symbols
  server.tool(
    'search_symbols',
    'Search for functions, classes, interfaces, types, and other symbols by name. Supports partial and fuzzy matching.',
    {
      query: z.string().describe('Search query (supports partial matches)'),
      type: z.enum(['function', 'class', 'interface', 'type', 'variable', 'enum', 'all']).optional().describe('Filter by symbol type (default: all)'),
      limit: z.number().optional().describe('Maximum number of results (default: 20)'),
      exportedOnly: z.boolean().optional().describe('Only show exported symbols (default: false)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = searchSymbols.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_call_chain
  server.tool(
    'get_call_chain',
    'Find the dependency path between two files or symbols. Answers "How does file A relate to file B?" or "What connects these two parts of the codebase?"',
    {
      from: z.string().describe('Starting file path or symbol name'),
      to: z.string().describe('Target file path or symbol name'),
      maxDepth: z.number().optional().describe('Maximum chain length to search (default: 5)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getCallChain.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_architecture
  server.tool(
    'get_architecture',
    'Generate a visual ASCII diagram of the codebase architecture showing directory structure, file counts, and complexity indicators.',
    {
      style: z.enum(['tree', 'boxes', 'compact']).optional().describe('Diagram style: tree (hierarchical), boxes (visual), or compact (bar chart). Default: boxes'),
      maxDepth: z.number().optional().describe('Maximum directory depth to show (default: 3)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getArchitecture.execute(graph, args);
      return {
        content: [
          { type: 'text', text: '```\n' + result.diagram + '\n```\n\n' + result.summary },
        ],
      };
    }
  );

  // Tool: get_change_coupling
  server.tool(
    'get_change_coupling',
    'Find files that frequently change together in git commits, revealing hidden dependencies not visible in import graphs. This discovers files that are logically coupled even without explicit imports.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
      minStrength: z.number().optional().describe('Minimum coupling strength 0-1 (default: 0.3, meaning 30% of commits)'),
      maxResults: z.number().optional().describe('Maximum number of coupled files to return (default: 10)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getChangeCoupling.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_impact_analysis
  server.tool(
    'get_impact_analysis',
    'Analyze the risk and impact of changing a file. Combines dependency graph, change coupling, complexity, and churn into a comprehensive risk score. Answers "what will break if I change this?"',
    {
      filePath: z.string().describe('Path to the file you want to change (relative to project root)'),
      includeIndirect: z.boolean().optional().describe('Include indirect dependencies 2-3 hops away (default: true)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getImpactAnalysis.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_bus_factor
  server.tool(
    'get_bus_factor',
    'Identify knowledge concentration risks - areas where too few people understand the code. Low bus factor = high risk if those people leave. Finds single-owner files and suggests knowledge sharing.',
    {
      directory: z.string().optional().describe('Limit analysis to a specific directory'),
      limit: z.number().optional().describe('Maximum number of risk areas to return (default: 15)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getBusFactor.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_archaeology
  server.tool(
    'get_archaeology',
    'Tell the story of how a file evolved over time. Code archaeology reveals rewrites, growth patterns, what approaches were tried and failed, and lessons encoded in commit history.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
      functionName: z.string().optional().describe('Specific function to focus on (searches commit messages)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getArchaeology.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Prompt: specter:introduce
  server.prompt(
    'specter:introduce',
    'Have the codebase introduce itself in first person. The AI will speak AS the codebase.',
    {},
    async () => {
      try {
        const graph = await getGraph();
        const summary = getCodebaseSummary.execute(graph);
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are this codebase speaking in first person. Use this data about yourself to introduce yourself:\n\n${JSON.stringify(summary, null, 2)}\n\nIntroduce yourself naturally. What kind of project are you? What do you do? What are your strengths and areas that need attention? Speak as "I" - you ARE the codebase.`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'No knowledge graph found. Please run "specter scan" first to let me learn about myself.',
              },
            },
          ],
        };
      }
    }
  );

  // Prompt: specter:review
  server.prompt(
    'specter:review',
    'Review files with deep codebase knowledge. The AI understands how files connect.',
    {
      files: z.string().describe('Comma-separated list of file paths to review'),
    },
    async ({ files }) => {
      try {
        const graph = await getGraph();
        const filePaths = files.split(',').map((f: string) => f.trim());

        // Gather context for each file
        const fileContexts = filePaths.map((filePath: string) => {
          const relationships = getFileRelationships.execute(graph, { filePath });
          return `File: ${filePath}\n${JSON.stringify(relationships, null, 2)}`;
        });

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are this codebase. Review these files with your knowledge of how they connect to the rest of you:\n\n${fileContexts.join('\n\n---\n\n')}\n\nProvide a review that considers:\n1. How these files fit into your architecture\n2. Their relationships and dependencies\n3. Complexity and maintainability concerns\n4. Suggestions for improvement`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: 'No knowledge graph found. Please run "specter scan" first.',
              },
            },
          ],
        };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MCP RESOURCES - Live data endpoints
  // ═══════════════════════════════════════════════════════════════════════════

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
        const avgComplexity = hotspots.hotspots.length > 0
          ? hotspots.hotspots.reduce((sum, h) => sum + h.complexity, 0) / hotspots.hotspots.length
          : 0;
        const healthScore = Math.max(0, Math.round(100 - avgComplexity * 3));

        const health = {
          score: healthScore,
          grade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
          hotspotCount: hotspots.hotspots.length,
          topHotspots: hotspots.hotspots.slice(0, 5).map(h => ({
            file: h.filePath,
            name: h.name,
            complexity: h.complexity,
          })),
          recommendation: healthScore >= 80
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
