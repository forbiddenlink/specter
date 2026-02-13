/**
 * Roast command - comedic roast of the codebase
 */

import path from 'node:path';
import chalk from 'chalk';
// @ts-expect-error no types
import chalkAnimation from 'chalk-animation';
import type { Command } from 'commander';
import gradient from 'gradient-string';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';

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

      // Hotspots roast
      if (report.hotspots.length > 0) {
        lines.push(chalk.bold.red('  🌶️ Hottest Takes:'));
        for (const hotspot of report.hotspots.slice(0, 5)) {
          const fileName = hotspot.filePath.split('/').pop() || hotspot.filePath;
          let roastLine = '';

          if (fileName.includes('helper') || fileName.includes('util')) {
            roastLine = `Ah yes, the junk drawer of code. ${hotspot.complexity > 1 ? `${Object.values(graph.nodes).filter((n) => n.filePath === hotspot.filePath && n.type === 'function').length} functions, 0 purpose.` : ''}`;
          } else if (fileName === 'index.ts' || fileName === 'index.js') {
            roastLine = `The "I'll organize this later" file. We both know you won't.`;
          } else if (hotspot.complexity > 20) {
            roastLine = `Complexity ${hotspot.complexity}. That's not code, that's job security.`;
          } else if (hotspot.complexity > 15) {
            roastLine = `Complexity ${hotspot.complexity}. Someone really didn't believe in small functions.`;
          } else {
            roastLine = `Complexity ${hotspot.complexity}. It's seen better days.`;
          }

          lines.push(chalk.yellow(`  • ${hotspot.filePath}:${hotspot.lineStart}`));
          lines.push(chalk.dim(`    ${roastLine}`));
        }
        lines.push('');
      }

      // Dead code roast
      if (deadCode.totalCount > 0) {
        lines.push(chalk.bold.gray('  💀 Dead Code:'));
        lines.push(
          chalk.white(
            `  You have ${deadCode.totalCount} unused exports. They're not dead, they're just waiting for someone to care.`
          )
        );
        lines.push(chalk.dim("  They'll keep waiting."));
        lines.push('');
      }

      // Bus factor roast
      if (busFactor.analyzed && busFactor.topOwners.length > 0) {
        const topOwner = busFactor.topOwners[0];
        lines.push(chalk.bold.magenta('  👻 Bus Factor:'));
        if (topOwner.percentage > 60) {
          lines.push(
            chalk.white(`  ${topOwner.name} owns ${topOwner.percentage}% of your codebase.`)
          );
          lines.push(chalk.dim('  Hope they like their job here. Forever.'));
        } else if (busFactor.overallBusFactor < 2) {
          lines.push(
            chalk.white(
              `  Overall bus factor: ${busFactor.overallBusFactor}. That's dangerously low.`
            )
          );
          lines.push(chalk.dim('  One sick day and it all falls apart.'));
        } else {
          lines.push(
            chalk.white(
              `  Bus factor ${busFactor.overallBusFactor}. At least ${Math.ceil(busFactor.overallBusFactor)} people need to win the lottery for this to be a problem.`
            )
          );
        }
        lines.push('');
      }

      // Naming roasts
      const suspiciousFiles = Object.values(graph.nodes)
        .filter((n) => n.type === 'file')
        .filter((n) => {
          const name = n.filePath.split('/').pop() || '';
          return (
            name.includes('helper') ||
            name.includes('util') ||
            name.includes('misc') ||
            name.includes('stuff')
          );
        });

      if (suspiciousFiles.length > 0) {
        lines.push(chalk.bold.yellow('  🤔 Naming Crimes:'));
        for (const file of suspiciousFiles.slice(0, 3)) {
          const name = file.filePath.split('/').pop();
          lines.push(chalk.white(`  • ${file.filePath}`));
          if (name?.includes('helper')) {
            lines.push(
              chalk.dim('    "Helpers" - the universal sign for "I gave up on naming things"')
            );
          } else if (name?.includes('util')) {
            lines.push(chalk.dim('    "Utils" - where functions go to be forgotten'));
          } else if (name?.includes('misc')) {
            lines.push(chalk.dim('    "Misc" - at least you\'re honest about the chaos'));
          } else {
            lines.push(chalk.dim('    This name screams "I\'ll refactor later"'));
          }
        }
        lines.push('');
      }

      // Complexity distribution roast
      if (report.distribution.veryHigh > 0) {
        lines.push(chalk.bold.red('  💣 Complexity Crimes:'));
        lines.push(
          chalk.white(`  ${report.distribution.veryHigh} functions have complexity over 20.`)
        );
        lines.push(chalk.dim("  These aren't functions, they're escape rooms."));
        lines.push('');
      }

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
