/**
 * Ask command - Natural language Q&A with personality
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { askCodebase, formatAsk } from '../../ask.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import type { PersonalityMode } from '../../personality/types.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('ask <question>')
    .description('Ask questions about your codebase in natural language')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option(
      '-p, --personality <mode>',
      'Output personality: default, noir, roast, mentor, cheerleader, critic, historian, minimalist, therapist, dramatic, ghost',
      'default'
    )
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (question, options) => {
      const rootDir = path.resolve(options.dir);
      const personality = options.personality as PersonalityMode;

      const spinner = options.json ? null : createSpinner('Thinking...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('ask', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await askCodebase(question, rootDir, graph, { personality });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson(
          'ask',
          {
            question,
            answer: result.answer,
            confidence: result.confidence,
            relevantFiles: result.relevantFiles,
          },
          { personality }
        );
        return;
      }

      const output = formatAsk(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.cyan(`  ${line}`));
        } else if (line.startsWith('Q:')) {
          console.log(chalk.bold.yellow(`  ${line}`));
        } else if (line.startsWith('A:')) {
          console.log(chalk.bold.green(`  ${line}`));
        } else if (line.startsWith('📁 Relevant')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (line.startsWith('Confidence:')) {
          if (line.includes('█')) {
            console.log(chalk.green(`  ${line}`));
          } else if (line.includes('▓')) {
            console.log(chalk.yellow(`  ${line}`));
          } else {
            console.log(chalk.red(`  ${line}`));
          }
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.startsWith('   📂') || line.startsWith('   📄')) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.startsWith('   🔣') || line.startsWith('   📦')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('   📋') || line.startsWith('   •')) {
          console.log(chalk.blue(`  ${line}`));
        } else if (line.includes('*')) {
          console.log(chalk.italic.dim(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
