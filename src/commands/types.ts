/**
 * Shared types and utilities for command modules
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import type { Ora } from 'ora';
import ora from 'ora';

export { default as path } from 'node:path';
export { default as chalk } from 'chalk';
export type { Command } from 'commander';

// Re-export common types
export type { PersonalityMode } from '../personality/types.js';

/**
 * Create a spinner that works in both TTY and non-TTY environments
 */
export function createSpinner(text: string): Ora {
  const spinner = ora({
    text,
    isSilent: !process.stdout.isTTY,
  });
  if (!process.stdout.isTTY) {
    console.log(text);
  }
  return spinner;
}

/**
 * Display share links after PNG export
 */
export function showShareLinks(commandType: string, repoUrl?: string | null): void {
  // Dynamic import to avoid circular dependencies
  import('../export-png.js').then(({ generateShareUrls }) => {
    const shareUrls = generateShareUrls(commandType, repoUrl);
    console.log();
    console.log(chalk.bold.magenta('  📤 Share your results:'));
    console.log(chalk.cyan(`     Twitter: `) + chalk.dim(shareUrls.twitter));
    console.log(chalk.cyan(`     LinkedIn: `) + chalk.dim(shareUrls.linkedin));
  });
}

/**
 * Standard command registration function type
 */
export type RegisterCommand = (program: Command) => void;
