/**
 * Review command - AI-powered PR review (requires GitHub token)
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import type { PersonalityMode } from '../../personality/types.js';
import { reviewPullRequest } from '../../pr-review.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('review <pr>')
    .description('AI-powered review of a pull request (requires GITHUB_TOKEN)')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--owner <owner>', 'Repository owner (auto-detected from git)')
    .option('--repo <repo>', 'Repository name (auto-detected from git)')
    .option('--token <token>', 'GitHub token (or set GITHUB_TOKEN env var)')
    .option('-p, --personality <mode>', 'Output personality mode', 'default')
    .option('--post-comments', 'Post inline comments on the PR')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (pr, options) => {
      const rootDir = path.resolve(options.dir);
      const pullNumber = parseInt(pr, 10);

      if (Number.isNaN(pullNumber)) {
        console.log(chalk.red('Invalid PR number. Please provide a valid pull request number.'));
        return;
      }

      const token = options.token || process.env.GITHUB_TOKEN;
      if (!token) {
        console.log(chalk.red('GitHub token required. Set GITHUB_TOKEN env var or use --token.'));
        return;
      }

      // Try to auto-detect owner/repo from git remote
      let owner = options.owner;
      let repo = options.repo;

      if (!owner || !repo) {
        try {
          const { execSync } = await import('node:child_process');
          const remote = execSync('git remote get-url origin', {
            cwd: rootDir,
            encoding: 'utf-8',
          }).trim();
          const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
          if (match) {
            owner = owner || match[1];
            repo = repo || match[2];
          }
        } catch {
          // Ignore errors, user must provide manually
        }
      }

      if (!owner || !repo) {
        console.log(chalk.red('Could not detect repository. Please provide --owner and --repo.'));
        return;
      }

      const spinner = options.json ? null : createSpinner(`Reviewing PR #${pullNumber}...`);
      spinner?.start();

      const graph = await loadGraph(rootDir);

      if (!graph) {
        spinner?.fail('No graph found. Run `specter scan` first.');
        if (options.json) {
          outputJsonError('review', 'No graph found. Run `specter scan` first.');
        }
        return;
      }

      try {
        const result = await reviewPullRequest(rootDir, graph, {
          token,
          owner,
          repo,
          pullNumber,
          mode: options.personality as PersonalityMode,
          postInlineComments: options.postComments,
        });
        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson('review', result);
          return;
        }

        console.log();
        console.log(chalk.bold.magenta('  🔍 PR Review Complete'));
        console.log(chalk.dim(`  ${'─'.repeat(50)}`));
        console.log();
        console.log(chalk.white(`  Review ID: ${result.reviewId}`));
        console.log(chalk.white(`  Comments Posted: ${result.commentsPosted}`));
        console.log(chalk.white(`  Risk Level: ${result.riskLevel}`));
        console.log();
        console.log(chalk.dim(`  ${'─'.repeat(50)}`));
        console.log();
      } catch (error) {
        spinner?.fail('Review failed');
        if (options.json) {
          outputJsonError('review', error instanceof Error ? error.message : String(error));
        }
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
