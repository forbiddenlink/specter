/**
 * MCP Tool Registrations
 *
 * Registers all Specter tools with the MCP server.
 * Each tool exposes a specific analysis capability.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as getArchaeology from '../tools/get-archaeology.js';
import * as getArchitecture from '../tools/get-architecture.js';
import * as getBusFactor from '../tools/get-bus-factor.js';
import * as getCallChain from '../tools/get-call-chain.js';
import * as getChangeCoupling from '../tools/get-change-coupling.js';
import * as getCodebaseSummary from '../tools/get-codebase-summary.js';
import * as getComplexityHotspots from '../tools/get-complexity-hotspots.js';
import * as getDeadCode from '../tools/get-dead-code.js';
import * as getFileHistory from '../tools/get-file-history.js';
import * as getFileRelationships from '../tools/get-file-relationships.js';
import * as getHealthTrends from '../tools/get-health-trends.js';
import * as getImpactAnalysis from '../tools/get-impact-analysis.js';
import * as getRiskScore from '../tools/get-risk-score.js';
import * as searchSymbols from '../tools/search-symbols.js';
import { executeTool, getGraph } from './core.js';

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer): void {
  // Tool: get_file_relationships
  server.tool(
    'get_file_relationships',
    'Get imports, exports, and dependencies for a specific file. Returns what the file imports, what imports it, and what it exports.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
    },
    async (args) => {
      try {
        const graph = await getGraph();
        const result = await executeTool('get_file_relationships', async () =>
          getFileRelationships.execute(graph, args)
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing file relationships: ${message}\n\nPlease ensure:\n1. You've run 'specter scan' in your project directory\n2. The file path is correct and relative to project root\n3. The file exists in the scanned codebase`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_complexity_hotspots
  server.tool(
    'get_complexity_hotspots',
    'Find the most complex functions and classes in the codebase. High complexity indicates code that may be difficult to understand or maintain.',
    {
      limit: z.number().optional().describe('Maximum number of hotspots to return (default: 10)'),
      threshold: z
        .number()
        .optional()
        .describe('Minimum complexity to be considered a hotspot (default: 10)'),
      includeFiles: z
        .boolean()
        .optional()
        .describe('Include file-level complexity (default: false)'),
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
        content: [{ type: 'text', text: `${result.personality}\n\n${result.summary}` }],
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
      type: z
        .enum(['function', 'class', 'interface', 'type', 'variable', 'enum', 'all'])
        .optional()
        .describe('Filter by symbol type (default: all)'),
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
      style: z
        .enum(['tree', 'boxes', 'compact'])
        .optional()
        .describe(
          'Diagram style: tree (hierarchical), boxes (visual), or compact (bar chart). Default: boxes'
        ),
      maxDepth: z.number().optional().describe('Maximum directory depth to show (default: 3)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = getArchitecture.execute(graph, args);
      return {
        content: [{ type: 'text', text: `\`\`\`\n${result.diagram}\n\`\`\`\n\n${result.summary}` }],
      };
    }
  );

  // Tool: get_change_coupling
  server.tool(
    'get_change_coupling',
    'Find files that frequently change together in git commits, revealing hidden dependencies not visible in import graphs. This discovers files that are logically coupled even without explicit imports.',
    {
      filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
      minStrength: z
        .number()
        .optional()
        .describe('Minimum coupling strength 0-1 (default: 0.3, meaning 30% of commits)'),
      maxResults: z
        .number()
        .optional()
        .describe('Maximum number of coupled files to return (default: 10)'),
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
      filePath: z
        .string()
        .describe('Path to the file you want to change (relative to project root)'),
      includeIndirect: z
        .boolean()
        .optional()
        .describe('Include indirect dependencies 2-3 hops away (default: true)'),
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
      functionName: z
        .string()
        .optional()
        .describe('Specific function to focus on (searches commit messages)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getArchaeology.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_health_trends
  server.tool(
    'get_health_trends',
    'Analyze how the codebase health has changed over time. Shows trends in complexity, hotspots, and overall health score with sparkline visualizations. Useful for tracking technical debt.',
    {
      period: z
        .enum(['day', 'week', 'month', 'all'])
        .optional()
        .describe('Time period to analyze: day, week, month, or all (default: all)'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getHealthTrends.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );

  // Tool: get_risk_score
  server.tool(
    'get_risk_score',
    'Analyze the risk of staged changes, a branch, or a specific commit. Evaluates multiple factors including files changed, complexity, dependencies, bus factor, and test coverage to provide an overall risk score and recommendations.',
    {
      staged: z.boolean().optional().describe('Analyze staged changes (default: true)'),
      branch: z.string().optional().describe('Compare against this branch (e.g., "main")'),
      commit: z.string().optional().describe('Analyze a specific commit hash'),
    },
    async (args) => {
      const graph = await getGraph();
      const result = await getRiskScore.execute(graph, args);
      return {
        content: [{ type: 'text', text: result.summary }],
      };
    }
  );
}
