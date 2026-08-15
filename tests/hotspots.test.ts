/**
 * Hotspots Formatter Tests
 *
 * analyzeHotspots is git-coupled; formatHotspots is a pure renderer over
 * a HotspotsResult.
 */

import { describe, expect, it } from 'vitest'
import { formatHotspots, type Hotspot, type HotspotsResult } from '../src/hotspots.js'

function hotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  return {
    file: 'src/danger.ts',
    complexity: 90,
    churn: 80,
    churnRate: 3,
    hotspotScore: 85,
    priority: 'critical',
    lastModified: new Date('2020-01-01'),
    topContributors: ['alice', 'bob'],
    ...overrides,
  }
}

function result(overrides: Partial<HotspotsResult> = {}): HotspotsResult {
  const hs = overrides.hotspots ?? [hotspot()]
  return {
    hotspots: hs,
    summary: { criticalCount: 1, highCount: 0, totalDebtHours: 60 },
    quadrants: {
      highComplexityHighChurn: hs,
      highComplexityLowChurn: [],
      lowComplexityHighChurn: [],
      lowComplexityLowChurn: [],
    },
    timeRange: {
      since: new Date('2020-01-01'),
      until: new Date('2020-02-01'),
      weeks: 4,
    },
    ...overrides,
  }
}

describe('formatHotspots', () => {
  it('renders the header, time range, and quadrant analysis', () => {
    const out = formatHotspots(result())
    expect(out).toContain('HOTSPOT ANALYSIS')
    expect(out).toContain('weeks)')
    expect(out).toContain('QUADRANT ANALYSIS')
    expect(out).toContain('DANGER ZONE (high complexity + high churn): 1 files')
  })

  it('renders the top hotspots list with priority and score', () => {
    const out = formatHotspots(result())
    expect(out).toContain('TOP HOTSPOTS')
    expect(out).toContain('CRITICAL')
    expect(out).toContain('src/danger.ts')
    expect(out).toContain('85/100')
    expect(out).toContain('Contributors: alice, bob')
  })

  it('surfaces a danger-zone recommendation and debt total', () => {
    const out = formatHotspots(result())
    expect(out).toContain('RECOMMENDATIONS')
    expect(out).toContain('DANGER ZONE need immediate attention')
    expect(out).toContain('60 hours')
  })
})
