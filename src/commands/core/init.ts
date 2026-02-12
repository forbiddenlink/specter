/**
 * Init command - initialize Specter for a project
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  formatInitComplete,
  formatInitWelcome,
  initializeProject,
  initializeProjectInteractive,
  listAvailablePersonalities,
} from '../../init.js';
import type { PersonalityMode } from '../../personality/types.js';

export function register(program: Command): void {
  program
    .command('init')
    .description('Initialize Specter for your project')
    .option('-d, --dir <path>', 'Directory to initialize', '.')
    .option('--no-interactive', 'Skip interactive prompts')
    .option('-p, --personality <mode>', 'Set default personality mode', 'default')
    .option('--hooks', 'Set up pre-commit hooks')
    .option('--no-scan', 'Skip initial scan')
    .option('--no-config', 'Skip config file creation')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      console.log();
      console.log(formatInitWelcome());
      console.log();

      if (options.interactive === false) {
        // Non-interactive mode
        const result = await initializeProject(rootDir, {
          personality: options.personality as PersonalityMode,
          hooks: options.hooks || false,
          scan: options.scan !== false,
          config: options.config !== false,
        });

        console.log(formatInitComplete(result, rootDir));
      } else {
        // Interactive mode
        try {
          const result = await initializeProjectInteractive(rootDir);
          console.log();
          console.log(formatInitComplete(result, rootDir));
        } catch (error) {
          // User cancelled or error occurred
          if (error instanceof Error && error.message === 'cancelled') {
            console.log(chalk.yellow('  Initialization cancelled.'));
          } else {
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
          }
        }
      }

      // Show available personalities
      console.log();
      console.log(chalk.bold.magenta('  Available Personalities:'));
      console.log(listAvailablePersonalities());
      console.log();
    });
}
