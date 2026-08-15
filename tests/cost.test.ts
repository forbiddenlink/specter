/**
 * Cost Formatter Tests
 *
 * analyzeCost pulls in git-coupled bus-factor/hotspots; formatCost is a
 * pure renderer over a CostAnalysis.
 */

import { describe, expect, it } from 'vitest'
import { type CostAnalysis, formatCost } from '../src/cost.js'

function analysis(overrides: Partial<CostAnalysis> = {}): CostAnalysis {
  return {
    totalDebt: 10000,
    categories: [
      {
        name: 'Complexity',
        cost: 6000,
        hours: 80,
        fileCount: 3,
        description: 'complex files',
        emoji: '🧩',
      },
      {
        name: 'Bus Factor',
        cost: 4000,
        hours: 53,
        fileCount: 2,
        description: 'solo-owned',
        emoji: '🚌',
      },
    ],
    topFiles: [
      {
        file: 'src/monster.ts',
        totalCost: 5000,
        breakdown: { complexity: 3000, busFactor: 2000 },
        priority: 'critical',
        estimatedFixTime: 40,
      },
    ],
    quickWins: [
      {
        file: 'src/easy.ts',
        cost: 800,
        fixTime: 2,
        roi: 400,
        recommendation: 'Delete dead export',
      },
    ],
    estimatedSavings: 3000,
    hourlyRate: 75,
    currency: 'USD',
    analysisDate: '2020-01-01',
    ...overrides,
  }
}

describe('formatCost', () => {
  it('renders the header, total debt, and hourly rate', () => {
    const out = formatCost(analysis())
    expect(out).toContain('TECH DEBT COST ANALYSIS')
    expect(out).toContain('Total Tech Debt:')
  })

  it('renders the cost breakdown and most-expensive files', () => {
    const out = formatCost(analysis())
    expect(out).toContain('COST BREAKDOWN')
    expect(out).toContain('Complexity')
    expect(out).toContain('TOP 5 MOST EXPENSIVE FILES')
    expect(out).toContain('src/monster.ts')
    expect(out).toContain('CRITICAL')
  })

  it('renders quick wins and recommendations', () => {
    const out = formatCost(analysis())
    expect(out).toContain('QUICK WINS')
    expect(out).toContain('src/easy.ts')
    expect(out).toContain('Delete dead export')
    expect(out).toContain('RECOMMENDATIONS')
  })
})
