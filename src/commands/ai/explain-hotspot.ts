/**
 * Explain hotspot command - AI-powered hotspot explanations
 */

import path from 'node:path';
import type { Command } from 'commander';
import { explainHotspot } from '../../explain-hotspot.js';

export function register(program: Command): void {
  program
    .command('explain-hotspot <file>')
    .description('Explain why a file is a hotspot using AI (powered by GitHub Copilot CLI)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --lines <range>', 'Explain specific lines (e.g., 10-50)')
    .option('-s, --suggestions', 'Include refactoring suggestions')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);
      await explainHotspot(file, rootDir, options);
    });
}
