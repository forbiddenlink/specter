/**
 * Trajectory command - project future health
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { showNextSteps } from '../../cli-utils.js'
import { outputJson, outputJsonError } from '../../json-output.js'
import { formatTrajectory, projectTrajectory } from '../../trajectory.js'
import { createSpinner } from '../types.js'

export function register(program: Command): void {
  program
    .command('trajectory')
    .description('Project future codebase health based on trends')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--weeks <n>', 'Number of weeks to project', '12')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)
      const weeks = parseInt(options.weeks, 10)

      const spinner = options.json ? null : createSpinner('Projecting trajectory...')
      spinner?.start()

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      try {
        // Note: weeks option parsed but projectTrajectory uses fixed projections
        void weeks // suppress unused variable warning
        const result = await projectTrajectory(rootDir, graph)
        spinner?.stop()

        // JSON output for CI/CD
        if (options.json) {
          outputJson('trajectory', result)
          return
        }

        const output = formatTrajectory(result)

        console.log()
        for (const line of output.split('\n')) {
          if (line.includes('TRAJECTORY') || line.includes('📈')) {
            console.log(chalk.bold.cyan(`  ${line}`))
          } else if (line.includes('improving') || line.includes('↗️')) {
            console.log(chalk.green(`  ${line}`))
          } else if (line.includes('declining') || line.includes('↘️')) {
            console.log(chalk.red(`  ${line}`))
          } else if (line.includes('stable') || line.includes('→')) {
            console.log(chalk.yellow(`  ${line}`))
          } else if (line.startsWith('─')) {
            console.log(chalk.dim(`  ${line}`))
          } else {
            console.log(chalk.white(`  ${line}`))
          }
        }
        console.log()

        const suggestions = [
          { description: 'See current health snapshot', command: 'specter health' },
          { description: 'Find what to fix next', command: 'specter next' },
          { description: 'Generate shareable report', command: 'specter report' },
        ]
        showNextSteps(suggestions)
      } catch (error) {
        spinner?.fail('Failed to project trajectory')
        if (options.json) {
          outputJsonError('trajectory', error instanceof Error ? error.message : String(error))
        }
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
      }
    })
}
