/**
 * Cycles command - Detect circular dependencies
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { showNextSteps } from '../../cli-utils.js'
import { detectCycles, formatCycles } from '../../cycles.js'
import { outputJson } from '../../json-output.js'
import { createSpinner } from '../types.js'

export function register(program: Command): void {
  program
    .command('cycles')
    .description('Detect circular dependencies in the codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--max <n>', 'Maximum cycles to show', '20')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)
      const maxCycles = parseInt(options.max, 10)

      const spinner = options.json ? null : createSpinner('Detecting circular dependencies...')
      spinner?.start()

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      const result = detectCycles(graph)
      spinner?.stop()

      // JSON output for CI/CD
      if (options.json) {
        outputJson('cycles', {
          cycles: result.cycles.slice(0, maxCycles),
          totalCycles: result.totalCycles,
          affectedFiles: result.affectedFiles,
          suggestions: result.suggestions,
        })
        return
      }

      const output = formatCycles(result)

      console.log()
      for (const line of output.split('\n')) {
        if (line.includes('CIRCULAR DEPENDENCIES')) {
          console.log(chalk.bold.red(`  ${line}`))
        } else if (line.includes('No circular dependencies')) {
          console.log(chalk.bold.green(`  ${line}`))
        } else if (line.startsWith('CYCLE')) {
          console.log(chalk.bold.yellow(`  ${line}`))
        } else if (line.includes('→')) {
          console.log(chalk.cyan(`  ${line}`))
        } else if (line.startsWith('SUGGESTIONS') || line.startsWith('RECOMMENDATIONS')) {
          console.log(chalk.bold.white(`  ${line}`))
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`))
        } else {
          console.log(chalk.white(`  ${line}`))
        }
      }
      console.log()

      const suggestions = [
        { description: 'Visualize the dependency graph', command: 'specter diagram' },
        { description: 'Find coupling between modules', command: 'specter coupling' },
        { description: 'See overall health impact', command: 'specter health' },
      ]
      showNextSteps(suggestions)
    })
}
