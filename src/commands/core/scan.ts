/**
 * Scan command - builds the knowledge graph
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import gradient from 'gradient-string'
import { getComplexityEmoji } from '../../analyzers/complexity.js'
import { showNextSteps } from '../../cli-utils.js'
import { buildKnowledgeGraph, getGraphStats } from '../../graph/builder.js'
import { graphExists, isGraphStale, saveGraph } from '../../graph/persistence.js'
import { outputJson } from '../../json-output.js'
import { acquireScanLock, releaseScanLock } from '../../scan-lock.js'
import { timingBadge } from '../../ui/progress.js'
import { createSpinner } from '../types.js'

export function register(program: Command): void {
  program
    .command('scan')
    .alias('s')
    .description('Scan the codebase and build the knowledge graph')
    .option('-d, --dir <path>', 'Directory to scan', '.')
    .option('--no-git', 'Skip git history analysis')
    .option('-f, --force', 'Force rescan even if graph exists')
    .option('-q, --quiet', 'Minimal output')
    .option('-v, --verbose', 'Show detailed progress (file names being analyzed)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .addHelpText(
      'after',
      `
Examples:
  $ specter scan
  $ specter s --force
  $ specter scan --dir ./my-project
  $ specter s --quiet --json | jq '.stats'`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir)
      const projectName = path.basename(rootDir)
      const quiet = options.quiet || options.json

      // Cool intro banner
      if (!quiet) {
        const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe'])
        console.log()
        console.log(g('  ╔═══════════════════════════════════════════╗'))
        console.log(
          g('  ║') + chalk.bold.white('          👻 SPECTER AWAKENING...          ') + g('║')
        )
        console.log(g('  ╚═══════════════════════════════════════════╝'))
        console.log()
      }

      const spinner = options.json ? null : createSpinner('Initializing...').start()

      try {
        // Check if graph already exists and is fresh
        if (!options.force && (await graphExists(rootDir))) {
          const isStale = await isGraphStale(rootDir)
          if (!isStale) {
            spinner?.info('I already know this codebase. Use --force to rescan.')
            return
          }
          if (spinner) spinner.text = 'My memory is stale, relearning...'
        }

        // Acquire scan lock to prevent concurrent graph corruption
        if (!options.force) {
          const lockAcquired = await acquireScanLock(rootDir)
          if (!lockAcquired) {
            spinner?.fail('Another scan is already running. Use --force to override.')
            process.exit(1)
          }
        }

        const result = await buildKnowledgeGraph({
          rootDir,
          includeGitHistory: options.git !== false,
          onProgress: (phase, completed, total, currentFile) => {
            if (phase === 'Analyzing AST' && total > 1) {
              // Create a progress bar
              const barWidth = 25
              const progress = completed / total
              const filled = Math.round(progress * barWidth)
              const empty = barWidth - filled
              const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))
              const percent = Math.round(progress * 100)

              if (spinner) {
                if (options.verbose && currentFile) {
                  spinner.text = `Learning... ${bar} ${percent}% - ${currentFile}`
                } else {
                  spinner.text = `Learning about myself... ${bar} ${percent}% (${completed}/${total})`
                }
              }
            } else if (spinner) {
              if (phase === 'Building import graph') {
                spinner.text = '🔗 Mapping my connections...'
              } else if (phase === 'Analyzing git history') {
                spinner.text = '📜 Reading my history...'
              } else if (total > 1) {
                spinner.text = `${phase}... ${completed}/${total}`
              } else {
                spinner.text = `${phase}...`
              }
            }
          },
        })

        // Save the graph
        await saveGraph(result.graph, rootDir)

        spinner?.succeed(chalk.bold('I am awake!'))

        // Print summary with personality
        const stats = getGraphStats(result.graph)
        const healthScore = Math.max(0, 100 - stats.avgComplexity * 5)

        // JSON output for CI/CD
        if (options.json) {
          outputJson('scan', {
            projectName,
            ...stats,
            healthScore: Math.round(healthScore),
            errors: result.errors.map((e) => ({ file: e.file, error: e.error })),
          })
          return
        }

        if (!quiet) {
          const sg = gradient(['#9b59b6', '#6c5ce7', '#a29bfe'])
          console.log()
          console.log(sg('┌─────────────────────────────────────────────┐'))
          console.log(
            sg('│') + chalk.cyan(`  👻 I am ${chalk.bold(projectName)}`.padEnd(44)) + sg('│')
          )
          console.log(sg('├─────────────────────────────────────────────┤'))
          console.log(
            sg('│') +
              `  📁 Files:       ${chalk.cyan(String(stats.fileCount).padStart(6))}`.padEnd(50) +
              sg('│')
          )
          console.log(
            sg('│') +
              `  📝 Lines:       ${chalk.cyan(stats.totalLines.toLocaleString().padStart(6))}`.padEnd(
                50
              ) +
              sg('│')
          )
          console.log(
            sg('│') +
              `  🔣 Symbols:     ${chalk.cyan(String(stats.nodeCount - stats.fileCount).padStart(6))}`.padEnd(
                50
              ) +
              sg('│')
          )
          console.log(
            sg('│') +
              `  🔗 Relations:   ${chalk.cyan(String(stats.edgeCount).padStart(6))}`.padEnd(50) +
              sg('│')
          )
          console.log(sg('├─────────────────────────────────────────────┤'))

          // Complexity personality
          const mood = healthScore >= 80 ? '😊' : healthScore >= 60 ? '😐' : '😰'
          console.log(
            sg('│') +
              `  ${mood} Health:     ${getComplexityEmoji(stats.avgComplexity)} ${chalk.yellow(Math.round(healthScore))}/100`.padEnd(
                48
              ) +
              sg('│')
          )

          if (stats.maxComplexity > 15) {
            console.log(
              sg('│') + chalk.yellow(`  ⚠️  I have some complex areas...`).padEnd(48) + sg('│')
            )
          }

          console.log(sg('└─────────────────────────────────────────────┘'))

          // Languages
          console.log()
          const langs = Object.entries(stats.languages)
            .map(([lang, count]) => `${lang}: ${count}`)
            .join(', ')
          console.log(chalk.dim(`  Languages: ${langs}`))
          console.log(chalk.dim(`  Scanned in ${timingBadge(stats.scanDurationMs)}`))
        }

        // Show errors/warnings (keep these concise)
        if (result.errors.length > 0) {
          console.log()
          console.log(chalk.bold.red(`⚠️  ${result.errors.length} files I couldn't understand`))
          for (const error of result.errors.slice(0, 3)) {
            console.log(chalk.dim(`  ${error.file}`))
          }
          if (result.errors.length > 3) {
            console.log(chalk.dim(`  ... and ${result.errors.length - 3} more`))
          }
        }

        // Final message with personality
        console.log()
        console.log(chalk.bold.green('  ✨ I am ready to talk!'))
        console.log(chalk.dim('  Ask me: @specter Tell me about yourself'))
        console.log()

        // Show next steps suggestions
        if (!quiet) {
          const suggestions = [
            {
              description: 'See your codebase health report',
              command: 'specter health',
            },
            {
              description: 'Find the most problematic files',
              command: 'specter hotspots',
            },
            {
              description: 'Ask questions about your code',
              command: 'specter ask "Tell me about the architecture"',
            },
            {
              description: 'Open interactive dashboard',
              command: 'specter dashboard',
            },
          ]
          showNextSteps(suggestions)
        }
      } catch (error) {
        spinner?.fail('Failed to awaken')
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      } finally {
        if (!options.force) {
          await releaseScanLock(rootDir)
        }
      }
    })
}
