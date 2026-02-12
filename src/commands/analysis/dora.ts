/**
 * DORA command - DevOps Research & Assessment metrics
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { calculateDora, formatDora } from '../../dora.js';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';

export function register(program: Command): void {
  program
    .command('dora')
    .description('Calculate DORA metrics for software delivery performance')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <period>', 'Time period to analyze', '6 months ago')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Calculating DORA metrics...');
      spinner?.start();

      try {
        const result = await calculateDora(rootDir, { since: options.since });
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('dora', {
            deploymentFrequency: result.deploymentFrequency,
            leadTimeForChanges: result.leadTimeForChanges,
            changeFailureRate: result.changeFailureRate,
            meanTimeToRecovery: result.meanTimeToRecovery,
            overallLevel: result.overallLevel,
            period: result.period,
            rawData: result.rawData,
          });
          return;
        }

        const output = formatDora(result);

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
          showShareLinks('dora', qrUrl);
          return;
        }

        console.log();
        for (const line of output.split('\n')) {
          if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
            console.log(chalk.bold.cyan(`  ${line}`));
          } else if (line.startsWith('Overall Performance:')) {
            if (line.includes('ELITE')) {
              console.log(chalk.bold.green(`  ${line}`));
            } else if (line.includes('HIGH')) {
              console.log(chalk.bold.green(`  ${line}`));
            } else if (line.includes('MEDIUM')) {
              console.log(chalk.bold.yellow(`  ${line}`));
            } else {
              console.log(chalk.bold.red(`  ${line}`));
            }
          } else if (line.includes('\u2B50')) {
            console.log(chalk.bold.green(`  ${line}`));
          } else if (line.includes('\uD83D\uDFE2')) {
            console.log(chalk.green(`  ${line}`));
          } else if (line.includes('\uD83D\uDFE1')) {
            console.log(chalk.yellow(`  ${line}`));
          } else if (line.includes('\uD83D\uDD34')) {
            console.log(chalk.red(`  ${line}`));
          } else if (line.startsWith('  [')) {
            console.log(chalk.cyan(`  ${line}`));
          } else if (line.startsWith('\u2500') || line.startsWith('Period:')) {
            console.log(chalk.dim(`  ${line}`));
          } else if (line.startsWith('Data Summary:') || line.startsWith('Recommendations:')) {
            console.log(chalk.bold.white(`  ${line}`));
          } else if (line.includes('\u2022')) {
            console.log(chalk.italic.yellow(`  ${line}`));
          } else if (line.includes('\u2728')) {
            console.log(chalk.bold.green(`  ${line}`));
          } else {
            console.log(chalk.white(`  ${line}`));
          }
        }
        console.log();
      } catch (error) {
        if (options.json) {
          outputJsonError('dora', error instanceof Error ? error.message : String(error));
        }
        spinner?.fail('Failed to calculate DORA metrics');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
