/**
 * Velocity command - Team velocity metrics
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { analyzeVelocity, formatVelocity } from '../../velocity.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('velocity')
    .description('Analyze team velocity and productivity metrics')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <period>', 'Time period to analyze', '30 days ago')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Analyzing velocity...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('velocity', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await analyzeVelocity(rootDir, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('velocity', result);
        return;
      }

      const output = formatVelocity(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('VELOCITY')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('↑') || line.includes('improving')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('↓') || line.includes('declining')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
