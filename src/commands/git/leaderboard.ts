/**
 * Leaderboard command - Team gamification stats
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatLeaderboard, generateLeaderboard } from '../../leaderboard.js';
import { createSpinner, showShareLinks } from '../types.js';

export function register(program: Command): void {
  program
    .command('leaderboard')
    .description("Show team gamification stats - who's improving the codebase?")
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <date>', 'Start date (e.g., "30 days ago", "2024-01-01")', '30 days ago')
    .option('--limit <n>', 'Number of contributors to show', '10')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('leaderboard', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Analyzing contributor impact...');
      spinner?.start();

      try {
        const result = await generateLeaderboard(rootDir, graph, {
          since: options.since,
          limit: parseInt(options.limit, 10),
        });
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('leaderboard', {
            entries: result.entries,
            teamStats: result.teamStats,
            timeRange: result.timeRange,
          });
          return;
        }

        const output = formatLeaderboard(result);

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
          showShareLinks('leaderboard', qrUrl);
          return;
        }

        // Console output with colors
        console.log();
        for (const line of output.split('\n')) {
          if (line.includes('\uD83C\uDFC6')) {
            console.log(chalk.bold.yellow(`${line}`));
          } else if (line.includes('\uD83E\uDD47')) {
            console.log(chalk.bold.yellow(`${line}`));
          } else if (line.includes('\uD83E\uDD48')) {
            console.log(chalk.hex('#C0C0C0')(`${line}`));
          } else if (line.includes('\uD83E\uDD49')) {
            console.log(chalk.hex('#CD7F32')(`${line}`));
          } else if (line.includes('Health Hero')) {
            console.log(chalk.green(`${line}`));
          } else if (line.includes('Code Guardian')) {
            console.log(chalk.cyan(`${line}`));
          } else if (line.includes('Hotspot Hunter')) {
            console.log(chalk.blue(`${line}`));
          } else if (line.includes('Rising Star')) {
            console.log(chalk.magenta(`${line}`));
          } else if (line.includes('\u2550') || line.includes('\u2500')) {
            console.log(chalk.dim(`${line}`));
          } else if (line.includes('\uD83D\uDCCA')) {
            console.log(chalk.bold.white(`${line}`));
          } else if (line.includes('improving!')) {
            console.log(chalk.green(`${line}`));
          } else if (line.includes('needs attention')) {
            console.log(chalk.yellow(`${line}`));
          } else if (line.includes('commits') && line.includes('\u2502')) {
            console.log(chalk.dim(`${line}`));
          } else {
            console.log(chalk.white(`${line}`));
          }
        }
        console.log();
      } catch (error) {
        if (options.json) {
          outputJsonError('leaderboard', error instanceof Error ? error.message : String(error));
        }
        spinner?.fail('Failed to generate leaderboard');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
