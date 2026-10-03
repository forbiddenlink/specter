/**
 * File change-risk brief
 *
 * What an agent (or a person) should know before editing one file, drawn from the
 * knowledge graph: files that historically change with it, who imports it, whether
 * it is a hotspot, and which tests cover it.
 *
 * The agent rendering is deliberately silent unless something clears a threshold.
 * Generic context files measurably fail to help coding agents and raise cost
 * (Gloaguen et al., 2026, arXiv:2602.11988); specific, actionable lines are the
 * part agents act on.
 */

import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import type { KnowledgeGraph } from '../graph/types.js'

export interface BriefCoChange {
  file: string
  shared: number
  confidence: number
  /** True when either file imports the other */
  linked: boolean
}

export interface FileBrief {
  file: string
  inGraph: boolean
  maxComplexity: number
  complexSymbol?: string
  churn: number
  /** Share of files with a lower complexity x churn score (0-1), null without churn data */
  hotspotPercentile: number | null
  dependents: string[]
  coChange: BriefCoChange[]
  tests: string[]
  /** Owners by commit count; only filled for multi-author repos */
  owners: string[]
  scannedAt: string
  /** How often co-change predictions held on this repo's own history */
  coChangeAccuracy?: { precision: number; predictions: number }
}

export interface BriefThresholds {
  /** Co-change partner needs this many shared commits... */
  minShared: number
  /** ...and this confidence (shared / commits of the edited file) */
  minConfidence: number
  /** Report the import fan-in at or above this */
  minDependents: number
  /** Hotspot when above this percentile and complex enough */
  hotspotPercentile: number
  hotspotMinComplexity: number
  /** Suppress co-change lines when this repo's backtested precision is below this */
  minCoChangePrecision: number
  /** ...measured over at least this many predictions */
  minBacktestPredictions: number
}

/**
 * Defaults follow code-maat practice (support >= 5) with confidence raised to 0.5
 * to favour precision; `specter backtest` measures them on a real history.
 */
export const DEFAULT_BRIEF_THRESHOLDS: BriefThresholds = {
  minShared: 5,
  minConfidence: 0.5,
  minDependents: 5,
  hotspotPercentile: 0.9,
  hotspotMinComplexity: 15,
  minCoChangePrecision: 0.25,
  minBacktestPredictions: 20,
}

/**
 * Collect everything known about one file. `filePath` is relative to rootDir.
 */
export function buildFileBrief(
  graph: KnowledgeGraph,
  rootDir: string,
  filePath: string
): FileBrief {
  const file = path.normalize(filePath)
  const fileNode = graph.nodes[file]

  // One pass over nodes: per-file max complexity, for this file and for ranking
  const maxByFile = new Map<string, { complexity: number; name: string }>()
  for (const node of Object.values(graph.nodes)) {
    if (node.complexity === undefined) continue
    const current = maxByFile.get(node.filePath)
    if (!current || node.complexity > current.complexity) {
      maxByFile.set(node.filePath, { complexity: node.complexity, name: node.name })
    }
  }

  const dependents = new Set<string>()
  const linked = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.type !== 'imports') continue
    if (edge.target === file && edge.source !== file) {
      dependents.add(edge.source)
      linked.add(edge.source)
    } else if (edge.source === file) {
      linked.add(edge.target)
    }
  }

  const churn = fileNode?.modificationCount ?? 0
  const own = maxByFile.get(file)

  let hotspotPercentile: number | null = null
  if (churn > 0) {
    const score = (own?.complexity ?? 0) * churn
    let lower = 0
    let total = 0
    for (const node of Object.values(graph.nodes)) {
      if (node.type !== 'file' || !node.modificationCount) continue
      total++
      const s = (maxByFile.get(node.filePath)?.complexity ?? 0) * node.modificationCount
      if (s < score) lower++
    }
    hotspotPercentile = total > 1 ? lower / (total - 1) : null
  }

  const coChange = (graph.coChange?.[file] ?? [])
    .filter((p) => fs.existsSync(path.join(rootDir, p.file)))
    .map((p) => ({ ...p, linked: linked.has(p.file) }))

  const solo = (graph.metadata.authorCount ?? 1) <= 1

  return {
    file,
    inGraph: Boolean(fileNode),
    maxComplexity: own?.complexity ?? 0,
    complexSymbol: own?.name,
    churn,
    hotspotPercentile,
    dependents: [...dependents].sort(),
    coChange,
    tests: findTestFiles(rootDir, file),
    owners: solo ? [] : (fileNode?.contributors ?? []),
    scannedAt: graph.metadata.scannedAt,
    coChangeAccuracy: graph.metadata.coChangeAccuracy,
  }
}

/**
 * Test files that most likely cover `file`: `x.test.ts` / `x.spec.ts` beside it,
 * in `__tests__/`, or anywhere under a tests directory with the same base name.
 */
export function findTestFiles(rootDir: string, file: string): string[] {
  const base = path.basename(file).replace(/\.(m|c)?(t|j)sx?$/, '')
  if (!base || base === 'index') return []
  try {
    const found = fg.sync([`**/${fg.escapePath(base)}.{test,spec}.{ts,tsx,js,jsx,mts,mjs}`], {
      cwd: rootDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.git/**', '**/build/**'],
      deep: 8,
      suppressErrors: true,
    })
    // Closest to the source file first
    const dir = path.dirname(file)
    return found
      .sort((a, b) => distance(dir, a) - distance(dir, b) || a.localeCompare(b))
      .slice(0, 3)
  } catch {
    return []
  }
}

function distance(fromDir: string, to: string): number {
  return path.relative(fromDir, path.dirname(to)).split(path.sep).filter(Boolean).length
}

/**
 * The short brief an agent sees before editing, or null when nothing clears a
 * threshold. Plain text, at most a handful of lines.
 */
export function renderAgentBrief(
  brief: FileBrief,
  thresholds: BriefThresholds = DEFAULT_BRIEF_THRESHOLDS
): string | null {
  if (!brief.inGraph) return null

  const lines: string[] = []

  const accuracy = brief.coChangeAccuracy
  const measured =
    accuracy !== undefined && accuracy.predictions >= thresholds.minBacktestPredictions
  const trusted = !measured || (accuracy?.precision ?? 0) >= thresholds.minCoChangePrecision

  const partners = (trusted ? brief.coChange : [])
    .filter((p) => p.shared >= thresholds.minShared && p.confidence >= thresholds.minConfidence)
    // Partners with no import link are the ones an agent cannot discover by reading code
    .sort((a, b) => Number(a.linked) - Number(b.linked) || b.confidence - a.confidence)
    .slice(0, 3)

  if (partners.length > 0) {
    const described = partners.map(
      (p) =>
        `${p.file} (${Math.round(p.confidence * 100)}% of its changes, ${p.shared} commits${p.linked ? '' : ', no import link'})`
    )
    const track = measured
      ? ` In this repo such predictions held ${Math.round((accuracy?.precision ?? 0) * 100)}% of the time.`
      : ''
    lines.push(
      `Usually changes together with: ${described.join('; ')}. Check whether they need the same change.${track}`
    )
  }

  if (brief.dependents.length >= thresholds.minDependents) {
    const sample = brief.dependents.slice(0, 3).join(', ')
    lines.push(
      `Imported by ${brief.dependents.length} files (${sample}${brief.dependents.length > 3 ? ', ...' : ''}). Keep its exports compatible.`
    )
  }

  const isHotspot =
    brief.hotspotPercentile !== null &&
    brief.hotspotPercentile >= thresholds.hotspotPercentile &&
    brief.maxComplexity >= thresholds.hotspotMinComplexity
  if (isHotspot) {
    const top = Math.max(1, Math.round((1 - (brief.hotspotPercentile ?? 0)) * 100))
    lines.push(
      `Hotspot: top ${top}% by complexity x churn (complexity ${brief.maxComplexity}${brief.complexSymbol ? ` in ${brief.complexSymbol}` : ''}, ${brief.churn} commits). Prefer small, contained edits.`
    )
  }

  if (lines.length === 0) return null

  if (brief.tests.length > 0) {
    lines.push(`Tests: ${brief.tests.join(', ')}`)
  }

  return [`Specter change-risk brief for ${brief.file}:`, ...lines.map((l) => `- ${l}`)].join('\n')
}
