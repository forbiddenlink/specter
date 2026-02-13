/**
 * Health command - show codebase health report
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import gradient from 'gradient-string';
import { generateComplexityReport, getComplexityEmoji } from '../../analyzers/complexity.js';
import { showNextSteps } from '../../cli-utils.js';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatHealthComment } from '../../personality/formatter.js';
import type { PersonalityMode } from '../../personality/types.js';
import { animateScore, timingBadge } from '../../ui/progress.js';
import { createSpinner, showShareLinks } from '../types.js';

export function register(program: Command): void {
  program
    .command('health')
    .alias('h')
    .description('Generate a codebase health report')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Number of hotspots to show', '10')
    .option(
      '-p, --personality <mode>',
      'Output personality: mentor, critic, historian, cheerleader, minimalist',
      'default'
    )
    .option('--exit-code', 'Exit with code 1 if health score is below threshold')
    .option('--threshold <n>', 'Health score threshold for --exit-code (default: 50)', '50')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--social', 'Optimize PNG for Twitter/LinkedIn (1200x630)')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .addHelpText(
      'after',
      `
Examples:
  $ specter health
  $ specter h --personality critic
  $ specter health --exit-code --threshold 70
  $ specter h --png health.png --social`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const limit = parseInt(options.limit, 10);
      const personality = options.personality as PersonalityMode;
      const exitCode = options.exitCode;
      const threshold = parseInt(options.threshold, 10);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('health', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const startTime = Date.now();
      const report = generateComplexityReport(graph);
      const healthScore = Math.max(0, 100 - report.averageComplexity * 5);

      // JSON output for CI/CD
      if (options.json) {
        outputJson(
          'health',
          {
            healthScore: Math.round(healthScore),
            averageComplexity: report.averageComplexity,
            maxComplexity: report.maxComplexity,
            distribution: report.distribution,
            hotspots: report.hotspots.slice(0, limit).map((h) => ({
              filePath: h.filePath,
              name: h.name,
              type: h.type,
              complexity: h.complexity,
              lineStart: h.lineStart,
              lineEnd: h.lineEnd,
            })),
            totalHotspots: report.hotspots.length,
          },
          { personality, threshold }
        );
        if (exitCode && healthScore < threshold) {
          process.exit(1);
        }
        return;
      }

      // Helper for progress bars
      const progressBar = (
        value: number,
        max: number,
        width: number,
        color: (s: string) => string
      ): string => {
        const filled = Math.round((value / max) * width);
        const empty = width - filled;
        return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
      };

      // Calculate totals for progress bars
      const totalFunctions =
        report.distribution.low +
        report.distribution.medium +
        report.distribution.high +
        report.distribution.veryHigh;
      const barWidth = 20;

      // Overall score
      const scoreColor =
        healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
      const scoreEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';

      const W = 60; // inner width

      const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);

      // Helper to calculate visible length (strips ANSI codes)
      const stripAnsi = (str: string): string => {
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1b\[[0-9;]*m/g, '');
      };

      const visibleLength = (str: string): number => {
        return stripAnsi(str).length;
      };

      // Build output as array of lines
      const lines: string[] = [];
      lines.push('');
      lines.push(g(`╔${'═'.repeat(W)}╗`));
      lines.push(
        `${g('║')}  👻 ${chalk.bold.white('SPECTER HEALTH REPORT')}${' '.repeat(W - 27)}${g('║')}`
      );
      lines.push(g(`╠${'═'.repeat(W)}╣`));

      // Health score with large display
      const scoreDisplay = `${Math.round(healthScore)}`.padStart(3);
      const scoreLine = `  ${scoreEmoji} Health Score: ${scoreDisplay}/100`;
      lines.push(g('║') + scoreLine + ' '.repeat(W - scoreLine.length + 4) + g('║'));
      const barLine = `     ${progressBar(healthScore, 100, 40, scoreColor)}`;
      lines.push(g('║') + barLine + ' '.repeat(W - visibleLength(barLine)) + g('║'));
      lines.push(g(`╠${'═'.repeat(W)}╣`));

      // Complexity distribution with bars
      const distTitle = '  📊 Complexity Distribution';
      lines.push(g('║') + distTitle + ' '.repeat(W - distTitle.length + 2) + g('║'));
      lines.push(g('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + g('║'));

      const formatRow = (
        emoji: string,
        label: string,
        count: number,
        color: (s: string) => string
      ) => {
        const countStr = String(count).padStart(4);
        const bar = progressBar(count, totalFunctions || 1, barWidth, color);
        const line = `  ${emoji} ${label.padEnd(16)} ${bar} ${countStr}`;
        const padding = Math.max(0, W - visibleLength(line) + 6);
        return g('║') + line + ' '.repeat(padding) + g('║');
      };

      lines.push(formatRow('🟢', 'Low (1-5)', report.distribution.low, chalk.green));
      lines.push(formatRow('🟡', 'Medium (6-10)', report.distribution.medium, chalk.yellow));
      lines.push(formatRow('🟠', 'High (11-20)', report.distribution.high, chalk.hex('#FFA500')));
      lines.push(formatRow('🔴', 'Critical (21+)', report.distribution.veryHigh, chalk.red));

      lines.push(g(`╠${'═'.repeat(W)}╣`));

      // Hotspots
      if (report.hotspots.length > 0) {
        const hotspotTitle = `  🔥 Top ${Math.min(limit, report.hotspots.length)} Complexity Hotspots`;
        lines.push(g('║') + hotspotTitle + ' '.repeat(W - hotspotTitle.length + 2) + g('║'));
        lines.push(g('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + g('║'));

        for (const hotspot of report.hotspots.slice(0, limit)) {
          const emoji = getComplexityEmoji(hotspot.complexity);
          const location = `${hotspot.filePath}:${hotspot.lineStart}`.slice(0, 48);
          const info = `${hotspot.name} (${hotspot.type})`.slice(0, 40);
          const complexity = String(hotspot.complexity).padStart(2);

          const line1 = `  ${emoji} ${location}`;
          const padding1 = Math.max(0, W - line1.length + 2);
          lines.push(g('║') + chalk.cyan(line1) + ' '.repeat(padding1) + g('║'));
          const line2 = `     ${info}`;
          const cplx = `C:${complexity}`;
          const padding2 = Math.max(0, W - line2.length - cplx.length - 1);
          lines.push(
            g('║') + chalk.dim(line2) + ' '.repeat(padding2) + chalk.yellow(cplx) + ' ' + g('║')
          );
        }
      } else {
        const noHotspots = '  ✨ No complexity hotspots found! Great job!';
        const padding = Math.max(0, W - noHotspots.length);
        lines.push(g('║') + chalk.green(noHotspots) + ' '.repeat(padding) + g('║'));
      }

      lines.push(g(`╚${'═'.repeat(W)}╝`));

      // Summary line with personality
      lines.push('');
      const healthComment = formatHealthComment(healthScore, personality);
      if (healthScore >= 80) {
        lines.push(chalk.green(`  ${healthComment}`));
      } else if (healthScore >= 60) {
        lines.push(chalk.yellow(`  ${healthComment}`));
      } else {
        lines.push(chalk.red(`  ${healthComment}`));
      }

      const duration = Date.now() - startTime;
      lines.push('');
      lines.push(chalk.dim(`  Analyzed in ${timingBadge(duration)}`));

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

        const spinner = createSpinner('Generating shareable health report image...');
        spinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
        const outputPath = await exportToPng(output, options.png, {
          qrUrl: qrUrl || undefined,
          socialFormat: options.social,
        });

        spinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('health', qrUrl);
        return;
      }

      // Animate score reveal if in TTY, then show full report
      if (process.stdout.isTTY && !options.png) {
        await animateScore('Health Score', Math.round(healthScore));
        console.log();
      }

      console.log(output);

      // Show next steps suggestions
      if (!options.json) {
        const suggestions = [
          {
            description: 'Find the most problematic files',
            command: 'specter hotspots',
          },
          {
            description: 'Get AI suggestions for improvements',
            command: 'specter ask "How can I improve code quality?"',
          },
          {
            description: 'Track health over time',
            command: 'specter trajectory',
          },
        ];

        // Adjust suggestions based on health score
        if (healthScore < 60) {
          suggestions.unshift({
            description: 'Get immediate refactoring suggestions',
            command: 'specter fix',
          });
        }

        showNextSteps(suggestions);
      }

      // Exit with error code if health is below threshold
      if (exitCode && healthScore < threshold) {
        console.log();
        console.log(
          chalk.red(`  Health score ${Math.round(healthScore)} is below threshold ${threshold}`)
        );
        process.exit(1);
      }
    });
}
