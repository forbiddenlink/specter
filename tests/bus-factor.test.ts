/**
 * Bus Factor Formatter Tests
 *
 * formatBusFactor is a pure string builder over a BusFactorResult.
 */

import { describe, expect, it } from 'vitest'
import { type BusFactorResult, formatBusFactor } from '../src/bus-factor.js'

function result(overrides: Partial<BusFactorResult> = {}): BusFactorResult {
  return {
    overallBusFactor: 2.5,
    riskLevel: 'concerning',
    risks: [],
    summary: { soloOwnedFiles: 0, soloOwnedLines: 0, percentageAtRisk: 0 },
    recommendations: [],
    ...overrides,
  }
}

describe('formatBusFactor', () => {
  it('always renders the header and overall bus factor', () => {
    const out = formatBusFactor(result({ overallBusFactor: 3.4, riskLevel: 'healthy' }))
    expect(out).toContain('BUS FACTOR ANALYSIS')
    expect(out).toContain('Overall Bus Factor: 3.4')
    expect(out).toContain('[OK] HEALTHY')
  })

  it('renders a critical risk block with solo owner and suggestion', () => {
    const out = formatBusFactor(
      result({
        overallBusFactor: 1,
        riskLevel: 'critical',
        risks: [
          {
            area: 'src/core',
            busFactor: 1,
            soleOwner: 'alice',
            contributors: [{ name: 'alice', percentage: 95 }],
            linesOfCode: 1200,
            criticality: 'critical',
            suggestion: 'Pair alice with another developer on all changes',
          },
        ],
      })
    )

    expect(out).toContain('CRITICAL RISKS')
    expect(out).toContain('src/core')
    expect(out).toContain('Solo owner: alice (95% of commits)')
    expect(out).toContain('1,200 lines at risk')
    expect(out).toContain('-> Pair alice with another developer on all changes')
    expect(out).toContain('[!!] CRITICAL')
  })

  it('separates medium and low risks into their own sections', () => {
    const out = formatBusFactor(
      result({
        risks: [
          {
            area: 'src/mid',
            busFactor: 2,
            contributors: [],
            linesOfCode: 300,
            criticality: 'medium',
            suggestion: 's',
          },
          {
            area: 'src/safe',
            busFactor: 4,
            contributors: [],
            linesOfCode: 400,
            criticality: 'low',
            suggestion: 's',
          },
        ],
      })
    )

    expect(out).toContain('MODERATE RISKS')
    expect(out).toContain('src/mid')
    expect(out).toContain('HEALTHY AREAS')
    expect(out).toContain('src/safe')
  })

  it('renders recommendations when present', () => {
    const out = formatBusFactor(result({ recommendations: ['Cross-train the team'] }))
    expect(out).toContain('RECOMMENDATIONS')
    expect(out).toContain('* Cross-train the team')
  })
})
