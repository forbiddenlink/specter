/**
 * Watch command - Real-time code analysis
 */

import path from 'node:path';
import type { Command } from 'commander';
import type { PersonalityMode } from '../../personality/types.js';
import { startWatch } from '../../watch.js';

export function register(program: Command): void {
  program
    .command('watch')
    .description('Watch files and provide real-time analysis feedback')
    .option('-d, --dir <path>', 'Directory to watch', '.')
    .option(
      '-p, --personality <mode>',
      'Output personality: roast, noir, zen, pirate, motivational, sage, hacker, poet, valley, default',
      'default'
    )
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '500')
    .option('--all', 'Show all changes, not just significant ones')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const mode = options.personality as PersonalityMode;
      const debounceMs = parseInt(options.debounce, 10);
      const showAll = options.all;

      await startWatch({
        rootDir,
        mode,
        debounceMs,
        showAll,
      });
    });
}
