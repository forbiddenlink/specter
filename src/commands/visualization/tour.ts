/**
 * Tour command - guided codebase tour
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatTour, generateTour } from '../../tour.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('tour')
    .description('Get a guided tour of your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--focus <area>', 'Focus on specific area of the codebase')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Preparing your tour...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('tour', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = generateTour(graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('tour', result);
        return;
      }

      const output = formatTour(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('TOUR') || line.includes('🗺️')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('Stop #') || line.includes('📍')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('Key Files') || line.includes('Entry Points')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('  •') || line.startsWith('  -')) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
