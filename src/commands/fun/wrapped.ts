/**
 * Wrapped command - Year in review for your codebase
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatWrapped, gatherWrappedData, type WrappedPeriod } from '../../wrapped.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('wrapped')
    .description('Get your codebase year in review (Spotify Wrapped style)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--period <period>', 'Time period: year, quarter, month', 'year')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const period = options.period as WrappedPeriod;

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('wrapped', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Generating your wrapped...');
      spinner?.start();

      const data = await gatherWrappedData(graph, rootDir, { period });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('wrapped', data);
        return;
      }

      const output = formatWrapped(data);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('WRAPPED') || line.includes('🎁')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('Top') || line.includes('#1')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('🏆') || line.includes('🥇')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
