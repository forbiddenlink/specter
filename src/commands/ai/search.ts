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

      const output = formatSearchWithMode(response, limit);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Query:')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.startsWith('Found:')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (
          line.startsWith('TOP MATCHES') ||
          line.startsWith('GOOD MATCHES') ||
          line.startsWith('OTHER MATCHES')
        ) {
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
}
