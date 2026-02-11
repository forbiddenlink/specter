#!/usr/bin/env node

/**
 * Specter CLI
 *
 * Command-line interface for scanning codebases and managing
 * the knowledge graph.
 */

import path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import ora, { type Ora } from 'ora';

// Create a spinner that works in both TTY and non-TTY environments
function createSpinner(text: string): Ora {
  const spinner = ora({
    text,
    isSilent: !process.stdout.isTTY,
  });
  if (!process.stdout.isTTY) {
    console.log(text);
  }
  return spinner;
}

import { generateComplexityReport, getComplexityEmoji } from './analyzers/complexity.js';
import { buildKnowledgeGraph, getGraphStats } from './graph/builder.js';
import {
  deleteGraph,
  graphExists,
  isGraphStale,
  loadGraph,
  loadMetadata,
  saveGraph,
} from './graph/persistence.js';
import { loadSnapshots } from './history/storage.js';
import { analyzeTrends, getTimeSpan } from './history/trends.js';
import {
  formatHealthComment,
  formatRiskComment,
  formatTrendComment,
} from './personality/formatter.js';
import type { PersonalityMode } from './personality/types.js';
import { coloredSparkline, healthBar } from './ui/index.js';
import { calculateStats, checkAchievements, achievements } from './achievements.js';
import { formatHoroscope, generateHoroscope } from './horoscope.js';
import { gatherOriginData, generateOriginStory } from './origin.js';
import { gatherWrappedData, formatWrapped } from './wrapped.js';
import { summonSpirits, formatSeance, listRecentlyDeleted } from './seance.js';
import { generateReading, formatReading } from './fortune.js';
import { generateDNA, formatDNA, generateBadge } from './dna.js';

const program = new Command();

program
  .name('specter')
  .description('Give your codebase a voice. Build a knowledge graph and talk to your code.')
  .version('1.0.0');

/**
 * Scan command - builds the knowledge graph
 */
program
  .command('scan')
  .description('Scan the codebase and build the knowledge graph')
  .option('-d, --dir <path>', 'Directory to scan', '.')
  .option('--no-git', 'Skip git history analysis')
  .option('-f, --force', 'Force rescan even if graph exists')
  .option('-q, --quiet', 'Minimal output')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const projectName = path.basename(rootDir);
    const quiet = options.quiet;

    // Cool intro banner
    if (!quiet) {
      console.log();
      console.log(chalk.bold.magenta('  ╔═══════════════════════════════════════════╗'));
      console.log(
        chalk.bold.magenta('  ║') +
          chalk.bold.white('          👻 SPECTER AWAKENING...          ') +
          chalk.bold.magenta('║')
      );
      console.log(chalk.bold.magenta('  ╚═══════════════════════════════════════════╝'));
      console.log();
    }

    const spinner = createSpinner('Initializing...').start();

    try {
      // Check if graph already exists and is fresh
      if (!options.force && (await graphExists(rootDir))) {
        const isStale = await isGraphStale(rootDir);
        if (!isStale) {
          spinner.info('I already know this codebase. Use --force to rescan.');
          return;
        }
        spinner.text = 'My memory is stale, relearning...';
      }

      const _lastFile = '';
      const _discoveries: string[] = [];

      const result = await buildKnowledgeGraph({
        rootDir,
        includeGitHistory: options.git !== false,
        onProgress: (phase, completed, total) => {
          if (phase === 'Analyzing AST' && total > 1) {
            // Create a progress bar
            const barWidth = 25;
            const progress = completed / total;
            const filled = Math.round(progress * barWidth);
            const empty = barWidth - filled;
            const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
            const percent = Math.round(progress * 100);

            spinner.text = `Learning about myself... ${bar} ${percent}% (${completed}/${total})`;
          } else if (phase === 'Building import graph') {
            spinner.text = '🔗 Mapping my connections...';
          } else if (phase === 'Analyzing git history') {
            spinner.text = '📜 Reading my history...';
          } else if (total > 1) {
            spinner.text = `${phase}... ${completed}/${total}`;
          } else {
            spinner.text = `${phase}...`;
          }
        },
      });

      // Save the graph
      await saveGraph(result.graph, rootDir);

      spinner.succeed(chalk.bold('I am awake!'));

      // Print summary with personality
      const stats = getGraphStats(result.graph);

      if (!quiet) {
        console.log();
        console.log(chalk.bold('┌─────────────────────────────────────────────┐'));
        console.log(
          chalk.bold('│') +
            chalk.cyan(`  👻 I am ${chalk.bold(projectName)}`.padEnd(44)) +
            chalk.bold('│')
        );
        console.log(chalk.bold('├─────────────────────────────────────────────┤'));
        console.log(
          chalk.bold('│') +
            `  📁 Files:       ${chalk.cyan(String(stats.fileCount).padStart(6))}`.padEnd(50) +
            chalk.bold('│')
        );
        console.log(
          chalk.bold('│') +
            `  📝 Lines:       ${chalk.cyan(stats.totalLines.toLocaleString().padStart(6))}`.padEnd(
              50
            ) +
            chalk.bold('│')
        );
        console.log(
          chalk.bold('│') +
            `  🔣 Symbols:     ${chalk.cyan(String(stats.nodeCount - stats.fileCount).padStart(6))}`.padEnd(
              50
            ) +
            chalk.bold('│')
        );
        console.log(
          chalk.bold('│') +
            `  🔗 Relations:   ${chalk.cyan(String(stats.edgeCount).padStart(6))}`.padEnd(50) +
            chalk.bold('│')
        );
        console.log(chalk.bold('├─────────────────────────────────────────────┤'));

        // Complexity personality
        const healthScore = Math.max(0, 100 - stats.avgComplexity * 5);
        const mood = healthScore >= 80 ? '😊' : healthScore >= 60 ? '😐' : '😰';
        console.log(
          chalk.bold('│') +
            `  ${mood} Health:     ${getComplexityEmoji(stats.avgComplexity)} ${chalk.yellow(Math.round(healthScore))}/100`.padEnd(
              48
            ) +
            chalk.bold('│')
        );

        if (stats.maxComplexity > 15) {
          console.log(
            chalk.bold('│') +
              chalk.yellow(`  ⚠️  I have some complex areas...`).padEnd(48) +
              chalk.bold('│')
          );
        }

        console.log(chalk.bold('└─────────────────────────────────────────────┘'));

        // Languages
        console.log();
        const langs = Object.entries(stats.languages)
          .map(([lang, count]) => `${lang}: ${count}`)
          .join(', ');
        console.log(chalk.dim(`  Languages: ${langs}`));
        console.log(chalk.dim(`  Scan time: ${stats.scanDurationMs}ms`));
      }

      // Show errors/warnings (keep these concise)
      if (result.errors.length > 0) {
        console.log();
        console.log(chalk.bold.red(`⚠️  ${result.errors.length} files I couldn't understand`));
        for (const error of result.errors.slice(0, 3)) {
          console.log(chalk.dim(`  ${error.file}`));
        }
        if (result.errors.length > 3) {
          console.log(chalk.dim(`  ... and ${result.errors.length - 3} more`));
        }
      }

      // Final message with personality
      console.log();
      console.log(chalk.bold.green('  ✨ I am ready to talk!'));
      console.log(chalk.dim('  Ask me: @specter Tell me about yourself'));
      console.log();
    } catch (error) {
      spinner.fail('Failed to awaken');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Status command - show graph status
 */
program
  .command('status')
  .description('Show the current graph status')
  .option('-d, --dir <path>', 'Directory to check', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const exists = await graphExists(rootDir);

    if (!exists) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const metadata = await loadMetadata(rootDir);
    const isStale = await isGraphStale(rootDir);

    console.log();
    console.log(chalk.bold('👻 Specter Status'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(`  Status:     ${isStale ? chalk.yellow('Stale') : chalk.green('Fresh')}`);
    console.log(`  Scanned:    ${chalk.cyan(metadata?.scannedAt || 'Unknown')}`);
    console.log(`  Files:      ${chalk.cyan(metadata?.fileCount || 0)}`);
    console.log(`  Lines:      ${chalk.cyan(metadata?.totalLines?.toLocaleString() || 0)}`);
    console.log(`  Nodes:      ${chalk.cyan(metadata?.nodeCount || 0)}`);
    console.log(`  Edges:      ${chalk.cyan(metadata?.edgeCount || 0)}`);

    if (isStale) {
      console.log();
      console.log(chalk.yellow('Run `specter scan` to update the graph.'));
    }
  });

/**
 * Health command - show codebase health report
 */
program
  .command('health')
  .description('Generate a codebase health report')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-l, --limit <n>', 'Number of hotspots to show', '10')
  .option(
    '-p, --personality <mode>',
    'Output personality: mentor, critic, historian, cheerleader, minimalist',
    'default'
  )
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const limit = parseInt(options.limit, 10);
    const personality = options.personality as PersonalityMode;

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const report = generateComplexityReport(graph);

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
    const healthScore = Math.max(0, 100 - report.averageComplexity * 5);
    const scoreColor =
      healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
    const scoreEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';

    const W = 60; // inner width

    console.log();
    console.log(chalk.bold(`╔${'═'.repeat(W)}╗`));
    console.log(
      chalk.bold('║') +
        '  👻 ' +
        chalk.bold.white('SPECTER HEALTH REPORT') +
        ' '.repeat(W - 27) +
        chalk.bold('║')
    );
    console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Health score with large display
    const scoreDisplay = `${Math.round(healthScore)}`.padStart(3);
    const scoreLine = `  ${scoreEmoji} Health Score: ${scoreDisplay}/100`;
    console.log(
      chalk.bold('║') + scoreLine + ' '.repeat(W - scoreLine.length + 4) + chalk.bold('║')
    );
    const barLine = `     ${progressBar(healthScore, 100, 40, scoreColor)}`;
    console.log(chalk.bold('║') + barLine + ' '.repeat(W - 45) + chalk.bold('║'));
    console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Complexity distribution with bars
    const distTitle = '  📊 Complexity Distribution';
    console.log(
      chalk.bold('║') + distTitle + ' '.repeat(W - distTitle.length + 2) + chalk.bold('║')
    );
    console.log(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

    const formatRow = (
      emoji: string,
      label: string,
      count: number,
      color: (s: string) => string
    ) => {
      const countStr = String(count).padStart(4);
      const bar = progressBar(count, totalFunctions || 1, barWidth, color);
      const line = `  ${emoji} ${label.padEnd(16)} ${bar} ${countStr}`;
      return chalk.bold('║') + line + ' '.repeat(W - line.length + 6) + chalk.bold('║');
    };

    console.log(formatRow('🟢', 'Low (1-5)', report.distribution.low, chalk.green));
    console.log(formatRow('🟡', 'Medium (6-10)', report.distribution.medium, chalk.yellow));
    console.log(formatRow('🟠', 'High (11-20)', report.distribution.high, chalk.hex('#FFA500')));
    console.log(formatRow('🔴', 'Critical (21+)', report.distribution.veryHigh, chalk.red));

    console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Hotspots
    if (report.hotspots.length > 0) {
      const hotspotTitle = `  🔥 Top ${Math.min(limit, report.hotspots.length)} Complexity Hotspots`;
      console.log(
        chalk.bold('║') + hotspotTitle + ' '.repeat(W - hotspotTitle.length + 2) + chalk.bold('║')
      );
      console.log(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

      for (const hotspot of report.hotspots.slice(0, limit)) {
        const emoji = getComplexityEmoji(hotspot.complexity);
        const location = `${hotspot.filePath}:${hotspot.lineStart}`.slice(0, 48);
        const info = `${hotspot.name} (${hotspot.type})`.slice(0, 40);
        const complexity = String(hotspot.complexity).padStart(2);

        const line1 = `  ${emoji} ${location}`;
        console.log(
          chalk.bold('║') + chalk.cyan(line1) + ' '.repeat(W - line1.length + 2) + chalk.bold('║')
        );
        const line2 = `     ${info}`;
        const cplx = `C:${complexity}`;
        console.log(
          chalk.bold('║') +
            chalk.dim(line2) +
            ' '.repeat(W - line2.length - cplx.length - 1) +
            chalk.yellow(cplx) +
            ' ' +
            chalk.bold('║')
        );
      }
    } else {
      const noHotspots = '  ✨ No complexity hotspots found! Great job!';
      console.log(
        chalk.bold('║') +
          chalk.green(noHotspots) +
          ' '.repeat(W - noHotspots.length) +
          chalk.bold('║')
      );
    }

    console.log(chalk.bold(`╚${'═'.repeat(W)}╝`));

    // Summary line with personality
    console.log();
    const healthComment = formatHealthComment(healthScore, personality);
    if (healthScore >= 80) {
      console.log(chalk.green(`  ${healthComment}`));
    } else if (healthScore >= 60) {
      console.log(chalk.yellow(`  ${healthComment}`));
    } else {
      console.log(chalk.red(`  ${healthComment}`));
    }
  });

/**
 * Trends command - show health trends over time
 */
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
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const period = options.period as 'day' | 'week' | 'month' | 'all';
    const personality = options.personality as PersonalityMode;

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const snapshots = await loadSnapshots(rootDir);
    const snapshotCount = snapshots.length;

    if (snapshotCount === 0) {
      console.log(
        chalk.yellow(
          'No health history yet. Run `specter scan` a few times to build up trend data.'
        )
      );
      return;
    }

    const analysis = analyzeTrends(snapshots);
    const timeSpan = getTimeSpan(snapshots);

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
            chalk.bold('║') + insightLine + ' '.repeat(W - insightLine.length + 2) + chalk.bold('║')
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

/**
 * Risk command - analyze commit/PR risk
 */
program
  .command('risk')
  .description('Analyze risk of staged changes or commits')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--staged', 'Analyze staged changes (default)', true)
  .option('-b, --branch <branch>', 'Compare against branch')
  .option('-c, --commit <hash>', 'Analyze specific commit')
  .option(
    '-p, --personality <mode>',
    'Output personality: mentor, critic, historian, cheerleader, minimalist',
    'default'
  )
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const personality = options.personality as PersonalityMode;

    const graph = await loadGraph(rootDir);
    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const spinner = createSpinner('Analyzing risk...').start();

    try {
      // Dynamic import to avoid loading risk code unless needed
      const { calculateRiskScore } = await import('./risk/scorer.js');

      const risk = await calculateRiskScore(rootDir, graph, {
        staged: options.staged,
        branch: options.branch,
        commit: options.commit,
      });

      spinner.stop();

      // Display risk score with visual
      const levelColor =
        risk.level === 'low'
          ? chalk.green
          : risk.level === 'medium'
            ? chalk.yellow
            : risk.level === 'high'
              ? chalk.hex('#FFA500')
              : chalk.red;

      const levelEmoji =
        risk.level === 'low'
          ? '\u{1F7E2}'
          : risk.level === 'medium'
            ? '\u{1F7E1}'
            : risk.level === 'high'
              ? '\u{1F7E0}'
              : '\u{1F534}';

      const W = 55; // inner width

      console.log();
      console.log(chalk.bold(`\u2554${'\u2550'.repeat(W)}\u2557`));
      console.log(
        chalk.bold('\u2551') +
          '  \u{1F47B} ' +
          chalk.bold.white('SPECTER RISK ANALYSIS') +
          ' '.repeat(W - 27) +
          chalk.bold('\u2551')
      );
      console.log(chalk.bold(`\u2560${'\u2550'.repeat(W)}\u2563`));

      // Overall score with big display
      const riskLabel = `  ${levelEmoji} Risk: ${levelColor(risk.level.toUpperCase())} ${risk.overall}/100`;
      console.log(
        chalk.bold('\u2551') +
          riskLabel +
          ' '.repeat(W - riskLabel.length + 13) +
          chalk.bold('\u2551')
      );

      // Progress bar for risk
      const barWidth = 40;
      const filled = Math.round((risk.overall / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = levelColor('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty));
      console.log(
        `${chalk.bold('\u2551')}  ${bar}${' '.repeat(W - barWidth - 4)}${chalk.bold('\u2551')}`
      );

      console.log(chalk.bold(`\u2560${'\u2550'.repeat(W)}\u2563`));

      // Factor breakdown
      const factorTitle = '  Risk Factors:';
      console.log(
        chalk.bold('\u2551') +
          chalk.cyan(factorTitle) +
          ' '.repeat(W - factorTitle.length + 2) +
          chalk.bold('\u2551')
      );
      console.log(
        chalk.bold('\u2551') + chalk.dim(`  ${'\u2500'.repeat(W - 4)}`) + chalk.bold('\u2551')
      );

      for (const [, factor] of Object.entries(risk.factors)) {
        const factorBar = (() => {
          const fWidth = 12;
          const fFilled = Math.round((factor.score / 100) * fWidth);
          const fEmpty = fWidth - fFilled;
          const fColor =
            factor.score <= 25
              ? chalk.green
              : factor.score <= 50
                ? chalk.yellow
                : factor.score <= 75
                  ? chalk.hex('#FFA500')
                  : chalk.red;
          return fColor('\u2588'.repeat(fFilled)) + chalk.dim('\u2591'.repeat(fEmpty));
        })();
        const scorePad = factor.score.toString().padStart(3);
        const factorLine = `  ${factor.name.padEnd(18)} ${factorBar} ${scorePad}`;
        console.log(
          chalk.bold('\u2551') +
            factorLine +
            ' '.repeat(W - factorLine.length + 2) +
            chalk.bold('\u2551')
        );
      }

      console.log(chalk.bold(`\u2560${'\u2550'.repeat(W)}\u2563`));

      // Recommendations
      if (risk.recommendations.length > 0) {
        const recTitle = '  Recommendations:';
        console.log(
          chalk.bold('\u2551') +
            chalk.yellow(recTitle) +
            ' '.repeat(W - recTitle.length + 2) +
            chalk.bold('\u2551')
        );
        for (const rec of risk.recommendations) {
          const recLine = `  \u2022 ${rec.slice(0, W - 6)}`;
          console.log(
            chalk.bold('\u2551') +
              recLine +
              ' '.repeat(Math.max(0, W - recLine.length + 2)) +
              chalk.bold('\u2551')
          );
        }
      }

      console.log(chalk.bold(`\u255A${'\u2550'.repeat(W)}\u255D`));

      // Summary with personality
      console.log();
      if (personality !== 'default') {
        const personalitySummary = formatRiskComment(risk.level, risk.overall, personality);
        console.log(chalk.italic(personalitySummary));
      } else {
        console.log(chalk.italic(risk.summary));
      }
      console.log();
    } catch (error) {
      spinner.fail('Risk analysis failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

/**
 * Vitals command - real-time vital signs dashboard
 */
program
  .command('vitals')
  .description('Show codebase vital signs')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--live', 'Live updating mode')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const report = generateComplexityReport(graph);
    const stats = getGraphStats(graph);

    // Get file paths for bus factor analysis
    const filePaths = Object.values(graph.nodes)
      .filter((n) => n.type === 'file')
      .map((n) => n.filePath);

    // Analyze bus factor
    const { analyzeKnowledgeDistribution } = await import('./analyzers/knowledge.js');
    const busFactor = await analyzeKnowledgeDistribution(rootDir, filePaths, {
      maxCommits: 200,
    });

    // Calculate health score
    const healthScore = Math.max(0, 100 - report.averageComplexity * 5);
    const healthColor =
      healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
    const pulseStatus =
      healthScore >= 80 ? 'STABLE' : healthScore >= 60 ? 'ELEVATED' : 'CRITICAL';

    // Calculate metrics for display
    const avgComplexity = report.averageComplexity;
    const busFactorValue = busFactor.overallBusFactor || 0;

    // Count dead/unused exports
    const exportedNodes = Object.values(graph.nodes).filter((n) => n.exported && n.type !== 'file');
    const importEdges = graph.edges.filter((e) => e.type === 'imports');
    const importedIds = new Set(importEdges.map((e) => e.target));
    const deadExports = exportedNodes.filter((n) => !importedIds.has(n.id)).length;

    // Calculate coverage estimate (files with complexity data / total files)
    const filesWithComplexity = Object.values(graph.nodes).filter(
      (n) => n.type === 'file' && n.complexity !== undefined
    ).length;
    const coverageEstimate = stats.fileCount > 0 ? (filesWithComplexity / stats.fileCount) * 100 : 0;

    // Load snapshots for heartbeat sparkline
    const snapshots = await loadSnapshots(rootDir);
    const heartbeatData = snapshots
      .slice(0, 30)
      .reverse()
      .map((s) => s.metrics.healthScore);

    // Helper to create progress bar
    const makeBar = (value: number, max: number, width: number = 10): string => {
      const filled = Math.round((value / max) * width);
      const empty = width - filled;
      return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    };

    // Determine status indicators
    const getHealthIndicator = () => {
      const change =
        snapshots.length >= 2
          ? snapshots[0].metrics.healthScore - snapshots[1].metrics.healthScore
          : 0;
      if (change > 0) return chalk.green(`\u{1F4C8} +${change}`);
      if (change < 0) return chalk.red(`${change}`);
      return chalk.dim('--');
    };

    const getComplexityStatus = () => {
      if (avgComplexity <= 5) return chalk.green('healthy');
      if (avgComplexity <= 10) return chalk.yellow('\u26A0\uFE0F  warning');
      return chalk.red('critical');
    };

    const getBusFactorStatus = () => {
      if (busFactorValue >= 3) return chalk.green('healthy');
      if (busFactorValue >= 2) return chalk.yellow('\u{1F630} at risk');
      return chalk.red('critical');
    };

    const getDeadCodeStatus = () => {
      if (deadExports === 0) return chalk.green('clean');
      if (deadExports <= 5) return chalk.yellow('\u{1F47B} haunted');
      return chalk.red('infested');
    };

    const getCoverageStatus = () => {
      if (coverageEstimate >= 80) return chalk.green('\u{1F6E1}\uFE0F  solid');
      if (coverageEstimate >= 50) return chalk.yellow('\u{1F6E1}\uFE0F  decent');
      return chalk.red('sparse');
    };

    // Build display - use fixed width without ANSI calculations
    const W = 51;
    const B = chalk.bold.magenta; // Border color shorthand

    // Helper to pad a line to width (use for uncolored text only)
    const padLine = (content: string, width: number = W): string => {
      const visibleLen = content.replace(/\x1b\[[0-9;]*m/g, '').length;
      const padding = Math.max(0, width - visibleLen);
      return content + ' '.repeat(padding);
    };

    console.log();
    console.log(B(`\u2554${'\u2550'.repeat(W)}\u2557`));

    // Header with pulse
    const pulseColor = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
    console.log(
      B('\u2551') +
        chalk.bold.white('  SPECTER VITAL SIGNS') +
        '              ' +
        '\u2764\uFE0F  ' +
        pulseColor(`PULSE: ${pulseStatus}`) +
        B('\u2551')
    );

    console.log(B(`\u2560${'\u2550'.repeat(W)}\u2563`));
    console.log(B('\u2551') + ' '.repeat(W) + B('\u2551'));

    // Health score - calculate indicator text without ANSI for padding
    const healthIndicatorVal = snapshots.length >= 2
      ? snapshots[0].metrics.healthScore - snapshots[1].metrics.healthScore
      : 0;
    const healthIndicatorText = healthIndicatorVal > 0 ? `+${healthIndicatorVal}` : healthIndicatorVal < 0 ? `${healthIndicatorVal}` : '--';
    const healthIndicator = healthIndicatorVal > 0 ? chalk.green(`\u{1F4C8} ${healthIndicatorText}`) :
                            healthIndicatorVal < 0 ? chalk.red(healthIndicatorText) :
                            chalk.dim(healthIndicatorText);

    console.log(
      B('\u2551') +
        `  HEALTH      [` + healthColor(makeBar(healthScore, 100, 10)) + `] ` +
        String(Math.round(healthScore)).padStart(2) + `/100   ` +
        healthIndicator +
        ' '.repeat(8) +
        B('\u2551')
    );

    // Complexity
    const complexityColor = avgComplexity <= 5 ? chalk.green : avgComplexity <= 10 ? chalk.yellow : chalk.red;
    const complexityStatus = avgComplexity <= 5 ? 'healthy' : avgComplexity <= 10 ? '\u26A0\uFE0F  warning' : 'critical';
    console.log(
      B('\u2551') +
        `  COMPLEXITY  [` + complexityColor(makeBar(avgComplexity, 30, 10)) + `] ` +
        avgComplexity.toFixed(0).padStart(2) + ` avg   ` +
        complexityColor(complexityStatus) +
        ' '.repeat(4) +
        B('\u2551')
    );

    // Bus factor
    const busColor = busFactorValue >= 3 ? chalk.green : busFactorValue >= 2 ? chalk.yellow : chalk.red;
    const busStatus = busFactorValue >= 3 ? 'healthy' : busFactorValue >= 2 ? '\u{1F630} at risk' : 'critical';
    console.log(
      B('\u2551') +
        `  BUS FACTOR  [` + busColor(makeBar(busFactorValue, 5, 10)) + `] ` +
        busFactorValue.toFixed(1).padStart(3) + `      ` +
        busColor(busStatus) +
        ' '.repeat(4) +
        B('\u2551')
    );

    // Dead code
    const deadColor = deadExports === 0 ? chalk.green : deadExports <= 5 ? chalk.yellow : chalk.red;
    const deadStatus = deadExports === 0 ? 'clean' : deadExports <= 5 ? '\u{1F47B} haunted' : 'infested';
    const deadBarVal = deadExports === 0 ? 0 : Math.min(deadExports, 20);
    console.log(
      B('\u2551') +
        `  DEAD CODE   [` + deadColor(makeBar(deadBarVal, 20, 10)) + `] ` +
        String(deadExports).padStart(3) + ` exp  ` +
        deadColor(deadStatus) +
        ' '.repeat(4) +
        B('\u2551')
    );

    // Coverage estimate
    const covColor = coverageEstimate >= 80 ? chalk.green : coverageEstimate >= 50 ? chalk.yellow : chalk.red;
    const covStatus = coverageEstimate >= 80 ? '\u{1F6E1}\uFE0F  solid' : coverageEstimate >= 50 ? '\u{1F6E1}\uFE0F  decent' : 'sparse';
    console.log(
      B('\u2551') +
        `  COVERAGE    [` + covColor(makeBar(coverageEstimate, 100, 10)) + `] ` +
        Math.round(coverageEstimate).toString().padStart(2) + `%      ` +
        covColor(covStatus) +
        ' '.repeat(4) +
        B('\u2551')
    );

    console.log(B('\u2551') + ' '.repeat(W) + B('\u2551'));
    console.log(B(`\u2560${'\u2550'.repeat(W)}\u2563`));

    // Heartbeat sparkline
    console.log(B('\u2551') + `  \u{1F493} HEARTBEAT (last 30 scans)` + ' '.repeat(23) + B('\u2551'));

    if (heartbeatData.length >= 2) {
      const sparkline = coloredSparkline(heartbeatData, true);
      // Sparkline length varies, pad to fill the box
      const sparklineVisibleLen = sparkline.replace(/\x1b\[[0-9;]*m/g, '').length;
      console.log(B('\u2551') + `  ${sparkline}` + ' '.repeat(Math.max(0, W - sparklineVisibleLen - 2)) + B('\u2551'));
    } else {
      console.log(B('\u2551') + chalk.dim('  (need more scans for heartbeat data)') + ' '.repeat(11) + B('\u2551'));
    }

    console.log(B(`\u2560${'\u2550'.repeat(W)}\u2563`));

    // Diagnosis
    let diagnosis = 'Stable with minor concerns';
    let prescription = 'Consider refactoring top hotspots';

    if (healthScore >= 90) {
      diagnosis = 'Excellent health - keep it up!';
      prescription = 'Maintain current practices';
    } else if (healthScore >= 80) {
      diagnosis = 'Good health with room to improve';
      prescription = 'Address any complexity warnings';
    } else if (healthScore >= 60) {
      diagnosis = 'Moderate health - attention needed';
      prescription = 'Prioritize refactoring hotspots';
    } else {
      diagnosis = 'Critical - immediate action needed';
      prescription = 'Emergency complexity reduction';
    }

    const diagPadding = Math.max(0, W - 14 - diagnosis.length);
    console.log(B('\u2551') + `  DIAGNOSIS: ${diagnosis}` + ' '.repeat(diagPadding) + B('\u2551'));

    const rxPadding = Math.max(0, W - 6 - prescription.length);
    console.log(B('\u2551') + chalk.dim(`  Rx: ${prescription}`) + ' '.repeat(rxPadding) + B('\u2551'));

    console.log(B(`\u255A${'\u2550'.repeat(W)}\u255D`));
    console.log();
  });

/**
 * Tinder command - dating profile for your codebase
 */
program
  .command('tinder')
  .description('Generate a dating profile for your codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const projectName = path.basename(rootDir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const report = generateComplexityReport(graph);
    const stats = getGraphStats(graph);

    // Get file paths for bus factor analysis
    const filePaths = Object.values(graph.nodes)
      .filter((n) => n.type === 'file')
      .map((n) => n.filePath);

    // Analyze bus factor
    const { analyzeKnowledgeDistribution } = await import('./analyzers/knowledge.js');
    const busFactor = await analyzeKnowledgeDistribution(rootDir, filePaths, {
      maxCommits: 200,
    });

    // Calculate various stats
    const healthScore = Math.max(0, 100 - report.averageComplexity * 5);
    const busFactorValue = busFactor.overallBusFactor || 0;
    const hotspotCount = report.hotspots.length;

    // Determine primary language
    const languages = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
    const primaryLang = languages[0]?.[0] || 'Unknown';
    const langPercent = languages[0] ? Math.round((languages[0][1] / stats.fileCount) * 100) : 0;

    // Calculate age from first file modification (approximation using scan time)
    const scannedAt = new Date(graph.metadata.scannedAt);
    const ageMonths = Math.max(1, Math.floor((Date.now() - scannedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));

    // Check for common "red flag" files
    const hasHelpers = Object.values(graph.nodes).some(
      (n) => n.type === 'file' && n.name.toLowerCase().includes('helper')
    );
    const hasUtils = Object.values(graph.nodes).some(
      (n) => n.type === 'file' && n.name.toLowerCase().includes('util')
    );

    // Count circular dependencies (simplified: files that import each other)
    const importEdges = graph.edges.filter((e) => e.type === 'imports');
    const importPairs = new Set<string>();
    let circularCount = 0;
    for (const edge of importEdges) {
      const reverseKey = `${edge.target}->${edge.source}`;
      if (importPairs.has(reverseKey)) {
        circularCount++;
      }
      importPairs.add(`${edge.source}->${edge.target}`);
    }

    // Count tools/functions
    const functionCount = Object.values(graph.nodes).filter((n) => n.type === 'function').length;

    // Generate bio based on stats
    const generateBio = (): string[] => {
      const lines: string[] = [];

      if (healthScore >= 80) {
        lines.push('Healthy, well-maintained, and looking for');
        lines.push('developers who appreciate clean code.');
      } else if (healthScore >= 60) {
        lines.push('Complex on the inside, well-documented');
        lines.push('on the outside. Looking for developers');
        lines.push('who appreciate a good type system.');
      } else {
        lines.push("I'm a work in progress, but I've got");
        lines.push('potential. Seeking patient developers');
        lines.push('who enjoy a challenge.');
      }

      lines.push('');

      if (functionCount > 50) {
        lines.push(`I have ${functionCount} functions and I know how to`);
        lines.push('use them.');
      } else if (functionCount > 20) {
        lines.push(`Compact but capable with ${functionCount} functions.`);
      } else {
        lines.push(`Small but mighty with ${functionCount} functions.`);
      }

      if (hotspotCount > 0) {
        lines.push(`Swipe right if you can handle my`);
        lines.push(`${hotspotCount} complexity hotspot${hotspotCount !== 1 ? 's' : ''}. \u{1F60F}`);
      }

      return lines;
    };

    // Generate green flags
    const greenFlags: string[] = [];
    if (langPercent >= 90) {
      greenFlags.push(`${langPercent}% ${primaryLang} (I know my types)`);
    } else if (langPercent >= 70) {
      greenFlags.push(`${langPercent}% ${primaryLang} (mostly typed)`);
    }

    const hasGitHistory = Object.values(graph.nodes).some((n) => n.lastModified);
    if (hasGitHistory) {
      greenFlags.push("Active git history (I'm not ghosting)");
    }

    if (healthScore >= 80) {
      greenFlags.push(`Health score ${Math.round(healthScore)} (I work out)`);
    } else if (healthScore >= 60) {
      greenFlags.push(`Health score ${Math.round(healthScore)} (room to grow)`);
    }

    if (report.distribution.veryHigh === 0) {
      greenFlags.push('No critical complexity (drama-free)');
    }

    if (busFactorValue >= 3) {
      greenFlags.push(`Bus factor ${busFactorValue.toFixed(1)} (team player)`);
    }

    // Generate red flags
    const redFlags: string[] = [];
    if (hasHelpers) {
      redFlags.push('helpers.ts exists (I have baggage)');
    }
    if (hasUtils) {
      redFlags.push('utils/ folder (some skeletons)');
    }
    if (busFactorValue < 2) {
      redFlags.push(`Bus factor ${busFactorValue.toFixed(1)} (attachment issues)`);
    }
    if (circularCount > 0) {
      redFlags.push(`${circularCount} circular dependencies (it's complex)`);
    }
    if (hotspotCount > 10) {
      redFlags.push(`${hotspotCount} complexity hotspots (high maintenance)`);
    }
    if (healthScore < 60) {
      redFlags.push(`Health score ${Math.round(healthScore)} (needs TLC)`);
    }

    // Ensure we have at least one of each
    if (greenFlags.length === 0) {
      greenFlags.push("Still standing (I'm resilient)");
    }
    if (redFlags.length === 0) {
      redFlags.push("Too good to be true? (I'm real!)");
    }

    // Generate conversation starters based on features
    const starters: string[] = [];
    starters.push('"What\'s your complexity score?"');
    starters.push('"Come here often... to refactor?"');

    if (stats.edgeCount > 100) {
      starters.push('"Is that a knowledge graph or are you');
      starters.push(' just happy to see me?"');
    } else {
      starters.push('"Want to see my import graph?"');
    }

    // Build the display
    const W = 45;

    console.log();
    console.log(chalk.magenta('\u{1F495} CODEBASE DATING PROFILE \u{1F495}'));
    console.log();
    console.log(chalk.dim(`\u250C${'\u2500'.repeat(W)}\u2510`));
    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Name and basic info
    const nameLine = `  \u{1F4C1} ${projectName}/`;
    console.log(chalk.dim('\u2502') + chalk.bold.cyan(nameLine) + ' '.repeat(W - nameLine.length + 2) + chalk.dim('\u2502'));

    const infoLine = `  ${stats.fileCount} files \u2022 ${primaryLang} \u2022 Looking for devs`;
    console.log(chalk.dim('\u2502') + infoLine + ' '.repeat(W - infoLine.length + 2) + chalk.dim('\u2502'));

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Basic stats
    const ageLine = `  \u{1F382} Age: ${ageMonths} month${ageMonths !== 1 ? 's' : ''} (estimated)`;
    console.log(chalk.dim('\u2502') + ageLine + ' '.repeat(W - ageLine.length + 2) + chalk.dim('\u2502'));

    const locLine = `  \u{1F4CD} Location: ${rootDir.slice(0, 30)}${rootDir.length > 30 ? '...' : ''}`;
    console.log(chalk.dim('\u2502') + locLine + ' '.repeat(Math.max(0, W - locLine.length + 2)) + chalk.dim('\u2502'));

    const jobLine = `  \u{1F4BC} Occupation: ${primaryLang} Codebase`;
    console.log(chalk.dim('\u2502') + jobLine + ' '.repeat(W - jobLine.length + 2) + chalk.dim('\u2502'));

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Bio
    console.log(chalk.dim('\u2502') + chalk.bold('  \u{1F4DD} Bio:') + ' '.repeat(W - 9) + chalk.dim('\u2502'));
    for (const line of generateBio()) {
      const bioLine = `  ${line}`;
      console.log(chalk.dim('\u2502') + bioLine + ' '.repeat(Math.max(0, W - bioLine.length + 2)) + chalk.dim('\u2502'));
    }

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Green flags
    console.log(chalk.dim('\u2502') + chalk.bold.green('  \u{1F7E2} Green Flags:') + ' '.repeat(W - 17) + chalk.dim('\u2502'));
    for (const flag of greenFlags.slice(0, 4)) {
      const flagLine = `  \u2022 ${flag}`;
      console.log(chalk.dim('\u2502') + chalk.green(flagLine) + ' '.repeat(Math.max(0, W - flagLine.length + 2)) + chalk.dim('\u2502'));
    }

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Red flags
    console.log(chalk.dim('\u2502') + chalk.bold.red('  \u{1F6A9} Red Flags:') + ' '.repeat(W - 16) + chalk.dim('\u2502'));
    for (const flag of redFlags.slice(0, 4)) {
      const flagLine = `  \u2022 ${flag}`;
      console.log(chalk.dim('\u2502') + chalk.red(flagLine) + ' '.repeat(Math.max(0, W - flagLine.length + 2)) + chalk.dim('\u2502'));
    }

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Conversation starters
    console.log(chalk.dim('\u2502') + chalk.bold('  \u{1F4AC} Conversation starters:') + ' '.repeat(W - 27) + chalk.dim('\u2502'));
    for (const starter of starters) {
      const starterLine = `  ${starter}`;
      console.log(chalk.dim('\u2502') + chalk.italic(starterLine) + ' '.repeat(Math.max(0, W - starterLine.length + 2)) + chalk.dim('\u2502'));
    }

    console.log(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    console.log(chalk.dim(`\u2514${'\u2500'.repeat(W)}\u2518`));

    // Swipe buttons
    console.log();
    const passBtn = chalk.red.bold('[\u{1F44E} PASS]');
    const mergeBtn = chalk.green.bold('[\u{1F49A} MERGE]');
    console.log(`        ${passBtn}     ${mergeBtn}`);
    console.log();
  });

/**
 * Clean command - remove cached graph
 */
program
  .command('clean')
  .description('Remove the cached knowledge graph')
  .option('-d, --dir <path>', 'Directory to clean', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    await deleteGraph(rootDir);
    console.log(chalk.green('\u2713 Graph cache removed.'));
  });

/**
 * Roast command - comedic roast of the codebase
 */
program
  .command('roast')
  .description('Get a comedic roast of your codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    // Dynamic imports
    const { generateComplexityReport } = await import('./analyzers/complexity.js');
    const { execute: getDeadCode } = await import('./tools/get-dead-code.js');
    const { execute: getBusFactor } = await import('./tools/get-bus-factor.js');

    const report = generateComplexityReport(graph);
    const deadCode = getDeadCode(graph, { limit: 20 });
    const busFactor = await getBusFactor(graph, { limit: 10 });

    const stats = graph.metadata;

    console.log();
    console.log(chalk.bold.red('  ' + '\u{1F525} CODEBASE ROAST \u{1F525}'));
    console.log();
    console.log(chalk.italic('  Oh, you want feedback? Alright, let\'s see what we\'re working with...'));
    console.log();

    // Stats roast
    console.log(chalk.bold.cyan('  \u{1F4CA} The Stats:'));
    console.log(chalk.white(`  You have ${stats.fileCount} files. That's ${stats.fileCount} opportunities for bugs. Congratulations.`));
    console.log(chalk.white(`  ${stats.totalLines.toLocaleString()} lines of code. That's a lot of places to hide mistakes.`));
    console.log();

    // Hotspots roast
    if (report.hotspots.length > 0) {
      console.log(chalk.bold.red('  \u{1F336}\u{FE0F} Hottest Takes:'));
      for (const hotspot of report.hotspots.slice(0, 5)) {
        const fileName = hotspot.filePath.split('/').pop() || hotspot.filePath;
        let roastLine = '';

        // Special roasts for common naming patterns
        if (fileName.includes('helper') || fileName.includes('util')) {
          roastLine = `Ah yes, the junk drawer of code. ${hotspot.complexity > 1 ? `${Object.values(graph.nodes).filter(n => n.filePath === hotspot.filePath && n.type === 'function').length} functions, 0 purpose.` : ''}`;
        } else if (fileName === 'index.ts' || fileName === 'index.js') {
          roastLine = `The "I'll organize this later" file. We both know you won't.`;
        } else if (hotspot.complexity > 20) {
          roastLine = `Complexity ${hotspot.complexity}. That's not code, that's job security.`;
        } else if (hotspot.complexity > 15) {
          roastLine = `Complexity ${hotspot.complexity}. Someone really didn't believe in small functions.`;
        } else {
          roastLine = `Complexity ${hotspot.complexity}. It's seen better days.`;
        }

        console.log(chalk.yellow(`  \u{2022} ${hotspot.filePath}:${hotspot.lineStart}`));
        console.log(chalk.dim(`    ${roastLine}`));
      }
      console.log();
    }

    // Dead code roast
    if (deadCode.totalCount > 0) {
      console.log(chalk.bold.gray('  \u{1F480} Dead Code:'));
      console.log(chalk.white(`  You have ${deadCode.totalCount} unused exports. They're not dead, they're just waiting for someone to care.`));
      console.log(chalk.dim(`  They'll keep waiting.`));
      console.log();
    }

    // Bus factor roast
    if (busFactor.analyzed && busFactor.topOwners.length > 0) {
      const topOwner = busFactor.topOwners[0];
      console.log(chalk.bold.magenta('  \u{1F47B} Bus Factor:'));
      if (topOwner.percentage > 60) {
        console.log(chalk.white(`  ${topOwner.name} owns ${topOwner.percentage}% of your codebase.`));
        console.log(chalk.dim(`  Hope they like their job here. Forever.`));
      } else if (busFactor.overallBusFactor < 2) {
        console.log(chalk.white(`  Overall bus factor: ${busFactor.overallBusFactor}. That's dangerously low.`));
        console.log(chalk.dim(`  One sick day and it all falls apart.`));
      } else {
        console.log(chalk.white(`  Bus factor ${busFactor.overallBusFactor}. At least ${Math.ceil(busFactor.overallBusFactor)} people need to win the lottery for this to be a problem.`));
      }
      console.log();
    }

    // Naming roasts - check for common bad patterns
    const suspiciousFiles = Object.values(graph.nodes)
      .filter(n => n.type === 'file')
      .filter(n => {
        const name = n.filePath.split('/').pop() || '';
        return name.includes('helper') || name.includes('util') || name.includes('misc') || name.includes('stuff');
      });

    if (suspiciousFiles.length > 0) {
      console.log(chalk.bold.yellow('  \u{1F914} Naming Crimes:'));
      for (const file of suspiciousFiles.slice(0, 3)) {
        const name = file.filePath.split('/').pop();
        console.log(chalk.white(`  \u{2022} ${file.filePath}`));
        if (name?.includes('helper')) {
          console.log(chalk.dim(`    "Helpers" - the universal sign for "I gave up on naming things"`));
        } else if (name?.includes('util')) {
          console.log(chalk.dim(`    "Utils" - where functions go to be forgotten`));
        } else if (name?.includes('misc')) {
          console.log(chalk.dim(`    "Misc" - at least you're honest about the chaos`));
        } else {
          console.log(chalk.dim(`    This name screams "I'll refactor later"`));
        }
      }
      console.log();
    }

    // Complexity distribution roast
    if (report.distribution.veryHigh > 0) {
      console.log(chalk.bold.red('  \u{1F4A3} Complexity Crimes:'));
      console.log(chalk.white(`  ${report.distribution.veryHigh} functions have complexity over 20.`));
      console.log(chalk.dim(`  These aren't functions, they're escape rooms.`));
      console.log();
    }

    // Final mic drop
    console.log(chalk.bold.red('  \u{1F3A4} *drops mic*'));
    console.log();
  });

/**
 * Confess command - have a file confess its sins
 */
program
  .command('confess <file>')
  .description('Have a file confess its sins')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (file: string, options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    // Normalize the file path
    let filePath = file;
    if (!filePath.startsWith(rootDir)) {
      filePath = path.resolve(rootDir, file);
    }

    // Try to find the file in the graph - check various path formats
    let fileNode = graph.nodes[filePath];
    if (!fileNode) {
      // Try relative path from root
      const relativePath = path.relative(rootDir, filePath);
      fileNode = graph.nodes[relativePath];
    }
    if (!fileNode) {
      // Try the original input
      fileNode = graph.nodes[file];
    }
    if (!fileNode) {
      // Search for partial match
      const matchingKey = Object.keys(graph.nodes).find(k =>
        k.endsWith(file) || k.endsWith('/' + file)
      );
      if (matchingKey) {
        fileNode = graph.nodes[matchingKey];
        filePath = matchingKey;
      }
    }

    if (!fileNode || fileNode.type !== 'file') {
      console.log(chalk.red(`\u{274C} File "${file}" not found in the knowledge graph.`));
      console.log(chalk.dim('  Make sure the file is part of the scanned codebase.'));
      console.log(chalk.dim('  Run `specter scan` to update the graph.'));
      return;
    }

    // Get file data
    const { execute: getFileRelationships } = await import('./tools/get-file-relationships.js');
    const relationships = getFileRelationships(graph, { filePath });

    // Get symbols in this file
    const fileSymbols = Object.values(graph.nodes).filter(
      n => n.filePath === filePath && n.type !== 'file'
    );

    // Calculate sins
    const complexity = fileNode.complexity || 0;
    const functionCount = fileSymbols.filter(n => n.type === 'function').length;
    const exportCount = relationships.exports.length;
    const importedByCount = relationships.importedBy.length;

    // Find unused exports (dead code within this file)
    const importedSymbols = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.type === 'imports' && edge.metadata?.symbols) {
        for (const symbol of edge.metadata.symbols as string[]) {
          const originalName = symbol.split(' as ')[0].trim();
          importedSymbols.add(originalName);
        }
      }
    }
    const unusedExports = relationships.exports.filter(e => !importedSymbols.has(e.name));

    // Calculate days since last change
    let daysSinceChange = 0;
    if (fileNode.lastModified) {
      const lastMod = new Date(fileNode.lastModified).getTime();
      daysSinceChange = Math.floor((Date.now() - lastMod) / (1000 * 60 * 60 * 24));
    }

    // Commit count (approximation from modification count)
    const commitCount = fileNode.modificationCount || 0;

    // Check for tests
    const hasTests = Object.keys(graph.nodes).some(k =>
      (k.includes('.test.') || k.includes('.spec.') || k.includes('__tests__')) &&
      k.includes(fileNode.name.replace(/\.[^.]+$/, ''))
    );

    // Display the confession
    const fileName = filePath.split('/').pop() || filePath;

    console.log();
    console.log(chalk.bold.magenta(`  \u{1F64F} CONFESSION: ${fileName}`));
    console.log();
    console.log(chalk.italic.cyan('  Forgive me, developer, for I have sinned.'));
    console.log();

    if (commitCount > 0) {
      console.log(chalk.white(`  It has been ${commitCount} commits since my last refactor.`));
    } else if (daysSinceChange > 0) {
      console.log(chalk.white(`  It has been ${daysSinceChange} days since my last modification.`));
    }
    console.log();

    console.log(chalk.bold.yellow('  I confess:'));

    // Function count sin
    if (functionCount > 10) {
      console.log(chalk.white(`  \u{2022} I harbor ${functionCount} functions that probably don't all belong together.`));
    } else if (functionCount > 0) {
      console.log(chalk.white(`  \u{2022} I contain ${functionCount} function${functionCount > 1 ? 's' : ''}.`));
    }

    // Import sin
    if (importedByCount > 10) {
      console.log(chalk.white(`  \u{2022} I am imported by ${importedByCount} files who don't know what they want from me.`));
    } else if (importedByCount > 5) {
      console.log(chalk.white(`  \u{2022} I am imported by ${importedByCount} files. I carry their burdens.`));
    } else if (importedByCount === 0 && exportCount > 0) {
      console.log(chalk.white(`  \u{2022} I export ${exportCount} things, but nobody imports them. I am alone.`));
    } else if (importedByCount > 0) {
      console.log(chalk.white(`  \u{2022} ${importedByCount} file${importedByCount > 1 ? 's' : ''} depend${importedByCount === 1 ? 's' : ''} on me.`));
    }

    // Dead code sin
    if (unusedExports.length > 0) {
      console.log(chalk.white(`  \u{2022} I have ${unusedExports.length} export${unusedExports.length > 1 ? 's' : ''} that ${unusedExports.length > 1 ? 'are' : 'is'} never used by anyone.`));
    }

    // Complexity sin
    if (complexity > 20) {
      console.log(chalk.white(`  \u{2022} My complexity has reached ${complexity}. I am deeply ashamed.`));
    } else if (complexity > 10) {
      console.log(chalk.white(`  \u{2022} My complexity is ${complexity}. I could be simpler.`));
    } else if (complexity > 0) {
      console.log(chalk.white(`  \u{2022} My complexity is ${complexity}. At least I have that going for me.`));
    }

    // Test sin
    if (!hasTests) {
      console.log(chalk.white(`  \u{2022} I have no tests. Not one.`));
    }

    // Staleness sin
    if (daysSinceChange > 365) {
      console.log(chalk.white(`  \u{2022} I have not been touched in ${Math.floor(daysSinceChange / 365)} year${Math.floor(daysSinceChange / 365) > 1 ? 's' : ''}. I am forgotten.`));
    } else if (daysSinceChange > 180) {
      console.log(chalk.white(`  \u{2022} I have not been touched in ${Math.floor(daysSinceChange / 30)} months. The dust gathers.`));
    }

    console.log();

    // Penance
    const penances: string[] = [];
    if (complexity > 15) penances.push('breaking into smaller, focused functions');
    if (functionCount > 10) penances.push('a refactoring into smaller, focused modules');
    if (unusedExports.length > 0) penances.push('removing my dead code');
    if (!hasTests) penances.push('writing at least one test');
    if (importedByCount > 10) penances.push('reducing my surface area');

    if (penances.length > 0) {
      console.log(chalk.italic.green(`  For my penance, I accept: ${penances.join(', ')}.`));
    } else {
      console.log(chalk.italic.green(`  My sins are few. I am at peace.`));
    }

    console.log();
    console.log(chalk.bold.magenta('  Amen. \u{1F64F}'));
    console.log();
  });

/**
 * Dashboard command - launch interactive web dashboard
 */
program
  .command('dashboard')
  .description('Launch interactive web dashboard')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-p, --port <port>', 'Port to listen on', '3333')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const port = parseInt(options.port, 10);

    // Check graph exists
    if (!(await graphExists(rootDir))) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    console.log();
    console.log(chalk.bold.magenta('  👻 Starting Specter Dashboard...'));
    console.log();

    // Dynamic import to avoid loading dashboard code unless needed
    const { startDashboard } = await import('./dashboard/index.js');

    const { url, close } = await startDashboard({ rootDir, port });

    console.log(chalk.green(`  Dashboard running at ${chalk.bold(url)}`));
    console.log();

    // Open browser (macOS/Linux/Windows)
    if (options.open !== false) {
      const { exec } = await import('node:child_process');
      const platform = process.platform;
      const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${command} ${url}`);
    }

    console.log(chalk.dim('  Press Ctrl+C to stop'));
    console.log();

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n  Shutting down...'));
      await close();
      process.exit(0);
    });
  });

/**
 * Achievements command - view gamified codebase badges
 */
program
  .command('achievements')
  .description('View your codebase achievements')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    // Get dead code count and bus factor for achievement calculation
    const { execute: getDeadCode } = await import('./tools/get-dead-code.js');
    const { execute: getBusFactor } = await import('./tools/get-bus-factor.js');

    const deadCode = getDeadCode(graph, { limit: 1 });
    const busFactor = await getBusFactor(graph, { limit: 1 });

    const stats = calculateStats(
      graph,
      deadCode.totalCount,
      busFactor.analyzed ? busFactor.overallBusFactor : 0
    );

    const { unlocked, locked } = checkAchievements(graph, stats);

    const W = 45; // inner width

    console.log();
    console.log(chalk.bold.yellow('  \ud83c\udfc6 ACHIEVEMENTS'));
    console.log();

    // Unlocked achievements
    console.log(chalk.bold(`\u250c${'\u2500'.repeat(W)}\u2510`));
    console.log(chalk.bold('\u2502') + chalk.green.bold(' UNLOCKED'.padEnd(W - 1)) + chalk.bold('\u2502'));
    console.log(chalk.bold(`\u251c${'\u2500'.repeat(W)}\u2524`));

    if (unlocked.length === 0) {
      const line = ' No achievements unlocked yet...';
      console.log(chalk.bold('\u2502') + chalk.dim(line.padEnd(W - 1)) + chalk.bold('\u2502'));
    } else {
      for (const achievement of unlocked) {
        const line = ` ${achievement.emoji} ${achievement.name} - ${achievement.description}`;
        const truncated = line.slice(0, W - 1);
        console.log(chalk.bold('\u2502') + truncated.padEnd(W - 1) + chalk.bold('\u2502'));
      }
    }
    console.log(chalk.bold(`\u2514${'\u2500'.repeat(W)}\u2518`));

    console.log();

    // Locked achievements
    console.log(chalk.bold(`\u250c${'\u2500'.repeat(W)}\u2510`));
    console.log(chalk.bold('\u2502') + chalk.dim(' \ud83d\udd12 LOCKED'.padEnd(W - 1)) + chalk.bold('\u2502'));
    console.log(chalk.bold(`\u251c${'\u2500'.repeat(W)}\u2524`));

    if (locked.length === 0) {
      const line = ' All achievements unlocked!';
      console.log(chalk.bold('\u2502') + chalk.green(line.padEnd(W - 1)) + chalk.bold('\u2502'));
    } else {
      for (const achievement of locked) {
        const line = ` ${achievement.emoji} ${achievement.name} - ${achievement.description}`;
        const truncated = line.slice(0, W - 1);
        console.log(chalk.bold('\u2502') + chalk.dim(truncated.padEnd(W - 1)) + chalk.bold('\u2502'));
      }
    }
    console.log(chalk.bold(`\u2514${'\u2500'.repeat(W)}\u2518`));

    // Progress
    console.log();
    const total = achievements.length;
    const percent = Math.round((unlocked.length / total) * 100);
    console.log(chalk.cyan(`  Progress: ${unlocked.length}/${total} achievements (${percent}%)`));

    // Progress bar
    const barWidth = 30;
    const filled = Math.round((unlocked.length / total) * barWidth);
    const empty = barWidth - filled;
    const bar = chalk.green('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty));
    console.log(`  ${bar}`);
    console.log();
  });

/**
 * Horoscope command - daily codebase fortune
 */
program
  .command('horoscope')
  .description('Get your codebase horoscope')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const reading = generateHoroscope(graph);
    const output = formatHoroscope(reading);

    console.log();
    // Add some mystical styling
    console.log(chalk.bold.magenta('  ' + '\u2500'.repeat(50)));
    for (const line of output.split('\n')) {
      if (line.startsWith('\ud83d\udd2e')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('Your codebase is')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith("Today's reading:")) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('"')) {
        console.log(chalk.italic.green(`  ${line}`));
      } else if (line.includes('\ud83d\udcab') || line.includes('\u26a0\ufe0f') || line.includes('\ud83c\udfaf') || line.includes('\ud83d\udc95') || line.includes('\ud83d\udeab')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.startsWith("Today's affirmation:")) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log(chalk.bold.magenta('  ' + '\u2500'.repeat(50)));
    console.log();
  });

program
  .command('origin')
  .description('Discover the origin story of your codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Consulting the ancient git logs...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const originData = await gatherOriginData(graph, rootDir);
    spinner.stop();

    const story = generateOriginStory(originData);

    console.log();
    // Print with styling
    for (const line of story.split('\n')) {
      if (line.startsWith('THE ORIGIN OF') || line.startsWith('THE MYSTERY OF')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('═')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.startsWith('CHAPTER')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.startsWith('THE CURRENT EPOCH') || line.startsWith('KEY MILESTONES')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('  •') || line.startsWith('  🏷️') || line.startsWith('  👤')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('first words spoken')) {
        console.log(chalk.italic.green(`  ${line}`));
      } else if (line.startsWith('The story of')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('wrapped')
  .description('Get your Spotify Wrapped-style yearly summary')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-y, --year <year>', 'Year to summarize (default: current year)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const year = options.year ? parseInt(options.year, 10) : undefined;

    const spinner = createSpinner('Unwrapping your year...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const wrappedData = await gatherWrappedData(graph, rootDir, year);
    spinner.stop();

    const output = formatWrapped(wrappedData);

    console.log();
    // Print with gradient styling
    for (const line of output.split('\n')) {
      if (line.startsWith('YOUR ') && line.includes('WRAPPED')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('EDITION')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('━')) {
        console.log(chalk.dim.magenta(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.match(/^THIS YEAR|^YOUR TOP|^BUSIEST|^STREAKS|^FUN FACTS/)) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.match(/^\s+\d+,?\d* COMMITS$/)) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('🥇') || line.startsWith('🥈') || line.startsWith('🥉')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.match(/^\d\./)) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.startsWith('   "')) {
        console.log(chalk.dim.italic(`  ${line}`));
      } else if (line.startsWith('•')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.startsWith('#Specter')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('Thanks for')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('seance [query]')
  .description('Commune with deleted files from git history')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-l, --limit <n>', 'Maximum spirits to summon', '5')
  .option('-c, --contents', 'Show last contents of deleted files')
  .option('--list', 'List recently deleted files')
  .action(async (query, options) => {
    const rootDir = path.resolve(options.dir);
    const limit = parseInt(options.limit, 10) || 5;

    if (options.list) {
      const spinner = createSpinner('Searching the void for lost souls...');
      spinner.start();

      const spirits = await listRecentlyDeleted(rootDir, 20);
      spinner.stop();

      console.log();
      console.log(chalk.dim.magenta('  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░'));
      console.log(chalk.bold.magenta('             RECENTLY DEPARTED'));
      console.log(chalk.dim.magenta('  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░'));
      console.log();

      if (spirits.length === 0) {
        console.log(chalk.dim('    No deleted files found in recent history.'));
      } else {
        for (const spirit of spirits) {
          const date = new Date(spirit.deletedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          console.log(chalk.white(`    👻 ${spirit.path}`));
          console.log(chalk.dim(`       Deleted ${date} by ${spirit.deletedBy}`));
        }
      }

      console.log();
      console.log(chalk.dim('    Use `specter seance <filename>` to commune with a spirit.'));
      console.log(chalk.dim.magenta('  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░'));
      console.log();
      return;
    }

    if (!query) {
      console.log(chalk.yellow('Please provide a file name to search for, or use --list to see recently deleted files.'));
      console.log(chalk.dim('Example: specter seance utils.ts'));
      return;
    }

    const spinner = createSpinner('Conducting séance...');
    spinner.start();

    const result = await summonSpirits(rootDir, query, {
      limit,
      showContents: options.contents,
    });
    spinner.stop();

    const output = formatSeance(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('░')) {
        console.log(chalk.dim.magenta(`  ${line}`));
      } else if (line.includes('S É A N C E') || line.includes('Communing')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('👻') && line.includes('│')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('┌') || line.includes('┐') || line.includes('├') || line.includes('┤') || line.includes('└') || line.includes('┘')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.includes('Passed on:') || line.includes('Deleted by:')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('Born:') || line.includes('Created by:') || line.includes('Lived:')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('Last words:')) {
        console.log(chalk.italic.yellow(`  ${line}`));
      } else if (line.includes('Final words from beyond:')) {
        console.log(chalk.bold.white(`  ${line}`));
      } else if (line.includes('May these files')) {
        console.log(chalk.italic.magenta(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('fortune')
  .alias('tarot')
  .description('Get a tarot reading for your codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-s, --single', 'Draw a single card instead of three')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Shuffling the deck...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const spread = options.single ? 'single' : 'three-card';
    const reading = generateReading(graph, spread);
    spinner.stop();

    const output = formatReading(reading);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('╔') || line.includes('╚') || line.includes('║')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('═')) {
        console.log(chalk.dim.magenta(`  ${line}`));
      } else if (line.startsWith('Reading for:') || line.startsWith('Date:') || line.startsWith('Spread:')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.includes('┌') || line.includes('┐') || line.includes('└') || line.includes('┘')) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.includes('│─') || (line.includes('│') && line.includes('─'))) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.match(/^│\s+(0|I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI)\./)) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('THE ') && line.includes('│')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('PAST') || line.includes('PRESENT') || line.includes('FUTURE')) {
        console.log(chalk.bold.white(`  ${line}`));
      } else if (line.includes('💡 Advice:')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.includes('Reversed')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('Remember:') || line.includes('you write the commits')) {
        console.log(chalk.italic.magenta(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('dna')
  .description('Generate a unique visual DNA fingerprint of your codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-b, --badge', 'Output compact badge format')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Sequencing codebase genome...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const profile = generateDNA(graph);
    spinner.stop();

    const output = options.badge ? generateBadge(profile) : formatDNA(profile);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('━')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.startsWith('  Specimen:') || line.startsWith('  Sequence:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('DOUBLE HELIX') || line.includes('GENETIC TRAITS') || line.includes('GENOME SIGNATURE')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('┌') || line.includes('┐') || line.includes('└') || line.includes('┘') || line.includes('│')) {
        console.log(chalk.dim.blue(`  ${line}`));
      } else if (line.includes('▓') || line.includes('░') || line.includes('─') || line.includes('┄')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.includes('unique to your codebase') || line.includes('No two projects')) {
        console.log(chalk.italic.green(`  ${line}`));
      } else if (line.includes('╭') || line.includes('╰') || line.includes('├')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program.parse();
