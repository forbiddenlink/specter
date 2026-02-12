#!/usr/bin/env node
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import type { Command } from 'commander';
import ora from 'ora';
import { resolve } from 'path';
import { simpleGit } from 'simple-git';

interface CommitOptions {
  apply?: boolean;
  verbose?: boolean;
  type?: string;
}

/**
 * Check if GitHub Copilot CLI is installed
 */
function checkCopilotCLI(): boolean {
  const result = spawnSync('copilot', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Get staged changes
 */
async function getStagedChanges(rootDir: string): Promise<string> {
  const git = simpleGit(rootDir);

  try {
    const diff = await git.diff(['--cached', '--stat']);
    if (!diff) {
      return '';
    }
    return diff;
  } catch {
    return '';
  }
}

/**
 * Get detailed diff of staged changes
 */
async function getStagedDiff(rootDir: string): Promise<string> {
  const git = simpleGit(rootDir);

  try {
    // Limit diff size to avoid huge prompts
    const diff = await git.diff(['--cached', '--unified=3']);
    if (!diff) {
      return '';
    }

    // Truncate if too long (keep first 3000 chars)
    return diff.length > 3000 ? diff.slice(0, 3000) + '\n... (diff truncated)' : diff;
  } catch {
    return '';
  }
}

/**
 * Generate commit message using AI
 */
export async function generateCommitMessage(
  rootDir: string,
  options: CommitOptions
): Promise<void> {
  const spinner = ora('Analyzing changes...').start();

  try {
    // Check for staged changes
    spinner.text = 'Checking for staged changes...';
    const stagedSummary = await getStagedChanges(rootDir);

    if (!stagedSummary) {
      spinner.fail('No staged changes');
      console.log(chalk.yellow('\n⚠️  No changes staged for commit.'));
      console.log(
        chalk.white('Use ') + chalk.cyan('git add') + chalk.white(' to stage changes first.\n')
      );
      process.exit(1);
    }

    // Check if Copilot CLI is available
    if (!checkCopilotCLI()) {
      spinner.fail('GitHub Copilot CLI not found');
      console.log(chalk.yellow('\n⚠️  GitHub Copilot CLI is required for AI commit messages.'));
      console.log(chalk.white('Install it with:'));
      console.log(chalk.cyan('  npm install -g @github/copilot\n'));
      process.exit(1);
    }

    // Get detailed diff
    spinner.text = 'Reading diff...';
    const diff = await getStagedDiff(rootDir);

    // Build prompt for Copilot
    const commitType = options.type || 'auto';
    const prompt = `Generate a conventional commit message for these changes.

${commitType !== 'auto' ? `Commit type should be: ${commitType}\n` : ''}
Follow the format: <type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Keep subject under 50 chars.
Add body with details if needed.

Changes summary:
${stagedSummary}

Diff:
${diff}

Generate a clear, concise commit message.`;

    spinner.text = 'Generating commit message...';

    try {
      // Use spawnSync with argument array to avoid shell injection
      const spawnResult = spawnSync('copilot', ['-p', prompt, '--allow-all-tools'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootDir,
        timeout: 60000, // 60 second timeout
      });

      if (spawnResult.error) throw spawnResult.error;
      if (spawnResult.status !== 0) throw new Error(spawnResult.stderr || 'Copilot failed');

      spinner.succeed('Commit message generated');

      console.log('\n' + chalk.bold.cyan('📝 Suggested Commit Message:\n'));
      console.log(chalk.green(spawnResult.stdout.trim()));

      if (options.verbose) {
        console.log(chalk.dim('\n📊 Changes:'));
        console.log(chalk.dim(stagedSummary));
      }

      if (options.apply) {
        console.log(
          chalk.yellow('\n⚡ Auto-apply not yet implemented. Copy message above and use:')
        );
        console.log(chalk.cyan('  git commit -m "message"\n'));
      } else {
        console.log(
          chalk.dim(
            '\n💡 Tip: Copy the message above or add --apply flag to commit automatically.\n'
          )
        );
      }
    } catch (copilotError) {
      spinner.fail('Failed to generate message');
      console.log(chalk.yellow('\n⚠️  GitHub Copilot is unavailable.'));
      console.log(chalk.white('Staged changes:'));
      console.log(stagedSummary);
    }
  } catch (error) {
    spinner.fail('Failed to analyze changes');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

/**
 * Register the ai-commit command
 */
export function registerAICommitCommand(program: Command): void {
  program
    .command('ai-commit')
    .description('Generate AI-powered commit messages (powered by GitHub Copilot CLI)')
    .option('-a, --apply', 'Automatically apply the generated commit message')
    .option('-v, --verbose', 'Show detailed diff information')
    .option('-t, --type <type>', 'Specify commit type (feat, fix, docs, etc.)')
    .action(async (options: CommitOptions) => {
      const rootDir = resolve(process.cwd());
      await generateCommitMessage(rootDir, options);
    });
}

/**
 * Example usage:
 * - specter ai-commit
 * - specter ai-commit --type feat
 * - specter ai-commit --verbose
 * - specter ai-commit --apply
 */
