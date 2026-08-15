/**
 * Coupling Formatter Tests
 *
 * analyzeCoupling is git-coupled; formatCoupling is a pure renderer.
 */

import { describe, expect, it } from 'vitest'
import { type CouplingResult, formatCoupling } from '../src/coupling.js'

function result(overrides: Partial<CouplingResult> = {}): CouplingResult {
  return {
    pairs: [],
    hiddenCouplings: 0,
    expectedCouplings: 0,
    suspiciousCouplings: 0,
    recommendations: [],
    ...overrides,
  }
}

describe('formatCoupling', () => {
  it('always renders the header and summary counts', () => {
    const out = formatCoupling(result({ hiddenCouplings: 1, expectedCouplings: 2 }))
    expect(out).toContain('COUPLING ANALYSIS')
    expect(out).toContain('Found 3 coupling pair(s) above threshold')
  })

  it('renders hidden/suspicious pairs with a no-import warning', () => {
    const out = formatCoupling(
      result({
        hiddenCouplings: 1,
        pairs: [
          {
            file1: 'src/a.ts',
            file2: 'src/b.ts',
            coChangeCount: 8,
            totalChanges: 10,
            couplingStrength: 80,
            hasDirectDependency: false,
            type: 'hidden',
            suggestion: 'Extract shared logic',
          },
        ],
      })
    )
    expect(out).toContain('HIDDEN COUPLINGS')
    expect(out).toContain('src/a.ts')
    expect(out).toContain('src/b.ts')
    expect(out).toContain('No direct import found!')
    expect(out).toContain('Extract shared logic')
  })

  it('lists expected couplings and recommendations separately', () => {
    const out = formatCoupling(
      result({
        expectedCouplings: 1,
        pairs: [
          {
            file1: 'src/x.ts',
            file2: 'src/y.ts',
            coChangeCount: 5,
            totalChanges: 6,
            couplingStrength: 60,
            hasDirectDependency: true,
            type: 'expected',
            suggestion: 'ok',
          },
        ],
        recommendations: ['Add an abstraction layer'],
      })
    )
    expect(out).toContain('EXPECTED COUPLINGS')
    expect(out).toContain('RECOMMENDATIONS')
    expect(out).toContain('Add an abstraction layer')
  })
})
