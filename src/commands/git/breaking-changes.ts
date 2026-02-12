/**
 * Breaking Changes command - detect breaking changes
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { detectBreakingChanges, formatBreakingChanges } from '../../breaking-changes.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('breaking-changes [compare-to]')
    .alias('breaking')
    .description('Detect potential breaking changes compared to a branch (default: main)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (compareTo, options) => {
      const rootDir = path.resolve(options.dir);
      const compareRef = compareTo || 'main';

      const spinner = options.json ? null : createSpinner('Detecting breaking changes...');
      spinner?.start();

      try {
        const result = await detectBreakingChanges(rootDir, compareRef);
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('breaking-changes', result);
          return;
        }

        const output = formatBreakingChanges(result);

        console.log();
        for (const line of output.split('\n')) {
          if (line.includes('BREAKING CHANGES') || line.includes('⚠️')) {
            console.log(chalk.bold.red(`  ${line}`));
          } else if (line.includes('No breaking changes')) {
            console.log(chalk.bold.green(`  ${line}`));
          } else if (line.includes('removed') || line.includes('deleted')) {
            console.log(chalk.red(`  ${line}`));
          } else if (line.includes('changed') || line.includes('modified')) {
            console.log(chalk.yellow(`  ${line}`));
          } else if (line.startsWith('─')) {
            console.log(chalk.dim(`  ${line}`));
          } else {
            console.log(chalk.white(`  ${line}`));
          }
        }
        console.log();
      } catch (error) {
        spinner?.fail('Failed to detect breaking changes');
        if (options.json) {
          outputJsonError(
            'breaking-changes',
            error instanceof Error ? error.message : String(error)
          );
        }
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
