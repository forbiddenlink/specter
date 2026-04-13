/**
 * First-Run Experience Tests
 *
 * Tests for isFirstRun() and runFirstTimeExperience().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeGraph } from '../src/graph/types.js'

vi.mock('../src/graph/persistence.js', () => ({
  graphExists: vi.fn(),
}))

vi.mock('../src/auto-scan.js', () => ({
  ensureGraph: vi.fn(),
}))

vi.mock('../src/graph/builder.js', () => ({
  getGraphStats: vi.fn(() => ({
    fileCount: 10,
    totalLines: 1000,
    nodeCount: 50,
    edgeCount: 30,
    nodesByType: { file: 10, function: 30, class: 5, interface: 5 },
    edgesByType: { imports: 20, contains: 10 },
    avgComplexity: 5,
    maxComplexity: 20,
  })),
}))

vi.mock('../src/analyzers/complexity.js', () => ({
  generateComplexityReport: vi.fn(() => ({
    averageComplexity: 5,
    maxComplexity: 20,
    totalComplexity: 50,
    hotspots: [
      {
        filePath: 'src/complex.ts',
        name: 'complexFunction',
        type: 'function',
        complexity: 20,
        lineStart: 10,
        lineEnd: 50,
      },
    ],
    distribution: { low: 30, medium: 15, high: 4, veryHigh: 1 },
  })),
  getComplexityEmoji: vi.fn((c: number) =>
    c <= 5 ? '🟢' : c <= 10 ? '🟡' : c <= 20 ? '🟠' : '🔴'
  ),
}))

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      red: (s: string) => s,
      white: (s: string) => s,
      cyan: (s: string) => s,
    }),
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    hex: () => (s: string) => s,
  },
}))

vi.mock('gradient-string', () => ({
  default: vi.fn(() => (s: string) => s),
}))

import { ensureGraph } from '../src/auto-scan.js'
import { isFirstRun, runFirstTimeExperience } from '../src/first-run.js'
import { graphExists } from '../src/graph/persistence.js'

function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: 10,
      totalLines: 1000,
      languages: { typescript: 10 },
      nodeCount: 50,
      edgeCount: 30,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'test.ts',
        filePath: 'src/test.ts',
        lineStart: 1,
        lineEnd: 100,
        exported: true,
        complexity: 5,
      },
    },
    edges: [],
    ...overrides,
  }
}

describe('isFirstRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when graphExists returns false', async () => {
    vi.mocked(graphExists).mockResolvedValue(false)

    const result = await isFirstRun('/test')

    expect(result).toBe(true)
    expect(graphExists).toHaveBeenCalledWith('/test')
  })

  it('returns false when graphExists returns true', async () => {
    vi.mocked(graphExists).mockResolvedValue(true)

    const result = await isFirstRun('/test')

    expect(result).toBe(false)
  })
})

describe('runFirstTimeExperience', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('returns false when not first run', async () => {
    vi.mocked(graphExists).mockResolvedValue(true)

    const result = await runFirstTimeExperience('/test')

    expect(result).toBe(false)
    expect(ensureGraph).not.toHaveBeenCalled()
  })

  it('returns true and prints summary when first run succeeds', async () => {
    const mockGraph = createMockGraph()
    vi.mocked(graphExists).mockResolvedValue(false)
    vi.mocked(ensureGraph).mockResolvedValue(mockGraph)

    const result = await runFirstTimeExperience('/test')

    expect(result).toBe(true)
    expect(ensureGraph).toHaveBeenCalledWith('/test')
    // Should print the curated summary (check for key output markers)
    expect(consoleSpy).toHaveBeenCalled()
    const allOutput = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(allOutput).toContain('Codebase at a Glance')
  })

  it('returns true with error message when scan fails', async () => {
    vi.mocked(graphExists).mockResolvedValue(false)
    vi.mocked(ensureGraph).mockResolvedValue(null)

    const result = await runFirstTimeExperience('/test')

    expect(result).toBe(true)
    const allOutput = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(allOutput).toContain('Could not scan codebase')
  })
})
