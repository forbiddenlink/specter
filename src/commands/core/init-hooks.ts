/**
 * Init-hooks command - set up git hooks for automatic checks
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { loadGraph } from '../../graph/persistence.js'

/** Embedded post-commit health delta hook script */
const POST_COMMIT_HEALTH_SCRIPT = `
# --- Specter post-commit health delta ---
# Shows a 1-line health change after each commit.
# Non-blocking: runs silently if specter is not installed or scan fails.
(
  SPECTER=$(command -v specter 2>/dev/null)
  if [ -z "$SPECTER" ]; then
    if npx --yes specter --version >/dev/null 2>&1; then
      SPECTER="npx --yes specter"
    else
      exit 0
    fi
  fi

  HEALTH_JSON=$($SPECTER health --json 2>/dev/null)
  if [ $? -ne 0 ] || [ -z "$HEALTH_JSON" ]; then
    exit 0
  fi

  CURRENT=$(echo "$HEALTH_JSON" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { console.log(JSON.parse(d).data.healthScore); }
      catch(e) { process.exit(1); }
    });
  " 2>/dev/null)

  if [ -z "$CURRENT" ]; then
    exit 0
  fi

  PREV_FILE=".specter/last-health.txt"
  PREV=""
  if [ -f "$PREV_FILE" ]; then
    PREV=$(cat "$PREV_FILE")
  fi

  mkdir -p .specter
  echo "$CURRENT" > "$PREV_FILE"

  if [ -z "$PREV" ]; then
    echo "Specter: Health $CURRENT/100"
    exit 0
  fi

  DELTA=$((CURRENT - PREV))
  if [ "$DELTA" -gt 0 ]; then
    echo "Specter: Health $PREV -> $CURRENT (+$DELTA) ok"
  elif [ "$DELTA" -lt 0 ]; then
    echo "Specter: Health $PREV -> $CURRENT ($DELTA) warning"
  fi
) &
# --- End Specter post-commit health delta ---
`

/**
 * Install the post-commit health delta hook into .git/hooks/post-commit.
 * Creates the file if missing, appends if it exists and doesn't already contain specter.
 */
async function installPostCommitHook(
  fs: typeof import('node:fs'),
  gitDir: string
): Promise<'created' | 'appended' | 'exists'> {
  const hooksDir = path.join(gitDir, 'hooks')
  const postCommitPath = path.join(hooksDir, 'post-commit')

  if (fs.existsSync(postCommitPath)) {
    const existing = fs.readFileSync(postCommitPath, 'utf-8')
    if (existing.toLowerCase().includes('specter')) {
      return 'exists'
    }
    fs.writeFileSync(postCommitPath, `${existing}\n${POST_COMMIT_HEALTH_SCRIPT}`, { mode: 0o755 })
    return 'appended'
  }

  const hookContent = `#!/bin/sh\n${POST_COMMIT_HEALTH_SCRIPT}`
  fs.writeFileSync(postCommitPath, hookContent, { mode: 0o755 })
  return 'created'
}

export function register(program: Command): void {
  program
    .command('init-hooks')
    .description('Set up git hooks for automatic Specter checks')
    .option('--pre-commit', 'Install pre-commit framework hook')
    .option('--husky', 'Set up with Husky')
    .option('--simple', 'Install simple git hook (no framework)')
    .action(async (options) => {
      const fs = await import('node:fs')
      const rootDir = process.cwd()
      const gitDir = path.join(rootDir, '.git')

      // Check if we're in a git repo
      if (!fs.existsSync(gitDir)) {
        console.log(chalk.red('Not a git repository. Run `git init` first.'))
        process.exit(1)
      }

      // Check if graph exists
      const graph = await loadGraph(rootDir)
      if (!graph) {
        console.log(chalk.yellow('No Specter graph found. Run `specter scan` first.'))
        console.log(chalk.dim('Specter hooks require an initial scan to work.'))
        console.log()
      }

      console.log()
      console.log(chalk.bold.magenta('  Setting up Specter Git Hooks'))
      console.log(chalk.dim(`  ${'─'.repeat(40)}`))
      console.log()

      if (options.husky) {
        // Husky setup
        const huskyDir = path.join(rootDir, '.husky')

        if (!fs.existsSync(huskyDir)) {
          console.log(chalk.yellow('  Husky not installed. Installing...'))
          const { execSync } = await import('node:child_process')
          try {
            // Note: execSync is safe here - 'npx husky init' is a hardcoded command
            // with no user input. Using simple-git is not applicable for npx commands.
            execSync('npx husky init', { cwd: rootDir, stdio: 'inherit' })
          } catch {
            console.log(chalk.red('  Failed to initialize Husky. Install manually:'))
            console.log(chalk.dim('    npm install -D husky && npx husky init'))
            process.exit(1)
          }
        }

        const preCommitPath = path.join(huskyDir, 'pre-commit')
        const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Specter pre-commit check
specter precommit --exit-code
`

        fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 })
        console.log(chalk.green('  Created .husky/pre-commit'))

        // Install post-commit health delta hook
        const huskyPostCommitPath = path.join(huskyDir, 'post-commit')
        if (fs.existsSync(huskyPostCommitPath)) {
          const existingPost = fs.readFileSync(huskyPostCommitPath, 'utf-8')
          if (!existingPost.toLowerCase().includes('specter')) {
            fs.writeFileSync(huskyPostCommitPath, `${existingPost}\n${POST_COMMIT_HEALTH_SCRIPT}`, {
              mode: 0o755,
            })
            console.log(chalk.green('  Added health delta to existing .husky/post-commit'))
          } else {
            console.log(chalk.yellow('  Specter already in .husky/post-commit'))
          }
        } else {
          fs.writeFileSync(
            huskyPostCommitPath,
            `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n${POST_COMMIT_HEALTH_SCRIPT}`,
            { mode: 0o755 }
          )
          console.log(chalk.green('  Created .husky/post-commit (health delta)'))
        }

        console.log()
        console.log(chalk.bold('  Specter will now check every commit!'))
        console.log(chalk.dim('  High-risk commits will be blocked.'))
        console.log(chalk.dim('  Health score delta shown after each commit.'))
      } else if (options.simple) {
        // Simple git hook
        const hooksDir = path.join(gitDir, 'hooks')
        const preCommitPath = path.join(hooksDir, 'pre-commit')

        // Check if hook already exists
        if (fs.existsSync(preCommitPath)) {
          const existing = fs.readFileSync(preCommitPath, 'utf-8')
          if (!existing.includes('specter')) {
            // Append to existing hook
            const updatedHook =
              existing +
              `
# Specter pre-commit check
specter precommit --exit-code || exit 1
`
            fs.writeFileSync(preCommitPath, updatedHook, { mode: 0o755 })
            console.log(chalk.green('  Added Specter to existing pre-commit hook'))
          } else {
            console.log(chalk.yellow('  Specter already in pre-commit hook'))
          }
        } else {
          // Create new hook
          const hookContent = `#!/bin/sh
# Specter pre-commit check
# Blocks high-risk commits automatically

specter precommit --exit-code || exit 1
`
          fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 })
          console.log(chalk.green('  Created .git/hooks/pre-commit'))
        }

        // Install post-commit health delta hook
        const postCommitResult = await installPostCommitHook(fs, gitDir)
        if (postCommitResult === 'created') {
          console.log(chalk.green('  Created .git/hooks/post-commit (health delta)'))
        } else if (postCommitResult === 'appended') {
          console.log(chalk.green('  Added health delta to existing .git/hooks/post-commit'))
        } else {
          console.log(chalk.yellow('  Specter already in post-commit hook'))
        }

        console.log()
        console.log(chalk.bold('  Specter will now check every commit!'))
        console.log(chalk.dim('  High-risk commits will be blocked.'))
        console.log(chalk.dim('  Health score delta shown after each commit.'))
      } else if (options.preCommit) {
        // Pre-commit framework setup
        const configPath = path.join(rootDir, '.pre-commit-config.yaml')

        if (fs.existsSync(configPath)) {
          console.log(chalk.yellow('  .pre-commit-config.yaml already exists'))
          console.log(chalk.dim('  Add the following to your repos section:'))
          console.log()
          console.log(chalk.cyan('  - repo: https://github.com/your-org/specter'))
          console.log(chalk.cyan('    rev: v1.0.0'))
          console.log(chalk.cyan('    hooks:'))
          console.log(chalk.cyan('      - id: specter-precommit'))
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
`
          fs.writeFileSync(configPath, configContent)
          console.log(chalk.green('  Created .pre-commit-config.yaml'))
          console.log()
          console.log(chalk.dim('  Install hooks with:'))
          console.log(chalk.cyan('    pre-commit install'))
        }
      } else {
        // Show options
        console.log('  Choose a hook setup method:')
        console.log()
        console.log(chalk.bold('  --simple'))
        console.log(chalk.dim('    Direct .git/hooks/pre-commit'))
        console.log(chalk.dim('    No dependencies, works everywhere'))
        console.log()
        console.log(chalk.bold('  --husky'))
        console.log(chalk.dim('    Uses Husky for hook management'))
        console.log(chalk.dim('    Best for Node.js projects'))
        console.log()
        console.log(chalk.bold('  --pre-commit'))
        console.log(chalk.dim('    Uses pre-commit framework'))
        console.log(chalk.dim('    Best for Python or multi-language projects'))
        console.log()
        console.log(chalk.dim('  Example: specter init-hooks --simple'))
      }

      console.log()
    })
}
