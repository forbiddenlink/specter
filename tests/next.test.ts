/**
 * Next Command Tests
 *
 * Tests for analyzeNext() and formatNext() which suggest high-impact refactoring targets.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeGraph } from '../src/graph/types.js'

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

import { analyzeNext, formatNext, type NextSuggestion } from '../src/next.js'

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
    nodes: {},
    edges: [],
    ...overrides,
  }
}

describe('analyzeNext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns highest-complexity file as top suggestion', () => {
    const graph = createMockGraph({
      nodes: {
        'file-a': {
          id: 'file-a',
          type: 'file',
          name: 'a.ts',
          filePath: 'src/a.ts',
          lineStart: 1,
          lineEnd: 100,
          exported: true,
        },
        'func-a': {
          id: 'func-a',
          type: 'function',
          name: 'funcA',
          filePath: 'src/a.ts',
          lineStart: 5,
          lineEnd: 50,
          exported: true,
          complexity: 10,
        },
        'file-b': {
          id: 'file-b',
          type: 'file',
          name: 'b.ts',
          filePath: 'src/b.ts',
          lineStart: 1,
          lineEnd: 200,
          exported: true,
        },
        'func-b': {
          id: 'func-b',
          type: 'function',
          name: 'funcB',
          filePath: 'src/b.ts',
          lineStart: 5,
          lineEnd: 150,
          exported: true,
          complexity: 25,
        },
      },
      edges: [],
    })

    const suggestions = analyzeNext(graph)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]!.file).toBe('src/b.ts')
    expect(suggestions[0]!.complexity).toBe(25)
  })

  it('filters out files with complexity < 5', () => {
    const graph = createMockGraph({
      nodes: {
        'file-a': {
          id: 'file-a',
          type: 'file',
          name: 'simple.ts',
          filePath: 'src/simple.ts',
          lineStart: 1,
          lineEnd: 20,
          exported: true,
        },
        'func-a': {
          id: 'func-a',
          type: 'function',
          name: 'simpleFunc',
          filePath: 'src/simple.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
          complexity: 3,
        },
      },
      edges: [],
    })

    const suggestions = analyzeNext(graph)

    expect(suggestions).toHaveLength(0)
  })

  it('respects top option to return N suggestions', () => {
    const nodes: KnowledgeGraph['nodes'] = {}
    for (let i = 0; i < 5; i++) {
      nodes[`file-${i}`] = {
        id: `file-${i}`,
        type: 'file',
        name: `file${i}.ts`,
        filePath: `src/file${i}.ts`,
        lineStart: 1,
        lineEnd: 100,
        exported: true,
      }
      nodes[`func-${i}`] = {
        id: `func-${i}`,
        type: 'function',
        name: `func${i}`,
        filePath: `src/file${i}.ts`,
        lineStart: 5,
        lineEnd: 50,
        exported: true,
        complexity: 10 + i * 5,
      }
    }

    const graph = createMockGraph({ nodes, edges: [] })

    const suggestions = analyzeNext(graph, { top: 3 })

    expect(suggestions).toHaveLength(3)
  })

  it('returns empty array when no files meet threshold', () => {
    const graph = createMockGraph({
      nodes: {
        'file-1': {
          id: 'file-1',
          type: 'file',
          name: 'trivial.ts',
          filePath: 'src/trivial.ts',
          lineStart: 1,
          lineEnd: 10,
          exported: true,
        },
        'func-1': {
          id: 'func-1',
          type: 'function',
          name: 'trivialFunc',
          filePath: 'src/trivial.ts',
          lineStart: 1,
          lineEnd: 5,
          exported: true,
          complexity: 2,
        },
      },
      edges: [],
    })

    const suggestions = analyzeNext(graph)

    expect(suggestions).toHaveLength(0)
  })

  it('scores files correctly - high complexity + high churn + low bus factor = high score', () => {
    const graph = createMockGraph({
      nodes: {
        // High risk file: high complexity, high churn, sole owner
        'file-risky': {
          id: 'file-risky',
          type: 'file',
          name: 'risky.ts',
          filePath: 'src/risky.ts',
          lineStart: 1,
          lineEnd: 300,
          exported: true,
          modificationCount: 50,
          contributors: ['alice'],
        },
        'func-risky': {
          id: 'func-risky',
          type: 'function',
          name: 'riskyFunc',
          filePath: 'src/risky.ts',
          lineStart: 10,
          lineEnd: 200,
          exported: true,
          complexity: 30,
        },
        // Low risk file: moderate complexity, low churn, many contributors
        'file-safe': {
          id: 'file-safe',
          type: 'file',
          name: 'safe.ts',
          filePath: 'src/safe.ts',
          lineStart: 1,
          lineEnd: 100,
          exported: true,
          modificationCount: 2,
          contributors: ['alice', 'bob', 'charlie'],
        },
        'func-safe': {
          id: 'func-safe',
          type: 'function',
          name: 'safeFunc',
          filePath: 'src/safe.ts',
          lineStart: 10,
          lineEnd: 50,
          exported: true,
          complexity: 8,
        },
      },
      edges: [],
    })

    const suggestions = analyzeNext(graph, { top: 2 })

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]!.file).toBe('src/risky.ts')
    expect(suggestions[0]!.impactScore).toBeGreaterThan(suggestions[1]!.impactScore)
  })

  it('includes dependent count in output', () => {
    const graph = createMockGraph({
      nodes: {
        'file-core': {
          id: 'file-core',
          type: 'file',
          name: 'core.ts',
          filePath: 'src/core.ts',
          lineStart: 1,
          lineEnd: 200,
          exported: true,
        },
        'func-core': {
          id: 'func-core',
          type: 'function',
          name: 'coreFunc',
          filePath: 'src/core.ts',
          lineStart: 10,
          lineEnd: 100,
          exported: true,
          complexity: 15,
        },
        'file-consumer-1': {
          id: 'file-consumer-1',
          type: 'file',
          name: 'consumer1.ts',
          filePath: 'src/consumer1.ts',
          lineStart: 1,
          lineEnd: 50,
          exported: true,
        },
        'file-consumer-2': {
          id: 'file-consumer-2',
          type: 'file',
          name: 'consumer2.ts',
          filePath: 'src/consumer2.ts',
          lineStart: 1,
          lineEnd: 50,
          exported: true,
        },
      },
      edges: [
        { id: 'e1', source: 'file-consumer-1', target: 'file-core', type: 'imports' },
        { id: 'e2', source: 'file-consumer-2', target: 'file-core', type: 'imports' },
      ],
    })

    const suggestions = analyzeNext(graph)

    expect(suggestions[0]!.dependents).toBe(2)
  })
})

describe('formatNext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns "in good shape" message for empty suggestions', () => {
    const result = formatNext([])

    expect(result).toContain('good shape')
    expect(result).toContain('specter health')
  })

  it('includes file details for single suggestion', () => {
    const suggestion: NextSuggestion = {
      file: 'src/complex.ts',
      complexity: 25,
      churn: 15,
      dependents: 8,
      busFactor: 1,
      impactScore: 0.95,
      estimatedCostSavings: 37500,
    }

    const result = formatNext([suggestion])

    expect(result).toContain('src/complex.ts')
    expect(result).toContain('25')
    expect(result).toContain('15')
    expect(result).toContain('1')
    expect(result).toContain('8')
    expect(result).toContain('$37,500')
  })

  it('gives first suggestion detailed view and rest summary lines', () => {
    const suggestions: NextSuggestion[] = [
      {
        file: 'src/top.ts',
        complexity: 30,
        churn: 20,
        dependents: 10,
        busFactor: 1,
        impactScore: 0.98,
        estimatedCostSavings: 60000,
      },
      {
        file: 'src/second.ts',
        complexity: 15,
        churn: 10,
        dependents: 5,
        busFactor: 2,
        impactScore: 0.7,
        estimatedCostSavings: 15000,
      },
    ]

    const result = formatNext(suggestions)

    // First suggestion gets detailed treatment
    expect(result).toContain('Highest-impact fix')
    expect(result).toContain('src/top.ts')
    expect(result).toContain('Why this file')

    // Second suggestion gets summary line with #2
    expect(result).toContain('#2')
    expect(result).toContain('src/second.ts')
  })
})
