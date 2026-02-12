/**
 * Origin command - Discover the origin story of your codebase
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { gatherOriginData, generateOriginStory } from '../../origin.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('origin')
    .description('Discover the origin story of your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('origin', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Discovering your origin story...');
      spinner?.start();

      const data = await gatherOriginData(graph, rootDir);
      const story = generateOriginStory(data);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('origin', { data, story });
        return;
      }

      console.log();
      console.log(chalk.bold.magenta(`  ${'─'.repeat(50)}`));
      for (const line of story.split('\n')) {
        if (line.includes('ORIGIN') || line.includes('📜')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('Once upon') || line.includes('In the beginning')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.includes('founder') || line.includes('creator')) {
          console.log(chalk.green(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log(chalk.bold.magenta(`  ${'─'.repeat(50)}`));
      console.log();
    });
}
