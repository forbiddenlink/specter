/**
 * Hotspots command - Complexity x Churn analysis
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { analyzeHotspots, formatHotspots } from '../../hotspots.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('hotspots')
    .description('Find complexity x churn hotspots - highest priority for refactoring')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-t, --top <n>', 'Number of hotspots to show', '20')
    .option('-s, --since <period>', 'Time period for churn analysis', '3 months ago')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json
        ? null
        : createSpinner('Analyzing complexity x churn hotspots...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('hotspots', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await analyzeHotspots(rootDir, graph, {
        since: options.since,
        top: parseInt(options.top, 10),
      });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('hotspots', {
          hotspots: result.hotspots,
          summary: result.summary,
          quadrants: result.quadrants,
          timeRange: result.timeRange,
        });
        return;
      }

      const output = formatHotspots(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (
          line.startsWith('SCATTER PLOT') ||
          line.startsWith('QUADRANT') ||
          line.startsWith('TOP HOTSPOTS')
        ) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.startsWith('SUMMARY') || line.startsWith('RECOMMENDATIONS')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Period:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('\u2500') || line.startsWith('Legend:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('\uD83D\uDD34 CRITICAL')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE0 HIGH') || line.includes('\uD83D\uDFE0 Legacy')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE1 MEDIUM') || line.includes('\uD83D\uDFE1 Active')) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE2') || line.includes('Healthy')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('\uD83D\uDD34 DANGER')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('Score:')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('Complexity:') || line.includes('Churn:')) {
          console.log(chalk.dim.cyan(`  ${line}`));
        } else if (line.includes('Contributors:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Estimated effort:')) {
          console.log(chalk.dim.yellow(`  ${line}`));
        } else if (
          line.includes('\uD83D\uDEA8') ||
          line.includes('\u26A0\uFE0F') ||
          line.includes('\uD83D\uDCCA')
        ) {
          console.log(chalk.italic.yellow(`  ${line}`));
        } else if (
          line.includes('\u25B2') ||
          line.includes('\u25B6') ||
          line.includes('\u2502') ||
          line.includes('\u2514')
        ) {
          // Scatter plot
          console.log(chalk.white(`  ${line}`));
        } else if (line.includes('\u25CF') || line.includes('\u25CB') || line.includes('\u25E6')) {
          // Plot markers
          console.log(chalk.white(`  ${line}`));
        } else if (line.includes('... and')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
