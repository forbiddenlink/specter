/**
 * Fix command - Suggest actionable fixes for detected issues
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { showNextSteps } from '../../cli-utils.js';
import {
  type FixResult,
  formatFix,
  formatFixAll,
  generateFix,
  generateFixAll,
  type SuggestionSeverity,
} from '../../fix.js';
import { runInteractiveFix } from '../../fix-interactive.js';
import { loadGraph } from '../../graph/persistence.js';
import type { KnowledgeGraph } from '../../graph/types.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

const FIX_LINE_PATTERNS: Array<{
  test: (line: string) => boolean;
  style: (line: string) => string;
}> = [
  { test: (l) => l.includes('\u{1F527}'), style: (l) => chalk.bold.cyan(l) },
  { test: (l) => l.includes('\u2550'), style: (l) => chalk.magenta(l) },
  {
    test: (l) => l.includes('\u{1F534}') || l.includes('CRITICAL'),
    style: (l) => chalk.bold.red(l),
  },
  { test: (l) => l.includes('\u{1F7E1}') || l.includes('WARNING'), style: (l) => chalk.yellow(l) },
  { test: (l) => l.includes('\u{1F480}') || l.includes('INFO'), style: (l) => chalk.dim(l) },
  { test: (l) => l.includes('\u2705'), style: (l) => chalk.green(l) },
  { test: (l) => l.includes('\u2500'), style: (l) => chalk.dim(l) },
  { test: (l) => l.startsWith('  Run:'), style: (l) => chalk.cyan(l) },
  { test: (l) => l.startsWith('  Summary:'), style: (l) => chalk.bold.white(l) },
  {
    test: (l) => l.startsWith('     ') && (l.includes('Extract') || l.includes('Lines')),
    style: (l) => chalk.cyan(l),
  },
  { test: (l) => l.includes('Expected result:'), style: (l) => chalk.green(l) },
];

function colorizeOutputLine(line: string): string {
  const match = FIX_LINE_PATTERNS.find((pattern) => pattern.test(line));
  return match ? match.style(line) : chalk.white(line);
}

function printColorizedOutput(output: string): void {
  console.log();
  for (const line of output.split('\n')) {
    console.log(colorizeOutputLine(line));
  }
}

async function handleAllFilesMode(
  rootDir: string,
  graph: KnowledgeGraph,
  severity: SuggestionSeverity,
  options: { json?: boolean }
) {
  const results = await generateFixAll(rootDir, graph, { severity });

  if (options.json) {
    outputJson('fix', {
      mode: 'all',
      results,
      totalFiles: results.length,
      totalSuggestions: results.reduce((sum, r) => sum + r.summary.total, 0),
    });
    return;
  }

  printColorizedOutput(formatFixAll(results));
}

async function handleSingleFileMode(
  file: string,
  rootDir: string,
  graph: KnowledgeGraph,
  severity: SuggestionSeverity,
  options: { json?: boolean; interactive?: boolean; autoApply?: boolean }
): Promise<FixResult | null> {
  const filePath = path.relative(rootDir, path.resolve(rootDir, file));

  const fileNode = Object.values(graph.nodes).find(
    (n) => n.type === 'file' && (n.filePath === filePath || n.filePath === file)
  );

  if (!fileNode) {
    if (options.json) {
      outputJsonError('fix', `File not found in knowledge graph: ${file}`);
    } else {
      console.log(chalk.red(`  ✗ File not found in knowledge graph: ${file}`));
      console.log(chalk.dim('  Make sure the file was scanned. Run `specter scan` to update.'));
    }
    return null;
  }

  const result = await generateFix(fileNode.filePath, rootDir, graph, { severity });

  if (options.interactive) {
    const session = await runInteractiveFix(result, {
      autoApply: options.autoApply,
      skipInfo: severity !== 'info',
    });

    if (session.applied > 0) {
      console.log(
        chalk.cyan('  🔄 Fixes applied! Run `specter scan` to update the knowledge graph.')
      );
      console.log();
    }
    return null;
  }

  if (options.json) {
    outputJson('fix', {
      mode: 'single',
      file: fileNode.filePath,
      result,
    });
    return null;
  }

  return result;
}

export function register(program: Command): void {
  program
    .command('fix [file]')
    .description('Suggest actionable fixes for detected issues in a file or all files')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--all', 'Analyze all files with issues')
    .option('-i, --interactive', 'Interactive mode - apply fixes step-by-step')
    .option('--auto-apply', 'Auto-apply safe fixes in interactive mode')
    .option('-s, --severity <level>', 'Minimum severity: critical, warning, info', 'info')
    .option('--json', 'Output as JSON for CI/CD integration')
    .addHelpText(
      'after',
      `
Examples:
  $ specter fix src/api.ts
  $ specter fix --all
  $ specter fix --severity critical
  $ specter fix src/utils.ts --interactive --auto-apply
  
Use interactive mode to safely apply suggested refactorings step-by-step.
`
    )
    .action(async (file, options) => {
      const rootDir = path.resolve(options.dir);
      const spinner = options.json ? null : createSpinner('Analyzing for fix suggestions...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('fix', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      const severity = options.severity as SuggestionSeverity;

      if (options.all || !file) {
        spinner?.stop();
        await handleAllFilesMode(rootDir, graph, severity, options);

        // Show next steps suggestions
        if (!options.json) {
          const suggestions = [
            {
              description: 'Get detailed health metrics',
              command: 'specter health',
            },
            {
              description: 'Find who knows these files best',
              command: 'specter who',
            },
            {
              description: 'Analyze coupling between files',
              command: 'specter coupling',
            },
          ];
          showNextSteps(suggestions);
        }
      } else {
        spinner?.stop();
        const result = await handleSingleFileMode(file, rootDir, graph, severity, options);
        if (result) {
          printColorizedOutput(formatFix(result));

          // Show next steps suggestions
          if (!options.json) {
            const suggestions = [
              {
                description: 'Apply fixes interactively',
                command: `specter fix ${file} --interactive`,
              },
              {
                description: 'See all files with issues',
                command: 'specter fix --all',
              },
              {
                description: 'View file change history',
                command: `specter who ${file}`,
              },
            ];
            showNextSteps(suggestions);
          }
        }
      }
    });
}
