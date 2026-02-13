/**
 * Blame Game command - gamified blame with awards
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('blame-game')
    .alias('blame')
    .description('Gamified blame analysis with awards for contributors')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('blame-game', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const { generateBlameGame } = await import('../../blame-game.js');
      const output = await generateBlameGame(graph, rootDir);

      if (options.json) {
        outputJson('blame-game', { output });
        return;
      }

      console.log(output);
    });
}
