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
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    const limit = parseInt(options.limit, 10);

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

    // Summary line
    console.log();
    if (healthScore >= 80) {
      console.log(chalk.green('  ✨ Your codebase is in great shape!'));
    } else if (healthScore >= 60) {
      console.log(chalk.yellow('  ⚠️  Some areas could use attention.'));
    } else {
      console.log(chalk.red('  🚨 Consider refactoring high-complexity functions.'));
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

program.parse();
