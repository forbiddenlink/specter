/**
 * Before command - save a health baseline before refactoring
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { outputJson } from '../../json-output.js'
import { saveBaseline } from '../../refactor-tracker.js'

export function register(program: Command): void {
  program
    .command('before')
    .description('Save a health baseline before refactoring')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  $ specter before
  $ specter before --dir ./my-project
  $ specter before --json`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      const baseline = await saveBaseline(rootDir, graph)

      if (options.json) {
        outputJson('before', baseline)
        return
      }

      console.log()
      console.log(chalk.bold('  Baseline saved.'))
      console.log(
        chalk.dim(
          `  Health: ${baseline.healthScore}/100 | Avg complexity: ${baseline.avgComplexity.toFixed(1)} | Hotspots: ${baseline.hotspotCount}`
        )
      )
      console.log()
      console.log(chalk.dim('  Now refactor, then run `specter after` to measure impact.'))
      console.log()
    })
}
