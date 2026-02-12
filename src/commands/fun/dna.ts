/**
 * DNA command - Generate a DNA profile for your codebase
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { formatDNA, generateBadge, generateDNA } from '../../dna.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('dna')
    .description('Generate a DNA profile for your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--badge', 'Generate a badge URL')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('dna', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Analyzing your DNA...');
      spinner?.start();

      const dna = generateDNA(graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('dna', dna);
        return;
      }

      if (options.badge) {
        const badge = generateBadge(dna);
        console.log();
        console.log(chalk.bold.cyan('  DNA Badge URL:'));
        console.log(chalk.white(`  ${badge}`));
        console.log();
        return;
      }

      const output = formatDNA(dna);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('DNA') || line.includes('🧬')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('Dominant') || line.includes('Primary')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('%')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
