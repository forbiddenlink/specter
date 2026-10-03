import { describe, expect, it } from 'vitest'
import type { MinedCommit } from '../../src/analyzers/git-history.js'
import { runCoChangeBacktest } from '../../src/risk/backtest.js'

const c = (i: number, files: string[]): MinedCommit => ({
  hash: `h${i}`,
  author: 'a',
  email: 'a@x.com',
  date: '2026-01-01T00:00:00Z',
  subject: '',
  files,
})

/** Newest first, as git log returns */
const newestFirst = (commits: MinedCommit[]) => [...commits].reverse()

describe('runCoChangeBacktest', () => {
  it('scores a perfectly coupled pair as fully precise', () => {
    const history = Array.from({ length: 10 }, (_, i) => c(i, ['a.ts', 'b.ts']))
    const [row] = runCoChangeBacktest(newestFirst(history), {
      evalCommits: 4,
      settings: [{ minShared: 3, minConfidence: 0.5 }],
    })
    expect(row).toMatchObject({
      queries: 8,
      answered: 8,
      hits: 8,
      precision: 1,
      recall: 1,
      coverage: 1,
    })
  })

  it('never uses the evaluated commit to predict itself', () => {
    // Only one commit pairs a and b: there is no earlier evidence for it
    const [row] = runCoChangeBacktest([c(0, ['a.ts', 'b.ts'])], {
      evalCommits: 1,
      settings: [{ minShared: 1, minConfidence: 0 }],
    })
    expect(row?.answered).toBe(0)
  })

  it('counts a wrong prediction against precision', () => {
    const history = [
      ...Array.from({ length: 5 }, (_, i) => c(i, ['a.ts', 'b.ts'])),
      c(5, ['a.ts', 'c.ts']),
    ]
    const [row] = runCoChangeBacktest(newestFirst(history), {
      evalCommits: 1,
      settings: [{ minShared: 3, minConfidence: 0.5 }],
    })
    // Editing a.ts predicts b.ts, but c.ts changed
    expect(row?.hits).toBe(0)
    expect(row?.precision).toBe(0)
  })

  it('counts a prediction for a file edited alone as a miss', () => {
    const history = [...Array.from({ length: 5 }, (_, i) => c(i, ['a.ts', 'b.ts'])), c(5, ['a.ts'])]
    const [row] = runCoChangeBacktest(newestFirst(history), {
      evalCommits: 1,
      settings: [{ minShared: 3, minConfidence: 0.5 }],
    })
    expect(row).toMatchObject({ queries: 1, answered: 1, hits: 0, precision: 0 })
  })

  it('never predicts test files', () => {
    const history = Array.from({ length: 6 }, (_, i) => c(i, ['a.ts', 'a.test.ts']))
    const [row] = runCoChangeBacktest(newestFirst(history), {
      evalCommits: 6,
      settings: [{ minShared: 1, minConfidence: 0 }],
    })
    expect(row?.predictions).toBe(0)
  })
})
