/**
 * Ask command - Natural language Q&A with personality
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { askCodebase, formatAsk } from '../../ask.js';
import { showNextSteps } from '../../cli-utils.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import type { PersonalityMode } from '../../personality/types.js';
import { createSpinner } from '../types.js';

const ASK_LINE_PATTERNS: Array<{
  test: (line: string) => boolean;
  style: (line: string) => string;
}> = [
  {
    test: (l) => l.includes('┏') || l.includes('┗') || l.includes('┃'),
    style: (l) => chalk.bold.cyan(`  ${l}`),
  },
  { test: (l) => l.startsWith('Q:'), style: (l) => chalk.bold.yellow(`  ${l}`) },
  { test: (l) => l.startsWith('A:'), style: (l) => chalk.bold.green(`  ${l}`) },
  { test: (l) => l.startsWith('📁 Relevant'), style: (l) => chalk.bold.magenta(`  ${l}`) },
  {
    test: (l) => l.startsWith('Confidence:') && l.includes('█'),
    style: (l) => chalk.green(`  ${l}`),
  },
  {
    test: (l) => l.startsWith('Confidence:') && l.includes('▓'),
    style: (l) => chalk.yellow(`  ${l}`),
  },
  { test: (l) => l.startsWith('Confidence:'), style: (l) => chalk.red(`  ${l}`) },
  { test: (l) => l.startsWith('─') || l.startsWith('━'), style: (l) => chalk.dim(`  ${l}`) },
  {
    test: (l) => l.startsWith('   📂') || l.startsWith('   📄'),
    style: (l) => chalk.cyan(`  ${l}`),
  },
  {
    test: (l) => l.startsWith('   🔣') || l.startsWith('   📦'),
    style: (l) => chalk.green(`  ${l}`),
  },
  {
    test: (l) => l.startsWith('   📋') || l.startsWith('   •'),
    style: (l) => chalk.blue(`  ${l}`),
  },
  { test: (l) => l.includes('*'), style: (l) => chalk.italic.dim(`  ${l}`) },
];

function colorizeAskOutputLine(line: string): string {
  const match = ASK_LINE_PATTERNS.find((pattern) => pattern.test(line));
  return match ? match.style(line) : chalk.white(`  ${line}`);
}

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
    .addHelpText(
      'after',
      `
Examples:
  $ specter ask "What does this codebase do?"
  $ specter ask "Where is authentication handled?"
  $ specter ask "Why is src/api.ts so complex?" --personality mentor
  $ specter ask "Tell me about the architecture" --personality minimalist`
    )
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
        console.log(colorizeAskOutputLine(line));
      }
      console.log();

      // Show next steps suggestions
      if (!options.json) {
        const suggestions = [
          {
            description: 'Get a full health report',
            command: 'specter health',
          },
          {
            description: 'Find complexity hotspots',
            command: 'specter hotspots',
          },
          {
            description: 'Get refactoring suggestions',
            command: 'specter fix',
          },
        ];

        // Add context-specific suggestion based on question
        const lowerQ = question.toLowerCase();
        if (lowerQ.includes('complex') || lowerQ.includes('refactor')) {
          suggestions.unshift({
            description: 'See who knows these files best',
            command: 'specter who',
          });
        } else if (lowerQ.includes('test') || lowerQ.includes('coverage')) {
          suggestions.unshift({
            description: 'Analyze test impact',
            command: 'specter predict',
          });
        }

        showNextSteps(suggestions);
      }
    });
}
