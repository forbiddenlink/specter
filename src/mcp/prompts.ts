/**
 * MCP Prompt Registrations
 *
 * Registers all Specter prompts with the MCP server.
 * Prompts provide pre-built interaction patterns for AI assistants.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as getArchitecture from '../tools/get-architecture.js';
import * as getBusFactor from '../tools/get-bus-factor.js';
import * as getCodebaseSummary from '../tools/get-codebase-summary.js';
import * as getComplexityHotspots from '../tools/get-complexity-hotspots.js';
import * as getDeadCode from '../tools/get-dead-code.js';
import * as getFileRelationships from '../tools/get-file-relationships.js';
import * as getHealthTrends from '../tools/get-health-trends.js';
import { getGraph } from './core.js';

/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server: McpServer): void {
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

  // Prompt: specter:onboard
  server.prompt(
    'specter:onboard',
    'Explain this codebase to a new developer. Provides a comprehensive overview of architecture, key files, and conventions.',
    {
      focusArea: z
        .string()
        .optional()
        .describe(
          'Specific area to focus on (e.g., "auth", "api", "database"). If omitted, gives a full overview.'
        ),
    },
    async ({ focusArea }) => {
      try {
        const graph = await getGraph();
        const summary = getCodebaseSummary.execute(graph);
        const architecture = getArchitecture.execute(graph, { style: 'tree', maxDepth: 3 });
        const hotspots = getComplexityHotspots.execute(graph, { limit: 5 });
        const deadCode = getDeadCode.execute(graph, { limit: 5 });

        const focusClause = focusArea
          ? `\n\nThe developer is specifically interested in the "${focusArea}" area. Prioritize information about files, modules, and patterns related to "${focusArea}".`
          : '';

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `You are onboarding a new developer to this codebase. Give them a comprehensive, friendly walkthrough using the following data from Specter's knowledge graph.

**Codebase Summary:**
${JSON.stringify(summary, null, 2)}

**Architecture:**
\`\`\`
${architecture.diagram}
\`\`\`
${architecture.summary}

**Complexity Hotspots (files they should approach carefully):**
${hotspots.summary}

**Potential Dead Code (exports with no importers):**
${deadCode.summary}
${focusClause}

Structure your response as:
1. **What this project does** - high-level purpose and tech stack
2. **How the code is organized** - directory structure and key modules
3. **Entry points** - where to start reading the code
4. **Key patterns and conventions** - coding patterns used throughout
5. **Watch out for** - complex areas, known hotspots, and gotchas
6. **First tasks** - suggested low-risk areas for a first contribution`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'No knowledge graph found. Please run "specter scan" first to build the codebase graph.',
              },
            },
          ],
        };
      }
    }
  );

  // Prompt: specter:refactor-plan
  server.prompt(
    'specter:refactor-plan',
    'Create a refactoring plan for the most complex files. Identifies hotspots and produces an actionable, prioritized plan.',
    {
      directory: z
        .string()
        .optional()
        .describe('Limit refactoring scope to a specific directory (e.g., "src/api")'),
      maxFiles: z
        .number()
        .optional()
        .describe('Maximum number of files to include in the plan (default: 5)'),
    },
    async ({ directory, maxFiles }) => {
      try {
        const graph = await getGraph();
        const limit = maxFiles ? Number(maxFiles) : 5;
        const hotspots = getComplexityHotspots.execute(graph, {
          limit,
          threshold: 8,
          includeFiles: true,
        });
        const busFactor = await getBusFactor.execute(graph, { directory, limit });

        // Gather relationships for top hotspot files to understand coupling
        const hotspotFiles = [...new Set(hotspots.hotspots.map((h) => h.filePath))].slice(0, limit);
        const relationshipDetails = hotspotFiles.map((filePath) => {
          const relationships = getFileRelationships.execute(graph, { filePath });
          return `**${filePath}**:\n${JSON.stringify(relationships, null, 2)}`;
        });

        const dirClause = directory
          ? `Focus the plan only on files within the "${directory}" directory.`
          : 'Consider the entire codebase.';

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Create a detailed, actionable refactoring plan for this codebase. ${dirClause}

**Complexity Hotspots (ranked by severity):**
${hotspots.summary}

**Bus Factor Risks (knowledge concentration):**
${busFactor.summary}

**Dependency Details for Top Hotspot Files:**
${relationshipDetails.join('\n\n---\n\n')}

For each file in the plan, provide:
1. **File** - path and current complexity score
2. **Why it needs refactoring** - specific problems (too many responsibilities, deep nesting, god function, etc.)
3. **Proposed changes** - concrete refactoring steps (extract function, split module, introduce interface, etc.)
4. **Risk assessment** - what could break, how many dependents are affected
5. **Estimated effort** - small/medium/large
6. **Priority** - P0 (do now) through P3 (nice to have)

Order the plan by priority. Include a summary at the top with total estimated effort and expected health improvement.`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'No knowledge graph found. Please run "specter scan" first to build the codebase graph.',
              },
            },
          ],
        };
      }
    }
  );

  // Prompt: specter:standup-summary
  server.prompt(
    'specter:standup-summary',
    'Summarize recent changes for a standup. Leverages git history and change patterns to produce a concise update.',
    {
      period: z
        .enum(['day', 'week', 'month'])
        .optional()
        .describe('Time range for the summary (default: day)'),
      author: z.string().optional().describe('Filter to a specific git author name or email'),
    },
    async ({ period, author }) => {
      try {
        const graph = await getGraph();
        const timePeriod = period || 'day';
        const healthTrends = await getHealthTrends.execute(graph, { period: timePeriod });
        const summary = getCodebaseSummary.execute(graph);

        const authorClause = author ? `\n\nFocus specifically on changes made by "${author}".` : '';

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Generate a concise standup summary for the past ${timePeriod} of work on this codebase.

**Codebase Overview:**
${summary.summary}

**Health Trends (${timePeriod}):**
${healthTrends.summary}
${authorClause}

Format the standup as:
- **What was done** - key changes, files modified, features added or bugs fixed (infer from file names and change patterns)
- **Health impact** - did complexity go up or down? Any new hotspots introduced?
- **What's next** - based on current trends, what should be prioritized (e.g., growing hotspots, files with increasing churn)
- **Blockers/Risks** - any concerning trends (rapidly increasing complexity, bus factor risks)

Keep it concise - this should be readable in under 2 minutes. Use bullet points.`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'No knowledge graph found. Please run "specter scan" first to build the codebase graph.',
              },
            },
          ],
        };
      }
    }
  );

  // Prompt: specter:health-check
  server.prompt(
    'specter:health-check',
    'Analyze the health of this codebase and suggest improvements. Comprehensive analysis covering complexity, dependencies, knowledge risks, and dead code.',
    {
      severity: z
        .enum(['all', 'critical', 'actionable'])
        .optional()
        .describe(
          'Filter findings by severity: "all" for everything, "critical" for urgent issues only, "actionable" for issues with clear fixes (default: actionable)'
        ),
    },
    async ({ severity }) => {
      try {
        const graph = await getGraph();
        const filter = severity || 'actionable';
        const summary = getCodebaseSummary.execute(graph);
        const hotspots = getComplexityHotspots.execute(graph, { limit: 10, threshold: 8 });
        const deadCode = getDeadCode.execute(graph, { limit: 10 });
        const busFactor = await getBusFactor.execute(graph, { limit: 10 });
        const healthTrends = await getHealthTrends.execute(graph, { period: 'all' });
        const architecture = getArchitecture.execute(graph, { style: 'compact', maxDepth: 2 });

        const severityClause =
          filter === 'critical'
            ? 'Only report critical issues that need immediate attention - ignore minor concerns.'
            : filter === 'actionable'
              ? 'Focus on issues that have clear, actionable fixes. Skip vague or low-impact concerns.'
              : 'Report all findings regardless of severity.';

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Perform a comprehensive health check on this codebase. ${severityClause}

**Codebase Summary:**
${summary.summary}

**Architecture Overview:**
\`\`\`
${architecture.diagram}
\`\`\`

**Complexity Hotspots:**
${hotspots.summary}

**Dead Code (unused exports):**
${deadCode.summary}

**Bus Factor / Knowledge Risks:**
${busFactor.summary}

**Health Trends Over Time:**
${healthTrends.summary}

Structure your analysis as a health report:

1. **Overall Health Grade** - A through F with a one-line justification
2. **Vital Signs** - key metrics (complexity, file count, hotspot count, bus factor score)
3. **Diagnosis** - what's going well and what's concerning, organized by category:
   - Complexity & Maintainability
   - Architecture & Dependencies
   - Knowledge Distribution
   - Code Hygiene (dead code, conventions)
4. **Treatment Plan** - prioritized list of improvements, each with:
   - What to do
   - Why it matters
   - Estimated effort (small/medium/large)
5. **Prognosis** - based on trends, is this codebase getting healthier or sicker over time?

Be direct and specific. Reference actual file names and metrics from the data above.`,
              },
            },
          ],
        };
      } catch {
        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: 'No knowledge graph found. Please run "specter scan" first to build the codebase graph.',
              },
            },
          ],
        };
      }
    }
  );
}
