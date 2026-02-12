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

// Display share links after PNG export
function showShareLinks(commandType: string, repoUrl?: string | null): void {
  const shareUrls = generateShareUrls(commandType, repoUrl);
  console.log();
  console.log(chalk.bold.magenta('  📤 Share your results:'));
  console.log(chalk.cyan(`     Twitter: `) + chalk.dim(shareUrls.twitter));
  console.log(chalk.cyan(`     LinkedIn: `) + chalk.dim(shareUrls.linkedin));
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
import { gatherWrappedData, formatWrapped, type WrappedPeriod } from './wrapped.js';
import { summonSpirits, formatSeance, listRecentlyDeleted } from './seance.js';
import { generateReading, formatReading } from './fortune.js';
import { generateDNA, formatDNA, generateBadge } from './dna.js';
import { generateTour, formatTour } from './tour.js';
import { findExperts, formatWho } from './who.js';
import { explainWhy, formatWhy } from './why.js';
import { analyzeZones, formatSafeZones, formatDangerZones } from './zones.js';
import { generateMorning, formatMorning } from './morning.js';
import { generateStandup, formatStandup } from './standup.js';
import { generatePrediction, formatPrediction } from './predict.js';
import { suggestReviewers, formatReviewers } from './reviewers.js';
import { runPrecommitCheck, formatPrecommit } from './precommit.js';
import { detectDrift, formatDrift } from './drift.js';
import { exportToPng, formatAchievementsForExport, isPngExportAvailable, getRepoUrl, generateShareUrls } from './export-png.js';
import { detectCycles, formatCycles } from './cycles.js';
import { analyzeVelocity, formatVelocity } from './velocity.js';
import { projectTrajectory, formatTrajectory } from './trajectory.js';
import { generateKnowledgeMap, formatKnowledgeMap } from './knowledge-map.js';
import {
  generateDiagram,
  saveDiagram,
  formatDiagramOutput,
  getDiagramExtension,
  type DiagramFormat,
} from './diagram.js';
import { searchCodebase, formatSearch, semanticSearch, formatSearchWithMode, type SearchMode } from './search.js';
import {
  buildEmbeddingIndex,
  saveEmbeddingIndex,
  loadEmbeddingIndex,
  embeddingIndexExists,
  isEmbeddingIndexStale,
} from './embeddings.js';
import { analyzeBusFactor, formatBusFactor } from './bus-factor.js';
import { analyzeHotspots, formatHotspots } from './hotspots.js';
import { generateReport, formatReportSummary } from './report.js';
import { analyzeCoupling, formatCoupling } from './coupling.js';
import { calculateDora, formatDora } from './dora.js';
import { analyzeCost, formatCost } from './cost.js';
import { generateLeaderboard, formatLeaderboard } from './leaderboard.js';
import { askCodebase, formatAsk } from './ask.js';
import { compareBranches, formatCompare } from './compare.js';
import { generateChangelog, formatChangelog } from './changelog.js';
import { detectBreakingChanges, formatBreakingChanges } from './breaking-changes.js';
import { generateFix, generateFixAll, formatFix, formatFixAll, type SuggestionSeverity } from './fix.js';
import {
  initializeProject,
  initializeProjectInteractive,
  formatInitWelcome,
  formatInitComplete,
  listAvailablePersonalities,
  INIT_PERSONALITIES,
} from './init.js';

const program = new Command();

/**
 * ASCII banner for Specter CLI
 * Ghost-themed, compact (5-7 lines), purple/magenta theme
 */
function printBanner(): void {
  const ghost = chalk.magenta;
  const bright = chalk.bold.magentaBright;
  const dim = chalk.dim;

  console.log();
  console.log(ghost('   ____                  _            '));
  console.log(ghost('  / ___| _ __   ___  ___| |_ ___ _ __ '));
  console.log(bright('  \\___ \\| \'_ \\ / _ \\/ __| __/ _ \\ \'__|'));
  console.log(bright('   ___) | |_) |  __/ (__| ||  __/ |   '));
  console.log(ghost('  |____/| .__/ \\___|\\___|\\___|\\__|_|   '));
  console.log(ghost('        |_|   ') + dim('Give your codebase a voice'));
  console.log();
}

/**
 * Print version with banner
 */
function printVersion(): void {
  printBanner();
  console.log(chalk.dim(`  v1.0.0`));
  console.log();
}

// Check for version flag early to show banner
const hasVersionFlag = process.argv.includes('-V') || process.argv.includes('--version');
const hasNoCommand = process.argv.length === 2;

if (hasVersionFlag) {
  printVersion();
  process.exit(0);
}

if (hasNoCommand) {
  printBanner();
}

program
  .name('specter')
  .description('Give your codebase a voice. Build a knowledge graph and talk to your code.')
  .version('1.0.0')
  .showSuggestionAfterError(true);

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
  .option('--exit-code', 'Exit with code 1 if health score is below threshold')
  .option('--threshold <n>', 'Health score threshold for --exit-code (default: 50)', '50')
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const limit = parseInt(options.limit, 10);
    const personality = options.personality as PersonalityMode;
    const exitCode = options.exitCode;
    const threshold = parseInt(options.threshold, 10);

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

    // Build output as array of lines
    const lines: string[] = [];
    lines.push('');
    lines.push(chalk.bold(`╔${'═'.repeat(W)}╗`));
    lines.push(
      chalk.bold('║') +
        '  👻 ' +
        chalk.bold.white('SPECTER HEALTH REPORT') +
        ' '.repeat(W - 27) +
        chalk.bold('║')
    );
    lines.push(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Health score with large display
    const scoreDisplay = `${Math.round(healthScore)}`.padStart(3);
    const scoreLine = `  ${scoreEmoji} Health Score: ${scoreDisplay}/100`;
    lines.push(
      chalk.bold('║') + scoreLine + ' '.repeat(W - scoreLine.length + 4) + chalk.bold('║')
    );
    const barLine = `     ${progressBar(healthScore, 100, 40, scoreColor)}`;
    lines.push(chalk.bold('║') + barLine + ' '.repeat(W - 45) + chalk.bold('║'));
    lines.push(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Complexity distribution with bars
    const distTitle = '  📊 Complexity Distribution';
    lines.push(
      chalk.bold('║') + distTitle + ' '.repeat(W - distTitle.length + 2) + chalk.bold('║')
    );
    lines.push(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

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

    lines.push(formatRow('🟢', 'Low (1-5)', report.distribution.low, chalk.green));
    lines.push(formatRow('🟡', 'Medium (6-10)', report.distribution.medium, chalk.yellow));
    lines.push(formatRow('🟠', 'High (11-20)', report.distribution.high, chalk.hex('#FFA500')));
    lines.push(formatRow('🔴', 'Critical (21+)', report.distribution.veryHigh, chalk.red));

    lines.push(chalk.bold(`╠${'═'.repeat(W)}╣`));

    // Hotspots
    if (report.hotspots.length > 0) {
      const hotspotTitle = `  🔥 Top ${Math.min(limit, report.hotspots.length)} Complexity Hotspots`;
      lines.push(
        chalk.bold('║') + hotspotTitle + ' '.repeat(W - hotspotTitle.length + 2) + chalk.bold('║')
      );
      lines.push(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

      for (const hotspot of report.hotspots.slice(0, limit)) {
        const emoji = getComplexityEmoji(hotspot.complexity);
        const location = `${hotspot.filePath}:${hotspot.lineStart}`.slice(0, 48);
        const info = `${hotspot.name} (${hotspot.type})`.slice(0, 40);
        const complexity = String(hotspot.complexity).padStart(2);

        const line1 = `  ${emoji} ${location}`;
        lines.push(
          chalk.bold('║') + chalk.cyan(line1) + ' '.repeat(W - line1.length + 2) + chalk.bold('║')
        );
        const line2 = `     ${info}`;
        const cplx = `C:${complexity}`;
        lines.push(
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
      lines.push(
        chalk.bold('║') +
          chalk.green(noHotspots) +
          ' '.repeat(W - noHotspots.length) +
          chalk.bold('║')
      );
    }

    lines.push(chalk.bold(`╚${'═'.repeat(W)}╝`));

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

    const output = lines.join('\n');

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const spinner = createSpinner('Generating shareable health report image...');
      spinner.start();

      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

      spinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('health', qrUrl);
      return;
    }

    console.log(output);

    // Exit with error code if health is below threshold
    if (exitCode && healthScore < threshold) {
      console.log();
      console.log(chalk.red(`  Health score ${Math.round(healthScore)} is below threshold ${threshold}`));
      process.exit(1);
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
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
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

    // Build output as array of lines
    const lines: string[] = [];
    lines.push('');
    lines.push(chalk.magenta('\u{1F495} CODEBASE DATING PROFILE \u{1F495}'));
    lines.push('');
    lines.push(chalk.dim(`\u250C${'\u2500'.repeat(W)}\u2510`));
    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Name and basic info
    const nameLine = `  \u{1F4C1} ${projectName}/`;
    lines.push(chalk.dim('\u2502') + chalk.bold.cyan(nameLine) + ' '.repeat(W - nameLine.length + 2) + chalk.dim('\u2502'));

    const infoLine = `  ${stats.fileCount} files \u2022 ${primaryLang} \u2022 Looking for devs`;
    lines.push(chalk.dim('\u2502') + infoLine + ' '.repeat(W - infoLine.length + 2) + chalk.dim('\u2502'));

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Basic stats
    const ageLine = `  \u{1F382} Age: ${ageMonths} month${ageMonths !== 1 ? 's' : ''} (estimated)`;
    lines.push(chalk.dim('\u2502') + ageLine + ' '.repeat(W - ageLine.length + 2) + chalk.dim('\u2502'));

    const locLine = `  \u{1F4CD} Location: ${rootDir.slice(0, 30)}${rootDir.length > 30 ? '...' : ''}`;
    lines.push(chalk.dim('\u2502') + locLine + ' '.repeat(Math.max(0, W - locLine.length + 2)) + chalk.dim('\u2502'));

    const jobLine = `  \u{1F4BC} Occupation: ${primaryLang} Codebase`;
    lines.push(chalk.dim('\u2502') + jobLine + ' '.repeat(W - jobLine.length + 2) + chalk.dim('\u2502'));

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Bio
    lines.push(chalk.dim('\u2502') + chalk.bold('  \u{1F4DD} Bio:') + ' '.repeat(W - 9) + chalk.dim('\u2502'));
    for (const bioContent of generateBio()) {
      const bioLine = `  ${bioContent}`;
      lines.push(chalk.dim('\u2502') + bioLine + ' '.repeat(Math.max(0, W - bioLine.length + 2)) + chalk.dim('\u2502'));
    }

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Green flags
    lines.push(chalk.dim('\u2502') + chalk.bold.green('  \u{1F7E2} Green Flags:') + ' '.repeat(W - 17) + chalk.dim('\u2502'));
    for (const flag of greenFlags.slice(0, 4)) {
      const flagLine = `  \u2022 ${flag}`;
      lines.push(chalk.dim('\u2502') + chalk.green(flagLine) + ' '.repeat(Math.max(0, W - flagLine.length + 2)) + chalk.dim('\u2502'));
    }

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Red flags
    lines.push(chalk.dim('\u2502') + chalk.bold.red('  \u{1F6A9} Red Flags:') + ' '.repeat(W - 16) + chalk.dim('\u2502'));
    for (const flag of redFlags.slice(0, 4)) {
      const flagLine = `  \u2022 ${flag}`;
      lines.push(chalk.dim('\u2502') + chalk.red(flagLine) + ' '.repeat(Math.max(0, W - flagLine.length + 2)) + chalk.dim('\u2502'));
    }

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + chalk.dim(`\u2500`.repeat(W)) + chalk.dim('\u2502'));
    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));

    // Conversation starters
    lines.push(chalk.dim('\u2502') + chalk.bold('  \u{1F4AC} Conversation starters:') + ' '.repeat(W - 27) + chalk.dim('\u2502'));
    for (const starter of starters) {
      const starterLine = `  ${starter}`;
      lines.push(chalk.dim('\u2502') + chalk.italic(starterLine) + ' '.repeat(Math.max(0, W - starterLine.length + 2)) + chalk.dim('\u2502'));
    }

    lines.push(chalk.dim('\u2502') + ' '.repeat(W) + chalk.dim('\u2502'));
    lines.push(chalk.dim(`\u2514${'\u2500'.repeat(W)}\u2518`));

    // Swipe buttons
    lines.push('');
    const passBtn = chalk.red.bold('[\u{1F44E} PASS]');
    const mergeBtn = chalk.green.bold('[\u{1F49A} MERGE]');
    lines.push(`        ${passBtn}     ${mergeBtn}`);
    lines.push('');

    const output = lines.join('\n');

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const spinner = createSpinner('Generating shareable dating profile image...');
      spinner.start();

      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

      spinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('tinder', qrUrl);
      return;
    }

    console.log(output);
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
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
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

    // Build output as array of lines
    const lines: string[] = [];
    lines.push('');
    lines.push(chalk.bold.red('  \u{1F525} CODEBASE ROAST \u{1F525}'));
    lines.push('');
    lines.push(chalk.italic("  Oh, you want feedback? Alright, let's see what we're working with..."));
    lines.push('');

    // Stats roast
    lines.push(chalk.bold.cyan('  \u{1F4CA} The Stats:'));
    lines.push(chalk.white(`  You have ${stats.fileCount} files. That's ${stats.fileCount} opportunities for bugs. Congratulations.`));
    lines.push(chalk.white(`  ${stats.totalLines.toLocaleString()} lines of code. That's a lot of places to hide mistakes.`));
    lines.push('');

    // Hotspots roast
    if (report.hotspots.length > 0) {
      lines.push(chalk.bold.red('  \u{1F336}\u{FE0F} Hottest Takes:'));
      for (const hotspot of report.hotspots.slice(0, 5)) {
        const fileName = hotspot.filePath.split('/').pop() || hotspot.filePath;
        let roastLine = '';

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

        lines.push(chalk.yellow(`  \u{2022} ${hotspot.filePath}:${hotspot.lineStart}`));
        lines.push(chalk.dim(`    ${roastLine}`));
      }
      lines.push('');
    }

    // Dead code roast
    if (deadCode.totalCount > 0) {
      lines.push(chalk.bold.gray('  \u{1F480} Dead Code:'));
      lines.push(chalk.white(`  You have ${deadCode.totalCount} unused exports. They're not dead, they're just waiting for someone to care.`));
      lines.push(chalk.dim("  They'll keep waiting."));
      lines.push('');
    }

    // Bus factor roast
    if (busFactor.analyzed && busFactor.topOwners.length > 0) {
      const topOwner = busFactor.topOwners[0];
      lines.push(chalk.bold.magenta('  \u{1F47B} Bus Factor:'));
      if (topOwner.percentage > 60) {
        lines.push(chalk.white(`  ${topOwner.name} owns ${topOwner.percentage}% of your codebase.`));
        lines.push(chalk.dim('  Hope they like their job here. Forever.'));
      } else if (busFactor.overallBusFactor < 2) {
        lines.push(chalk.white(`  Overall bus factor: ${busFactor.overallBusFactor}. That's dangerously low.`));
        lines.push(chalk.dim('  One sick day and it all falls apart.'));
      } else {
        lines.push(chalk.white(`  Bus factor ${busFactor.overallBusFactor}. At least ${Math.ceil(busFactor.overallBusFactor)} people need to win the lottery for this to be a problem.`));
      }
      lines.push('');
    }

    // Naming roasts
    const suspiciousFiles = Object.values(graph.nodes)
      .filter(n => n.type === 'file')
      .filter(n => {
        const name = n.filePath.split('/').pop() || '';
        return name.includes('helper') || name.includes('util') || name.includes('misc') || name.includes('stuff');
      });

    if (suspiciousFiles.length > 0) {
      lines.push(chalk.bold.yellow('  \u{1F914} Naming Crimes:'));
      for (const file of suspiciousFiles.slice(0, 3)) {
        const name = file.filePath.split('/').pop();
        lines.push(chalk.white(`  \u{2022} ${file.filePath}`));
        if (name?.includes('helper')) {
          lines.push(chalk.dim('    "Helpers" - the universal sign for "I gave up on naming things"'));
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
      lines.push(chalk.bold.red('  \u{1F4A3} Complexity Crimes:'));
      lines.push(chalk.white(`  ${report.distribution.veryHigh} functions have complexity over 20.`));
      lines.push(chalk.dim("  These aren't functions, they're escape rooms."));
      lines.push('');
    }

    // Final mic drop
    lines.push(chalk.bold.red('  \u{1F3A4} *drops mic*'));
    lines.push('');

    const output = lines.join('\n');

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const spinner = createSpinner('Generating shareable roast image...');
      spinner.start();

      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

      spinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('roast', qrUrl);
      return;
    }

    console.log(output);
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
      const { execFile } = await import('node:child_process');
      const platform = process.platform;
      if (platform === 'darwin') {
        execFile('open', [url]);
      } else if (platform === 'win32') {
        execFile('cmd', ['/c', 'start', '', url]);
      } else {
        execFile('xdg-open', [url]);
      }
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
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
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

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const spinner = createSpinner('Generating shareable image...');
      spinner.start();

      const content = formatAchievementsForExport(unlocked, locked, achievements.length);
      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(content, options.png, { qrUrl: qrUrl || undefined });

      spinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('achievements', qrUrl);
      return;
    }

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
  .description('Get your Spotify Wrapped-style summary (year, quarter, month, or week)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-y, --year <year>', 'Year to summarize (default: current year)')
  .option('--period <period>', 'Period: year, quarter, month, week (default: year)', 'year')
  .option('--quarter <n>', 'Quarter number (1-4) when period is quarter')
  .option('--month <n>', 'Month number (1-12) when period is month')
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const year = options.year ? parseInt(options.year, 10) : undefined;
    const period = (options.period || 'year') as WrappedPeriod;
    const periodNum = options.quarter ? parseInt(options.quarter, 10) :
                      options.month ? parseInt(options.month, 10) : undefined;

    const periodLabel = period === 'year' ? 'year' :
                        period === 'quarter' ? `Q${periodNum || Math.ceil((new Date().getMonth() + 1) / 3)}` :
                        period === 'month' ? 'month' : 'week';
    const spinner = createSpinner(`Unwrapping your ${periodLabel}...`);
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const wrappedData = await gatherWrappedData(graph, rootDir, { year, period, periodNum });
    spinner.stop();

    const output = formatWrapped(wrappedData);

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const pngSpinner = createSpinner('Generating shareable image...');
      pngSpinner.start();

      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

      pngSpinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('wrapped', qrUrl);
      return;
    }

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
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
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

    // PNG export
    if (options.png) {
      const pngAvailable = await isPngExportAvailable();
      if (!pngAvailable) {
        console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
        return;
      }

      const pngSpinner = createSpinner('Generating shareable image...');
      pngSpinner.start();

      const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

      pngSpinner.succeed(`Image saved to ${outputPath}`);
      showShareLinks('dna', qrUrl);
      return;
    }

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

program
  .command('tour')
  .description('Get an interactive walkthrough of the codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Preparing your tour...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const tour = generateTour(graph);
    spinner.stop();

    const output = formatTour(tour);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('╔') || line.includes('╚') || line.includes('║')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('═')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.startsWith('OVERVIEW') || line.startsWith('ARCHITECTURE') || line.includes('QUICK START')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('📍')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('🔴')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.startsWith('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('🟢')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('💡')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else if (line.startsWith('Legend:')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('who <file>')
  .description('Find out who knows the most about a file')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (file, options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Finding experts...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await findExperts(rootDir, file, graph);
    spinner.stop();

    const output = formatWho(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('━')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.startsWith('File:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('EXPERTS') || line.startsWith('RELATED') || line.startsWith('SUGGESTIONS')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('🥇')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('🥈')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('🥉')) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.includes('⭐ Primary')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('💡')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else if (line.includes('⚠️')) {
        console.log(chalk.yellow(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Why command - explain why code exists
 */
program
  .command('why <file>')
  .description('Explain why a file exists based on history, comments, and patterns')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (file, options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing file purpose...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await explainWhy(rootDir, file, graph);
    spinner.stop();

    const output = formatWhy(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('WHY DOES THIS EXIST')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('File:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('ORIGIN') || line.startsWith('AUTHOR') || line.startsWith('CONNECTIONS') || line.startsWith('PATTERNS') || line.startsWith('MAJOR') || line.startsWith('SUGGESTIONS')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('-'.repeat(10)) || line.startsWith('='.repeat(10))) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('Created:')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('   "')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else if (line.startsWith('   *')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.startsWith('     -')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('   !')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('FILE NOT FOUND')) {
        console.log(chalk.red(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('safe')
  .description('Find safe zones for new contributors')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Mapping safe zones...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const zones = analyzeZones(graph);
    spinner.stop();

    const output = formatSafeZones(zones);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('🟢')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('Safety:')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.includes('✓')) {
        console.log(chalk.dim.green(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('danger')
  .description('Find danger zones requiring caution')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Mapping danger zones...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const zones = analyzeZones(graph);
    spinner.stop();

    const output = formatDangerZones(zones);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.startsWith('🔴')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('Risk:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('⚠️')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('💡')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

program
  .command('morning')
  .description('Get your daily codebase briefing')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Preparing your briefing...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const briefing = await generateMorning(graph, rootDir);
    spinner.stop();

    const output = formatMorning(briefing);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('╔') || line.includes('╚') || line.includes('║')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('═')) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.startsWith('CODEBASE') || line.startsWith('LAST 24') || line.startsWith('HOT FILES') || line.startsWith("TODAY'S")) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('⚠️  ALERTS')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.startsWith('─')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('💚') || line.includes('💛') || line.includes('❤️')) {
        const color = line.includes('💚') ? chalk.green : line.includes('💛') ? chalk.yellow : chalk.red;
        console.log(color(`  ${line}`));
      } else if (line.includes('🔥')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.startsWith('  →')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.includes('Have a productive')) {
        console.log(chalk.italic.yellow(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Standup command - Generate standup summary
 */
program
  .command('standup')
  .description('Generate a standup summary for your daily meeting')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--since <time>', 'Look back period (e.g., "2 days ago")', '1 day ago')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Generating standup summary...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await generateStandup(rootDir, graph, { since: options.since });
    spinner.stop();

    const output = formatStandup(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('YESTERDAY') || line.startsWith('TODAY') || line.startsWith('BLOCKERS')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('\u2500')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('\u2713')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('\u2705')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('\u26A0')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('\uD83D\uDCDD') || line.includes('\uD83C\uDFAF') || line.includes('\uD83D\uDCA1')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('\uD83D\uDCC5')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.trim().startsWith('-')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Predict command - PR impact prediction
 */
program
  .command('predict')
  .description('Predict impact of staged changes before creating a PR')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing staged changes...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const prediction = await generatePrediction(rootDir, graph);
    spinner.stop();

    const output = formatPrediction(prediction);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('SUMMARY') || line.startsWith('FILE IMPACTS')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('WARNINGS')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('RECOMMENDATIONS')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴') || line.includes('CRITICAL')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟠') || line.includes('HIGH')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟡') || line.includes('MEDIUM')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢') || line.includes('LOW')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('🆕') || line.includes('🗑️') || line.includes('✏️')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('Risk:') && line.includes('█')) {
        const riskMatch = line.match(/(\d+)%/);
        const riskValue = riskMatch ? parseInt(riskMatch[1], 10) : 0;
        const color = riskValue >= 60 ? chalk.red : riskValue >= 40 ? chalk.yellow : chalk.green;
        console.log(color(`  ${line}`));
      } else if (line.startsWith('  •')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Reviewers command - suggest PR reviewers
 */
program
  .command('reviewers')
  .description('Suggest reviewers for staged changes based on file expertise')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Finding reviewers...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await suggestReviewers(rootDir, graph);
    spinner.stop();

    const output = formatReviewers(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('PRIMARY')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('BACKUP')) {
        console.log(chalk.bold.blue(`  ${line}`));
      } else if (line.includes('OPTIONAL')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('WARNINGS')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('RECOMMENDATIONS')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('Score:')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.startsWith('  •')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Precommit command - quick risk check before committing
 */
program
  .command('precommit')
  .description('Quick risk check before committing staged changes')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--exit-code', 'Exit with code 1 if high-risk changes detected')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const exitCode = options.exitCode;

    const spinner = createSpinner('Checking staged changes...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await runPrecommitCheck(rootDir, graph);
    spinner.stop();

    const output = formatPrecommit(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        const color =
          result.status === 'pass' ? chalk.bold.green :
          result.status === 'warn' ? chalk.bold.yellow : chalk.bold.red;
        console.log(color(`  ${line}`));
      } else if (line.includes('HIGH RISK')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('MEDIUM RISK')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('LOW RISK')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.includes('SUGGESTIONS')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('  •')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();

    // Exit with error code if high-risk changes detected
    if (exitCode && result.status === 'fail') {
      process.exit(1);
    }
  });

/**
 * Compare command - branch health comparison
 */
program
  .command('compare [branch]')
  .description('Compare health between current branch and another branch (default: main)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option(
    '-p, --personality <mode>',
    'Output personality: mentor, critic, roast, cheerleader, executive',
    'default'
  )
  .option('--exit-code', 'Exit with code 1 if health decreased significantly')
  .action(async (branch, options) => {
    const rootDir = path.resolve(options.dir);
    const compareBranch = branch || 'main';
    const personality = options.personality as PersonalityMode;

    const spinner = createSpinner(`Comparing with ${compareBranch}...`);
    spinner.start();

    const result = await compareBranches(rootDir, compareBranch);
    spinner.stop();

    const output = formatCompare(result, personality);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('PR HEALTH CHECK')) {
        const color =
          result.riskLevel === 'safe' ? chalk.bold.green :
          result.riskLevel === 'caution' ? chalk.bold.yellow : chalk.bold.red;
        console.log(color(`  ${line}`));
      } else if (line.startsWith('\u2500')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('\u{1F4C8}') || line.includes('\u{1F389}') || line.includes('\u{1F7E2}')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('\u{1F4C9}') || line.includes('\u{1F525}') || line.includes('\u{1F534}') || line.includes('\u{1F6A8}')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('\u26A0\uFE0F')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('\u{1F4C1}') || line.includes('\u{1F3AF}') || line.includes('\u{1F4AC}')) {
        console.log(chalk.cyan(`  ${line}`));
      } else {
        console.log(`  ${line}`);
      }
    }
    console.log();

    // Exit with error code if health decreased significantly
    if (options.exitCode && result.riskLevel === 'danger') {
      process.exit(1);
    }
  });

/**
 * Changelog command - auto-generate release notes with personality
 */
program
  .command('changelog')
  .description('Auto-generate changelog from git history with personality')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--since <date>', 'Start date (e.g., 2024-01-01 or "1 week ago")')
  .option('--until <date>', 'End date (e.g., 2024-12-31)')
  .option('--from-tag <tag>', 'Generate changelog since tag (e.g., v1.0.0)')
  .option(
    '-p, --personality <mode>',
    'Output personality: mentor, critic, roast, cheerleader, executive, noir',
    'default'
  )
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const personality = options.personality as PersonalityMode;

    const spinner = createSpinner('Generating changelog...');
    spinner.start();

    const result = await generateChangelog(rootDir, {
      since: options.since,
      until: options.until,
      fromTag: options.fromTag,
    });
    spinner.stop();

    if (result.entries.length === 0) {
      console.log(chalk.yellow('\n  No commits found in the specified range.\n'));
      return;
    }

    const output = formatChangelog(result, personality);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('CHANGELOG')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('\u2500')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('BREAKING')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('NEW FEATURES') || line.includes('\u2728')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.includes('BUG FIXES') || line.includes('\u{1F41B}')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('REFACTORING') || line.includes('\u{1F527}')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('CONTRIBUTORS') || line.includes('\u{1F465}')) {
        console.log(chalk.bold.blue(`  ${line}`));
      } else {
        console.log(`  ${line}`);
      }
    }
    console.log();
  });

/**
 * Breaking Changes command - detect API breaking changes
 */
program
  .command('breaking-changes [branch]')
  .alias('breaking')
  .description('Detect potential breaking changes compared to another branch')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option(
    '-p, --personality <mode>',
    'Output personality: mentor, critic, roast, cheerleader, executive',
    'default'
  )
  .option('--exit-code', 'Exit with code 1 if breaking changes detected')
  .action(async (branch, options) => {
    const rootDir = path.resolve(options.dir);
    const compareTo = branch || 'main';
    const personality = options.personality as PersonalityMode;

    const spinner = createSpinner(`Analyzing changes vs ${compareTo}...`);
    spinner.start();

    const result = await detectBreakingChanges(rootDir, compareTo);
    spinner.stop();

    const output = formatBreakingChanges(result, personality);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('BREAKING CHANGES ANALYSIS')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('\u2500')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('HIGH SEVERITY') || line.includes('\u{1F534}')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('MEDIUM SEVERITY') || line.includes('\u{1F7E1}')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('LOW SEVERITY') || line.includes('\u{1F7E2}')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.includes('\u2705')) {
        console.log(chalk.green(`  ${line}`));
      } else {
        console.log(`  ${line}`);
      }
    }
    console.log();

    if (options.exitCode && result.riskLevel === 'breaking') {
      process.exit(1);
    }
  });

/**
 * Drift command - architecture drift detection
 */
program
  .command('drift')
  .description('Detect architecture drift from best practices')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing architecture...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await detectDrift(rootDir, graph);
    spinner.stop();

    const output = formatDrift(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('DRIFT SCORE') || line.includes('VIOLATIONS') || line.includes('ISSUES')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('RECOMMENDATIONS')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟠')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('  •') || line.startsWith('   →')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Cycles command - circular dependency detection
 */
program
  .command('cycles')
  .description('Detect circular dependencies in the codebase')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--exit-code', 'Exit with code 1 if circular dependencies found')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const exitCode = options.exitCode;

    const spinner = createSpinner('Hunting for cycles...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = detectCycles(graph);
    spinner.stop();

    const output = formatCycles(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('SUMMARY') || line.includes('SEVERITY CYCLES') || line.includes('WORST CYCLE')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('SUGGESTIONS')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('  •')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('No circular dependencies')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();

    // Exit with error code if cycles found
    if (exitCode && result.totalCycles > 0) {
      process.exit(1);
    }
  });

/**
 * Velocity command - complexity velocity tracking
 */
program
  .command('velocity')
  .description('Track complexity velocity and debt growth over time')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Calculating complexity velocity...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await analyzeVelocity(rootDir, graph);
    spinner.stop();

    const output = formatVelocity(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('OVERALL VELOCITY') || line.startsWith('INSUFFICIENT DATA')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('CURRENT STATE')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('30-DAY PROJECTION')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('FASTEST GROWING')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('FASTEST IMPROVING')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.includes('INSIGHTS')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴') || line.includes('critical')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟠')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢') || line.includes('improving')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('📈') || line.includes('degrading')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('📉')) {
        console.log(chalk.green(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Trajectory command - health trajectory projection
 */
program
  .command('trajectory')
  .description('Project future codebase health based on historical trends')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Projecting health trajectory...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await projectTrajectory(rootDir, graph);
    spinner.stop();

    const output = formatTrajectory(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('CURRENT STATE') || line.startsWith('INSUFFICIENT DATA')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('PROJECTIONS')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('TRAJECTORY')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.includes('RISK FACTORS')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('RECOMMENDATIONS')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.includes('OUTLOOK')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴') || line.includes('critical')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟠')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢') || line.includes('improving')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('█')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('░')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Knowledge Map command - team expertise heatmap
 */
program
  .command('knowledge-map')
  .alias('kmap')
  .description('Generate a team expertise heatmap showing who knows what')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Mapping team expertise...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await generateKnowledgeMap(graph, rootDir);
    spinner.stop();

    const output = formatKnowledgeMap(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('OVERALL BUS FACTOR') || line.startsWith('Risk Areas')) {
        console.log(chalk.bold.white(`  ${line}`));
      } else if (line.startsWith('EXPERTISE HEATMAP') || line.startsWith('AREA DETAILS')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.includes('RISK AREAS')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('SUGGESTIONS')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('🔴')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('🟡')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('🟢') || line.includes('🌟')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('⚠️')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('Legend:')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('  •')) {
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('░') || line.includes('▒') || line.includes('▓') || line.includes('█')) {
        // Heatmap cells - use default coloring
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Diagram command - generate architecture diagrams
 */
program
  .command('diagram')
  .description('Generate architecture diagram from the knowledge graph')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option(
    '-f, --format <format>',
    'Output format: mermaid, d2, or ascii',
    'mermaid'
  )
  .option('--depth <n>', 'Directory depth to show', '2')
  .option('--focus <path>', 'Focus on specific file or directory')
  .option('--complexity', 'Show complexity indicators')
  .option('--health', 'Show health indicators')
  .option('-o, --output <file>', 'Save diagram to file')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Generating architecture diagram...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const format = options.format as DiagramFormat;
    if (!['mermaid', 'd2', 'ascii'].includes(format)) {
      spinner.fail(`Invalid format: ${format}. Use mermaid, d2, or ascii.`);
      return;
    }

    let result = generateDiagram(graph, {
      format,
      depth: parseInt(options.depth, 10),
      focus: options.focus,
      showComplexity: options.complexity,
      showHealth: options.health,
    });

    // Save to file if requested
    if (options.output) {
      const outputPath = path.resolve(options.output);
      result = await saveDiagram(result, outputPath);
      spinner.succeed(`Diagram saved to ${outputPath}`);
    } else {
      spinner.stop();
    }

    const output = formatDiagramOutput(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('Format:') || line.startsWith('Nodes:') || line.startsWith('Edges:')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.startsWith('Saved:')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('graph TD') || line.startsWith('subgraph')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('-->')) {
        console.log(chalk.blue(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('Paste into') || line.includes('Render with')) {
        console.log(chalk.dim.italic(`  ${line}`));
      } else if (line.includes('┌') || line.includes('└') || line.includes('│') || line.includes('├')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Index command - Build embedding index for semantic search
 */
program
  .command('index')
  .description('Build embedding index for semantic search')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--rebuild', 'Force rebuild even if index exists')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    console.log();
    console.log(chalk.bold.magenta('  ╔═══════════════════════════════════════════╗'));
    console.log(
      chalk.bold.magenta('  ║') +
        chalk.bold.white('      🧠 BUILDING SEMANTIC INDEX...         ') +
        chalk.bold.magenta('║')
    );
    console.log(chalk.bold.magenta('  ╚═══════════════════════════════════════════╝'));
    console.log();

    const spinner = createSpinner('Loading knowledge graph...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    // Check if index already exists and is fresh
    if (!options.rebuild && (await embeddingIndexExists(rootDir))) {
      const isStale = await isEmbeddingIndexStale(rootDir);
      if (!isStale) {
        spinner.info('Embedding index is up to date. Use --rebuild to force rebuild.');
        return;
      }
      spinner.text = 'Index is stale, rebuilding...';
    }

    spinner.text = 'Building TF-IDF vectors...';

    const startTime = Date.now();
    const index = await buildEmbeddingIndex(graph);

    spinner.text = 'Saving embedding index...';
    await saveEmbeddingIndex(rootDir, index);

    const duration = Date.now() - startTime;
    spinner.succeed(chalk.bold('Semantic index built!'));

    console.log();
    console.log(chalk.bold('┌─────────────────────────────────────────────┐'));
    console.log(
      chalk.bold('│') +
        chalk.cyan('  🧠 EMBEDDING INDEX READY'.padEnd(44)) +
        chalk.bold('│')
    );
    console.log(chalk.bold('├─────────────────────────────────────────────┤'));
    console.log(
      chalk.bold('│') +
        `  📦 Chunks:      ${chalk.cyan(String(index.chunkCount).padStart(6))}`.padEnd(50) +
        chalk.bold('│')
    );
    console.log(
      chalk.bold('│') +
        `  📚 Vocabulary:  ${chalk.cyan(String(index.vocabularySize).padStart(6))}`.padEnd(50) +
        chalk.bold('│')
    );
    console.log(
      chalk.bold('│') +
        `  ⏱️  Built in:    ${chalk.cyan(String(duration).padStart(4))}ms`.padEnd(49) +
        chalk.bold('│')
    );
    console.log(chalk.bold('└─────────────────────────────────────────────┘'));
    console.log();
    console.log(chalk.dim('  Use `specter search "query"` for semantic search'));
    console.log();
  });

program
  .command('search <query>')
  .description('Natural language code search with semantic understanding')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-l, --limit <n>', 'Maximum results to show', '10')
  .option('-s, --semantic', 'Use pure semantic search')
  .option('-k, --keyword', 'Use pure keyword search')
  .action(async (query, options) => {
    const rootDir = path.resolve(options.dir);
    const limit = parseInt(options.limit, 10);

    // Determine search mode
    let mode: SearchMode = 'hybrid';
    if (options.semantic) {
      mode = 'semantic';
    } else if (options.keyword) {
      mode = 'keyword';
    }

    const spinner = createSpinner('Searching codebase...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    let response;

    if (mode === 'keyword') {
      // Pure keyword search (no index needed)
      response = searchCodebase(query, graph);
      response.mode = 'keyword';
    } else {
      // Need embedding index for semantic or hybrid search
      const index = await loadEmbeddingIndex(rootDir);

      if (!index) {
        if (mode === 'semantic') {
          spinner.fail('No embedding index found. Run `specter index` first for semantic search.');
          return;
        }
        // Fall back to keyword search for hybrid mode
        spinner.text = 'No embedding index found, using keyword search...';
        response = searchCodebase(query, graph);
        response.mode = 'keyword';
      } else {
        response = semanticSearch(query, graph, index, { mode, limit: limit * 2 });
      }
    }

    spinner.stop();

    const output = formatSearchWithMode(response, limit);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('Query:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.startsWith('Found:')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('TOP MATCHES') || line.startsWith('GOOD MATCHES') || line.startsWith('OTHER MATCHES')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('SUGGESTIONS')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('💡')) {
        console.log(chalk.italic.cyan(`  ${line}`));
      } else if (line.startsWith('📁')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.startsWith('🔣') || line.startsWith('📦')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('📋') || line.startsWith('📝')) {
        console.log(chalk.blue(`  ${line}`));
      } else if (line.includes('📍')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.includes('✓')) {
        console.log(chalk.dim.green(`  ${line}`));
      } else if (line.includes('[█') || line.includes('[▓') || line.includes('[░')) {
        // Relevance bars - color based on content
        if (line.includes('█')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('▓')) {
          console.log(chalk.yellow(`  ${line}`));
        } else {
          console.log(chalk.dim(`  ${line}`));
        }
      } else if (line.includes('No matches')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('... and')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Ask command - Natural language Q&A with personality
 */
program
  .command('ask <question>')
  .description('Ask questions about your codebase in natural language')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option(
    '-p, --personality <mode>',
    'Output personality: default, noir, roast, mentor, cheerleader, critic, historian, minimalist, therapist, dramatic, ghost',
    'default'
  )
  .action(async (question, options) => {
    const rootDir = path.resolve(options.dir);
    const personality = options.personality as PersonalityMode;

    const spinner = createSpinner('Thinking...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await askCodebase(question, rootDir, graph, { personality });
    spinner.stop();

    const output = formatAsk(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('Q:')) {
        console.log(chalk.bold.yellow(`  ${line}`));
      } else if (line.startsWith('A:')) {
        console.log(chalk.bold.green(`  ${line}`));
      } else if (line.startsWith('📁 Relevant')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('Confidence:')) {
        // Color confidence based on level
        if (line.includes('█')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('▓')) {
          console.log(chalk.yellow(`  ${line}`));
        } else {
          console.log(chalk.red(`  ${line}`));
        }
      } else if (line.startsWith('─') || line.startsWith('━')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('   📂') || line.startsWith('   📄')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.startsWith('   🔣') || line.startsWith('   📦')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith('   📋') || line.startsWith('   •')) {
        console.log(chalk.blue(`  ${line}`));
      } else if (line.includes('*')) {
        // Personality flourishes (noir, dramatic, etc.)
        console.log(chalk.italic.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Bus Factor command - Surface bus factor risks prominently
 */
program
  .command('bus-factor')
  .alias('bus')
  .description('Surface bus factor risks - which parts of the codebase are at risk if someone leaves')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--critical-only', 'Only show critical risks')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing bus factor risks...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await analyzeBusFactor(graph, {
      criticalOnly: options.criticalOnly,
    });
    spinner.stop();

    const output = formatBusFactor(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('+--') || line.includes('|')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('Overall Bus Factor')) {
        // Color based on risk level
        if (line.includes('CRITICAL') || line.includes('[!!]')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.includes('DANGEROUS') || line.includes('[!]')) {
          console.log(chalk.bold.hex('#FFA500')(`  ${line}`));
        } else if (line.includes('CONCERNING') || line.includes('[~]')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else {
          console.log(chalk.bold.green(`  ${line}`));
        }
      } else if (line.startsWith('CRITICAL RISKS') || line.startsWith('[!]') || line.startsWith('[!!]')) {
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
      } else if (line.includes('Files with single owner') || line.includes('Lines at risk') || line.includes('Percentage of codebase')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * Hotspots command - Complexity x Churn analysis
 */
program
  .command('hotspots')
  .description('Find complexity x churn hotspots - highest priority for refactoring')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-t, --top <n>', 'Number of hotspots to show', '20')
  .option('-s, --since <period>', 'Time period for churn analysis', '3 months ago')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing complexity x churn hotspots...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await analyzeHotspots(rootDir, graph, {
      since: options.since,
      top: parseInt(options.top, 10),
    });
    spinner.stop();

    const output = formatHotspots(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.startsWith('SCATTER PLOT') || line.startsWith('QUADRANT') || line.startsWith('TOP HOTSPOTS')) {
        console.log(chalk.bold.magenta(`  ${line}`));
      } else if (line.startsWith('SUMMARY') || line.startsWith('RECOMMENDATIONS')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('Period:')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith('\u2500') || line.startsWith('Legend:')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('\uD83D\uDD34 CRITICAL')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('\uD83D\uDFE0 HIGH') || line.includes('\uD83D\uDFE0 Legacy')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('\uD83D\uDFE1 MEDIUM') || line.includes('\uD83D\uDFE1 Active')) {
        console.log(chalk.cyan(`  ${line}`));
      } else if (line.includes('\uD83D\uDFE2') || line.includes('Healthy')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('\uD83D\uDD34 DANGER')) {
        console.log(chalk.bold.red(`  ${line}`));
      } else if (line.includes('Score:')) {
        console.log(chalk.yellow(`  ${line}`));
      } else if (line.includes('Complexity:') || line.includes('Churn:')) {
        console.log(chalk.dim.cyan(`  ${line}`));
      } else if (line.includes('Contributors:')) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.includes('Estimated effort:')) {
        console.log(chalk.dim.yellow(`  ${line}`));
      } else if (line.includes('\uD83D\uDEA8') || line.includes('\u26A0\uFE0F') || line.includes('\uD83D\uDCCA')) {
        console.log(chalk.italic.yellow(`  ${line}`));
      } else if (line.includes('\u25B2') || line.includes('\u25B6') || line.includes('\u2502') || line.includes('\u2514')) {
        // Scatter plot
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('\u25CF') || line.includes('\u25CB') || line.includes('\u25E6')) {
        // Plot markers
        console.log(chalk.white(`  ${line}`));
      } else if (line.includes('... and')) {
        console.log(chalk.dim(`  ${line}`));
      } else {
        console.log(chalk.white(`  ${line}`));
      }
    }
    console.log();
  });

/**
 * DORA command - DevOps Research & Assessment metrics
 */
program
  .command('dora')
  .description('Calculate DORA metrics for software delivery performance')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--since <period>', 'Time period to analyze', '6 months ago')
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Calculating DORA metrics...');
    spinner.start();

    try {
      const result = await calculateDora(rootDir, { since: options.since });
      spinner.stop();

      const output = formatDora(result);

      // PNG export
      if (options.png) {
        const pngAvailable = await isPngExportAvailable();
        if (!pngAvailable) {
          console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
          return;
        }

        const pngSpinner = createSpinner('Generating shareable image...');
        pngSpinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

        pngSpinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('dora', qrUrl);
        return;
      }

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Overall Performance:')) {
          if (line.includes('ELITE')) {
            console.log(chalk.bold.green(`  ${line}`));
          } else if (line.includes('HIGH')) {
            console.log(chalk.bold.green(`  ${line}`));
          } else if (line.includes('MEDIUM')) {
            console.log(chalk.bold.yellow(`  ${line}`));
          } else {
            console.log(chalk.bold.red(`  ${line}`));
          }
        } else if (line.includes('\u2B50')) {
          // Star emoji - elite
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE2')) {
          // Green circle - high
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('\uD83D\uDFE1')) {
          // Yellow circle - medium
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('\uD83D\uDD34')) {
          // Red circle - low
          console.log(chalk.red(`  ${line}`));
        } else if (line.startsWith('  [')) {
          // Progress bar
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.startsWith('\u2500') || line.startsWith('Period:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('Data Summary:') || line.startsWith('Recommendations:')) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.includes('\u2022')) {
          // Bullet points
          console.log(chalk.italic.yellow(`  ${line}`));
        } else if (line.includes('\u2728')) {
          // Sparkles
          console.log(chalk.bold.green(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    } catch (error) {
      spinner.fail('Failed to calculate DORA metrics');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

/**
 * Cost command - Tech debt in dollar terms
 */
program
  .command('cost')
  .description('Estimate tech debt in dollar terms - calculates maintenance burden')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--rate <n>', 'Developer hourly rate', '75')
  .option('--currency <code>', 'Currency code (USD, EUR, GBP)', 'USD')
  .option('--no-dead-code', 'Skip dead code analysis')
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const spinner = createSpinner('Calculating tech debt costs...');
    spinner.start();

    try {
      const result = await analyzeCost(rootDir, graph, {
        hourlyRate: parseInt(options.rate, 10),
        currency: options.currency,
        includeDeadCode: options.deadCode !== false,
      });
      spinner.stop();

      const output = formatCost(result);

      // PNG export
      if (options.png) {
        const pngAvailable = await isPngExportAvailable();
        if (!pngAvailable) {
          console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
          return;
        }

        const pngSpinner = createSpinner('Generating shareable image...');
        pngSpinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

        pngSpinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('cost', qrUrl);
        return;
      }

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Total Tech Debt:')) {
          console.log(chalk.bold.red(`  ${line}`));
        } else if (line.startsWith('COST BREAKDOWN') || line.startsWith('TOP 5') || line.startsWith('QUICK WINS') || line.startsWith('RECOMMENDATIONS')) {
          console.log(chalk.bold.white(`  ${line}`));
        } else if (line.includes('\u{1F534}')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('\u{1F7E0}')) {
          console.log(chalk.hex('#FFA500')(`  ${line}`));
        } else if (line.includes('\u{1F7E1}')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('\u{1F7E2}')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('\u{1F3AF}') || line.includes('\u26A1') || line.includes('\u{1F4CA}') || line.includes('\u{1F4A1}')) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.startsWith('\u2500')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('\u2192')) {
          console.log(chalk.italic.yellow(`  ${line}`));
        } else if (line.startsWith('Run with')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    } catch (error) {
      spinner.fail('Failed to calculate tech debt costs');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

/**
 * Leaderboard command - Team gamification stats
 */
program
  .command('leaderboard')
  .description('Show team gamification stats - who\'s improving the codebase?')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--since <date>', 'Start date (e.g., "30 days ago", "2024-01-01")', '30 days ago')
  .option('--limit <n>', 'Number of contributors to show', '10')
  .option('--png <file>', 'Export as PNG image for sharing')
  .option('--qr', 'Add QR code linking to repo (with --png)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const graph = await loadGraph(rootDir);

    if (!graph) {
      console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
      return;
    }

    const spinner = createSpinner('Analyzing contributor impact...');
    spinner.start();

    try {
      const result = await generateLeaderboard(rootDir, graph, {
        since: options.since,
        limit: parseInt(options.limit, 10),
      });
      spinner.stop();

      const output = formatLeaderboard(result);

      // PNG export
      if (options.png) {
        const pngAvailable = await isPngExportAvailable();
        if (!pngAvailable) {
          console.log(chalk.red('PNG export requires the canvas package. Install with: npm install canvas'));
          return;
        }

        const pngSpinner = createSpinner('Generating shareable image...');
        pngSpinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
      const outputPath = await exportToPng(output, options.png, { qrUrl: qrUrl || undefined });

        pngSpinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('leaderboard', qrUrl);
        return;
      }

      // Console output with colors
      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\uD83C\uDFC6')) {
          // Trophy - header
          console.log(chalk.bold.yellow(`${line}`));
        } else if (line.includes('\uD83E\uDD47')) {
          // Gold medal
          console.log(chalk.bold.yellow(`${line}`));
        } else if (line.includes('\uD83E\uDD48')) {
          // Silver medal
          console.log(chalk.hex('#C0C0C0')(`${line}`));
        } else if (line.includes('\uD83E\uDD49')) {
          // Bronze medal
          console.log(chalk.hex('#CD7F32')(`${line}`));
        } else if (line.includes('Health Hero')) {
          console.log(chalk.green(`${line}`));
        } else if (line.includes('Code Guardian')) {
          console.log(chalk.cyan(`${line}`));
        } else if (line.includes('Hotspot Hunter')) {
          console.log(chalk.blue(`${line}`));
        } else if (line.includes('Rising Star')) {
          console.log(chalk.magenta(`${line}`));
        } else if (line.includes('\u2550') || line.includes('\u2500')) {
          // Dividers
          console.log(chalk.dim(`${line}`));
        } else if (line.includes('\uD83D\uDCCA')) {
          // Chart emoji - team stats
          console.log(chalk.bold.white(`${line}`));
        } else if (line.includes('improving!')) {
          console.log(chalk.green(`${line}`));
        } else if (line.includes('needs attention')) {
          console.log(chalk.yellow(`${line}`));
        } else if (line.includes('commits') && line.includes('\u2502')) {
          // Stats line
          console.log(chalk.dim(`${line}`));
        } else {
          console.log(chalk.white(`${line}`));
        }
      }
      console.log();
    } catch (error) {
      spinner.fail('Failed to generate leaderboard');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }
  });

/**
 * Coupling command - Hidden coupling discovery
 */
program
  .command('coupling')
  .description('Find hidden couplings - files that change together but have no direct dependency')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--hidden-only', 'Only show hidden couplings (no expected couplings)')
  .option('--min-strength <n>', 'Minimum coupling strength (0-100)', '30')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing coupling patterns...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const result = await analyzeCoupling(rootDir, graph, {
      hiddenOnly: options.hiddenOnly,
      minStrength: parseInt(options.minStrength, 10),
    });
    spinner.stop();

    const output = formatCoupling(result);

    console.log();
    for (const line of output.split('\n')) {
      if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
        console.log(chalk.bold.cyan(`  ${line}`));
      } else if (line.startsWith('\uD83D\uDD34 HIDDEN') || line.startsWith('\uD83D\uDD34 SUSPICIOUS')) {
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
      } else if (line.startsWith('RECOMMENDATIONS') || line.startsWith('\uD83D\uDD34 HIDDEN COUPLINGS')) {
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
  });

/**
 * Report command - generate comprehensive markdown report
 */
program
  .command('report')
  .description('Generate a comprehensive codebase health report')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-o, --output <file>', 'Save report to file')
  .option('--json', 'Output in JSON format')
  .option('--quick', 'Generate executive summary only')
  .option('--no-health', 'Skip health overview section')
  .option('--no-risks', 'Skip risks section')
  .option('--no-dora', 'Skip development metrics section')
  .option('--no-hotspots', 'Skip hotspots section')
  .option('--no-bus-factor', 'Skip bus factor section')
  .option('--no-trajectory', 'Skip trajectory section')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const fs = await import('node:fs/promises');

    const spinner = createSpinner('Generating comprehensive report...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    try {
      const reportOptions = {
        includeHealth: options.health !== false,
        includeRisks: options.risks !== false,
        includeDora: options.dora !== false,
        includeHotspots: options.hotspots !== false,
        includeBusFactor: options.busFactor !== false,
        includeTrajectory: options.trajectory !== false,
        format: options.json ? 'json' as const : 'markdown' as const,
        quick: options.quick || false,
      };

      const result = await generateReport(rootDir, graph, reportOptions);
      spinner.stop();

      // Output or save the report
      if (options.output) {
        await fs.writeFile(options.output, result.content, 'utf-8');
        result.outputPath = options.output;

        // Show summary
        const summary = formatReportSummary(result);
        for (const line of summary.split('\n')) {
          if (line.includes('+') || line.includes('|')) {
            console.log(chalk.bold.green(line));
          } else if (line.includes('KEY METRICS:')) {
            console.log(chalk.bold.cyan(line));
          } else if (line.includes('Saved to:')) {
            console.log(chalk.bold.yellow(line));
          } else {
            console.log(chalk.white(line));
          }
        }
      } else {
        // Output to stdout
        if (options.json) {
          console.log(result.content);
        } else {
          // Pretty print markdown for terminal
          console.log();
          for (const line of result.content.split('\n')) {
            if (line.startsWith('# ')) {
              console.log(chalk.bold.magenta(line));
            } else if (line.startsWith('## ')) {
              console.log(chalk.bold.cyan(line));
            } else if (line.startsWith('### ')) {
              console.log(chalk.bold.yellow(line));
            } else if (line.startsWith('| ')) {
              console.log(chalk.white(line));
            } else if (line.startsWith('|---')) {
              console.log(chalk.dim(line));
            } else if (line.startsWith('- ')) {
              console.log(chalk.white(line));
            } else if (line.startsWith('> ')) {
              console.log(chalk.italic.cyan(line));
            } else if (line.startsWith('```')) {
              console.log(chalk.dim(line));
            } else if (line.startsWith('---')) {
              console.log(chalk.dim(line));
            } else if (line.startsWith('*') && line.endsWith('*')) {
              console.log(chalk.italic(line));
            } else if (line.includes(':red_circle:')) {
              console.log(chalk.red(line.replace(/:red_circle:/g, '\uD83D\uDD34')));
            } else if (line.includes(':orange_circle:')) {
              console.log(chalk.yellow(line.replace(/:orange_circle:/g, '\uD83D\uDFE0')));
            } else if (line.includes(':yellow_circle:')) {
              console.log(chalk.yellow(line.replace(/:yellow_circle:/g, '\uD83D\uDFE1')));
            } else if (line.includes(':green_circle:')) {
              console.log(chalk.green(line.replace(/:green_circle:/g, '\uD83D\uDFE2')));
            } else if (line.includes(':white_check_mark:')) {
              console.log(chalk.green(line.replace(/:white_check_mark:/g, '\u2705')));
            } else if (line.includes(':warning:')) {
              console.log(chalk.yellow(line.replace(/:warning:/g, '\u26A0\uFE0F')));
            } else if (line.includes(':arrow_')) {
              let processed = line
                .replace(/:arrow_upper_right:/g, '\u2197\uFE0F')
                .replace(/:arrow_lower_right:/g, '\u2198\uFE0F')
                .replace(/:arrow_right:/g, '\u2192')
                .replace(/:arrow_double_down:/g, '\u23EC');
              console.log(chalk.white(processed));
            } else if (line.includes(':blue_circle:')) {
              console.log(chalk.blue(line.replace(/:blue_circle:/g, '\uD83D\uDD35')));
            } else {
              console.log(chalk.white(line));
            }
          }
          console.log();
        }
      }
    } catch (error) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Init command - set up Specter for a new project
 */
program
  .command('init')
  .description('Initialize Specter for a new project with interactive setup')
  .option('-d, --dir <path>', 'Directory to initialize', '.')
  .option('-y, --yes', 'Accept all defaults (non-interactive)')
  .option('--no-hooks', 'Skip pre-commit hook setup')
  .option('--no-scan', 'Skip initial scan')
  .option(
    '-p, --personality <mode>',
    `Personality mode: ${listAvailablePersonalities()}`,
    'default'
  )
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    // Interactive mode (default)
    if (!options.yes) {
      // Print welcome banner
      console.log(chalk.bold.magenta(formatInitWelcome()));

      try {
        const result = await initializeProjectInteractive(rootDir);

        // Print completion message
        console.log(chalk.bold.green(formatInitComplete(result, rootDir)));
      } catch (error) {
        console.error(chalk.red('Failed to initialize Specter'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
      return;
    }

    // Non-interactive mode (--yes flag)
    const spinner = createSpinner('Initializing Specter...').start();

    try {
      const result = await initializeProject(rootDir, {
        hooks: options.hooks !== false,
        scan: options.scan !== false,
        config: true,
        personality: options.personality as PersonalityMode,
      });

      if (!result.configCreated && !result.scanCompleted) {
        spinner.stop();
        console.log('Specter is already initialized in this project.');
        console.log(chalk.dim('  To reinitialize, delete specter.config.json and .specter/'));
        return;
      }

      spinner.succeed('Specter initialized!');

      // Print summary
      console.log();
      console.log(chalk.bold('  Created:'));
      if (result.configCreated) {
        console.log(chalk.green('    ✓ specter.config.json'));
      }
      if (result.hooksInstalled) {
        console.log(chalk.green('    ✓ .husky/pre-commit'));
      }
      if (result.scanCompleted) {
        console.log(chalk.green('    ✓ .specter/ (knowledge graph)'));
        if (result.fileCount && result.nodeCount) {
          console.log();
          console.log(chalk.cyan(`    Files: ${result.fileCount}`));
          console.log(chalk.cyan(`    Symbols: ${result.nodeCount}`));
          if (result.healthScore !== undefined) {
            const healthEmoji = result.healthScore >= 70 ? '🟢' : result.healthScore >= 40 ? '🟡' : '🔴';
            console.log(chalk.cyan(`    Health: ${healthEmoji} ${result.healthScore}/100`));
          }
        }
      }

      console.log();
      console.log(chalk.dim('  Next steps:'));
      console.log(chalk.dim('    specter health    # Check codebase health'));
      console.log(chalk.dim('    specter tour      # Take a guided tour'));
      console.log(chalk.dim('    specter morning   # Get your daily briefing'));
      console.log();
    } catch (error) {
      spinner.fail('Failed to initialize Specter');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Fix command - suggest actionable fixes for detected issues
 */
program
  .command('fix [file]')
  .description('Suggest actionable fixes for detected issues in a file or all files')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--all', 'Analyze all files with issues')
  .option('-s, --severity <level>', 'Minimum severity: critical, warning, info', 'info')
  .action(async (file, options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = createSpinner('Analyzing for fix suggestions...');
    spinner.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const severity = options.severity as SuggestionSeverity;

    if (options.all || !file) {
      // Analyze all files
      const results = await generateFixAll(rootDir, graph, { severity });
      spinner.stop();

      const output = formatFixAll(results);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u{1F527}')) {
          console.log(chalk.bold.cyan(`${line}`));
        } else if (line.includes('\u2550')) {
          console.log(chalk.magenta(`${line}`));
        } else if (line.includes('\u{1F534}') || line.includes('CRITICAL')) {
          console.log(chalk.bold.red(`${line}`));
        } else if (line.includes('\u{1F7E1}') || line.includes('WARNING')) {
          console.log(chalk.yellow(`${line}`));
        } else if (line.includes('\u{1F480}') || line.includes('INFO')) {
          console.log(chalk.dim(`${line}`));
        } else if (line.includes('\u2705')) {
          console.log(chalk.green(`${line}`));
        } else if (line.includes('\u2500')) {
          console.log(chalk.dim(`${line}`));
        } else if (line.startsWith('  Run:')) {
          console.log(chalk.cyan(`${line}`));
        } else {
          console.log(chalk.white(`${line}`));
        }
      }
    } else {
      // Analyze specific file
      const filePath = path.relative(rootDir, path.resolve(rootDir, file));

      // Check if file exists in graph
      const fileNode = Object.values(graph.nodes).find(
        (n) => n.type === 'file' && (n.filePath === filePath || n.filePath === file)
      );

      if (!fileNode) {
        spinner.fail(`File not found in knowledge graph: ${file}`);
        console.log(chalk.dim('  Make sure the file was scanned. Run `specter scan` to update.'));
        return;
      }

      const result = await generateFix(fileNode.filePath, rootDir, graph, { severity });
      spinner.stop();

      const output = formatFix(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('\u{1F527}')) {
          console.log(chalk.bold.cyan(`${line}`));
        } else if (line.includes('\u2550')) {
          console.log(chalk.magenta(`${line}`));
        } else if (line.includes('\u{1F534}') || line.includes('CRITICAL')) {
          console.log(chalk.bold.red(`${line}`));
        } else if (line.includes('\u{1F7E1}') || line.includes('WARNING')) {
          console.log(chalk.yellow(`${line}`));
        } else if (line.includes('\u{1F480}') || line.includes('INFO')) {
          console.log(chalk.dim(`${line}`));
        } else if (line.includes('\u2705')) {
          console.log(chalk.green(`${line}`));
        } else if (line.includes('\u2500')) {
          console.log(chalk.dim(`${line}`));
        } else if (line.startsWith('     ') && (line.includes('Extract') || line.includes('Lines'))) {
          console.log(chalk.cyan(`${line}`));
        } else if (line.includes('Expected result:')) {
          console.log(chalk.green(`${line}`));
        } else if (line.startsWith('  Run:')) {
          console.log(chalk.cyan(`${line}`));
        } else if (line.startsWith('  Summary:')) {
          console.log(chalk.bold.white(`${line}`));
        } else {
          console.log(chalk.white(`${line}`));
        }
      }
    }
  });

/**
 * Init-hooks command - set up git hooks for automatic checks
 */
program
  .command('init-hooks')
  .description('Set up git hooks for automatic Specter checks')
  .option('--pre-commit', 'Install pre-commit framework hook')
  .option('--husky', 'Set up with Husky')
  .option('--simple', 'Install simple git hook (no framework)')
  .action(async (options) => {
    const fs = await import('node:fs');
    const rootDir = process.cwd();
    const gitDir = path.join(rootDir, '.git');

    // Check if we're in a git repo
    if (!fs.existsSync(gitDir)) {
      console.log(chalk.red('Not a git repository. Run `git init` first.'));
      process.exit(1);
    }

    // Check if graph exists
    const graph = await loadGraph(rootDir);
    if (!graph) {
      console.log(chalk.yellow('No Specter graph found. Run `specter scan` first.'));
      console.log(chalk.dim('Specter hooks require an initial scan to work.'));
      console.log();
    }

    console.log();
    console.log(chalk.bold.magenta('  Setting up Specter Git Hooks'));
    console.log(chalk.dim('  ' + '─'.repeat(40)));
    console.log();

    if (options.husky) {
      // Husky setup
      const huskyDir = path.join(rootDir, '.husky');

      if (!fs.existsSync(huskyDir)) {
        console.log(chalk.yellow('  Husky not installed. Installing...'));
        const { execSync } = await import('node:child_process');
        try {
          execSync('npx husky init', { cwd: rootDir, stdio: 'inherit' });
        } catch {
          console.log(chalk.red('  Failed to initialize Husky. Install manually:'));
          console.log(chalk.dim('    npm install -D husky && npx husky init'));
          process.exit(1);
        }
      }

      const preCommitPath = path.join(huskyDir, 'pre-commit');
      const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Specter pre-commit check
specter precommit --exit-code
`;

      fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
      console.log(chalk.green('  Created .husky/pre-commit'));
      console.log();
      console.log(chalk.bold('  Specter will now check every commit!'));
      console.log(chalk.dim('  High-risk commits will be blocked.'));

    } else if (options.simple) {
      // Simple git hook
      const hooksDir = path.join(gitDir, 'hooks');
      const preCommitPath = path.join(hooksDir, 'pre-commit');

      // Check if hook already exists
      if (fs.existsSync(preCommitPath)) {
        const existing = fs.readFileSync(preCommitPath, 'utf-8');
        if (!existing.includes('specter')) {
          // Append to existing hook
          const updatedHook = existing + `
# Specter pre-commit check
specter precommit --exit-code || exit 1
`;
          fs.writeFileSync(preCommitPath, updatedHook, { mode: 0o755 });
          console.log(chalk.green('  Added Specter to existing pre-commit hook'));
        } else {
          console.log(chalk.yellow('  Specter already in pre-commit hook'));
        }
      } else {
        // Create new hook
        const hookContent = `#!/bin/sh
# Specter pre-commit check
# Blocks high-risk commits automatically

specter precommit --exit-code || exit 1
`;
        fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
        console.log(chalk.green('  Created .git/hooks/pre-commit'));
      }

      console.log();
      console.log(chalk.bold('  Specter will now check every commit!'));
      console.log(chalk.dim('  High-risk commits will be blocked.'));

    } else if (options.preCommit) {
      // Pre-commit framework setup
      const configPath = path.join(rootDir, '.pre-commit-config.yaml');

      if (fs.existsSync(configPath)) {
        console.log(chalk.yellow('  .pre-commit-config.yaml already exists'));
        console.log(chalk.dim('  Add the following to your repos section:'));
        console.log();
        console.log(chalk.cyan('  - repo: https://github.com/your-org/specter'));
        console.log(chalk.cyan('    rev: v1.0.0'));
        console.log(chalk.cyan('    hooks:'));
        console.log(chalk.cyan('      - id: specter-precommit'));
      } else {
        const configContent = `# Pre-commit hooks configuration
# See https://pre-commit.com for more information

repos:
  - repo: https://github.com/your-org/specter
    rev: v1.0.0
    hooks:
      - id: specter-precommit
      # Optionally add more hooks:
      # - id: specter-health
      # - id: specter-cycles
`;
        fs.writeFileSync(configPath, configContent);
        console.log(chalk.green('  Created .pre-commit-config.yaml'));
        console.log();
        console.log(chalk.dim('  Install hooks with:'));
        console.log(chalk.cyan('    pre-commit install'));
      }

    } else {
      // Show options
      console.log('  Choose a hook setup method:');
      console.log();
      console.log(chalk.bold('  --simple'));
      console.log(chalk.dim('    Direct .git/hooks/pre-commit'));
      console.log(chalk.dim('    No dependencies, works everywhere'));
      console.log();
      console.log(chalk.bold('  --husky'));
      console.log(chalk.dim('    Uses Husky for hook management'));
      console.log(chalk.dim('    Best for Node.js projects'));
      console.log();
      console.log(chalk.bold('  --pre-commit'));
      console.log(chalk.dim('    Uses pre-commit framework'));
      console.log(chalk.dim('    Best for Python or multi-language projects'));
      console.log();
      console.log(chalk.dim('  Example: specter init-hooks --simple'));
    }

    console.log();
  });

program.parse();
