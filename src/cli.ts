#!/usr/bin/env node

/**
 * Specter CLI
 *
 * Command-line interface for scanning codebases and managing
 * the knowledge graph.
 */

import cfonts from 'cfonts';
import chalk from 'chalk';
import { Command, type ParseOptions } from 'commander';
import gradient from 'gradient-string';

// Import global CLI utilities
import { setGlobalOptions, suggestCommand } from './cli-utils.js';

// Display share links after PNG export
function _showShareLinks(commandType: string, repoUrl?: string | null): void {
  const { generateShareUrls } = require('./export-png.js');
  const shareUrls = generateShareUrls(commandType, repoUrl);
  console.log();
  console.log(chalk.bold.magenta('  📤 Share your results:'));
  console.log(chalk.cyan(`     Twitter: `) + chalk.dim(shareUrls.twitter));
  console.log(chalk.cyan(`     LinkedIn: `) + chalk.dim(shareUrls.linkedin));
}

// Import modular command registration
import { registerAllCommands } from './commands/index.js';

const program = new Command();

// Global accessibility flag - can also be set via environment variable
export const isAccessibleMode = process.env['SPECTER_ACCESSIBLE'] === 'true';

/**
 * ASCII banner for Specter CLI
 * Uses cfonts chrome font for a striking 3D metallic effect
 */
function printBanner(): void {
  if (process.stdout.isTTY) {
    cfonts.say('Specter', {
      font: 'chrome',
      colors: ['#9b59b6', '#6c5ce7', '#a29bfe'],
      space: false,
    });
  } else {
    // Fallback for non-TTY (CI, piped output)
    const specterGradient = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
    console.log(specterGradient('  SPECTER'));
  }
  console.log(chalk.dim('        Give your codebase a voice'));
  console.log();
}

/**
 * Print version with banner
 */
function printVersion(): void {
  printBanner();
  console.log(chalk.dim(`  v1.1.0`));
  console.log();
}

// Check for version flag early to show banner
const hasVersionFlag = process.argv.includes('-V') || process.argv.includes('--version');
const hasNoCommand = process.argv.length === 2;

if (hasVersionFlag) {
  printVersion();
  process.exit(0);
}

// Set up global options before command registration
program.option('--accessible', 'Enable accessibility mode (color-blind friendly)');
program.option('-q, --quiet', 'Suppress non-essential output (useful for CI/CD)');
program.option('--no-emoji', 'Disable emoji in output');

if (hasNoCommand) {
  printBanner();
}

program
  .name('specter')
  .description('Give your codebase a voice. Build a knowledge graph and talk to your code.')
  .version('1.1.0')
  .showSuggestionAfterError(true)
  .showHelpAfterError('(add --help for additional information)');

// Capture global options after parsing
const originalParse = program.parse.bind(program);
program.parse = (argv?: readonly string[], parseOptions?: ParseOptions): Command => {
  const result = originalParse(argv, parseOptions);
  const opts = program.opts();

  // Update global options for use by all commands
  setGlobalOptions({
    quiet: opts['quiet'] || false,
    noEmoji: opts['noEmoji'] || false,
    accessible: opts['accessible'] || isAccessibleMode,
  });

  return result;
};

// Register all modular commands
registerAllCommands(program);

// Custom error handler for better suggestions on unknown commands
program.on('command:*', (operands: string[]) => {
  const unknownCmd = operands[0] ?? 'unknown';

  // Get all available commands
  const commands = program.commands.map((cmd) => cmd.name()).filter(Boolean);

  // Try to find a similar command
  const suggestion = suggestCommand(unknownCmd, commands);

  console.error(chalk.red(`❌ Unknown command: ${unknownCmd}`));

  if (suggestion) {
    console.error(chalk.yellow(`💡 Did you mean: ${suggestion}?`));
    console.error(chalk.dim(`   Run: specter ${suggestion} --help`));
  } else {
    console.error(chalk.yellow(`💡 Available commands: ${commands.join(', ')}`));
  }

  process.exit(1);
});

program.parse();
