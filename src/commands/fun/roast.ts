/**
 * Roast command - comedic roast of the codebase
 */

import path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error no types
import chalkAnimation from 'chalk-animation';
import type { Command } from 'commander';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';
import {
  type RoastData,
  roastBusFactor,
  roastComplexityDistribution,
  roastDeadCode,
  roastHotspots,
  roastNamingCrimes,
} from './roast-helpers.js';

export function register(program: Command): void {
  program
    .command('roast')
    .description('Get a comedic roast of your codebase')
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
          outputJsonError('roast', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      // Dynamic imports
      const { generateComplexityReport } = await import('../../analyzers/complexity.js');
      const { execute: getDeadCode } = await import('../../tools/get-dead-code.js');
      const { execute: getBusFactor } = await import('../../tools/get-bus-factor.js');

      const report = generateComplexityReport(graph);
      const deadCode = getDeadCode(graph, { limit: 20 });
      const busFactor = await getBusFactor(graph, { limit: 10 });

      const stats = graph.metadata;

      // Prepare data for roast helpers
      const roastData: RoastData = {
        hotspots: report.hotspots,
        deadCode,
        busFactor,
        stats,
        distribution: report.distribution,
        graph,
      };

      // JSON output for CI/CD
      if (options.json) {
        outputJson('roast', {
          fileCount: stats.fileCount,
          totalLines: stats.totalLines,
          hotspots: report.hotspots.slice(0, 5).map((h) => ({
            filePath: h.filePath,
            name: h.name,
            complexity: h.complexity,
          })),
          deadCode: deadCode.items?.slice(0, 10) || [],
          busFactor: busFactor.criticalAreas?.slice(0, 5) || [],
          averageComplexity: report.averageComplexity,
        });
        return;
      }

      // Animated glitch intro (TTY only)
      if (process.stdout.isTTY && !options.png) {
        const glitch = chalkAnimation.glitch('  🔥 CODEBASE ROAST 🔥');
        await new Promise((r) => setTimeout(r, 1500));
        glitch.stop();
        console.log(''); // Clear the line after animation
      }

      // Build output as array of lines
      const lines: string[] = [];
      lines.push('');
      lines.push(chalk.bold.red('  🔥 CODEBASE ROAST 🔥'));
      lines.push('');
      lines.push(
        chalk.italic("  Oh, you want feedback? Alright, let's see what we're working with...")
      );
      lines.push('');

      // Stats roast
      lines.push(chalk.bold.cyan('  📊 The Stats:'));
      lines.push(
        chalk.white(
          `  You have ${stats.fileCount} files. That's ${stats.fileCount} opportunities for bugs. Congratulations.`
        )
      );
      lines.push(
        chalk.white(
          `  ${stats.totalLines.toLocaleString()} lines of code. That's a lot of places to hide mistakes.`
        )
      );
      lines.push('');

      // Generate roasts using helpers
      lines.push(...roastHotspots(roastData));
      lines.push(...roastDeadCode(roastData));
      lines.push(...roastBusFactor(roastData));
      lines.push(...roastNamingCrimes(roastData));
      lines.push(...roastComplexityDistribution(roastData));

      // Final mic drop
      lines.push(chalk.bold.red('  🎤 *drops mic*'));
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

        const spinner = createSpinner('Generating shareable roast image...');
        spinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
        const outputPath = await exportToPng(output, options.png, {
          qrUrl: qrUrl || undefined,
          socialFormat: options.social,
        });

        spinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('roast', qrUrl);
        return;
      }

      console.log(output);
    });
}
