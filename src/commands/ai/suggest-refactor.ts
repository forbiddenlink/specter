/**
 * Suggest refactor command - AI-powered refactoring suggestions
 */

import path from 'node:path';
import type { Command } from 'commander';
import { suggestRefactoring } from '../../suggest-refactor.js';

export function register(program: Command): void {
  program
    .command('suggest-refactor <file>')
    .description('Get AI-powered refactoring suggestions (powered by GitHub Copilot CLI)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-f, --focus <area>', 'Focus on specific area (e.g., "error handling", "performance")')
    .option('-p, --priority <type>', 'Priority: complexity, coupling, testability, or all', 'all')
    .option('--format <type>', 'Output format: steps, diff, or explanation', 'steps')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);
      await suggestRefactoring(file, rootDir, options);
    });
}
