/**
 * AI commit command - Generate smart commit messages using AI
 */

import path from 'node:path';
import type { Command } from 'commander';
import { generateCommitMessage } from '../../ai-commit.js';

export function register(program: Command): void {
  program
    .command('ai-commit')
    .description('Generate AI-powered commit messages (powered by GitHub Copilot CLI)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-a, --apply', 'Automatically apply the generated commit message')
    .option('-v, --verbose', 'Show detailed diff information')
    .option('-t, --type <type>', 'Specify commit type (feat, fix, docs, etc.)')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      await generateCommitMessage(rootDir, options);
    });
}
