/**
 * Cost command - Tech debt in dollar terms
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { analyzeCost, formatCost } from '../../cost.js';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';

export function register(program: Command): void {
  program
    .command('cost')
    .description('Estimate tech debt in dollar terms - calculates maintenance burden')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--rate <n>', 'Developer hourly rate', '75')
    .option('--currency <code>', 'Currency code (USD, EUR, GBP)', 'USD')
    .option('--no-dead-code', 'Skip dead code analysis')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('cost', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Calculating tech debt costs...');
      spinner?.start();

      try {
        const result = await analyzeCost(rootDir, graph, {
          hourlyRate: parseInt(options.rate, 10),
          currency: options.currency,
          includeDeadCode: options.deadCode !== false,
        });
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('cost', {
            totalDebt: result.totalDebt,
            categories: result.categories,
            topFiles: result.topFiles,
            quickWins: result.quickWins,
            estimatedSavings: result.estimatedSavings,
            hourlyRate: result.hourlyRate,
            currency: result.currency,
          });
          return;
        }

        const output = formatCost(result);

        // PNG export
        if (options.png) {
          const pngAvailable = await isPngExportAvailable();
          if (!pngAvailable) {
            console.log(
              chalk.red('PNG export requires the canvas package. Install with: npm install canvas')
            );
            return;
          }

          const pngSpinner = createSpinner('Generating shareable image...');
          pngSpinner.start();

          const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
          const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

          pngSpinner.succeed(`Image saved to ${outputPath}`);
          showShareLinks('cost', qrUrl);
          return;
        }

        console.log();
        for (const line of output.split('\n')) {
          if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
            console.log(chalk.bold.cyan(`  ${line}`));
          } else if (line.startsWith('Total Tech Debt:')) {
            console.log(chalk.bold.red(`  ${line}`));
          } else if (
            line.startsWith('COST BREAKDOWN') ||
            line.startsWith('TOP 5') ||
            line.startsWith('QUICK WINS') ||
            line.startsWith('RECOMMENDATIONS')
          ) {
            console.log(chalk.bold.white(`  ${line}`));
          } else if (line.includes('\u{1F534}')) {
            console.log(chalk.red(`  ${line}`));
          } else if (line.includes('\u{1F7E0}')) {
            console.log(chalk.hex('#FFA500')(`  ${line}`));
          } else if (line.includes('\u{1F7E1}')) {
            console.log(chalk.yellow(`  ${line}`));
          } else if (line.includes('\u{1F7E2}')) {
            console.log(chalk.green(`  ${line}`));
          } else if (
            line.includes('\u{1F3AF}') ||
            line.includes('\u26A1') ||
            line.includes('\u{1F4CA}') ||
            line.includes('\u{1F4A1}')
          ) {
            console.log(chalk.cyan(`  ${line}`));
          } else if (line.startsWith('\u2500')) {
            console.log(chalk.dim(`  ${line}`));
          } else if (line.includes('\u2192')) {
            console.log(chalk.italic.yellow(`  ${line}`));
          } else if (line.startsWith('Run with')) {
            console.log(chalk.dim(`  ${line}`));
          } else {
            console.log(chalk.white(`  ${line}`));
          }
        }
        console.log();
      } catch (error) {
        if (options.json) {
          outputJsonError('cost', error instanceof Error ? error.message : String(error));
        }
        spinner?.fail('Failed to calculate tech debt costs');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
