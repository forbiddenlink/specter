/**
 * Hotspots command - Complexity x Churn analysis
 */

import path from 'node:path';
import type { Command } from 'commander';
import { showNextSteps } from '../../cli-utils.js';
import { loadGraph } from '../../graph/persistence.js';
import { analyzeHotspots, formatHotspots } from '../../hotspots.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { colorizeOutput, printFormatted } from '../../tools/output-formatter.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('hotspots')
    .alias('hot')
    .description('Find complexity x churn hotspots - highest priority for refactoring')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-l, --limit <n>', 'Number of hotspots to show', '20')
    .option('-s, --since <period>', 'Time period for churn analysis', '3 months ago')
    .option('--json', 'Output as JSON for CI/CD integration')
    .addHelpText(
      'after',
      `
Examples:
  $ specter hotspots
  $ specter hot --limit 10
  $ specter hotspots --since "1 year ago"
  $ specter hot -l 5 --json`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const spinner = options.json
        ? null
        : createSpinner('Analyzing complexity x churn hotspots...');
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('hotspots', 'No graph found. Run `specter scan` first.');
        }
        spinner?.fail('No graph found. Run `specter scan` first.');
        return;
      }

      const result = await analyzeHotspots(rootDir, graph, {
        since: options.since,
        top: parseInt(options.limit, 10),
      });
      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('hotspots', {
          hotspots: result.hotspots,
          summary: result.summary,
          quadrants: result.quadrants,
          timeRange: result.timeRange,
        });
        return;
      }

      const output = formatHotspots(result);
      const lines = colorizeOutput(output.split('\n'));
      printFormatted(lines);

      // Show next steps suggestions
      if (!options.json) {
        const topHotspot =
          result.quadrants.highComplexityHighChurn[0] || result.quadrants.highComplexityLowChurn[0];
        const suggestions = [
          {
            description: 'Get AI-powered refactoring suggestions',
            command: 'specter fix',
          },
          {
            description: 'See who knows these files best',
            command: 'specter who',
          },
          {
            description: 'Analyze dependencies between hotspots',
            command: 'specter coupling',
          },
        ];

        if (topHotspot) {
          suggestions.unshift({
            description: `Ask AI about ${topHotspot.file}`,
            command: `specter ask "Why is ${topHotspot.file} so complex?"`,
          });
        }

        showNextSteps(suggestions);
      }
    });
}
