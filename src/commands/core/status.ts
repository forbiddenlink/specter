/**
 * Status command - show graph status
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { graphExists, isGraphStale, loadMetadata } from '../../graph/persistence.js';
import { outputJson } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('status')
    .description('Show the current graph status')
    .option('-d, --dir <path>', 'Directory to check', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const exists = await graphExists(rootDir);

      if (!exists) {
        if (options.json) {
          outputJson('status', { exists: false, stale: false });
          return;
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const metadata = await loadMetadata(rootDir);
      const isStale = await isGraphStale(rootDir);

      if (options.json) {
        outputJson('status', {
          exists: true,
          stale: isStale,
          scannedAt: metadata?.scannedAt || null,
          fileCount: metadata?.fileCount || 0,
          totalLines: metadata?.totalLines || 0,
          nodeCount: metadata?.nodeCount || 0,
          edgeCount: metadata?.edgeCount || 0,
        });
        return;
      }

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
}
