/**
 * Search command - semantic code search
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadEmbeddingIndex } from '../../embeddings.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import {
  formatSearchWithMode,
  type SearchMode,
  type SearchResponse,
  searchCodebase,
  semanticSearch,
} from '../../search.js';
import { createSpinner } from '../types.js';

type LineFormatter = (line: string) => string;

interface FormatRule {
  match: (line: string) => boolean;
  format: LineFormatter;
}

/**
 * Rules for formatting output lines, evaluated in order.
 * First matching rule wins.
 */
const FORMAT_RULES: FormatRule[] = [
  {
    match: (line) => line.includes('┏') || line.includes('┗') || line.includes('┃'),
    format: (line) => chalk.bold.cyan(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('Query:'),
    format: (line) => chalk.yellow(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('Found:'),
    format: (line) => chalk.dim(`  ${line}`),
  },
  {
    match: (line) =>
      line.startsWith('TOP MATCHES') ||
      line.startsWith('GOOD MATCHES') ||
      line.startsWith('OTHER MATCHES'),
    format: (line) => chalk.bold.magenta(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('SUGGESTIONS'),
    format: (line) => chalk.bold.yellow(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('─') || line.startsWith('━'),
    format: (line) => chalk.dim(`  ${line}`),
  },
  {
    match: (line) => line.includes('💡'),
    format: (line) => chalk.italic.cyan(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('📁'),
    format: (line) => chalk.cyan(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('🔣') || line.startsWith('📦'),
    format: (line) => chalk.green(`  ${line}`),
  },
  {
    match: (line) => line.startsWith('📋') || line.startsWith('📝'),
    format: (line) => chalk.blue(`  ${line}`),
  },
  {
    match: (line) => line.includes('📍'),
    format: (line) => chalk.dim.cyan(`  ${line}`),
  },
  {
    match: (line) => line.includes('✓'),
    format: (line) => chalk.dim.green(`  ${line}`),
  },
  {
    match: (line) => line.includes('[█') || line.includes('[▓') || line.includes('[░'),
    format: (line) => formatProgressBar(line),
  },
  {
    match: (line) => line.includes('No matches'),
    format: (line) => chalk.yellow(`  ${line}`),
  },
  {
    match: (line) => line.includes('... and'),
    format: (line) => chalk.dim(`  ${line}`),
  },
];

function formatProgressBar(line: string): string {
  if (line.includes('█')) {
    return chalk.green(`  ${line}`);
  }
  if (line.includes('▓')) {
    return chalk.yellow(`  ${line}`);
  }
  return chalk.dim(`  ${line}`);
}

function formatOutputLine(line: string): string {
  for (const rule of FORMAT_RULES) {
    if (rule.match(line)) {
      return rule.format(line);
    }
  }
  return chalk.white(`  ${line}`);
}

function displayResults(response: SearchResponse, limit: number): void {
  const output = formatSearchWithMode(response, limit);

  console.log();
  for (const line of output.split('\n')) {
    console.log(formatOutputLine(line));
  }
  console.log();
}

export function register(program: Command): void {
  program
    .command('search <query>')
    .description('Natural language code search with semantic understanding')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Maximum results to show', '10')
    .option('-s, --semantic', 'Use pure semantic search')
    .option('-k, --keyword', 'Use pure keyword search')
    .option('--json', 'Output as JSON for CI/CD integration')
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

      const spinner = options.json ? null : createSpinner('Searching codebase...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('search', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      let response: SearchResponse;

      if (mode === 'keyword') {
        // Pure keyword search (no index needed)
        response = searchCodebase(query, graph);
        response.mode = 'keyword';
      } else {
        // Need embedding index for semantic or hybrid search
        const index = await loadEmbeddingIndex(rootDir);

        if (!index) {
          if (mode === 'semantic') {
            spinner?.fail(
              'No embedding index found. Run `specter index` first for semantic search.'
            );
            if (options.json) {
              outputJsonError(
                'search',
                'No embedding index found. Run `specter index` first for semantic search.'
              );
            }
            return;
          }
          // Fall back to keyword search for hybrid mode
          if (spinner) spinner.text = 'No embedding index found, using keyword search...';
          response = searchCodebase(query, graph);
          response.mode = 'keyword';
        } else {
          response = semanticSearch(query, graph, index, { mode, limit: limit * 2 });
        }
      }

      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('search', {
          query,
          mode: response.mode,
          totalResults: response.results.length,
          results: response.results.slice(0, limit),
        });
        return;
      }

      displayResults(response, limit);
    });
}
