/**
 * Why command - explain why a file exists
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { explainWhy, formatWhy } from '../../why.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('why <file>')
    .description('Explain why a file exists based on history, comments, and patterns')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Analyzing file purpose...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('why', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await explainWhy(rootDir, file, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('why', result);
        return;
      }

      const output = formatWhy(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('WHY DOES THIS EXIST')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('File:')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (
          line.startsWith('ORIGIN') ||
          line.startsWith('AUTHOR') ||
          line.startsWith('CONNECTIONS') ||
          line.startsWith('PATTERNS') ||
          line.startsWith('MAJOR') ||
          line.startsWith('SUGGESTIONS')
        ) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.startsWith('-'.repeat(10)) || line.startsWith('='.repeat(10))) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Created:')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('   "')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.startsWith('   *')) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.startsWith('     -')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('   !')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('FILE NOT FOUND')) {
          console.log(chalk.red(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
