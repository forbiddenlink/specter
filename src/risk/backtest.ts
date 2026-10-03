/**
 * Co-change backtest
 *
 * Replays history oldest to newest. At each evaluated commit, every source file in
 * it acts as "the file being edited"; the co-change model built only from earlier
 * commits predicts its partners, and the commit's other files are the truth. This
 * is the evaluation design of Zimmermann et al., "Mining Version Histories to
 * Guide Software Changes" (ROSE, TSE 2005).
 *
 * The result answers: when the brief names a partner, how often was it right
 * (precision), how many real partners did it name (recall), and how often did it
 * say anything at all (coverage).
 */

import type { MinedCommit } from '../analyzers/git-history.js'

export interface ThresholdSetting {
  minShared: number
  minConfidence: number
}

export interface BacktestRow extends ThresholdSetting {
  /** Edited-file queries evaluated */
  queries: number
  /** Queries where at least one partner was predicted */
  answered: number
  predictions: number
  hits: number
  /** Actual partner files across all queries */
  actual: number
  precision: number
  recall: number
  coverage: number
}

export interface BacktestOptions {
  /** Most recent commits evaluated (older ones only train) */
  evalCommits?: number
  maxFilesPerCommit?: number
  /** Partners shown per file, as in the brief */
  topK?: number
  settings?: ThresholdSetting[]
  /** Which paths count as source files */
  isSource?: (file: string) => boolean
}

export const DEFAULT_BACKTEST_SETTINGS: ThresholdSetting[] = [
  { minShared: 2, minConfidence: 0.3 },
  { minShared: 3, minConfidence: 0.3 },
  { minShared: 3, minConfidence: 0.5 },
  { minShared: 5, minConfidence: 0.3 },
  { minShared: 5, minConfidence: 0.5 },
  { minShared: 8, minConfidence: 0.6 },
]

const SOURCE = /\.(m|c)?(t|j)sx?$/
const NOT_SOURCE = /(^|\/)(node_modules|dist|build|\.next)\/|\.d\.ts$|\.(test|spec)\./

export function runCoChangeBacktest(
  commitsNewestFirst: MinedCommit[],
  options: BacktestOptions = {}
): BacktestRow[] {
  const {
    evalCommits = 300,
    maxFilesPerCommit = 30,
    topK = 3,
    settings = DEFAULT_BACKTEST_SETTINGS,
    isSource = (f: string) => SOURCE.test(f) && !NOT_SOURCE.test(f),
  } = options

  const chronological = [...commitsNewestFirst]
    .reverse()
    .map((c) => [...new Set(c.files.filter(isSource))])
    .filter((files) => files.length > 0 && files.length <= maxFilesPerCommit)

  const evalStart = Math.max(0, chronological.length - evalCommits)
  const commitCount = new Map<string, number>()
  const pairCount = new Map<string, Map<string, number>>()
  const rows = settings.map((s) => ({
    ...s,
    queries: 0,
    answered: 0,
    predictions: 0,
    hits: 0,
    actual: 0,
  }))

  chronological.forEach((files, index) => {
    if (index >= evalStart && files.length >= 2) {
      for (const file of files) {
        const total = commitCount.get(file) ?? 0
        const partners = pairCount.get(file)
        const actual = new Set(files.filter((f) => f !== file))

        for (const row of rows) {
          row.queries++
          row.actual += actual.size
          if (!partners || total === 0) continue

          const predicted = [...partners]
            .filter(([, shared]) => shared >= row.minShared && shared / total >= row.minConfidence)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topK)
            .map(([f]) => f)

          if (predicted.length === 0) continue
          row.answered++
          row.predictions += predicted.length
          row.hits += predicted.filter((f) => actual.has(f)).length
        }
      }
    }

    // Learn from this commit only after predicting it
    for (const file of files) commitCount.set(file, (commitCount.get(file) ?? 0) + 1)
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        bump(pairCount, files[i] as string, files[j] as string)
        bump(pairCount, files[j] as string, files[i] as string)
      }
    }
  })

  return rows.map((r) => ({
    ...r,
    precision: r.predictions > 0 ? r.hits / r.predictions : 0,
    recall: r.actual > 0 ? r.hits / r.actual : 0,
    coverage: r.queries > 0 ? r.answered / r.queries : 0,
  }))
}

function bump(map: Map<string, Map<string, number>>, a: string, b: string): void {
  let inner = map.get(a)
  if (!inner) {
    inner = new Map()
    map.set(a, inner)
  }
  inner.set(b, (inner.get(b) ?? 0) + 1)
}
