/**
 * AI Ask command - AI-powered codebase Q&A using GitHub Copilot CLI
 */

import path from 'node:path';
import type { Command } from 'commander';
import { askQuestion } from '../../ai-ask.js';

export function register(program: Command): void {
  program
    .command('ai-ask <question>')
    .description('Ask questions about your codebase using AI (powered by GitHub Copilot CLI)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option(
      '-c, --context <type>',
      'Focus on specific context (hotspots, complexity, dependencies)'
    )
    .option('-v, --verbose', 'Show detailed context used for the answer')
    .action(async (question: string, options) => {
      const rootDir = path.resolve(options.dir);
      await askQuestion(question, rootDir, options);
    });
}
