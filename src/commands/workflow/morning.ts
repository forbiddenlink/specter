/**
 * Morning command - daily standup summary
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatMorning, generateMorning } from '../../morning.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('morning')
    .description('Get your morning standup summary')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Preparing your morning summary...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('morning', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await generateMorning(graph, rootDir);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('morning', result);
        return;
      }

      const output = formatMorning(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('GOOD MORNING') || line.includes('☀️')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('Yesterday') || line.includes('Today')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('✅') || line.includes('completed')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('⚠️') || line.includes('attention')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
