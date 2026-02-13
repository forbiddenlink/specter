/**
 * Predict command - PR impact prediction
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatPrediction, generatePrediction } from '../../predict.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('predict')
    .description('Predict impact of staged changes before creating a PR')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Analyzing staged changes...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('predict', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const prediction = await generatePrediction(rootDir, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('predict', prediction);
        return;
      }

      const output = formatPrediction(prediction);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.startsWith('SUMMARY') || line.startsWith('FILE IMPACTS')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.includes('WARNINGS')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('RECOMMENDATIONS')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('🔴') || line.includes('CRITICAL')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('🟠') || line.includes('HIGH')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('🟡') || line.includes('MEDIUM')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('🟢') || line.includes('LOW')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('🆕') || line.includes('🗑️') || line.includes('✏️')) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.includes('Risk:') && line.includes('█')) {
          const riskMatch = line.match(/(\d+)%/);
          const riskValue = riskMatch?.[1] ? parseInt(riskMatch[1], 10) : 0;
          const color = riskValue >= 60 ? chalk.red : riskValue >= 40 ? chalk.yellow : chalk.green;
          console.log(color(`  ${line}`));
        } else if (line.startsWith('  •')) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
