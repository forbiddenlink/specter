/**
 * Index command - Build embedding index for semantic search
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  buildEmbeddingIndex,
  type EmbeddingIndex,
  embeddingIndexExists,
  isEmbeddingIndexStale,
  saveEmbeddingIndex,
} from '../../embeddings.js';
import { loadGraph } from '../../graph/persistence.js';
import type { KnowledgeGraph } from '../../graph/types.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

function printBanner(): void {
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

function printIndexSummary(index: EmbeddingIndex, duration: number): void {
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
}

async function checkIndexFreshness(
  rootDir: string,
  rebuild: boolean,
  isJson: boolean
): Promise<boolean> {
  if (rebuild || !(await embeddingIndexExists(rootDir))) {
    return false;
  }

  const isStale = await isEmbeddingIndexStale(rootDir);
  if (!isStale) {
    if (isJson) {
      outputJson('index', { upToDate: true, rebuilt: false });
    } else {
      const spinner = createSpinner('');
      spinner.info('Embedding index is up to date. Use --rebuild to force rebuild.');
    }
    return true;
  }

  return false;
}

async function buildAndSaveIndex(
  graph: KnowledgeGraph,
  rootDir: string,
  isJson: boolean
): Promise<{ index: EmbeddingIndex; duration: number }> {
  const spinner = isJson ? null : createSpinner('Building TF-IDF vectors...');
  spinner?.start();

  const startTime = Date.now();
  const index = await buildEmbeddingIndex(graph);

  if (spinner) spinner.text = 'Saving embedding index...';
  await saveEmbeddingIndex(rootDir, index);

  const duration = Date.now() - startTime;
  spinner?.succeed(chalk.bold('Semantic index built!'));

  return { index, duration };
}

function outputIndexResult(index: EmbeddingIndex, duration: number, isJson: boolean): void {
  if (isJson) {
    outputJson('index', {
      upToDate: false,
      rebuilt: true,
      chunkCount: index.chunkCount,
      vocabularySize: index.vocabularySize,
      durationMs: duration,
    });
  } else {
    printIndexSummary(index, duration);
  }
}

async function handleIndexRebuild(
  rootDir: string,
  graph: KnowledgeGraph,
  options: {
    rebuild?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const isJson = options.json ?? false;
  const rebuild = options.rebuild ?? false;

  // Check if index is fresh
  const isFresh = await checkIndexFreshness(rootDir, rebuild, isJson);
  if (isFresh) return;

  const spinner = isJson ? null : createSpinner('Building embedding index...');
  if (spinner && rebuild) {
    spinner.text = 'Index is stale, rebuilding...';
  }
  spinner?.start();

  // Build and save index
  const { index, duration } = await buildAndSaveIndex(graph, rootDir, isJson);
  spinner?.stop();

  // Output results
  outputIndexResult(index, duration, isJson);
}

export function register(program: Command): void {
  program
    .command('index')
    .description('Build embedding index for semantic search')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--rebuild', 'Force rebuild even if index exists')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const isJson = options.json;

      if (!isJson) printBanner();

      const spinner = isJson ? null : createSpinner('Loading knowledge graph...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (isJson) {
          outputJsonError('index', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      spinner?.stop();
      await handleIndexRebuild(rootDir, graph, options);
    });
}
