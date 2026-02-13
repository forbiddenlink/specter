/**
 * Fame command - Compare your codebase to famous open-source projects
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { FAMOUS_REPOS, findClosestMatch, formatFamousComparison } from '../../famous-repos.js';
import { getGraphStats } from '../../graph/builder.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('fame')
    .description('Compare your codebase to famous open-source projects')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const projectName = path.basename(rootDir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('fame', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json
        ? null
        : createSpinner('Analyzing your codebase against the greats...');
      spinner?.start();

      const stats = getGraphStats(graph);
      const healthScore = Math.max(0, 100 - stats.avgComplexity * 5);

      const matchedRepo = findClosestMatch(healthScore, stats.avgComplexity, stats.fileCount);

      spinner?.stop();

      // JSON output for CI/CD
      if (options.json) {
        outputJson('fame', {
          projectName,
          healthScore: Math.round(healthScore),
          avgComplexity: stats.avgComplexity,
          fileCount: stats.fileCount,
          totalLines: stats.totalLines,
          closestMatch: matchedRepo.name,
          closestMatchUrl: matchedRepo.url,
          closestMatchHealthScore: matchedRepo.healthScore,
          rank: Object.values(FAMOUS_REPOS).filter((r) => r.healthScore > healthScore).length + 1,
          totalCompared: Object.keys(FAMOUS_REPOS).length + 1,
          famousRepos: FAMOUS_REPOS,
        });
        return;
      }

      const userStats = {
        fileCount: stats.fileCount,
        totalLines: stats.totalLines,
        avgComplexity: stats.avgComplexity,
        healthScore: Math.round(healthScore),
        projectName,
      };

      const output = formatFamousComparison(userStats, matchedRepo, FAMOUS_REPOS);
      console.log(output);
    });
}
