/**
 * Next command - What should I fix next?
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { ensureGraph } from '../../auto-scan.js'
import { exportToPng, isPngExportAvailable } from '../../export-png.js'
import { outputJson } from '../../json-output.js'
import { analyzeNext, formatNext } from '../../next.js'
import { createSpinner } from '../types.js'

export function register(program: Command): void {
  program
    .command('next')
    .alias('n')
    .description('Show the highest-impact refactoring target')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-t, --top <n>', 'Show top N suggestions', '1')
    .option('--share [file]', 'Generate shareable card (PNG)')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
Examples:
  $ specter next
  $ specter next --top 5
  $ specter n --json
  $ specter n --share`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)

      const graph = await ensureGraph(rootDir, { json: options.json })
      if (!graph) return

      const top = parseInt(options.top, 10)
      const suggestions = analyzeNext(graph, { top })

      if (options.json) {
        outputJson('next', { suggestions })
        return
      }

      const output = formatNext(suggestions)

      if (options.share) {
        const pngAvailable = await isPngExportAvailable()
        if (!pngAvailable) {
          console.log(
            chalk.red('PNG export requires the canvas package. Install with: npm install canvas')
          )
          return
        }

        const shareFile = typeof options.share === 'string' ? options.share : 'specter-next.png'
        const spinner = createSpinner('Generating shareable next steps image...')
        spinner.start()

        const outputPath = await exportToPng(output, shareFile, { socialFormat: true })

        spinner.succeed(`Image saved to ${outputPath}`)
        console.log(
          chalk.dim('  Share your next refactoring target on Twitter, LinkedIn, or your team chat!')
        )
        return
      }

      console.log(output)
    })
}
