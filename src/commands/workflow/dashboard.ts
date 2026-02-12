/**
 * Dashboard command - launch interactive web dashboard
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';

export function register(program: Command): void {
  program
    .command('dashboard')
    .description('Launch interactive web dashboard')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-p, --port <port>', 'Port to listen on', '3333')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const port = parseInt(options.port, 10);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const { startDashboard } = await import('../../dashboard/server.js');
      const openBrowser = options.open !== false;
      const result = await startDashboard({ rootDir, port });

      console.log(chalk.green(`Dashboard running at ${result.url}`));

      if (openBrowser) {
        const { exec } = await import('node:child_process');
        const cmd =
          process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start'
              : 'xdg-open';
        exec(`${cmd} ${result.url}`);
      }

      // Keep process running
      console.log(chalk.dim('Press Ctrl+C to stop the dashboard'));
      process.on('SIGINT', async () => {
        await result.close();
        process.exit(0);
      });
    });
}
