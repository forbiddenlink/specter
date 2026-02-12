/**
 * Drift command - Code drift detection
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { detectDrift, formatDrift } from '../../drift.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('drift')
    .description('Detect code drift - duplicate patterns that have diverged')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--threshold <n>', 'Similarity threshold (0-100)', '70')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Detecting code drift...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('drift', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await detectDrift(rootDir, graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('drift', {
          violations: result.violations,
          score: result.score,
          summary: result.summary,
        });
        return;
      }

      const output = formatDrift(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('CODE DRIFT') || line.includes('DRIFT')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.includes('No drift') || line.includes('clean')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('similarity') || line.includes('Score')) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.startsWith('RECOMMENDATIONS') || line.startsWith('SUGGESTIONS')) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
