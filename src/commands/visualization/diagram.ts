/**
 * Diagram command - generate architecture diagrams
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  type DiagramFormat,
  formatDiagramOutput,
  generateDiagram,
  saveDiagram,
} from '../../diagram.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('diagram')
    .description('Generate architecture diagram from the knowledge graph')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-f, --format <format>', 'Output format: mermaid, d2, or ascii', 'mermaid')
    .option('--depth <n>', 'Directory depth to show', '2')
    .option('--focus <path>', 'Focus on specific file or directory')
    .option('--complexity', 'Show complexity indicators')
    .option('--health', 'Show health indicators')
    .option('-o, --output <file>', 'Save diagram to file')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json ? null : createSpinner('Generating architecture diagram...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('diagram', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const format = options.format as DiagramFormat;
      if (!['mermaid', 'd2', 'ascii'].includes(format)) {
        spinner?.fail(`Invalid format: ${format}. Use mermaid, d2, or ascii.`);
        if (options.json) {
          outputJsonError('diagram', `Invalid format: ${format}. Use mermaid, d2, or ascii.`);
        }
        return;
      }

      let result = generateDiagram(graph, {
        format,
        depth: parseInt(options.depth, 10),
        focus: options.focus,
        showComplexity: options.complexity,
        showHealth: options.health,
      });

      // Save to file if requested
      if (options.output) {
        const outputPath = path.resolve(options.output);
        result = await saveDiagram(result, outputPath);
        spinner?.succeed(`Diagram saved to ${outputPath}`);
      } else {
        spinner?.stop();
      }

      // JSON output for CI/CD
      if (options.json) {
        outputJson('diagram', result);
        return;
      }

      const output = formatDiagramOutput(result);

      console.log();
      for (const line of output.split('\n')) {
        if (line.includes('┏') || line.includes('┗') || line.includes('┃')) {
          console.log(chalk.bold.magenta(`  ${line}`));
        } else if (
          line.startsWith('Format:') ||
          line.startsWith('Nodes:') ||
          line.startsWith('Edges:')
        ) {
          console.log(chalk.cyan(`  ${line}`));
        } else if (line.startsWith('Saved:')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.startsWith('graph TD') || line.startsWith('subgraph')) {
          console.log(chalk.yellow(`  ${line}`));
        } else if (line.includes('-->')) {
          console.log(chalk.blue(`  ${line}`));
        } else if (line.startsWith('─') || line.startsWith('━')) {
          console.log(chalk.dim(`  ${line}`));
        } else if (line.includes('Paste into') || line.includes('Render with')) {
          console.log(chalk.dim.italic(`  ${line}`));
        } else if (
          line.includes('┌') ||
          line.includes('└') ||
          line.includes('│') ||
          line.includes('├')
        ) {
          console.log(chalk.white(`  ${line}`));
        } else {
          console.log(chalk.white(`  ${line}`));
        }
      }
      console.log();
    });
}
