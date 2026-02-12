/**
 * Scan command - builds the knowledge graph
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { getComplexityEmoji } from '../../analyzers/complexity.js';
import { buildKnowledgeGraph, getGraphStats } from '../../graph/builder.js';
import { graphExists, isGraphStale, saveGraph } from '../../graph/persistence.js';
import { outputJson } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('scan')
    .description('Scan the codebase and build the knowledge graph')
    .option('-d, --dir <path>', 'Directory to scan', '.')
    .option('--no-git', 'Skip git history analysis')
    .option('-f, --force', 'Force rescan even if graph exists')
    .option('-q, --quiet', 'Minimal output')
    .option('-v, --verbose', 'Show detailed progress (file names being analyzed)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const projectName = path.basename(rootDir);
      const quiet = options.quiet || options.json;

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

        const result = await buildKnowledgeGraph({
          rootDir,
          includeGitHistory: options.git !== false,
          onProgress: (phase, completed, total, currentFile) => {
            if (phase === 'Analyzing AST' && total > 1) {
              // Create a progress bar
              const barWidth = 25;
              const progress = completed / total;
              const filled = Math.round(progress * barWidth);
              const empty = barWidth - filled;
              const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
              const percent = Math.round(progress * 100);

              if (options.verbose && currentFile) {
                spinner.text = `Learning... ${bar} ${percent}% - ${currentFile}`;
              } else {
                spinner.text = `Learning about myself... ${bar} ${percent}% (${completed}/${total})`;
              }
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
        const healthScore = Math.max(0, 100 - stats.avgComplexity * 5);

        // JSON output for CI/CD
        if (options.json) {
          outputJson('scan', {
            projectName,
            ...stats,
            healthScore: Math.round(healthScore),
            errors: result.errors.map((e) => ({ file: e.file, error: e.error })),
          });
          return;
        }

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
}
