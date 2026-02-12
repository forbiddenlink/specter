/**
 * Knowledge Map command - team expertise heatmap
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatKnowledgeMap, generateKnowledgeMap } from '../../knowledge-map.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('knowledge-map')
    .alias('kmap')
    .description('Generate a team expertise heatmap')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Mapping team expertise...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('knowledge-map', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = await generateKnowledgeMap(graph, rootDir);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('knowledge-map', result);
        return;
      }

      const output = formatKnowledgeMap(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('OVERALL BUS FACTOR') || line.startsWith('Risk Areas')) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.startsWith('EXPERTISE HEATMAP') || line.startsWith('AREA DETAILS')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('RISK AREAS')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('SUGGESTIONS')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('🔴')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('🟡')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('🟢') || line.includes('🌟')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('⚠️')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('Legend:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('  •')) {
          console.log(chalk.white(`  ${line}`));
        } else if (
          line.includes('░') ||
          line.includes('▒') ||
          line.includes('▓') ||
          line.includes('█')
        ) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
