/**
 * Streaks command - Display daily CLI usage streak information
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import gradient from 'gradient-string';
import { outputJson } from '../../json-output.js';
import {
  formatDailyChallenge,
  getDailyChallenge,
  getStreakEmoji,
  getStreakInfo,
} from '../../streaks.js';
import { stripAnsi } from '../../ui/ansi-utils.js';

export function register(program: Command): void {
  program
    .command('streaks')
    .description('Show your daily CLI usage streak')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const info = getStreakInfo(rootDir);

      // JSON output for CI/CD
      if (options.json) {
        outputJson('streaks', info);
        return;
      }

      const g = gradient(['#ff6b6b', '#ee5a24', '#f9ca24']);
      const W = 50;

      console.log();
      console.log(`  ${g(`+${'='.repeat(W)}+`)}`);

      // Header
      const title = '  SPECTER STREAKS';
      console.log(`  ${g('|')}${chalk.bold.white(title)}${' '.repeat(W - title.length)}${g('|')}`);
      console.log(`  ${g(`+${'='.repeat(W)}+`)}`);

      // Current streak
      const emoji = getStreakEmoji(info.currentStreak);
      const streakLabel = info.currentStreak === 1 ? 'day' : 'days';
      const currentLine =
        info.currentStreak > 0
          ? `  ${emoji} Current streak: ${info.currentStreak} ${streakLabel}`
          : '  No active streak';
      console.log(
        `  ${g('|')}${chalk.bold.white(currentLine)}${' '.repeat(Math.max(0, W - stripAnsi(currentLine).length))}${g('|')}`
      );

      // Longest streak
      const longestLine = `  Longest streak: ${info.longestStreak} days`;
      console.log(
        `  ${g('|')}${chalk.cyan(longestLine)}${' '.repeat(W - longestLine.length)}${g('|')}`
      );

      // Total active days
      const totalLine = `  Total active days: ${info.totalDays}`;
      console.log(
        `  ${g('|')}${chalk.cyan(totalLine)}${' '.repeat(W - totalLine.length)}${g('|')}`
      );

      // Divider
      console.log(`  ${g('|')}${chalk.dim(`  ${'-'.repeat(W - 4)}`)}${g('|')}`);

      // Most-used commands
      const commandEntries = Object.entries(info.commandCounts);
      if (commandEntries.length > 0) {
        const cmdTitle = '  Most-used commands:';
        console.log(
          `  ${g('|')}${chalk.bold.white(cmdTitle)}${' '.repeat(W - cmdTitle.length)}${g('|')}`
        );

        // Sort by count descending, take top 5
        const sorted = commandEntries.sort(([, a], [, b]) => b - a).slice(0, 5);

        for (const [cmd, count] of sorted) {
          const usesLabel = count === 1 ? 'use' : 'uses';
          const cmdLine = `    ${cmd}: ${count} ${usesLabel}`;
          console.log(
            `  ${g('|')}${chalk.white(cmdLine)}${' '.repeat(Math.max(0, W - cmdLine.length))}${g('|')}`
          );
        }
      } else {
        const noDataLine = '  No command data yet.';
        console.log(
          `  ${g('|')}${chalk.dim(noDataLine)}${' '.repeat(W - noDataLine.length)}${g('|')}`
        );
      }

      console.log(`  ${g(`+${'='.repeat(W)}+`)}`);

      // Motivational footer
      if (info.currentStreak >= 15) {
        console.log(chalk.bold.yellow(`  Legendary! You're unstoppable!`));
      } else if (info.currentStreak >= 8) {
        console.log(chalk.bold.yellow(`  On fire! Keep the momentum going!`));
      } else if (info.currentStreak >= 4) {
        console.log(chalk.bold.yellow(`  Nice streak! You're building a habit!`));
      } else if (info.currentStreak >= 1) {
        console.log(chalk.dim(`  Keep it up! Consistency is key.`));
      } else {
        console.log(chalk.dim(`  Run any specter command to start a streak!`));
      }

      // Daily challenge
      const challenge = getDailyChallenge(rootDir);
      console.log(formatDailyChallenge(challenge));

      console.log();
    });
}
