/**
 * Velocity Tests
 *
 * analyzeVelocity reads history snapshots (mocked here) plus the graph.
 * With < 2 snapshots it returns the "current metrics only" default, which
 * is computed purely from the graph. formatVelocity is a pure renderer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphNode, KnowledgeGraph } from '../src/graph/types.js'

vi.mock('../src/history/storage.js', () => ({
  loadSnapshots: vi.fn(),
}))

import { loadSnapshots } from '../src/history/storage.js'
import { analyzeVelocity, formatVelocity, type VelocityResult } from '../src/velocity.js'

const mockLoadSnapshots = vi.mocked(loadSnapshots)

function fileNode(filePath: string, complexity: number): GraphNode {
  return {
    id: filePath,
    type: 'file',
    name: filePath.split('/').pop() ?? filePath,
    filePath,
    lineStart: 1,
    lineEnd: 100,
    exported: true,
    complexity,
  }
}

function graph(nodes: GraphNode[]): KnowledgeGraph {
  const nodeMap: Record<string, GraphNode> = {}
  for (const n of nodes) nodeMap[n.id] = n
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: '2020-01-01',
      scanDurationMs: 1,
      rootDir: '/test',
      fileCount: nodes.length,
      totalLines: nodes.length * 100,
      languages: { typescript: nodes.length },
      nodeCount: nodes.length,
      edgeCount: 0,
    },
    nodes: nodeMap,
    edges: [],
  }
}

describe('analyzeVelocity (no history)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns current metrics from the graph when there are fewer than 2 snapshots', async () => {
    mockLoadSnapshots.mockResolvedValue([])

    const result = await analyzeVelocity(
      '/test',
      graph([fileNode('a.ts', 10), fileNode('b.ts', 20), fileNode('c.ts', 30)])
    )

    expect(result.snapshotCount).toBe(0)
    expect(result.trend).toBe('stable')
    expect(result.files).toEqual([])
    expect(result.currentMetrics).toEqual({
      avgComplexity: 20,
      totalComplexity: 60,
      hotspotCount: 2, // complexity > 15: b (20) and c (30)
      fileCount: 3,
    })
    expect(result.projectedDebtIn30Days).toBe(60)
  })

  it('reports zeroed metrics for a graph with no complexity data', async () => {
    mockLoadSnapshots.mockResolvedValue([])

    const result = await analyzeVelocity('/test', graph([]))

    expect(result.currentMetrics.fileCount).toBe(0)
    expect(result.currentMetrics.avgComplexity).toBe(0)
    expect(result.currentMetrics.hotspotCount).toBe(0)
  })
})

function result(overrides: Partial<VelocityResult> = {}): VelocityResult {
  return {
    files: [],
    overallVelocity: 0,
    trend: 'stable',
    fastestGrowing: [],
    fastestImproving: [],
    projectedDebtIn30Days: 100,
    snapshotCount: 2,
    timeSpanDays: 7,
    currentMetrics: { avgComplexity: 10, totalComplexity: 100, hotspotCount: 1, fileCount: 10 },
    ...overrides,
  }
}

describe('formatVelocity', () => {
  it('renders an insufficient-data message when there are fewer than 2 snapshots', () => {
    const out = formatVelocity(result({ snapshotCount: 1 }))
    expect(out).toContain('INSUFFICIENT DATA')
    expect(out).toContain('Need at least 2 snapshots')
  })

  it('renders overall velocity, projection, and fastest-growing files', () => {
    const out = formatVelocity(
      result({
        overallVelocity: 8,
        trend: 'degrading',
        projectedDebtIn30Days: 134,
        fastestGrowing: [
          {
            path: 'src/hot.ts',
            currentComplexity: 30,
            previousComplexity: 20,
            delta: 10,
            velocityPerWeek: 8,
            trend: 'degrading',
          },
        ],
      })
    )

    expect(out).toContain('OVERALL VELOCITY')
    expect(out).toContain('DEGRADING')
    expect(out).toContain('30-DAY PROJECTION')
    expect(out).toContain('FASTEST GROWING')
    expect(out).toContain('src/hot.ts')
    expect(out).toContain('Focus on: hot.ts')
  })
})
