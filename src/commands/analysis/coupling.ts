/**
 * Coupling command - Hidden coupling discovery
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { showNextSteps } from '../../cli-utils.js';
import { analyzeCoupling, formatCoupling } from '../../coupling.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('coupling')
    .alias('couple')
    .description('Find hidden couplings - files that change together but have no direct dependency')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--hidden-only', 'Only show hidden couplings (no expected couplings)')
    .option('--min-strength <n>', 'Minimum coupling strength (0-100)', '30')
    .option('--json', 'Output as JSON for CI/CD integration')
    .addHelpText(
      'after',
      `
Examples:
  $ specter coupling
  $ specter coupling --hidden-only
  $ specter coupling --min-strength 50
  $ specter coupling --json | jq '.pairs[] | select(.couplingStrength > 70)'
  
Hidden couplings reveal missing abstractions and architectural issues.
`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Analyzing coupling patterns...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('coupling', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await analyzeCoupling(rootDir, graph, {
        hiddenOnly: options.hiddenOnly,
        minStrength: parseInt(options.minStrength, 10),
      });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('coupling', {
          pairs: result.pairs,
          hiddenCouplings: result.hiddenCouplings,
          expectedCouplings: result.expectedCouplings,
          suspiciousCouplings: result.suspiciousCouplings,
          recommendations: result.recommendations,
        });
        return;
      }

      const output = formatCoupling(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (
          line.startsWith('\uD83D\uDD34 HIDDEN') ||
          line.startsWith('\uD83D\uDD34 SUSPICIOUS')
        ) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.startsWith('\uD83D\uDFE1 HIDDEN')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.startsWith('\uD83D\uDFE2 EXPECTED')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('\uD83D\uDD34')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE1')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE2')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('\u26A0\uFE0F') || line.includes('No direct import')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.startsWith('   \u2192')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.startsWith('   \u2194')) {
          console.log(chalk.magenta(`  ${line}`));
        } else if (
          line.startsWith('RECOMMENDATIONS') ||
          line.startsWith('\uD83D\uDD34 HIDDEN COUPLINGS')
        ) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.startsWith('\u2500')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('Found') || line.startsWith('  \uD83D')) {
          console.log(chalk.white(`  ${line}`));
        } else if (line.startsWith('  \u2022')) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.includes('correlation') || line.includes('Changed together')) {
          console.log(chalk.dim.cyan(`  ${line}`));
        } else if (line.includes('... and')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();

      // Show next steps suggestions
      if (!options.json) {
        const suggestions = [
          {
            description: 'Visualize architectural dependencies',
            command: 'specter diagram',
          },
          {
            description: 'Find circular dependencies',
            command: 'specter cycles',
          },
          {
            description: 'See files that change together',
            command: 'specter drift',
          },
          {
            description: 'Get refactoring suggestions',
            command: 'specter fix',
          },
        ];
        showNextSteps(suggestions);
      }
    });
}
