#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { findComplexityHotspots, generateComplexityReport } from './analyzers/complexity.js';
import { loadGraph } from './graph/persistence.js';
import { analyzeHotspots } from './hotspots.js';

interface ExplainOptions {
  lines?: string;
  suggestions?: boolean;
}

/**
 * Check if GitHub Copilot CLI is installed
 */
function checkCopilotCLI(): boolean {
  const result = spawnSync('copilot', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Analyze why a file is a hotspot
 */
async function analyzeHotspotReason(filePath: string, rootDir: string): Promise<string> {
  const relativePath = relative(rootDir, filePath);
  const reasons: string[] = [];

  try {
    // Load knowledge graph
    const graph = await loadGraph(rootDir);
    if (!graph) {
      return '\nNo analysis data available. Run `specter scan` first.';
    }

    // Check if it appears in hotspots analysis
    const hotspotsResult = await analyzeHotspots(rootDir, graph, { top: 20 });
    if (hotspotsResult?.hotspots) {
      const hotspot = hotspotsResult.hotspots.find((h) => h.file === relativePath);

      if (hotspot) {
        reasons.push(`📈 Change frequency: ${hotspot.churn} changes`);
        if (hotspot.complexity) {
          reasons.push(`🔧 Complexity: ${hotspot.complexity}`);
        }
      }
    }

    // Check complexity
    const _complexityReport = generateComplexityReport(graph);
    const complexFiles = findComplexityHotspots(graph, { limit: 20 });
    const complexFile = complexFiles.find((c) => c.filePath === relativePath);

    if (complexFile) {
      reasons.push(`🧮 Cyclomatic complexity: ${complexFile.complexity}`);

      if (complexFile.complexity > 20) {
        reasons.push('⚠️  High complexity - difficult to understand and test');
      }
    }

    return reasons.length > 0
      ? `\n## Why this is a hotspot:\n${reasons.join('\n')}`
      : '\nNo hotspot data available. Run `specter scan` first.';
  } catch (_error) {
    return '\nCould not analyze hotspot metrics.';
  }
}

/**
 * Explain a code hotspot using AI
 */
export async function explainHotspot(
  filePath: string,
  rootDir: string,
  options: ExplainOptions
): Promise<void> {
  const spinner = ora('Analyzing hotspot...').start();

  try {
    // Resolve file path
    const fullPath = resolve(rootDir, filePath);

    if (!existsSync(fullPath)) {
      spinner.fail('File not found');
      console.error(chalk.red(`Error: ${filePath} does not exist`));
      process.exit(1);
    }

    // Gather hotspot metrics
    spinner.text = 'Gathering metrics...';
    const hotspotAnalysis = await analyzeHotspotReason(fullPath, rootDir);

    // Check if Copilot CLI is available
    if (!checkCopilotCLI()) {
      spinner.warn('GitHub Copilot CLI not found');
      console.log(chalk.yellow('\n⚠️  GitHub Copilot CLI is recommended for AI explanations.'));
      console.log(chalk.white('Install it with:'));
      console.log(chalk.cyan('  npm install -g @github/copilot\n'));
      console.log(chalk.bold('📊 Hotspot Analysis:\n'));
      console.log(hotspotAnalysis);
      return;
    }

    // Read file content (limit to specified lines if provided)
    let fileContent = readFileSync(fullPath, 'utf-8');

    if (options.lines) {
      const [start, end] = options.lines.split('-').map(Number);
      const lines = fileContent.split('\n');
      fileContent = lines.slice(start - 1, end).join('\n');
    }

    // Build prompt for Copilot
    const prompt = options.suggestions
      ? `Analyze this code hotspot and suggest refactoring improvements:\n\nFile: ${filePath}\n${hotspotAnalysis}\n\nCode:\n${fileContent}`
      : `Explain why this code is complex and frequently changed:\n\nFile: ${filePath}\n${hotspotAnalysis}\n\nCode:\n${fileContent}`;

    spinner.text = 'Asking GitHub Copilot...';

    try {
      // Use spawnSync with argument array to avoid shell injection
      const spawnResult = spawnSync('copilot', ['-p', prompt, '--allow-all-tools'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootDir,
        timeout: 30000, // 30 second timeout
      });

      if (spawnResult.error) throw spawnResult.error;
      if (spawnResult.status !== 0) throw new Error(spawnResult.stderr || 'Copilot failed');

      spinner.succeed('Analysis complete');

      console.log(`\n${chalk.bold.cyan('🔍 Hotspot Analysis:\n')}`);
      console.log(hotspotAnalysis);
      console.log(`\n${chalk.bold.cyan('🤖 AI Explanation:\n')}`);
      console.log(spawnResult.stdout);

      if (options.suggestions) {
        console.log(
          '\n' +
            chalk.bold.green('💡 Tip:') +
            chalk.white(' Run ') +
            chalk.cyan(`specter suggest-refactor ${filePath}`) +
            chalk.white(' for detailed refactoring steps.')
        );
      }
    } catch (_copilotError) {
      spinner.warn('Copilot unavailable, showing metrics only');
      console.log(`\n${chalk.bold.cyan('📊 Hotspot Analysis:\n')}`);
      console.log(hotspotAnalysis);
      console.log(
        chalk.dim(
          '\nInstall GitHub Copilot CLI for AI-powered explanations: npm install -g @github/copilot'
        )
      );
    }
  } catch (error) {
    spinner.fail('Failed to analyze hotspot');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

/**
 * Register the explain-hotspot command
 */
export function registerExplainHotspotCommand(program: Command): void {
  program
    .command('explain-hotspot <file>')
    .description('Explain why a file is a hotspot using AI (powered by GitHub Copilot CLI)')
    .option('-l, --lines <range>', 'Explain specific lines (e.g., 10-50)')
    .option('-s, --suggestions', 'Include refactoring suggestions')
    .action(async (file: string, options: ExplainOptions) => {
      const rootDir = resolve(process.cwd());
      await explainHotspot(file, rootDir, options);
    });
}

/**
 * Example usage:
 * - specter explain-hotspot src/api/users.ts
 * - specter explain-hotspot src/auth.ts --suggestions
 * - specter explain-hotspot src/complex.ts --lines 100-200
 */
