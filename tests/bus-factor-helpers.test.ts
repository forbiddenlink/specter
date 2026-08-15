/**
 * Bus Factor Helpers Tests
 *
 * Pure calculation helpers behind bus-factor analysis. Contribution score
 * is `commits + (linesAdded + linesRemoved) / 10`.
 */

import { describe, expect, it } from 'vitest'
import {
  buildRiskItem,
  type ContributorPercentage,
  type ContributorStats,
  calculateContributorPercentages,
  determineBusFactor,
  determineCriticality,
} from '../src/bus-factor-helpers.js'
import type { KnowledgeGraph } from '../src/graph/types.js'

function stats(commits: number, linesAdded = 0, linesRemoved = 0): ContributorStats {
  return { commits, linesAdded, linesRemoved, lastCommit: new Date('2020-01-01') }
}

function contributorMap(entries: Array<[string, ContributorStats]>): Map<string, ContributorStats> {
  return new Map(entries)
}

const emptyGraph: KnowledgeGraph = {
  version: '1.0.0',
  metadata: {
    scannedAt: '2020-01-01',
    scanDurationMs: 1,
    rootDir: '/test',
    fileCount: 0,
    totalLines: 0,
    languages: {},
    nodeCount: 0,
    edgeCount: 0,
  },
  nodes: {},
  edges: [],
}

describe('calculateContributorPercentages', () => {
  it('returns [] when there is no contribution', () => {
    expect(calculateContributorPercentages(contributorMap([]))).toEqual([])
    // A contributor with zero of everything still scores 0 -> total 0.
    expect(calculateContributorPercentages(contributorMap([['x', stats(0)]]))).toEqual([])
  })

  it('assigns 100% to a single contributor', () => {
    const result = calculateContributorPercentages(contributorMap([['alice', stats(5)]]))
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('alice')
    expect(result[0]!.percentage).toBe(100)
  })

  it('splits percentages by contribution score and sorts descending', () => {
    // alice score 8, bob score 2, total 10 -> 80% / 20%
    const result = calculateContributorPercentages(
      contributorMap([
        ['bob', stats(2)],
        ['alice', stats(8)],
      ])
    )
    expect(result.map((c) => c.name)).toEqual(['alice', 'bob'])
    expect(result[0]!.percentage).toBe(80)
    expect(result[1]!.percentage).toBe(20)
  })

  it('factors added and removed lines into the score', () => {
    // alice: 1 commit + 90 lines/10 = 10 ; bob: 10 commits = 10 -> 50/50
    const result = calculateContributorPercentages(
      contributorMap([
        ['alice', stats(1, 50, 40)],
        ['bob', stats(10)],
      ])
    )
    expect(result[0]!.percentage).toBe(50)
    expect(result[1]!.percentage).toBe(50)
  })
})

describe('determineBusFactor', () => {
  const mk = (pcts: number[]): ContributorPercentage[] =>
    pcts.map((percentage, i) => ({ name: `c${i}`, score: percentage, percentage }))

  it('counts only contributors with >= 20% as significant', () => {
    expect(determineBusFactor(mk([80, 20]))).toEqual({ busFactor: 2, soleOwner: undefined })
    expect(determineBusFactor(mk([50, 30, 20]))).toEqual({ busFactor: 3, soleOwner: undefined })
  })

  it('returns bus factor 1 with a sole owner when only one is significant', () => {
    const result = determineBusFactor(mk([90, 10]))
    expect(result.busFactor).toBe(1)
    expect(result.soleOwner).toBe('c0')
  })

  it('never returns a bus factor below 1, even with no contributors', () => {
    expect(determineBusFactor([])).toEqual({ busFactor: 1, soleOwner: undefined })
  })
})

describe('determineCriticality', () => {
  const smallArea = { files: ['a.ts'], linesOfCode: 100, contributors: new Map(), totalCommits: 1 }
  const largeArea = {
    files: Array.from({ length: 11 }, (_, i) => `f${i}.ts`),
    linesOfCode: 2000,
    contributors: new Map(),
    totalCommits: 1,
  }

  it('is critical when bus factor 1 and ownership >= 80%', () => {
    expect(determineCriticality(1, 85, smallArea, 'utils', emptyGraph)).toBe('critical')
  })

  it('is critical when bus factor 1 in a core area regardless of ownership', () => {
    expect(determineCriticality(1, 40, smallArea, 'src/core', emptyGraph)).toBe('critical')
  })

  it('is critical when bus factor 1 in a large area', () => {
    expect(determineCriticality(1, 40, largeArea, 'utils', emptyGraph)).toBe('critical')
  })

  it('is high when bus factor 1 but small, non-core, low ownership', () => {
    expect(determineCriticality(1, 40, smallArea, 'utils', emptyGraph)).toBe('high')
  })

  it('is high when ownership >= 70% in a core/large area even with bus factor 2', () => {
    expect(determineCriticality(2, 75, largeArea, 'utils', emptyGraph)).toBe('high')
  })

  it('is medium for bus factor 2 in a small non-core area', () => {
    expect(determineCriticality(2, 50, smallArea, 'utils', emptyGraph)).toBe('medium')
  })

  it('is medium when ownership >= 60% with higher bus factor', () => {
    expect(determineCriticality(3, 65, smallArea, 'utils', emptyGraph)).toBe('medium')
  })

  it('is low when well distributed', () => {
    expect(determineCriticality(3, 40, smallArea, 'utils', emptyGraph)).toBe('low')
  })
})

describe('buildRiskItem', () => {
  it('caps contributors at 5 and projects to name/percentage', () => {
    const contributors: ContributorPercentage[] = Array.from({ length: 7 }, (_, i) => ({
      name: `c${i}`,
      score: 100 - i,
      percentage: 100 - i,
    }))

    const risk = buildRiskItem('src/x', 1, 'c0', contributors, 500, 'critical', 'do the thing')

    expect(risk.area).toBe('src/x')
    expect(risk.busFactor).toBe(1)
    expect(risk.soleOwner).toBe('c0')
    expect(risk.linesOfCode).toBe(500)
    expect(risk.criticality).toBe('critical')
    expect(risk.suggestion).toBe('do the thing')
    expect(risk.contributors).toHaveLength(5)
    expect(risk.contributors[0]).toEqual({ name: 'c0', percentage: 100 })
  })
})
