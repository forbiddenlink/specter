/**
 * Obituary command - generate an obituary for a file about to be deleted
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('obituary <file>')
    .description('Generate an obituary for a file about to be deleted')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('obituary', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      // Normalize the file path
      let filePath = file;
      if (!filePath.startsWith(rootDir)) {
        filePath = path.resolve(rootDir, file);
      }

      const { generateObituary } = await import('../../obituary.js');
      const output = generateObituary(filePath, graph, rootDir);

      if (options.json) {
        outputJson('obituary', { file: filePath, output });
        return;
      }

      console.log(output);
    });
}
