/**
 * Reviewers command - suggest PR reviewers
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatReviewers, suggestReviewers } from '../../reviewers.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('reviewers')
    .description('Suggest reviewers for staged changes based on file expertise')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Finding reviewers...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('reviewers', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await suggestReviewers(rootDir, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('reviewers', result);
        return;
      }

      const output = formatReviewers(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('PRIMARY')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('BACKUP')) {
          console.log(chalk.bold.blue(`  ${line}`));
        } else if (line.includes('OPTIONAL')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('WARNINGS')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('RECOMMENDATIONS')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Score:')) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.startsWith('  •')) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
