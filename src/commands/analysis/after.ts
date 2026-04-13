/**
 * After command - compare current health to baseline and show refactoring impact
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { showNextSteps } from '../../cli-utils.js'
import { outputJson } from '../../json-output.js'
import {
  compareToBaseline,
  deleteBaseline,
  formatDelta,
  loadBaseline,
} from '../../refactor-tracker.js'

export function register(program: Command): void {
  program
    .command('after')
    .description('Compare current health to baseline — measure refactoring impact')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--keep', 'Keep the baseline after comparison (default: deletes it)')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  $ specter after
  $ specter after --keep
  $ specter after --json`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)

      const baseline = await loadBaseline(rootDir)
      if (!baseline) {
        console.log(chalk.yellow('  No baseline found. Run `specter before` first.'))
        return
      }

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      const delta = compareToBaseline(baseline, graph)

      if (options.json) {
        outputJson('after', delta)
        if (!options.keep) await deleteBaseline(rootDir)
        return
      }

      console.log(formatDelta(delta))

      // Clean up baseline unless --keep
      if (!options.keep) {
        await deleteBaseline(rootDir)
        console.log(
          chalk.dim('  Baseline cleared. Run `specter before` to start a new comparison.')
        )
        console.log()
      }

      showNextSteps([
        { description: 'See full health report', command: 'specter health' },
        { description: 'Find remaining hotspots', command: 'specter next' },
        { description: 'Generate shareable report', command: 'specter report' },
      ])
    })
}
