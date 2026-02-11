#!/usr/bin/env node
/**
 * Specter CLI
 *
 * Command-line interface for scanning codebases and managing
 * the knowledge graph.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import path from 'path';

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
import { buildKnowledgeGraph, getGraphStats } from './graph/builder.js';
import { saveGraph, loadGraph, loadMetadata, graphExists, deleteGraph, isGraphStale } from './graph/persistence.js';
import { findComplexityHotspots, generateComplexityReport, getComplexityEmoji } from './analyzers/complexity.js';
import { loadSnapshots, getSnapshotCount } from './history/storage.js';
import { analyzeTrends, getTimeSpan } from './history/trends.js';
import { coloredSparkline, healthBar } from './ui/index.js';
import type { PersonalityMode } from './personality/types.js';
import { formatHealthComment, formatTrendComment, formatRiskComment } from './personality/formatter.js';

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
      console.log(chalk.bold.magenta('  ║') + chalk.bold.white('          👻 SPECTER AWAKENING...          ') + chalk.bold.magenta('║'));
      console.log(chalk.bold.magenta('  ╚═══════════════════════════════════════════╝'));
      console.log();
    }

    const spinner = createSpinner('Initializing...').start();

    try {
      // Check if graph already exists and is fresh
      if (!options.force && await graphExists(rootDir)) {
        const isStale = await isGraphStale(rootDir);
        if (!isStale) {
          spinner.info('I already know this codebase. Use --force to rescan.');
          return;
        }
        spinner.text = 'My memory is stale, relearning...';
      }

      let lastFile = '';
      let discoveries: string[] = [];

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
        console.log(chalk.bold('│') + chalk.cyan(`  👻 I am ${chalk.bold(projectName)}`.padEnd(44)) + chalk.bold('│'));
        console.log(chalk.bold('├─────────────────────────────────────────────┤'));
        console.log(chalk.bold('│') + `  📁 Files:       ${chalk.cyan(String(stats.fileCount).padStart(6))}`.padEnd(50) + chalk.bold('│'));
        console.log(chalk.bold('│') + `  📝 Lines:       ${chalk.cyan(stats.totalLines.toLocaleString().padStart(6))}`.padEnd(50) + chalk.bold('│'));
        console.log(chalk.bold('│') + `  🔣 Symbols:     ${chalk.cyan(String(stats.nodeCount - stats.fileCount).padStart(6))}`.padEnd(50) + chalk.bold('│'));
        console.log(chalk.bold('│') + `  🔗 Relations:   ${chalk.cyan(String(stats.edgeCount).padStart(6))}`.padEnd(50) + chalk.bold('│'));
        console.log(chalk.bold('├─────────────────────────────────────────────┤'));

        // Complexity personality
        const healthScore = Math.max(0, 100 - (stats.avgComplexity * 5));
        const mood = healthScore >= 80 ? '😊' : healthScore >= 60 ? '😐' : '😰';
        console.log(chalk.bold('│') + `  ${mood} Health:     ${getComplexityEmoji(stats.avgComplexity)} ${chalk.yellow(Math.round(healthScore))}/100`.padEnd(48) + chalk.bold('│'));

        if (stats.maxComplexity > 15) {
          console.log(chalk.bold('│') + chalk.yellow(`  ⚠️  I have some complex areas...`).padEnd(48) + chalk.bold('│'));
        }

        console.log(chalk.bold('└─────────────────────────────────────────────┘'));

        // Languages
        console.log();
        const langs = Object.entries(stats.languages).map(([lang, count]) => `${lang}: ${count}`).join(', ');
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
  .option('-p, --personality <mode>', 'Output personality: mentor, critic, historian, cheerleader, minimalist', 'default')
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
    const progressBar = (value: number, max: number, width: number, color: (s: string) => string): string => {
      const filled = Math.round((value / max) * width);
      const empty = width - filled;
      return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    };

    // Calculate totals for progress bars
    const totalFunctions = report.distribution.low + report.distribution.medium +
                          report.distribution.high + report.distribution.veryHigh;
    const barWidth = 20;

    // Overall score
    const healthScore = Math.max(0, 100 - (report.averageComplexity * 5));
    const scoreColor = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
    const scoreEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';

    const W = 60; // inner width

    console.log();
    console.log(chalk.bold('╔' + '═'.repeat(W) + '╗'));
    console.log(chalk.bold('║') + '  👻 ' + chalk.bold.white('SPECTER HEALTH REPORT') + ' '.repeat(W - 27) + chalk.bold('║'));
    console.log(chalk.bold('╠' + '═'.repeat(W) + '╣'));

    // Health score with large display
    const scoreDisplay = `${Math.round(healthScore)}`.padStart(3);
    const scoreLine = `  ${scoreEmoji} Health Score: ${scoreDisplay}/100`;
    console.log(chalk.bold('║') + scoreLine + ' '.repeat(W - scoreLine.length + 4) + chalk.bold('║'));
    const barLine = `     ${progressBar(healthScore, 100, 40, scoreColor)}`;
    console.log(chalk.bold('║') + barLine + ' '.repeat(W - 45) + chalk.bold('║'));
    console.log(chalk.bold('╠' + '═'.repeat(W) + '╣'));

    // Complexity distribution with bars
    const distTitle = '  📊 Complexity Distribution';
    console.log(chalk.bold('║') + distTitle + ' '.repeat(W - distTitle.length + 2) + chalk.bold('║'));
    console.log(chalk.bold('║') + chalk.dim('  ' + '─'.repeat(W - 4)) + chalk.bold('║'));

    const formatRow = (emoji: string, label: string, count: number, color: (s: string) => string) => {
      const countStr = String(count).padStart(4);
      const bar = progressBar(count, totalFunctions || 1, barWidth, color);
      const line = `  ${emoji} ${label.padEnd(16)} ${bar} ${countStr}`;
      return chalk.bold('║') + line + ' '.repeat(W - line.length + 6) + chalk.bold('║');
    };

    console.log(formatRow('🟢', 'Low (1-5)', report.distribution.low, chalk.green));
    console.log(formatRow('🟡', 'Medium (6-10)', report.distribution.medium, chalk.yellow));
    console.log(formatRow('🟠', 'High (11-20)', report.distribution.high, chalk.hex('#FFA500')));
    console.log(formatRow('🔴', 'Critical (21+)', report.distribution.veryHigh, chalk.red));

    console.log(chalk.bold('╠' + '═'.repeat(W) + '╣'));

    // Hotspots
    if (report.hotspots.length > 0) {
      const hotspotTitle = `  🔥 Top ${Math.min(limit, report.hotspots.length)} Complexity Hotspots`;
      console.log(chalk.bold('║') + hotspotTitle + ' '.repeat(W - hotspotTitle.length + 2) + chalk.bold('║'));
      console.log(chalk.bold('║') + chalk.dim('  ' + '─'.repeat(W - 4)) + chalk.bold('║'));

      for (const hotspot of report.hotspots.slice(0, limit)) {
        const emoji = getComplexityEmoji(hotspot.complexity);
        const location = `${hotspot.filePath}:${hotspot.lineStart}`.slice(0, 48);
        const info = `${hotspot.name} (${hotspot.type})`.slice(0, 40);
        const complexity = String(hotspot.complexity).padStart(2);

        const line1 = `  ${emoji} ${location}`;
        console.log(chalk.bold('║') + chalk.cyan(line1) + ' '.repeat(W - line1.length + 2) + chalk.bold('║'));
        const line2 = `     ${info}`;
        const cplx = `C:${complexity}`;
        console.log(chalk.bold('║') + chalk.dim(line2) + ' '.repeat(W - line2.length - cplx.length - 1) + chalk.yellow(cplx) + ' ' + chalk.bold('║'));
      }
    } else {
      const noHotspots = '  ✨ No complexity hotspots found! Great job!';
      console.log(chalk.bold('║') + chalk.green(noHotspots) + ' '.repeat(W - noHotspots.length) + chalk.bold('║'));
    }

    console.log(chalk.bold('╚' + '═'.repeat(W) + '╝'));

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
  .option('-p, --personality <mode>', 'Output personality: mentor, critic, historian, cheerleader, minimalist', 'default')
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
      console.log(chalk.yellow('No health history yet. Run `specter scan` a few times to build up trend data.'));
      return;
    }

    const analysis = analyzeTrends(snapshots);
    const timeSpan = getTimeSpan(snapshots);

    const W = 60; // inner width

    console.log();
    console.log(chalk.bold('╔' + '═'.repeat(W) + '╗'));
    console.log(chalk.bold('║') + '  📈 ' + chalk.bold.white('SPECTER HEALTH TRENDS') + ' '.repeat(W - 27) + chalk.bold('║'));
    console.log(chalk.bold('╠' + '═'.repeat(W) + '╣'));

    // Current health
    if (analysis.current) {
      const { healthScore, avgComplexity, hotspotCount, fileCount, totalLines } = analysis.current.metrics;
      const grade = healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F';
      const scoreColor = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;

      const scoreLine = `  Current Health: ${scoreColor(String(healthScore))}/100 (Grade ${grade})`;
      console.log(chalk.bold('║') + scoreLine + ' '.repeat(W - scoreLine.length + 13) + chalk.bold('║'));

      const bar = healthBar(healthScore, 40);
      console.log(chalk.bold('║') + '  ' + bar + ' '.repeat(W - 44) + chalk.bold('║'));

      console.log(chalk.bold('║') + chalk.dim('  ' + '─'.repeat(W - 4)) + chalk.bold('║'));

      // Metrics
      const metricsLine1 = `  Files: ${fileCount}  |  Lines: ${totalLines.toLocaleString()}  |  Hotspots: ${hotspotCount}`;
      console.log(chalk.bold('║') + metricsLine1 + ' '.repeat(W - metricsLine1.length + 2) + chalk.bold('║'));

      if (analysis.current.commitHash) {
        const commitLine = `  Commit: ${analysis.current.commitHash}`;
        console.log(chalk.bold('║') + chalk.dim(commitLine) + ' '.repeat(W - commitLine.length + 2) + chalk.bold('║'));
      }
    }

    console.log(chalk.bold('╠' + '═'.repeat(W) + '╣'));

    // Sparkline trend
    if (snapshots.length >= 2) {
      const scores = [...snapshots].reverse().map(s => s.metrics.healthScore);
      const sparkline = coloredSparkline(scores, true);
      const sparkTitle = `  Health over ${timeSpan} (${snapshotCount} snapshots):`;
      console.log(chalk.bold('║') + sparkTitle + ' '.repeat(W - sparkTitle.length + 2) + chalk.bold('║'));
      console.log(chalk.bold('║') + '  ' + sparkline + ' '.repeat(W - sparkline.length - 2) + chalk.bold('║'));
      console.log(chalk.bold('║') + chalk.dim('  ' + '─'.repeat(W - 4)) + chalk.bold('║'));
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
      console.log(chalk.bold('║') + trendTitle + ' '.repeat(W - trendTitle.length + 2) + chalk.bold('║'));

      if (selectedTrend.changePercent !== 0) {
        const sign = selectedTrend.changePercent > 0 ? '+' : '';
        const changeLine = `  Change: ${sign}${selectedTrend.changePercent}%`;
        const changeColor = selectedTrend.changePercent > 0 ? chalk.green : chalk.red;
        console.log(chalk.bold('║') + changeColor(changeLine) + ' '.repeat(W - changeLine.length + 2) + chalk.bold('║'));
      }

      // Insights
      if (selectedTrend.insights.length > 0) {
        console.log(chalk.bold('║') + ' '.repeat(W) + chalk.bold('║'));
        const insightsTitle = '  Insights:';
        console.log(chalk.bold('║') + chalk.cyan(insightsTitle) + ' '.repeat(W - insightsTitle.length + 2) + chalk.bold('║'));
        for (const insight of selectedTrend.insights.slice(0, 5)) {
          const insightLine = `  • ${insight}`.slice(0, W - 2);
          console.log(chalk.bold('║') + insightLine + ' '.repeat(W - insightLine.length + 2) + chalk.bold('║'));
        }
      }
    } else {
      const noDataLine = `  Not enough data for ${period} trends. Keep scanning!`;
      console.log(chalk.bold('║') + chalk.dim(noDataLine) + ' '.repeat(W - noDataLine.length + 2) + chalk.bold('║'));
    }

    console.log(chalk.bold('╚' + '═'.repeat(W) + '╝'));

    // First-person summary with personality
    console.log();
    if (selectedTrend && personality !== 'default') {
      const personalitySummary = formatTrendComment(selectedTrend.direction, selectedTrend.changePercent, personality);
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
  .option('-p, --personality <mode>', 'Output personality: mentor, critic, historian, cheerleader, minimalist', 'default')
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
      const levelColor = risk.level === 'low' ? chalk.green :
                        risk.level === 'medium' ? chalk.yellow :
                        risk.level === 'high' ? chalk.hex('#FFA500') :
                        chalk.red;

      const levelEmoji = risk.level === 'low' ? '\u{1F7E2}' :
                        risk.level === 'medium' ? '\u{1F7E1}' :
                        risk.level === 'high' ? '\u{1F7E0}' : '\u{1F534}';

      const W = 55; // inner width

      console.log();
      console.log(chalk.bold('\u2554' + '\u2550'.repeat(W) + '\u2557'));
      console.log(chalk.bold('\u2551') + '  \u{1F47B} ' + chalk.bold.white('SPECTER RISK ANALYSIS') + ' '.repeat(W - 27) + chalk.bold('\u2551'));
      console.log(chalk.bold('\u2560' + '\u2550'.repeat(W) + '\u2563'));

      // Overall score with big display
      const riskLabel = `  ${levelEmoji} Risk: ${levelColor(risk.level.toUpperCase())} ${risk.overall}/100`;
      console.log(chalk.bold('\u2551') + riskLabel + ' '.repeat(W - riskLabel.length + 13) + chalk.bold('\u2551'));

      // Progress bar for risk
      const barWidth = 40;
      const filled = Math.round((risk.overall / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = levelColor('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty));
      console.log(chalk.bold('\u2551') + '  ' + bar + ' '.repeat(W - barWidth - 4) + chalk.bold('\u2551'));

      console.log(chalk.bold('\u2560' + '\u2550'.repeat(W) + '\u2563'));

      // Factor breakdown
      const factorTitle = '  Risk Factors:';
      console.log(chalk.bold('\u2551') + chalk.cyan(factorTitle) + ' '.repeat(W - factorTitle.length + 2) + chalk.bold('\u2551'));
      console.log(chalk.bold('\u2551') + chalk.dim('  ' + '\u2500'.repeat(W - 4)) + chalk.bold('\u2551'));

      for (const [, factor] of Object.entries(risk.factors)) {
        const factorBar = (() => {
          const fWidth = 12;
          const fFilled = Math.round((factor.score / 100) * fWidth);
          const fEmpty = fWidth - fFilled;
          const fColor = factor.score <= 25 ? chalk.green :
                        factor.score <= 50 ? chalk.yellow :
                        factor.score <= 75 ? chalk.hex('#FFA500') : chalk.red;
          return fColor('\u2588'.repeat(fFilled)) + chalk.dim('\u2591'.repeat(fEmpty));
        })();
        const scorePad = factor.score.toString().padStart(3);
        const factorLine = `  ${factor.name.padEnd(18)} ${factorBar} ${scorePad}`;
        console.log(chalk.bold('\u2551') + factorLine + ' '.repeat(W - factorLine.length + 2) + chalk.bold('\u2551'));
      }

      console.log(chalk.bold('\u2560' + '\u2550'.repeat(W) + '\u2563'));

      // Recommendations
      if (risk.recommendations.length > 0) {
        const recTitle = '  Recommendations:';
        console.log(chalk.bold('\u2551') + chalk.yellow(recTitle) + ' '.repeat(W - recTitle.length + 2) + chalk.bold('\u2551'));
        for (const rec of risk.recommendations) {
          const recLine = `  \u2022 ${rec.slice(0, W - 6)}`;
          console.log(chalk.bold('\u2551') + recLine + ' '.repeat(Math.max(0, W - recLine.length + 2)) + chalk.bold('\u2551'));
        }
      }

      console.log(chalk.bold('\u255A' + '\u2550'.repeat(W) + '\u255D'));

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
 * Clean command - remove cached graph
 */
program
  .command('clean')
  .description('Remove the cached knowledge graph')
  .option('-d, --dir <path>', 'Directory to clean', '.')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    await deleteGraph(rootDir);
    console.log(chalk.green('✓ Graph cache removed.'));
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
      const { exec } = await import('child_process');
      const platform = process.platform;
      const command = platform === 'darwin' ? 'open' :
                     platform === 'win32' ? 'start' : 'xdg-open';
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

program.parse();
