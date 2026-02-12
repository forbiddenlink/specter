/**
 * Trends command - show health trends over time
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { loadSnapshots } from '../../history/storage.js';
import { analyzeTrends, getTimeSpan } from '../../history/trends.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatTrendComment } from '../../personality/formatter.js';
import type { PersonalityMode } from '../../personality/types.js';
import { coloredSparkline, healthBar } from '../../ui/index.js';

export function register(program: Command): void {
  program
    .command('trends')
    .description('Show health trends over time')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--period <period>', 'Time period: day, week, month, all', 'week')
    .option(
      '-p, --personality <mode>',
      'Output personality: mentor, critic, historian, cheerleader, minimalist',
      'default'
    )
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const period = options.period as 'day' | 'week' | 'month' | 'all';
      const personality = options.personality as PersonalityMode;

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('trends', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const snapshots = await loadSnapshots(rootDir);
      const snapshotCount = snapshots.length;

      if (snapshotCount === 0) {
        if (options.json) {
          outputJson('trends', { snapshots: [], analysis: null }, { period });
          return;
        }
        console.log(
          chalk.yellow(
            'No health history yet. Run `specter scan` a few times to build up trend data.'
          )
        );
        return;
      }

      const analysis = analyzeTrends(snapshots);
      const timeSpan = getTimeSpan(snapshots);

      // JSON output for CI/CD
      if (options.json) {
        const selectedTrend = analysis.trends[period];
        outputJson(
          'trends',
          {
            current: analysis.current?.metrics || null,
            snapshotCount,
            timeSpan,
            period,
            trend: selectedTrend
              ? {
                  direction: selectedTrend.direction,
                  changePercent: selectedTrend.changePercent,
                  insights: selectedTrend.insights,
                }
              : null,
            snapshots: snapshots.map((s) => ({
              timestamp: s.timestamp,
              commitHash: s.commitHash,
              metrics: s.metrics,
            })),
          },
          { personality, period }
        );
        return;
      }

      const W = 60; // inner width

      console.log();
      console.log(chalk.bold(`╔${'═'.repeat(W)}╗`));
      console.log(
        chalk.bold('║') +
          '  📈 ' +
          chalk.bold.white('SPECTER HEALTH TRENDS') +
          ' '.repeat(W - 27) +
          chalk.bold('║')
      );
      console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

      // Current health
      if (analysis.current) {
        const {
          healthScore,
          avgComplexity: _avgComplexity,
          hotspotCount,
          fileCount,
          totalLines,
        } = analysis.current.metrics;
        const grade =
          healthScore >= 90
            ? 'A'
            : healthScore >= 80
              ? 'B'
              : healthScore >= 70
                ? 'C'
                : healthScore >= 60
                  ? 'D'
                  : 'F';
        const scoreColor =
          healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;

        const scoreLine = `  Current Health: ${scoreColor(String(healthScore))}/100 (Grade ${grade})`;
        console.log(
          chalk.bold('║') + scoreLine + ' '.repeat(W - scoreLine.length + 13) + chalk.bold('║')
        );

        const bar = healthBar(healthScore, 40);
        console.log(`${chalk.bold('║')}  ${bar}${' '.repeat(W - 44)}${chalk.bold('║')}`);

        console.log(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

        // Metrics
        const metricsLine1 = `  Files: ${fileCount}  |  Lines: ${totalLines.toLocaleString()}  |  Hotspots: ${hotspotCount}`;
        console.log(
          chalk.bold('║') + metricsLine1 + ' '.repeat(W - metricsLine1.length + 2) + chalk.bold('║')
        );

        if (analysis.current.commitHash) {
          const commitLine = `  Commit: ${analysis.current.commitHash}`;
          console.log(
            chalk.bold('║') +
              chalk.dim(commitLine) +
              ' '.repeat(W - commitLine.length + 2) +
              chalk.bold('║')
          );
        }
      }

      console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

      // Sparkline trend
      if (snapshots.length >= 2) {
        const scores = [...snapshots].reverse().map((s) => s.metrics.healthScore);
        const sparkline = coloredSparkline(scores, true);
        const sparkTitle = `  Health over ${timeSpan} (${snapshotCount} snapshots):`;
        console.log(
          chalk.bold('║') + sparkTitle + ' '.repeat(W - sparkTitle.length + 2) + chalk.bold('║')
        );
        console.log(
          `${chalk.bold('║')}  ${sparkline}${' '.repeat(W - sparkline.length - 2)}${chalk.bold('║')}`
        );
        console.log(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));
      }

      // Period trends
      const selectedTrend = analysis.trends[period];
      if (selectedTrend && selectedTrend.snapshots.length >= 1) {
        const directionEmoji = {
          improving: '↗️',
          stable: '→',
          declining: '↘️',
        }[selectedTrend.direction];

        const periodLabel = {
          day: 'Today',
          week: 'This Week',
          month: 'This Month',
          all: 'All Time',
        }[period];

        const trendTitle = `  📊 ${periodLabel}: ${directionEmoji} ${selectedTrend.direction.charAt(0).toUpperCase() + selectedTrend.direction.slice(1)}`;
        console.log(
          chalk.bold('║') + trendTitle + ' '.repeat(W - trendTitle.length + 2) + chalk.bold('║')
        );

        if (selectedTrend.changePercent !== 0) {
          const sign = selectedTrend.changePercent > 0 ? '+' : '';
          const changeLine = `  Change: ${sign}${selectedTrend.changePercent}%`;
          const changeColor = selectedTrend.changePercent > 0 ? chalk.green : chalk.red;
          console.log(
            chalk.bold('║') +
              changeColor(changeLine) +
              ' '.repeat(W - changeLine.length + 2) +
              chalk.bold('║')
          );
        }

        // Insights
        if (selectedTrend.insights.length > 0) {
          console.log(chalk.bold('║') + ' '.repeat(W) + chalk.bold('║'));
          const insightsTitle = '  Insights:';
          console.log(
            chalk.bold('║') +
              chalk.cyan(insightsTitle) +
              ' '.repeat(W - insightsTitle.length + 2) +
              chalk.bold('║')
          );
          for (const insight of selectedTrend.insights.slice(0, 5)) {
            const insightLine = `  • ${insight}`.slice(0, W - 2);
            console.log(
              chalk.bold('║') +
                insightLine +
                ' '.repeat(W - insightLine.length + 2) +
                chalk.bold('║')
            );
          }
        }
      } else {
        const noDataLine = `  Not enough data for ${period} trends. Keep scanning!`;
        console.log(
          chalk.bold('║') +
            chalk.dim(noDataLine) +
            ' '.repeat(W - noDataLine.length + 2) +
            chalk.bold('║')
        );
      }

      console.log(chalk.bold(`╚${'═'.repeat(W)}╝`));

      // First-person summary with personality
      console.log();
      if (selectedTrend && personality !== 'default') {
        const personalitySummary = formatTrendComment(
          selectedTrend.direction,
          selectedTrend.changePercent,
          personality
        );
        console.log(chalk.italic(personalitySummary));
      } else {
        console.log(chalk.italic(analysis.summary));
      }
      console.log();
    });
}
