/**
 * Bus Factor command - Surface bus factor risks prominently
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { analyzeBusFactor, formatBusFactor } from '../../bus-factor.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('bus-factor')
    .alias('bus')
    .description(
      'Surface bus factor risks - which parts of the codebase are at risk if someone leaves'
    )
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--critical-only', 'Only show critical risks')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Analyzing bus factor risks...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('bus-factor', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await analyzeBusFactor(graph, {
        criticalOnly: options.criticalOnly,
      });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('bus-factor', {
          overallBusFactor: result.overallBusFactor,
          riskLevel: result.riskLevel,
          risks: result.risks,
          summary: result.summary,
          recommendations: result.recommendations,
        });
        return;
      }

      const output = formatBusFactor(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('+--') || line.includes('|')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Overall Bus Factor')) {
          if (line.includes('CRITICAL') || line.includes('[!!]')) {
            console.log(chalk.bold.red(`  ${line}`));
          } else if (line.includes('DANGEROUS') || line.includes('[!]')) {
            console.log(chalk.bold.hex('#FFA500')(`  ${line}`));
          } else if (line.includes('CONCERNING') || line.includes('[~]')) {
            console.log(chalk.bold.yellow(`  ${line}`));
          } else {
            console.log(chalk.bold.green(`  ${line}`));
          }
        } else if (
          line.startsWith('CRITICAL RISKS') ||
          line.startsWith('[!]') ||
          line.startsWith('[!!]')
        ) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.startsWith('MODERATE RISKS') || line.startsWith('[~]')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('HEALTHY AREAS') || line.startsWith('[+]')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('SUMMARY') || line.startsWith('RECOMMENDATIONS')) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.startsWith('-'.repeat(10))) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Solo owner:')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('lines at risk')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('   ->')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.startsWith('[*]')) {
          console.log(chalk.hex('#FFA500')(`  ${line}`));
        } else if (line.startsWith('  *')) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.includes('... and')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (
          line.includes('Files with single owner') ||
          line.includes('Lines at risk') ||
          line.includes('Percentage of codebase')
        ) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
