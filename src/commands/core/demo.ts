/**
 * Demo command - guided showcase of Specter features
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { formatDemoSteps, runDemo } from '../../demo.js';
import { buildKnowledgeGraph } from '../../graph/builder.js';
import { graphExists, loadGraph, saveGraph } from '../../graph/persistence.js';
import type { PersonalityMode } from '../../personality/types.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('demo')
    .description('Run a guided demo showcasing Specter features (perfect for recordings)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-s, --speed <speed>', 'Demo speed: slow, normal, fast', 'normal')
    .option(
      '--steps <steps>',
      `Demo steps to run: ${formatDemoSteps()}`,
      'health,roast,horoscope,hotspots,teaser'
    )
    .option('-p, --personality <mode>', 'Personality mode for demo', 'default')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      // Check for existing graph
      const hasGraph = await graphExists(rootDir);
      if (!hasGraph) {
        console.log(chalk.yellow('No knowledge graph found. Running quick scan...'));
        const spinner = createSpinner('Scanning codebase...');
        spinner.start();

        try {
          const result = await buildKnowledgeGraph({ rootDir, includeGitHistory: true });
          await saveGraph(result.graph, rootDir);
          spinner.succeed('Scan complete');
        } catch (error) {
          spinner.fail('Scan failed');
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
          process.exit(1);
        }
      }

      // Load graph
      const graph = await loadGraph(rootDir);
      if (!graph) {
        console.error(chalk.red('Failed to load knowledge graph'));
        process.exit(1);
      }

      // Parse steps
      const steps = options.steps.split(',').map((s: string) => s.trim());

      // Run demo
      await runDemo(graph, rootDir, {
        personality: options.personality as PersonalityMode,
        speed: options.speed as 'slow' | 'normal' | 'fast',
        steps,
      });
    });
}
