/**
 * Standup command - generate standup notes
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatStandup, generateStandup } from '../../standup.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('standup')
    .description('Generate standup notes based on recent activity')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <date>', 'Start date for activity', 'yesterday')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Generating standup notes...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('standup', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await generateStandup(rootDir, graph, { since: options.since });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('standup', result);
        return;
      }

      const output = formatStandup(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('STANDUP') || line.includes('📋')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('Done') || line.includes('Completed')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('In Progress') || line.includes('Working')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('Blocked') || line.includes('Issues')) {
          console.log(chalk.bold.red(`  ${line}`));
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
