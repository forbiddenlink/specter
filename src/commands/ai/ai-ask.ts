/**
 * AI Ask command - AI-powered codebase Q&A
 *
 * Without --ai flag: Uses GitHub Copilot CLI (fast, requires Copilot)
 * With --ai flag: Uses Claude AI via Anthropic API (enhanced reasoning)
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { isAIEnabled, reasonAboutCode } from '../../ai/claude-client.js';
import { askQuestion as askWithCopilot } from '../../ai-ask.js';
import { findComplexityHotspots, generateComplexityReport } from '../../analyzers/complexity.js';
import { loadGraph } from '../../graph/persistence.js';
import type { ComplexityHotspot } from '../../graph/types.js';
import { analyzeHotspots, type Hotspot } from '../../hotspots.js';

interface AskOptions {
  dir: string;
  context?: string;
  verbose?: boolean;
  ai?: boolean;
}

/**
 * Gather context from Specter's analysis data for Claude
 */
async function gatherSpecterContext(rootDir: string, query: string): Promise<string> {
  const contextParts: string[] = [];

  try {
    const graph = await loadGraph(rootDir);
    if (!graph) {
      return 'No analysis data available. Run `specter scan` first to analyze the codebase.';
    }

    contextParts.push('## Codebase Analysis Data');
    const nodeCount = Object.keys(graph.nodes || {}).length;
    contextParts.push(`Total code nodes analyzed: ${nodeCount}`);

    // Include hotspots context
    if (query.toLowerCase().includes('hotspot') || query.toLowerCase().includes('complex')) {
      contextParts.push('\n## Code Hotspots (files with high churn)');
      const hotspotsResult = await analyzeHotspots(rootDir, graph, { top: 10 });
      if (hotspotsResult?.hotspots) {
        hotspotsResult.hotspots.forEach((h: Hotspot, i: number) => {
          contextParts.push(`${i + 1}. ${h.file} - ${h.churn} changes`);
        });
      }
    }

    // Include complexity context
    if (query.toLowerCase().includes('complexity') || query.toLowerCase().includes('refactor')) {
      contextParts.push('\n## Complexity Analysis');
      generateComplexityReport(graph);
      const hotspots = findComplexityHotspots(graph, { limit: 10 });
      hotspots.forEach((c: ComplexityHotspot, i: number) => {
        contextParts.push(`${i + 1}. ${c.name} - Complexity score: ${c.complexity}`);
      });
    }

    // Add dependency information if asked about dependencies or architecture
    if (
      query.toLowerCase().includes('depend') ||
      query.toLowerCase().includes('import') ||
      query.toLowerCase().includes('architecture')
    ) {
      contextParts.push('\n## Dependency Overview');
      const edges = Object.values(graph.edges || {});
      contextParts.push(`Total dependency relationships: ${edges.length}`);

      // Find most connected modules
      const connectionCount: Record<string, number> = {};
      edges.forEach((edge) => {
        connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
        connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
      });
      const topConnected = Object.entries(connectionCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      if (topConnected.length > 0) {
        contextParts.push('Most connected modules:');
        topConnected.forEach(([name, count], i) => {
          contextParts.push(`  ${i + 1}. ${name} - ${count} connections`);
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      contextParts.push(`Note: Some context unavailable - ${error.message}`);
    }
  }

  return contextParts.join('\n');
}

/**
 * Ask a question using Claude AI with Specter context
 */
async function askWithClaude(
  question: string,
  rootDir: string,
  options: AskOptions
): Promise<void> {
  const spinner = ora('Gathering codebase context...').start();

  try {
    // Check if AI is available
    if (!isAIEnabled()) {
      spinner.fail('Claude AI not available');
      console.log(
        chalk.yellow('\nAI features require the ANTHROPIC_API_KEY environment variable.')
      );
      console.log(chalk.white('Set it with:'));
      console.log(chalk.cyan('  export ANTHROPIC_API_KEY=your-api-key\n'));
      process.exit(1);
    }

    // Gather context from Specter analysis
    const specterContext = await gatherSpecterContext(rootDir, question);

    spinner.text = 'Asking Claude...';

    // Build the prompt for Claude
    const prompt = `You are a code analysis assistant. Answer the following question about the codebase based on the analysis data provided.

Question: ${question}

Please provide a clear, actionable answer based on the codebase analysis data. If the data doesn't contain enough information to fully answer the question, say so and suggest what additional analysis might help.`;

    const response = await reasonAboutCode(prompt, specterContext);

    spinner.succeed('Answer ready');
    console.log(`\n${chalk.bold.cyan('🤖 Claude says:\n')}`);
    console.log(response);

    if (options.verbose && specterContext) {
      console.log(chalk.dim('\n📊 Context used:'));
      console.log(chalk.dim(specterContext));
    }
  } catch (error) {
    spinner.fail('Failed to process question');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

export function register(program: Command): void {
  program
    .command('ai-ask <question>')
    .description('Ask questions about your codebase using AI')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option(
      '-c, --context <type>',
      'Focus on specific context (hotspots, complexity, dependencies)'
    )
    .option('-v, --verbose', 'Show detailed context used for the answer')
    .option('--ai', 'Use Claude AI for enhanced reasoning (requires ANTHROPIC_API_KEY)')
    .action(async (question: string, options: AskOptions) => {
      const rootDir = path.resolve(options.dir);

      if (options.ai) {
        // Use Claude AI for enhanced reasoning
        await askWithClaude(question, rootDir, options);
      } else {
        // Use existing graph-based search with GitHub Copilot
        await askWithCopilot(question, rootDir, options);
      }
    });
}
