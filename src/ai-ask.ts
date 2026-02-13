#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { findComplexityHotspots, generateComplexityReport } from './analyzers/complexity.js';
import { loadGraph } from './graph/persistence.js';
import type { ComplexityHotspot } from './graph/types.js';
import { analyzeHotspots, type Hotspot } from './hotspots.js';

interface AskOptions {
  context?: string;
  verbose?: boolean;
}

/**
 * Check if GitHub Copilot CLI is installed
 */
function checkCopilotCLI(): boolean {
  const result = spawnSync('copilot', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Gather context from Specter's analysis data
 */
async function gatherSpecterContext(rootDir: string, query: string): Promise<string> {
  const contextParts: string[] = [];

  try {
    // Load knowledge graph
    const graph = await loadGraph(rootDir);
    if (!graph) {
      contextParts.push('\nNo analysis data available. Run `specter scan` first.');
      return contextParts.join('\n');
    }

    contextParts.push(`\n## Codebase Structure`);
    const nodeCount = Object.keys(graph.nodes || {}).length;
    contextParts.push(`Total nodes: ${nodeCount}`);

    // Check for hotspots if query mentions them
    if (query.toLowerCase().includes('hotspot') || query.toLowerCase().includes('complex')) {
      contextParts.push(`\n## Code Hotspots`);
      const hotspotsResult = await analyzeHotspots(rootDir, graph, { top: 5 });
      if (hotspotsResult?.hotspots) {
        hotspotsResult.hotspots.forEach((h: Hotspot, i: number) => {
          contextParts.push(`${i + 1}. ${h.file} - ${h.churn} changes`);
        });
      }
    }

    // Check for complexity data
    if (query.toLowerCase().includes('complexity') || query.toLowerCase().includes('refactor')) {
      contextParts.push(`\n## Complexity Analysis`);
      // Generate report for side effects, use hotspots for display
      generateComplexityReport(graph);
      const hotspots = findComplexityHotspots(graph, { limit: 5 });
      hotspots.forEach((c: ComplexityHotspot, i: number) => {
        contextParts.push(`${i + 1}. ${c.name} - Complexity: ${c.complexity}`);
      });
    }
  } catch (error) {
    // Context gathering is optional
    if (error instanceof Error) {
      contextParts.push(`Note: Some context unavailable - ${error.message}`);
    }
  }

  return contextParts.length > 0 ? contextParts.join('\n') : '';
}

/**
 * Main ask command - uses GitHub Copilot CLI with Specter context
 */
export async function askQuestion(
  question: string,
  rootDir: string,
  options: AskOptions
): Promise<void> {
  const spinner = ora('Thinking...').start();

  try {
    // Check if Copilot CLI is installed
    if (!checkCopilotCLI()) {
      spinner.fail('GitHub Copilot CLI not found');
      console.log(chalk.yellow('\n⚠️  GitHub Copilot CLI is required for this command.'));
      console.log(chalk.white('Install it with:'));
      console.log(chalk.cyan('  npm install -g @github/copilot\n'));
      process.exit(1);
    }

    // Gather context from Specter's analysis
    spinner.text = 'Gathering codebase context...';
    const specterContext = await gatherSpecterContext(rootDir, question);

    // Build enhanced prompt with context
    const enhancedPrompt = specterContext
      ? `${question}\n\nCodebase Context:${specterContext}`
      : question;

    spinner.text = 'Asking GitHub Copilot...';

    // Call GitHub Copilot CLI (using non-interactive mode with -p flag)
    try {
      // Use spawnSync with argument array to avoid shell injection
      const result = spawnSync('copilot', ['-p', enhancedPrompt, '--allow-all-tools'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootDir,
        timeout: 30000, // 30 second timeout
      });

      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(result.stderr || 'Copilot failed');

      spinner.succeed('Answer ready');
      console.log(`\n${chalk.bold.cyan('🤖 GitHub Copilot says:\n')}`);
      console.log(result.stdout);

      if (options.verbose && specterContext) {
        console.log(chalk.dim('\n📊 Context used:'));
        console.log(chalk.dim(specterContext));
      }
    } catch (_error) {
      // If copilot fails, provide a helpful response with our data
      spinner.warn('Copilot unavailable, using Specter analysis');
      console.log(`\n${chalk.bold.cyan('📊 Based on Specter analysis:\n')}`);

      if (specterContext) {
        console.log(specterContext);
      } else {
        console.log(chalk.yellow('Run `specter scan` first to analyze your codebase.'));
      }
    }
  } catch (error) {
    spinner.fail('Failed to process question');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

/**
 * Register the ask command
 */
export function registerAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('Ask questions about your codebase using AI (powered by GitHub Copilot CLI)')
    .option(
      '-c, --context <type>',
      'Focus on specific context (hotspots, complexity, dependencies)'
    )
    .option('-v, --verbose', 'Show detailed context used for the answer')
    .action(async (question: string, options: AskOptions) => {
      const rootDir = resolve(options.context || process.cwd());
      await askQuestion(question, rootDir, options);
    });
}

/**
 * Example questions:
 * - specter ask "What are the most complex files in this codebase?"
 * - specter ask "Which files change together most often?"
 * - specter ask "Who should review changes to the auth module?"
 * - specter ask "Why is this file a hotspot?"
 * - specter ask "What are the main architectural problems?"
 */
