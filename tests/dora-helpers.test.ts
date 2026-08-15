/**
 * DORA Helpers Tests
 *
 * Pure metric helpers behind the dora command.
 */

import { describe, expect, it } from 'vitest'
import { aggregateMetrics, analyzeChangeFailures, calculateMTTR } from '../src/dora-helpers.js'

describe('analyzeChangeFailures', () => {
  it('counts revert commits', () => {
    const result = analyzeChangeFailures([
      { message: 'Revert "feat: bad change"' },
      { message: 'feat: something' },
      { message: 'revert broken thing' },
    ])
    expect(result.reverts).toBe(2)
  })

  it('counts merges by message prefix or base-branch refs', () => {
    const result = analyzeChangeFailures([
      { message: 'Merge branch feature' },
      { message: 'feat: x', refs: 'origin/main' },
      { message: 'chore: y', refs: 'HEAD -> master' },
      { message: 'feat: z', refs: 'origin/feature' },
    ])
    expect(result.merges).toBe(3)
  })

  it('returns zeros for a clean history', () => {
    expect(analyzeChangeFailures([{ message: 'feat: a' }, { message: 'fix: b' }])).toEqual({
      reverts: 0,
      merges: 0,
    })
  })
})

describe('calculateMTTR', () => {
  it('measures hours between a revert and the following fix', () => {
    const result = calculateMTTR([
      { date: '2020-01-01T00:00:00Z', message: 'revert: bad deploy' },
      { date: '2020-01-01T02:00:00Z', message: 'fix: restore behavior' },
    ])
    expect(result).toEqual([2])
  })

  it('ignores a revert with no following fix', () => {
    const result = calculateMTTR([
      { date: '2020-01-01T00:00:00Z', message: 'revert: bad deploy' },
      { date: '2020-01-01T02:00:00Z', message: 'feat: unrelated' },
    ])
    expect(result).toEqual([])
  })

  it('excludes recoveries longer than 30 days', () => {
    const result = calculateMTTR([
      { date: '2020-01-01T00:00:00Z', message: 'revert: bad' },
      { date: '2020-03-01T00:00:00Z', message: 'fix: late' },
    ])
    expect(result).toEqual([])
  })

  it('sorts commits chronologically before pairing', () => {
    // fix listed before revert; sorting must reorder them
    const result = calculateMTTR([
      { date: '2020-01-01T05:00:00Z', message: 'fix: restore' },
      { date: '2020-01-01T00:00:00Z', message: 'revert: bad' },
    ])
    expect(result).toEqual([5])
  })
})

describe('aggregateMetrics', () => {
  it('computes deploy frequency, lead time, failure rate, and MTTR from data', () => {
    const result = aggregateMetrics({
      deployCount: 10,
      weeksAnalyzed: 2,
      leadTimes: [4, 6],
      commitCount: 100,
      revertCount: 2,
      mergeCount: 20,
      recoveryTimes: [3, 5],
    })
    expect(result.deploysPerWeek).toBe(5)
    expect(result.avgLeadTime).toBe(5)
    expect(result.failureRate).toBe(10) // 2 / max(20,10,1) * 100
    expect(result.avgMTTR).toBe(4)
  })

  it('estimates lead time when none is recorded but deploys exist', () => {
    // hoursInPeriod = 1*7*24 = 168; /deployCount(4)/2 = 21
    const result = aggregateMetrics({
      deployCount: 4,
      weeksAnalyzed: 1,
      leadTimes: [],
      commitCount: 50,
      revertCount: 0,
      mergeCount: 4,
      recoveryTimes: [],
    })
    expect(result.avgLeadTime).toBe(21)
  })

  it('falls back to a 24h MTTR estimate when reverts exist without recovery data', () => {
    const result = aggregateMetrics({
      deployCount: 5,
      weeksAnalyzed: 1,
      leadTimes: [2],
      commitCount: 10,
      revertCount: 1,
      mergeCount: 5,
      recoveryTimes: [],
    })
    expect(result.avgMTTR).toBe(24)
  })

  it('reports zero MTTR and lead time when there is nothing to measure', () => {
    const result = aggregateMetrics({
      deployCount: 0,
      weeksAnalyzed: 4,
      leadTimes: [],
      commitCount: 0,
      revertCount: 0,
      mergeCount: 0,
      recoveryTimes: [],
    })
    expect(result.avgLeadTime).toBe(0)
    expect(result.avgMTTR).toBe(0)
    expect(result.failureRate).toBe(0)
  })
})
