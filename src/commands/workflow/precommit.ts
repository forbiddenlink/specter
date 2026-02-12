/**
 * Precommit command - quick risk check before committing
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatPrecommit, runPrecommitCheck } from '../../precommit.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('precommit')
    .description('Quick risk check before committing staged changes')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--exit-code', 'Exit with code 1 if high-risk changes detected')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const exitCode = options.exitCode;

      const spinner = options.json ? null : createSpinner('Checking staged changes...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('precommit', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await runPrecommitCheck(rootDir, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('precommit', result);
        if (exitCode && result.status === 'fail') {
          process.exit(1);
        }
        return;
      }

      const output = formatPrecommit(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          const color =
            result.status === 'pass'
              ? chalk.bold.green
              : result.status === 'warn'
                ? chalk.bold.yellow
                : chalk.bold.red;
          console.log(color(`  ${line}`));
        } else if (line.includes('HIGH RISK')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('MEDIUM RISK')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('LOW RISK')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('SUGGESTIONS')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('  •')) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();

      // Exit with error code if high-risk changes detected
      if (exitCode && result.status === 'fail') {
        process.exit(1);
      }
    });
}
