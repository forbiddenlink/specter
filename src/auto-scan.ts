/**
 * Auto-Scan Utility
 *
 * Provides ensureGraph() to auto-scan on first use and warn about stale graphs.
 * Replaces the manual "No graph found. Run specter scan first." pattern.
 */

import chalk from 'chalk'
import ora from 'ora'
import { buildKnowledgeGraph } from './graph/builder.js'
import { graphExists, loadGraph, loadMetadata, saveGraph } from './graph/persistence.js'
import type { KnowledgeGraph } from './graph/types.js'
import { acquireScanLock, releaseScanLock } from './scan-lock.js'

/**
 * Format a duration in milliseconds to a human-readable age string.
 * e.g. "2 hours old", "3 days old", "1 week old"
 */
function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (weeks > 0) return `${weeks} week${weeks === 1 ? '' : 's'} old`
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} old`
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} old`
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} old`
  return 'just now'
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Ensure a knowledge graph is available, auto-scanning if needed.
 *
 * 1. If no graph exists, runs a scan automatically.
 * 2. If the graph is older than 24 hours, prints a non-blocking stale warning.
 * 3. Returns the loaded graph or null on failure.
 */
export async function ensureGraph(
  rootDir: string,
  options?: { json?: boolean; quiet?: boolean }
): Promise<KnowledgeGraph | null> {
  const json = options?.json ?? false
  const quiet = options?.quiet ?? false

  const exists = await graphExists(rootDir)

  if (!exists) {
    // Auto-scan: no graph found
    const lockAcquired = await acquireScanLock(rootDir)
    if (!lockAcquired) {
      // Another scan is running — try to load whatever graph exists
      if (!json && !quiet) {
        console.error(chalk.dim('\u26A0 Another scan is in progress. Waiting...'))
      }
      return null
    }

    if (!json && !quiet) {
      const spinner = ora('No analysis found. Scanning your codebase...').start()

      try {
        const result = await buildKnowledgeGraph({
          rootDir,
          includeGitHistory: true,
          onProgress: (phase, completed, total) => {
            if (phase === 'Analyzing AST' && total > 1) {
              const barWidth = 25
              const progress = completed / total
              const filled = Math.round(progress * barWidth)
              const empty = barWidth - filled
              const bar = chalk.green('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(empty))
              const percent = Math.round(progress * 100)
              spinner.text = `Scanning... ${bar} ${percent}% (${completed}/${total})`
            } else if (phase === 'Building import graph') {
              spinner.text = 'Mapping connections...'
            } else if (phase === 'Analyzing git history') {
              spinner.text = 'Reading git history...'
            } else if (total > 1) {
              spinner.text = `${phase}... ${completed}/${total}`
            } else {
              spinner.text = `${phase}...`
            }
          },
        })

        const graph = result.graph

        // Validate graph is not empty
        if (!graph || Object.keys(graph.nodes).length === 0) {
          spinner.fail(
            'Scan produced an empty graph. Check that the directory contains source files.'
          )
          return null
        }

        await saveGraph(graph, rootDir)
        spinner.succeed(chalk.dim('Codebase scanned.'))

        return graph
      } catch (error) {
        spinner.fail('Auto-scan failed.')
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        return null
      } finally {
        await releaseScanLock(rootDir)
      }
    } else {
      // JSON or quiet mode: scan silently
      try {
        const result = await buildKnowledgeGraph({
          rootDir,
          includeGitHistory: true,
        })

        const graph = result.graph

        if (!graph || Object.keys(graph.nodes).length === 0) {
          return null
        }

        await saveGraph(graph, rootDir)
        return graph
      } catch {
        return null
      } finally {
        await releaseScanLock(rootDir)
      }
    }
  }

  // Graph exists -- load it
  const graph = await loadGraph(rootDir)

  if (!graph) {
    return null
  }

  // Check staleness
  const metadata = await loadMetadata(rootDir)
  if (metadata?.scannedAt) {
    const scannedAt = new Date(metadata.scannedAt).getTime()
    const age = Date.now() - scannedAt

    if (age > STALE_THRESHOLD_MS) {
      const ageStr = formatAge(age)
      const warning = chalk.dim(`\u26A0 Analysis is ${ageStr}. Run \`specter scan\` to refresh.`)

      if (json) {
        // In JSON mode, write warning to stderr so it doesn't pollute JSON output
        process.stderr.write(`${warning}\n`)
      } else if (!quiet) {
        console.error(warning)
      }
    }
  }

  return graph
}
