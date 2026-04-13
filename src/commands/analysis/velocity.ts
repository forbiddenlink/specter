/**
 * Velocity command - Team velocity metrics
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { showNextSteps } from '../../cli-utils.js'
import { outputJson } from '../../json-output.js'
import { analyzeVelocity, formatVelocity } from '../../velocity.js'
import { createSpinner } from '../types.js'

export function register(program: Command): void {
  program
    .command('velocity')
    .description('Analyze team velocity and productivity metrics')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--since <period>', 'Time period to analyze', '30 days ago')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)

      const spinner = options.json ? null : createSpinner('Analyzing velocity...')
      spinner?.start()

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      const result = await analyzeVelocity(rootDir, graph)
      spinner?.stop()

      // JSON output for CI/CD
      if (options.json) {
        outputJson('velocity', result)
        return
      }

      const output = formatVelocity(result)

      console.log()
      for (const line of output.split('\n')) {
        if (line.includes('VELOCITY')) {
          console.log(chalk.bold.cyan(`  ${line}`))
        } else if (line.includes('↑') || line.includes('improving')) {
          console.log(chalk.green(`  ${line}`))
        } else if (line.includes('↓') || line.includes('declining')) {
          console.log(chalk.red(`  ${line}`))
        } else if (line.startsWith('─')) {
          console.log(chalk.dim(`  ${line}`))
        } else {
          console.log(chalk.white(`  ${line}`))
        }
      }
      console.log()

      const suggestions = [
        { description: 'See where complexity is concentrated', command: 'specter hotspots' },
        { description: 'Track project trajectory', command: 'specter trajectory' },
        { description: 'Generate full report', command: 'specter report' },
      ]
      showNextSteps(suggestions)
    })
}
