/**
 * Init-hooks command - set up git hooks for automatic checks
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';

export function register(program: Command): void {
  program
    .command('init-hooks')
    .description('Set up git hooks for automatic Specter checks')
    .option('--pre-commit', 'Install pre-commit framework hook')
    .option('--husky', 'Set up with Husky')
    .option('--simple', 'Install simple git hook (no framework)')
    .action(async (options) => {
      const fs = await import('node:fs');
      const rootDir = process.cwd();
      const gitDir = path.join(rootDir, '.git');

      // Check if we're in a git repo
      if (!fs.existsSync(gitDir)) {
        console.log(chalk.red('Not a git repository. Run `git init` first.'));
        process.exit(1);
      }

      // Check if graph exists
      const graph = await loadGraph(rootDir);
      if (!graph) {
        console.log(chalk.yellow('No Specter graph found. Run `specter scan` first.'));
        console.log(chalk.dim('Specter hooks require an initial scan to work.'));
        console.log();
      }

      console.log();
      console.log(chalk.bold.magenta('  Setting up Specter Git Hooks'));
      console.log(chalk.dim(`  ${'─'.repeat(40)}`));
      console.log();

      if (options.husky) {
        // Husky setup
        const huskyDir = path.join(rootDir, '.husky');

        if (!fs.existsSync(huskyDir)) {
          console.log(chalk.yellow('  Husky not installed. Installing...'));
          const { execSync } = await import('node:child_process');
          try {
            // Note: execSync is safe here - 'npx husky init' is a hardcoded command
            // with no user input. Using simple-git is not applicable for npx commands.
            execSync('npx husky init', { cwd: rootDir, stdio: 'inherit' });
          } catch {
            console.log(chalk.red('  Failed to initialize Husky. Install manually:'));
            console.log(chalk.dim('    npm install -D husky && npx husky init'));
            process.exit(1);
          }
        }

        const preCommitPath = path.join(huskyDir, 'pre-commit');
        const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Specter pre-commit check
specter precommit --exit-code
`;

        fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
        console.log(chalk.green('  Created .husky/pre-commit'));
        console.log();
        console.log(chalk.bold('  Specter will now check every commit!'));
        console.log(chalk.dim('  High-risk commits will be blocked.'));
      } else if (options.simple) {
        // Simple git hook
        const hooksDir = path.join(gitDir, 'hooks');
        const preCommitPath = path.join(hooksDir, 'pre-commit');

        // Check if hook already exists
        if (fs.existsSync(preCommitPath)) {
          const existing = fs.readFileSync(preCommitPath, 'utf-8');
          if (!existing.includes('specter')) {
            // Append to existing hook
            const updatedHook =
              existing +
              `
# Specter pre-commit check
specter precommit --exit-code || exit 1
`;
            fs.writeFileSync(preCommitPath, updatedHook, { mode: 0o755 });
            console.log(chalk.green('  Added Specter to existing pre-commit hook'));
          } else {
            console.log(chalk.yellow('  Specter already in pre-commit hook'));
          }
        } else {
          // Create new hook
          const hookContent = `#!/bin/sh
# Specter pre-commit check
# Blocks high-risk commits automatically

specter precommit --exit-code || exit 1
`;
          fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
          console.log(chalk.green('  Created .git/hooks/pre-commit'));
        }

        console.log();
        console.log(chalk.bold('  Specter will now check every commit!'));
        console.log(chalk.dim('  High-risk commits will be blocked.'));
      } else if (options.preCommit) {
        // Pre-commit framework setup
        const configPath = path.join(rootDir, '.pre-commit-config.yaml');

        if (fs.existsSync(configPath)) {
          console.log(chalk.yellow('  .pre-commit-config.yaml already exists'));
          console.log(chalk.dim('  Add the following to your repos section:'));
          console.log();
          console.log(chalk.cyan('  - repo: https://github.com/your-org/specter'));
          console.log(chalk.cyan('    rev: v1.0.0'));
          console.log(chalk.cyan('    hooks:'));
          console.log(chalk.cyan('      - id: specter-precommit'));
        } else {
          const configContent = `# Pre-commit hooks configuration
# See https://pre-commit.com for more information

repos:
  - repo: https://github.com/your-org/specter
    rev: v1.0.0
    hooks:
      - id: specter-precommit
      # Optionally add more hooks:
      # - id: specter-health
      # - id: specter-cycles
`;
          fs.writeFileSync(configPath, configContent);
          console.log(chalk.green('  Created .pre-commit-config.yaml'));
          console.log();
          console.log(chalk.dim('  Install hooks with:'));
          console.log(chalk.cyan('    pre-commit install'));
        }
      } else {
        // Show options
        console.log('  Choose a hook setup method:');
        console.log();
        console.log(chalk.bold('  --simple'));
        console.log(chalk.dim('    Direct .git/hooks/pre-commit'));
        console.log(chalk.dim('    No dependencies, works everywhere'));
        console.log();
        console.log(chalk.bold('  --husky'));
        console.log(chalk.dim('    Uses Husky for hook management'));
        console.log(chalk.dim('    Best for Node.js projects'));
        console.log();
        console.log(chalk.bold('  --pre-commit'));
        console.log(chalk.dim('    Uses pre-commit framework'));
        console.log(chalk.dim('    Best for Python or multi-language projects'));
        console.log();
        console.log(chalk.dim('  Example: specter init-hooks --simple'));
      }

      console.log();
    });
}
