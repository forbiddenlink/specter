/**
 * Changelog command - generate changelog from commits
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { formatChangelog, generateChangelog } from '../../changelog.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('changelog')
    .description('Generate a changelog from git commits')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <tag>', 'Generate changelog since this tag')
    .option('--until <tag>', 'Generate changelog until this tag')
    .option('-o, --output <file>', 'Write changelog to file')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Generating changelog...');
      spinner?.start();

      try {
        const result = await generateChangelog(rootDir, {
          since: options.since,
          until: options.until,
        });
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('changelog', result);
          return;
        }

        const output = formatChangelog(result);

        // Write to file if requested
        if (options.output) {
          const fs = await import('node:fs/promises');
          await fs.writeFile(options.output, output, 'utf-8');
          console.log(chalk.green(`Changelog written to ${options.output}`));
          return;
        }

        console.log();
        console.log(output);
        console.log();
      } catch (error) {
        spinner?.fail('Failed to generate changelog');
        if (options.json) {
          outputJsonError('changelog', error instanceof Error ? error.message : String(error));
        }
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
