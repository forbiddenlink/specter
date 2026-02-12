/**
 * Clean command - remove cached graph
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { deleteGraph } from '../../graph/persistence.js';
import { outputJson } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('clean')
    .description('Remove the cached knowledge graph')
    .option('-d, --dir <path>', 'Directory to clean', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      await deleteGraph(rootDir);
      if (options.json) {
        outputJson('clean', { cleaned: true, directory: rootDir });
        return;
      }
      console.log(chalk.green('✓ Graph cache removed.'));
    });
}
