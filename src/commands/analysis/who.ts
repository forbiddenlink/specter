/**
 * Who command - find out who knows the most about a file
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { findExperts, formatWho } from '../../who.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('who <file>')
    .description('Find out who knows the most about a file')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Finding experts...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('who', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await findExperts(rootDir, file, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('who', result);
        return;
      }

      const output = formatWho(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('+') || line.includes('|')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('-'.repeat(10))) {
          console.log(chalk.dim.cyan(`  ${line}`));
        } else if (line.startsWith('File:')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (
          line.startsWith('EXPERTS') ||
          line.startsWith('RELATED') ||
          line.startsWith('SUGGESTIONS')
        ) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.startsWith('-')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Primary')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('Tip:')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.includes('Warning:')) {
          console.log(chalk.yellow(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
