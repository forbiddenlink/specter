/**
 * Report command - generate comprehensive markdown report
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { formatReportSummary, generateReport } from '../../report.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('report')
    .description('Generate a comprehensive codebase health report')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-o, --output <file>', 'Save report to file')
    .option('--json', 'Output in JSON format')
    .option('--quick', 'Generate executive summary only')
    .option('--no-health', 'Skip health overview section')
    .option('--no-risks', 'Skip risks section')
    .option('--no-dora', 'Skip development metrics section')
    .option('--no-hotspots', 'Skip hotspots section')
    .option('--no-bus-factor', 'Skip bus factor section')
    .option('--no-trajectory', 'Skip trajectory section')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const fs = await import('node:fs/promises');

      const spinner = createSpinner('Generating comprehensive report...');
      spinner.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner.fail('No graph found. Run `specter scan` first.');
        return;
      }

      try {
        const reportOptions = {
          includeHealth: options.health !== false,
          includeRisks: options.risks !== false,
          includeDora: options.dora !== false,
          includeHotspots: options.hotspots !== false,
          includeBusFactor: options.busFactor !== false,
          includeTrajectory: options.trajectory !== false,
          format: options.json ? ('json' as const) : ('markdown' as const),
          quick: options.quick || false,
        };

        const result = await generateReport(rootDir, graph, reportOptions);
        spinner.stop();

        // Output or save the report
        if (options.output) {
          await fs.writeFile(options.output, result.content, 'utf-8');
          result.outputPath = options.output;

          // Show summary
          const summary = formatReportSummary(result);
          for (const line of summary.split('\n')) {
            if (line.includes('+') || line.includes('|')) {
              console.log(chalk.bold.green(line));
            } else if (line.includes('KEY METRICS:')) {
              console.log(chalk.bold.cyan(line));
            } else if (line.includes('Saved to:')) {
              console.log(chalk.bold.yellow(line));
            } else {
              console.log(chalk.white(line));
            }
          }
        } else {
          // Output to stdout
          if (options.json) {
            console.log(result.content);
          } else {
            console.log(result.content);
          }
        }
      } catch (error) {
        spinner.fail('Failed to generate report');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
