/**
 * Achievements command - show unlocked achievements
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { achievements, calculateStats, checkAchievements } from '../../achievements.js';
import {
  exportToPng,
  formatAchievementsForExport,
  getRepoUrl,
  isPngExportAvailable,
} from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';

export function register(program: Command): void {
  program
    .command('achievements')
    .description('Show unlocked achievements and progress')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--social', 'Optimize PNG for Twitter/LinkedIn (1200x630)')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('achievements', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const stats = calculateStats(graph);
      const result = checkAchievements(graph, stats);
      const unlockedAchievements = result.unlocked;
      const lockedAchievements = result.locked;

      // JSON output for CI/CD
      if (options.json) {
        outputJson('achievements', {
          unlockedCount: unlockedAchievements.length,
          totalCount: achievements.length,
          achievements: achievements.map((a) => ({
            ...a,
            unlocked: unlockedAchievements.some((u) => u.id === a.id),
          })),
        });
        return;
      }

      // Build output as array of lines
      const lines: string[] = [];
      const W = 55;

      lines.push('');
      lines.push(chalk.bold.yellow(`+${'='.repeat(W)}+`));
      lines.push(
        chalk.bold.yellow('|') +
          chalk.bold.white(`  SPECTER ACHIEVEMENTS`) +
          ' '.repeat(W - 23) +
          chalk.bold.yellow('|')
      );
      lines.push(chalk.bold.yellow(`+${'='.repeat(W)}+`));

      // Summary
      const summaryLine = `  Unlocked: ${unlockedAchievements.length}/${achievements.length}`;
      lines.push(
        chalk.bold.yellow('|') +
          chalk.cyan(summaryLine) +
          ' '.repeat(W - summaryLine.length + 2) +
          chalk.bold.yellow('|')
      );

      lines.push(
        chalk.bold.yellow('|') + chalk.dim(`  ${'-'.repeat(W - 4)}`) + chalk.bold.yellow('|')
      );

      // Unlocked achievements
      if (unlockedAchievements.length > 0) {
        const unlockedTitle = '  Unlocked:';
        lines.push(
          chalk.bold.yellow('|') +
            chalk.green(unlockedTitle) +
            ' '.repeat(W - unlockedTitle.length + 2) +
            chalk.bold.yellow('|')
        );

        for (const achievement of unlockedAchievements) {
          const achLine = `  ${achievement.emoji} ${achievement.name}`;
          lines.push(
            chalk.bold.yellow('|') +
              chalk.white(achLine) +
              ' '.repeat(W - achLine.length + 2) +
              chalk.bold.yellow('|')
          );
          const descLine = `     ${achievement.description}`;
          lines.push(
            chalk.bold.yellow('|') +
              chalk.dim(descLine.slice(0, W - 2)) +
              ' '.repeat(Math.max(0, W - descLine.length + 2)) +
              chalk.bold.yellow('|')
          );
        }
      }

      // Locked achievements
      if (lockedAchievements.length > 0) {
        lines.push(chalk.bold.yellow('|') + ' '.repeat(W) + chalk.bold.yellow('|'));
        const lockedTitle = '  Locked:';
        lines.push(
          chalk.bold.yellow('|') +
            chalk.dim(lockedTitle) +
            ' '.repeat(W - lockedTitle.length + 2) +
            chalk.bold.yellow('|')
        );

        for (const achievement of lockedAchievements.slice(0, 5)) {
          const achLine = `  [locked] ${achievement.name}`;
          lines.push(
            chalk.bold.yellow('|') +
              chalk.dim(achLine) +
              ' '.repeat(Math.max(0, W - achLine.length + 2)) +
              chalk.bold.yellow('|')
          );
        }

        if (lockedAchievements.length > 5) {
          const moreLine = `  ... and ${lockedAchievements.length - 5} more`;
          lines.push(
            chalk.bold.yellow('|') +
              chalk.dim(moreLine) +
              ' '.repeat(W - moreLine.length + 2) +
              chalk.bold.yellow('|')
          );
        }
      }

      lines.push(chalk.bold.yellow(`+${'='.repeat(W)}+`));
      lines.push('');

      const output = lines.join('\n');

      // PNG export
      if (options.png) {
        const pngAvailable = await isPngExportAvailable();
        if (!pngAvailable) {
          console.log(
            chalk.red('PNG export requires the canvas package. Install with: npm install canvas')
          );
          return;
        }

        const spinner = createSpinner('Generating shareable achievements image...');
        spinner.start();

        const exportContent = formatAchievementsForExport(
          unlockedAchievements,
          lockedAchievements,
          achievements.length
        );
        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
        const outputPath = await exportToPng(exportContent, options.png, {
          qrUrl: qrUrl || undefined,
          socialFormat: options.social,
        });

        spinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('achievements', qrUrl);
        return;
      }

      console.log(output);
    });
}
