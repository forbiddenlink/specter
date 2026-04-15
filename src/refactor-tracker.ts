/**
 * Refactoring ROI Tracker
 *
 * Snapshot-based before/after comparison for measuring refactoring impact.
 * Saves a health baseline to .specter/refactor-baseline.json, then compares
 * current metrics against it to show deltas and estimated savings.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import { generateComplexityReport } from './analyzers/complexity.js'
import type { KnowledgeGraph } from './graph/types.js'

const BASELINE_FILE = 'refactor-baseline.json'

interface Baseline {
  savedAt: string
  healthScore: number
  avgComplexity: number
  hotspotCount: number
  totalComplexity: number
  fileComplexities: Record<string, number> // filePath -> max complexity
}

export async function saveBaseline(rootDir: string, graph: KnowledgeGraph): Promise<Baseline> {
  const report = generateComplexityReport(graph)
  const healthScore = Math.max(0, 100 - report.averageComplexity * 5)

  // Build per-file complexity map (max complexity per file, excluding file nodes)
  const fileComplexities: Record<string, number> = {}
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') continue
    const current = fileComplexities[node.filePath] ?? 0
    fileComplexities[node.filePath] = Math.max(current, node.complexity ?? 0)
  }

  const baseline: Baseline = {
    savedAt: new Date().toISOString(),
    healthScore: Math.round(healthScore),
    avgComplexity: report.averageComplexity,
    hotspotCount: report.hotspots.length,
    totalComplexity: report.totalComplexity,
    fileComplexities,
  }

  const specterDir = path.join(rootDir, '.specter')
  await fs.mkdir(specterDir, { recursive: true })
  await fs.writeFile(
    path.join(specterDir, BASELINE_FILE),
    JSON.stringify(baseline, null, 2),
    'utf-8'
  )

  return baseline
}

export async function loadBaseline(rootDir: string): Promise<Baseline | null> {
  const baselinePath = path.join(rootDir, '.specter', BASELINE_FILE)
  try {
    const content = await fs.readFile(baselinePath, 'utf-8')
    return JSON.parse(content) as Baseline
  } catch {
    return null
  }
}

export async function deleteBaseline(rootDir: string): Promise<void> {
  const baselinePath = path.join(rootDir, '.specter', BASELINE_FILE)
  try {
    await fs.unlink(baselinePath)
  } catch {
    /* already gone */
  }
}

export interface RefactorDelta {
  baseline: Baseline
  current: Baseline
  healthDelta: number
  complexityDelta: number
  hotspotDelta: number
  estimatedSavings: number
  improvedFiles: Array<{ file: string; before: number; after: number; changePercent: number }>
  worsenedFiles: Array<{ file: string; before: number; after: number; changePercent: number }>
}

export function compareToBaseline(baseline: Baseline, currentGraph: KnowledgeGraph): RefactorDelta {
  const report = generateComplexityReport(currentGraph)
  const currentHealth = Math.max(0, Math.round(100 - report.averageComplexity * 5))

  // Build current per-file complexity map
  const currentFileComplexities: Record<string, number> = {}
  for (const node of Object.values(currentGraph.nodes)) {
    if (node.type === 'file') continue
    const current = currentFileComplexities[node.filePath] ?? 0
    currentFileComplexities[node.filePath] = Math.max(current, node.complexity ?? 0)
  }

  const current: Baseline = {
    savedAt: new Date().toISOString(),
    healthScore: currentHealth,
    avgComplexity: report.averageComplexity,
    hotspotCount: report.hotspots.length,
    totalComplexity: report.totalComplexity,
    fileComplexities: currentFileComplexities,
  }

  // Find improved and worsened files
  const improvedFiles: RefactorDelta['improvedFiles'] = []
  const worsenedFiles: RefactorDelta['worsenedFiles'] = []

  for (const [file, beforeComplexity] of Object.entries(baseline.fileComplexities)) {
    const afterComplexity = currentFileComplexities[file] ?? 0
    if (beforeComplexity <= 5 && afterComplexity <= 5) continue // skip simple files

    const change = afterComplexity - beforeComplexity
    if (change < -2) {
      // meaningful improvement
      improvedFiles.push({
        file,
        before: beforeComplexity,
        after: afterComplexity,
        changePercent: Math.round((change / beforeComplexity) * 100),
      })
    } else if (change > 2) {
      // meaningful regression
      worsenedFiles.push({
        file,
        before: beforeComplexity,
        after: afterComplexity,
        changePercent: Math.round((change / beforeComplexity) * 100),
      })
    }
  }

  // Sort by most improved/worsened
  improvedFiles.sort((a, b) => a.changePercent - b.changePercent)
  worsenedFiles.sort((a, b) => b.changePercent - a.changePercent)

  // Estimate savings: complexity reduction * rough hourly cost
  const complexityReduction = baseline.totalComplexity - report.totalComplexity
  const estimatedSavings = Math.max(0, Math.round(complexityReduction * 200)) // ~$200/complexity point/year

  return {
    baseline,
    current,
    healthDelta: currentHealth - baseline.healthScore,
    complexityDelta: report.averageComplexity - baseline.avgComplexity,
    hotspotDelta: report.hotspots.length - baseline.hotspotCount,
    estimatedSavings,
    improvedFiles: improvedFiles.slice(0, 10),
    worsenedFiles: worsenedFiles.slice(0, 5),
  }
}

export function formatDelta(delta: RefactorDelta): string {
  const lines: string[] = []

  lines.push('')
  lines.push(chalk.bold('  Refactoring Impact'))
  lines.push('')

  // Health delta
  const hSign = delta.healthDelta >= 0 ? '+' : ''
  const hColor = delta.healthDelta >= 0 ? chalk.green : chalk.red
  const hMark = delta.healthDelta >= 0 ? '\u2713' : '\u2717'
  lines.push(
    `  Health:      ${delta.baseline.healthScore} \u2192 ${delta.current.healthScore}  ${hColor(`(${hSign}${delta.healthDelta})`)}  ${hMark}`
  )

  // Complexity delta (lower is better, so negative = good)
  const cSign = delta.complexityDelta >= 0 ? '+' : ''
  const cColor = delta.complexityDelta <= 0 ? chalk.green : chalk.red
  const cMark = delta.complexityDelta <= 0 ? '\u2713' : '\u2717'
  lines.push(
    `  Complexity:  ${delta.baseline.avgComplexity.toFixed(1)} \u2192 ${delta.current.avgComplexity.toFixed(1)}  ${cColor(`(${cSign}${delta.complexityDelta.toFixed(1)})`)}  ${cMark}`
  )

  // Hotspot delta (lower is better)
  const hsSign = delta.hotspotDelta >= 0 ? '+' : ''
  const hsColor = delta.hotspotDelta <= 0 ? chalk.green : chalk.red
  const hsMark = delta.hotspotDelta <= 0 ? '\u2713' : '\u2717'
  lines.push(
    `  Hotspots:    ${delta.baseline.hotspotCount} \u2192 ${delta.current.hotspotCount}  ${hsColor(`(${hsSign}${delta.hotspotDelta})`)}  ${hsMark}`
  )

  lines.push('')

  if (delta.estimatedSavings > 0) {
    lines.push(
      `  Estimated savings: ~${chalk.green(`$${delta.estimatedSavings.toLocaleString()}`)}/year in maintenance`
    )
    lines.push('')
  }

  if (delta.improvedFiles.length > 0) {
    lines.push(chalk.bold('  Files improved:'))
    for (const f of delta.improvedFiles) {
      lines.push(
        `    ${chalk.cyan(f.file)}    C:${f.before} \u2192 C:${f.after}  ${chalk.green(`(${f.changePercent}%)`)}`
      )
    }
    lines.push('')
  }

  if (delta.worsenedFiles.length > 0) {
    lines.push(chalk.bold('  Files worsened:'))
    for (const f of delta.worsenedFiles) {
      lines.push(
        `    ${chalk.cyan(f.file)}    C:${f.before} \u2192 C:${f.after}  ${chalk.red(`(+${f.changePercent}%)`)}`
      )
    }
    lines.push('')
  }

  if (delta.improvedFiles.length === 0 && delta.worsenedFiles.length === 0) {
    lines.push(chalk.dim('  No significant per-file changes detected.'))
    lines.push('')
  }

  return lines.join('\n')
}
