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
function _showShareLinks(commandType: string, repoUrl?: string | null): void {
  const shareUrls = generateShareUrls(commandType, repoUrl);
  console.log();
  console.log(chalk.bold.magenta('  📤 Share your results:'));
  console.log(chalk.cyan(`     Twitter: `) + chalk.dim(shareUrls.twitter));
  console.log(chalk.cyan(`     LinkedIn: `) + chalk.dim(shareUrls.linkedin));
}

// AI-powered commands using GitHub Copilot CLI
import { askQuestion } from './ai-ask.js';
import { generateCommitMessage } from './ai-commit.js';
// Import modular command registration
import { registerAllCommands } from './commands/index.js';
import {
  buildEmbeddingIndex,
  embeddingIndexExists,
  isEmbeddingIndexStale,
  saveEmbeddingIndex,
} from './embeddings.js';
import { explainHotspot } from './explain-hotspot.js';
import { generateShareUrls } from './export-png.js';
import {
  formatFix,
  formatFixAll,
  generateFix,
  generateFixAll,
  type SuggestionSeverity,
} from './fix.js';
import { runInteractiveFix } from './fix-interactive.js';
import { loadGraph } from './graph/persistence.js';
import { outputJson, outputJsonError } from './json-output.js';
import { suggestRefactoring } from './suggest-refactor.js';

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
  console.log(bright("  \\___ \\| '_ \\ / _ \\/ __| __/ _ \\ '__|"));
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

// Register all modular commands
registerAllCommands(program);

// =========================================================================
// INLINE COMMANDS (AI-powered, not yet modularized)
// =========================================================================

/**
 * AI Ask command - AI-powered codebase Q&A
 */
program
  .command('ai-ask <question>')
  .description('Ask questions about your codebase using AI (powered by GitHub Copilot CLI)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-c, --context <type>', 'Focus on specific context (hotspots, complexity, dependencies)')
  .option('-v, --verbose', 'Show detailed context used for the answer')
  .action(async (question: string, options) => {
    const rootDir = path.resolve(options.dir);
    await askQuestion(question, rootDir, options);
  });

/**
 * Explain hotspot command - AI-powered hotspot explanations
 */
program
  .command('explain-hotspot <file>')
  .description('Explain why a file is a hotspot using AI (powered by GitHub Copilot CLI)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-l, --lines <range>', 'Explain specific lines (e.g., 10-50)')
  .option('-s, --suggestions', 'Include refactoring suggestions')
  .action(async (file: string, options) => {
    const rootDir = path.resolve(options.dir);
    await explainHotspot(file, rootDir, options);
  });

/**
 * AI commit command - Generate smart commit messages
 */
program
  .command('ai-commit')
  .description('Generate AI-powered commit messages (powered by GitHub Copilot CLI)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-a, --apply', 'Automatically apply the generated commit message')
  .option('-v, --verbose', 'Show detailed diff information')
  .option('-t, --type <type>', 'Specify commit type (feat, fix, docs, etc.)')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);
    await generateCommitMessage(rootDir, options);
  });

/**
 * Suggest refactor command - AI-powered refactoring suggestions
 */
program
  .command('suggest-refactor <file>')
  .description('Get AI-powered refactoring suggestions (powered by GitHub Copilot CLI)')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('-f, --focus <area>', 'Focus on specific area (e.g., "error handling", "performance")')
  .option('-p, --priority <type>', 'Priority: complexity, coupling, testability, or all', 'all')
  .option('--format <type>', 'Output format: steps, diff, or explanation', 'steps')
  .action(async (file: string, options) => {
    const rootDir = path.resolve(options.dir);
    await suggestRefactoring(file, rootDir, options);
  });

/**
 * Index command - Build embedding index for semantic search
 */
program
  .command('index')
  .description('Build embedding index for semantic search')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--rebuild', 'Force rebuild even if index exists')
  .option('--json', 'Output as JSON for CI/CD integration')
  .action(async (options) => {
    const rootDir = path.resolve(options.dir);

    if (!options.json) {
      console.log();
      console.log(chalk.bold.magenta('  ╔═══════════════════════════════════════════╗'));
      console.log(
        chalk.bold.magenta('  ║') +
          chalk.bold.white('      🧠 BUILDING SEMANTIC INDEX...         ') +
          chalk.bold.magenta('║')
      );
      console.log(chalk.bold.magenta('  ╚═══════════════════════════════════════════╝'));
      console.log();
    }

    const spinner = options.json ? null : createSpinner('Loading knowledge graph...');
    spinner?.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      spinner?.fail('No graph found. Run `specter scan` first.');
      if (options.json) {
        outputJsonError('index', 'No graph found. Run `specter scan` first.');
      }
      return;
    }

    // Check if index already exists and is fresh
    if (!options.rebuild && (await embeddingIndexExists(rootDir))) {
      const isStale = await isEmbeddingIndexStale(rootDir);
      if (!isStale) {
        spinner?.info('Embedding index is up to date. Use --rebuild to force rebuild.');
        if (options.json) {
          outputJson('index', { upToDate: true, rebuilt: false });
        }
        return;
      }
      if (spinner) spinner.text = 'Index is stale, rebuilding...';
    }

    if (spinner) spinner.text = 'Building TF-IDF vectors...';

    const startTime = Date.now();
    const index = await buildEmbeddingIndex(graph);

    if (spinner) spinner.text = 'Saving embedding index...';
    await saveEmbeddingIndex(rootDir, index);

    const duration = Date.now() - startTime;
    spinner?.succeed(chalk.bold('Semantic index built!'));

    // JSON output for CI/CD
    if (options.json) {
      outputJson('index', {
        upToDate: false,
        rebuilt: true,
        chunkCount: index.chunkCount,
        vocabularySize: index.vocabularySize,
        durationMs: duration,
      });
      return;
    }

    console.log();
    console.log(chalk.bold('┌─────────────────────────────────────────────┐'));
    console.log(
      chalk.bold('│') + chalk.cyan('  🧠 EMBEDDING INDEX READY'.padEnd(44)) + chalk.bold('│')
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

/**
 * Fix command - suggest actionable fixes for detected issues
 */
program
  .command('fix [file]')
  .description('Suggest actionable fixes for detected issues in a file or all files')
  .option('-d, --dir <path>', 'Directory to analyze', '.')
  .option('--all', 'Analyze all files with issues')
  .option('-i, --interactive', 'Interactive mode - apply fixes step-by-step')
  .option('--auto-apply', 'Auto-apply safe fixes in interactive mode')
  .option('-s, --severity <level>', 'Minimum severity: critical, warning, info', 'info')
  .option('--json', 'Output as JSON for CI/CD integration')
  .action(async (file, options) => {
    const rootDir = path.resolve(options.dir);

    const spinner = options.json ? null : createSpinner('Analyzing for fix suggestions...');
    spinner?.start();

    const graph = await loadGraph(rootDir);

    if (!graph) {
      if (options.json) {
        outputJsonError('fix', 'No graph found. Run `specter scan` first.');
      }
      spinner?.fail('No graph found. Run `specter scan` first.');
      return;
    }

    const severity = options.severity as SuggestionSeverity;

    if (options.all || !file) {
      // Analyze all files
      const results = await generateFixAll(rootDir, graph, { severity });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('fix', {
          mode: 'all',
          results,
          totalFiles: results.length,
          totalSuggestions: results.reduce((sum, r) => sum + r.summary.total, 0),
        });
        return;
      }

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
        if (options.json) {
          outputJsonError('fix', `File not found in knowledge graph: ${file}`);
        }
        spinner?.fail(`File not found in knowledge graph: ${file}`);
        console.log(chalk.dim('  Make sure the file was scanned. Run `specter scan` to update.'));
        return;
      }

      const result = await generateFix(fileNode.filePath, rootDir, graph, { severity });
      spinner?.stop();

      // Interactive mode
      if (options.interactive) {
        const session = await runInteractiveFix(result, {
          autoApply: options.autoApply,
          skipInfo: severity !== 'info',
        });

        // If we applied any fixes, offer to rescan
        if (session.applied > 0) {
          console.log(
            chalk.cyan('  🔄 Fixes applied! Run `specter scan` to update the knowledge graph.')
          );
          console.log();
        }

        return;
      }

      // JSON output for CI/CD (single file)
      if (options.json) {
        outputJson('fix', {
          mode: 'single',
          file: fileNode.filePath,
          result,
        });
        return;
      }

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
        } else if (
          line.startsWith('     ') &&
          (line.includes('Extract') || line.includes('Lines'))
        ) {
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

program.parse();
