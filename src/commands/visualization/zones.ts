/**
 * Safe and Danger zones commands
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { analyzeZones, formatDangerZones, formatSafeZones } from '../../zones.js';
import { createSpinner } from '../types.js';

export function registerSafe(program: Command): void {
  program
    .command('safe')
    .description('Find safe zones - well-tested, low-complexity areas')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Number of zones to show', '10')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const limit = parseInt(options.limit, 10);

      const spinner = options.json ? null : createSpinner('Finding safe zones...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('safe', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = analyzeZones(graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('safe', {
          safeZones: result.safeZones.slice(0, limit),
          totalSafe: result.safeZones.length,
        });
        return;
      }

      const output = formatSafeZones(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('SAFE ZONES') || line.includes('🛡️')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('✅')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}

export function registerDanger(program: Command): void {
  program
    .command('danger')
    .description('Find danger zones - high-risk, complex areas')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Number of zones to show', '10')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const limit = parseInt(options.limit, 10);

      const spinner = options.json ? null : createSpinner('Finding danger zones...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('danger', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const result = analyzeZones(graph);
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('danger', {
          dangerZones: result.dangerZones.slice(0, limit),
          totalDanger: result.dangerZones.length,
        });
        return;
      }

      const output = formatDangerZones(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('DANGER ZONES') || line.includes('⚠️')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('🔴') || line.includes('CRITICAL')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('🟠') || line.includes('HIGH')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}

export function register(program: Command): void {
  registerSafe(program);
  registerDanger(program);
}
