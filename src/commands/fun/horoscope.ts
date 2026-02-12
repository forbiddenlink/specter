/**
 * Horoscope command - daily codebase fortune
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { formatHoroscope, generateHoroscope } from '../../horoscope.js';
import { outputJson, outputJsonError } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('horoscope')
    .description('Get your codebase horoscope')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('horoscope', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const reading = generateHoroscope(graph);

      // JSON output for CI/CD
      if (options.json) {
        outputJson('horoscope', reading);
        return;
      }

      const output = formatHoroscope(reading);

      console.log();
      // Add some mystical styling
      console.log(chalk.bold.magenta(`  ${'─'.repeat(50)}`));
      for (const line of output.split('\n')) {
        if (line.startsWith('\uD83D\uDD2E')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('Your codebase is')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith("Today's reading:")) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.startsWith('"')) {
          console.log(chalk.italic.green(`  ${line}`));
        } else if (
          line.includes('\uD83D\uDCAB') ||
          line.includes('\u26A0\uFE0F') ||
          line.includes('\uD83C\uDFAF') ||
          line.includes('\uD83D\uDC95') ||
          line.includes('\uD83D\uDEAB')
        ) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.startsWith("Today's affirmation:")) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log(chalk.bold.magenta(`  ${'─'.repeat(50)}`));
      console.log();
    });
}
