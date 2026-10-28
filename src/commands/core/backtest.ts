/**
 * Backtest command - measure how accurate co-change predictions are on this repo
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { createGitClient, isGitRepository } from '../../analyzers/git.js'
import { parseGitLog, readGitLog } from '../../analyzers/git-history.js'
import { outputJson } from '../../json-output.js'
import { runCoChangeBacktest } from '../../risk/backtest.js'
import { DEFAULT_BRIEF_THRESHOLDS } from '../../risk/brief.js'

export function register(program: Command): void {
  program
    .command('backtest')
    .description('Replay git history to measure co-change prediction precision and recall')
    .option('-d, --dir <path>', 'Project root', '.')
    .option('-n, --commits <n>', 'Most recent commits to evaluate', '300')
    .option('--history <n>', 'Commits of history to read', '3000')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
For each recent commit, every source file in it is treated as the file being
edited. Only older history is used to predict which other files change with it.

  precision  share of named partners that really changed in that commit
  recall     share of real partners that were named
  coverage   share of edits where the brief named any partner at all

The row marked * is what the Claude Code hook uses.`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)
      const git = createGitClient(rootDir)
      if (!(await isGitRepository(git))) {
        console.error(chalk.yellow('Not a git repository.'))
        process.exitCode = 1
        return
      }

      const prefix = (await git.raw(['rev-parse', '--show-prefix'])).trim()
      const commits = parseGitLog(await readGitLog(git, Number(options.history))).map((c) => ({
        ...c,
        files: c.files.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length)),
      }))
      const rows = runCoChangeBacktest(commits, { evalCommits: Number(options.commits) })

      if (options.json) {
        outputJson('backtest', { commitsRead: commits.length, rows })
        return
      }

      const queries = rows[0]?.queries ?? 0
      console.log()
      console.log(
        chalk.bold(`Co-change backtest`) +
          chalk.dim(` (${commits.length} commits read, ${queries} edit queries evaluated)`)
      )
      if (queries < 30) {
        console.log(chalk.yellow('  Too little multi-file history for reliable numbers.'))
      }
      console.log()
      console.log(chalk.dim('    shared  confidence  precision  recall  coverage'))
      const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(9)
      for (const r of rows) {
        const active =
          r.minShared === DEFAULT_BRIEF_THRESHOLDS.minShared &&
          r.minConfidence === DEFAULT_BRIEF_THRESHOLDS.minConfidence
        console.log(
          `  ${active ? '*' : ' '} ${String(`>=${r.minShared}`).padStart(5)}  ${String(`>=${pct(r.minConfidence).trim()}`).padStart(10)}  ${pct(r.precision)}  ${pct(r.recall).slice(3)}  ${pct(r.coverage)}`
        )
      }
      console.log()
    })
}
