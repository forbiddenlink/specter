/**
 * Compare command - branch health comparison
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { compareBranches, formatCompare } from '../../compare.js';
import { outputJson } from '../../json-output.js';
import type { PersonalityMode } from '../../personality/types.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('compare [branch]')
    .description('Compare health between current branch and another branch (default: main)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option(
      '-p, --personality <mode>',
      'Output personality: mentor, critic, roast, cheerleader, executive',
      'default'
    )
    .option('--exit-code', 'Exit with code 1 if health decreased significantly')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (branch: string | undefined, options) => {
      const rootDir = path.resolve(options.dir);
      const compareBranch = branch || 'main';
      const personality = options.personality as PersonalityMode;

      const spinner = options.json ? null : createSpinner(`Comparing with ${compareBranch}...`);
      spinner?.start();

      const result = await compareBranches(rootDir, compareBranch);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('compare', result, { personality, compareBranch });
        if (options.exitCode && result.riskLevel === 'danger') {
          process.exit(1);
        }
        return;
      }

      const output = formatCompare(result, personality);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('PR HEALTH CHECK')) {
          const color =
            result.riskLevel === 'safe'
              ? chalk.bold.green
              : result.riskLevel === 'caution'
                ? chalk.bold.yellow
                : chalk.bold.red;
          console.log(color(`  ${line}`));
        } else if (line.startsWith('-'.repeat(10))) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('UP') || line.includes('improved') || line.includes('green')) {
          console.log(chalk.green(`  ${line}`));
        } else if (
          line.includes('DOWN') ||
          line.includes('declined') ||
          line.includes('red') ||
          line.includes('alert')
        ) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('warning') || line.includes('caution')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('files') || line.includes('target') || line.includes('comment')) {
          console.log(chalk.cyan(`  ${line}`));
        } else {
          console.log(`  ${line}`);
        }
      }
      console.log();

      // Exit with error code if health decreased significantly
      if (options.exitCode && result.riskLevel === 'danger') {
        process.exit(1);
      }
    });
}
