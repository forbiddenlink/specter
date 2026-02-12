/**
 * Seance command - summon deleted code spirits
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatSeance, listRecentlyDeleted, summonSpirits } from '../../seance.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('seance [query]')
    .description('Summon the spirits of deleted code')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Maximum results to show', '10')
    .option('--list', 'List recently deleted files')
    .option('--contents', 'Show file contents')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (query, options) => {
      const rootDir = path.resolve(options.dir);
      const limit = parseInt(options.limit, 10);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('seance', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Communing with the spirits...');
      spinner?.start();

      if (options.list) {
        const deleted = await listRecentlyDeleted(rootDir, limit);
        spinner?.stop();

        if (options.json) {
          outputJson('seance', { deletedFiles: deleted });
          return;
        }

        console.log();
        console.log(chalk.bold.magenta('  👻 Recently Departed Files'));
        console.log(chalk.dim(`  ${'─'.repeat(40)}`));
        if (deleted.length === 0) {
          console.log(chalk.dim('  No spirits found in this time period.'));
        } else {
          for (const file of deleted) {
            console.log(chalk.white(`  • ${file.path} (${file.deletedAt})`));
          }
        }
        console.log();
        return;
      }

      const searchQuery = query || '';
      const result = await summonSpirits(rootDir, searchQuery, {
        limit,
        showContents: options.contents,
      });
      spinner?.stop();

      if (options.json) {
        outputJson('seance', result);
        return;
      }

      const output = formatSeance(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('SEANCE') || line.includes('👻')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.includes('spirit') || line.includes('departed')) {
          console.log(chalk.italic.cyan(`  ${line}`));
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
