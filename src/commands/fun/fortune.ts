/**
 * Fortune command - fortune cookie style messages
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { formatReading, generateReading } from '../../fortune.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('fortune')
    .description('Get a fortune cookie reading for your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('fortune', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const reading = generateReading(graph);

      // JSON output for CI/CD
      if (options.json) {
        outputJson('fortune', reading);
        return;
      }

      const output = formatReading(reading);

      console.log();
      console.log(chalk.bold.yellow(`  ${'─'.repeat(50)}`));
      for (const line of output.split('\n')) {
        if (line.includes('🥠')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.startsWith('"')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.includes('Lucky')) {
          console.log(chalk.green(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log(chalk.bold.yellow(`  ${'─'.repeat(50)}`));
      console.log();
    });
}
