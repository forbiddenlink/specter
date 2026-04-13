/**
 * First-Run Guided Experience
 *
 * Shows a curated summary and suggested commands when Specter is run
 * for the first time on a codebase (no .specter/ directory).
 */

import chalk from 'chalk'
import gradient from 'gradient-string'
import { generateComplexityReport, getComplexityEmoji } from './analyzers/complexity.js'
import { ensureGraph } from './auto-scan.js'
import { getGraphStats } from './graph/builder.js'
import { graphExists } from './graph/persistence.js'
import type { KnowledgeGraph } from './graph/types.js'

/**
 * Check if this is a first-run scenario (no existing graph).
 */
export async function isFirstRun(rootDir: string): Promise<boolean> {
  return !(await graphExists(rootDir))
}

/**
 * Run the first-time guided experience.
 * Returns true if the first-run flow was triggered, false otherwise.
 */
export async function runFirstTimeExperience(rootDir: string): Promise<boolean> {
  const firstRun = await isFirstRun(rootDir)
  if (!firstRun) return false

  console.log()
  console.log(chalk.bold.white('  First time? Let me learn about your codebase...'))
  console.log()

  const graph = await ensureGraph(rootDir)
  if (!graph) {
    console.log(chalk.red('  Could not scan codebase.'))
    return true
  }

  printCuratedSummary(graph)
  return true
}

/**
 * Print a curated summary box after first scan.
 */
function printCuratedSummary(graph: KnowledgeGraph): void {
  const stats = getGraphStats(graph)
  const report = generateComplexityReport(graph)
  const healthScore = Math.max(0, Math.round(100 - report.averageComplexity * 5))

  const scoreEmoji =
    healthScore >= 80 ? '\uD83D\uDFE2' : healthScore >= 60 ? '\uD83D\uDFE1' : '\uD83D\uDD34'
  const topHotspot = report.hotspots[0]

  const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe'])
  const W = 50

  console.log()
  console.log(g(`  \u2554${'═'.repeat(W)}\u2557`))
  console.log(
    g('  \u2551') +
      chalk.bold.white('  Your Codebase at a Glance') +
      ' '.repeat(W - 27) +
      g('\u2551')
  )
  console.log(g(`  \u2560${'═'.repeat(W)}\u2563`))

  const lines: Array<{ label: string; value: string }> = [
    { label: `${scoreEmoji} Health Score`, value: `${healthScore}/100` },
    { label: '\uD83D\uDCC1 Files', value: String(stats.fileCount) },
    { label: '\uD83D\uDD25 Hotspots', value: String(report.hotspots.length) },
    {
      label: '\uD83D\uDCB0 Tech Debt',
      value:
        report.hotspots.length > 10
          ? 'Significant'
          : report.hotspots.length > 3
            ? 'Moderate'
            : 'Low',
    },
  ]

  for (const line of lines) {
    const content = `  ${line.label}: ${chalk.cyan(line.value)}`
    const visLen = `  ${line.label}: ${line.value}`.length
    const pad = Math.max(0, W - visLen)
    console.log(g('  \u2551') + content + ' '.repeat(pad) + g('\u2551'))
  }

  if (topHotspot) {
    console.log(g(`  \u2560${'═'.repeat(W)}\u2563`))
    const hotspotLabel = `  ${getComplexityEmoji(topHotspot.complexity)} Top hotspot:`
    const hotspotFile =
      topHotspot.filePath.length > 30 ? `...${topHotspot.filePath.slice(-27)}` : topHotspot.filePath
    console.log(
      g('  \u2551') +
        chalk.dim(hotspotLabel) +
        ' '.repeat(Math.max(0, W - hotspotLabel.length)) +
        g('\u2551')
    )
    const fileLine = `     ${hotspotFile} (C:${topHotspot.complexity})`
    console.log(
      g('  \u2551') +
        chalk.yellow(fileLine) +
        ' '.repeat(Math.max(0, W - fileLine.length)) +
        g('\u2551')
    )
  }

  console.log(g(`  \u255A${'═'.repeat(W)}\u255D`))

  // Suggested next commands
  console.log()
  console.log(chalk.bold.white('  Try next:'))
  console.log(`${chalk.dim('    specter health')}      ${chalk.dim('Full health report')}`)
  console.log(`${chalk.dim('    specter hotspots')}    ${chalk.dim('Find problem areas')}`)
  console.log(`${chalk.dim('    specter ask "..."')}   ${chalk.dim('Ask about your code')}`)
  console.log()
}
