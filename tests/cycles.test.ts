/**
 * Cycles Tests
 *
 * Tests for circular dependency detection (detectCycles) and its
 * formatter (formatCycles). detectCycles is a pure graph algorithm,
 * so these are deterministic known-answer tests.
 */

import { describe, expect, it } from 'vitest'
import { type CyclesResult, detectCycles, formatCycles } from '../src/cycles.js'
import type { GraphEdge, GraphNode, KnowledgeGraph } from '../src/graph/types.js'

/** Build a file node whose id equals its filePath for simple wiring. */
function fileNode(filePath: string): GraphNode {
  return {
    id: filePath,
    type: 'file',
    name: filePath.split('/').pop() ?? filePath,
    filePath,
    lineStart: 1,
    lineEnd: 100,
    exported: true,
  }
}

/** An `imports` edge: `from` depends on `to`. */
function importEdge(from: string, to: string): GraphEdge {
  return { id: `${from}->${to}`, source: from, target: to, type: 'imports' }
}

/**
 * Build a graph from a list of import pairs. Any file referenced in a
 * pair is registered as a file node automatically.
 */
function graphFromImports(pairs: Array<[string, string]>): KnowledgeGraph {
  const files = new Set<string>()
  for (const [from, to] of pairs) {
    files.add(from)
    files.add(to)
  }

  const nodes: Record<string, GraphNode> = {}
  for (const f of files) {
    nodes[f] = fileNode(f)
  }

  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date('2020-01-01').toISOString(),
      scanDurationMs: 1,
      rootDir: '/test',
      fileCount: files.size,
      totalLines: files.size * 100,
      languages: { typescript: files.size },
      nodeCount: files.size,
      edgeCount: pairs.length,
    },
    nodes,
    edges: pairs.map(([from, to]) => importEdge(from, to)),
  }
}

describe('detectCycles', () => {
  it('reports no cycles for an acyclic graph', () => {
    // a -> b -> c (a straight chain, no back-edges)
    const graph = graphFromImports([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(0)
    expect(result.cycles).toEqual([])
    expect(result.affectedFiles).toBe(0)
    expect(result.worstCycle).toBeNull()
    expect(result.suggestions).toEqual(['No circular dependencies detected - great job!'])
  })

  it('reports no cycles for an empty graph', () => {
    const result = detectCycles(graphFromImports([]))
    expect(result.totalCycles).toBe(0)
    expect(result.worstCycle).toBeNull()
  })

  it('detects a simple two-file cycle as low severity', () => {
    const graph = graphFromImports([
      ['a.ts', 'b.ts'],
      ['b.ts', 'a.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(1)
    const cycle = result.cycles[0]!
    expect(cycle.length).toBe(2)
    expect(cycle.severity).toBe('low')
    expect(cycle.files.sort()).toEqual(['a.ts', 'b.ts'])
    expect(result.affectedFiles).toBe(2)
    expect(result.worstCycle).toBe(cycle)
  })

  it('de-duplicates the same cycle regardless of traversal start', () => {
    // A triangle a->b->c->a. DFS may re-discover the same loop from
    // different entry points; normalization must collapse it to one.
    const graph = graphFromImports([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'a.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(1)
    expect(result.cycles[0]!.length).toBe(3)
    expect(result.cycles[0]!.severity).toBe('low')
  })

  it('normalizes cycle order to start at the lexicographically smallest file', () => {
    const graph = graphFromImports([
      ['b.ts', 'c.ts'],
      ['c.ts', 'a.ts'],
      ['a.ts', 'b.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.cycles[0]!.files[0]).toBe('a.ts')
  })

  it('classifies a 4-file cycle as medium severity', () => {
    const graph = graphFromImports([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'd.ts'],
      ['d.ts', 'a.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.cycles[0]!.length).toBe(4)
    expect(result.cycles[0]!.severity).toBe('medium')
  })

  it('classifies a 6-file cycle as high severity', () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']
    const pairs = files.map((f, i) => [f, files[(i + 1) % files.length]!] as [string, string])

    const result = detectCycles(graphFromImports(pairs))

    expect(result.cycles[0]!.length).toBe(6)
    expect(result.cycles[0]!.severity).toBe('high')
  })

  it('sorts higher-severity cycles before lower-severity ones', () => {
    // One 2-file (low) cycle and one 4-file (medium) cycle, disjoint.
    const graph = graphFromImports([
      ['a.ts', 'b.ts'],
      ['b.ts', 'a.ts'],
      ['w.ts', 'x.ts'],
      ['x.ts', 'y.ts'],
      ['y.ts', 'z.ts'],
      ['z.ts', 'w.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(2)
    expect(result.cycles[0]!.severity).toBe('medium')
    expect(result.cycles[1]!.severity).toBe('low')
    expect(result.worstCycle).toBe(result.cycles[0])
    expect(result.affectedFiles).toBe(6)
  })

  it('ignores non-import edges when detecting cycles', () => {
    const graph = graphFromImports([['a.ts', 'b.ts']])
    // add a 'calls' back-edge b -> a; should NOT create a cycle
    graph.edges.push({ id: 'b-calls-a', source: 'b.ts', target: 'a.ts', type: 'calls' })

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(0)
  })

  it('suggests refactoring the file that appears in the most cycles', () => {
    // shared.ts is part of two different cycles.
    const graph = graphFromImports([
      ['shared.ts', 'a.ts'],
      ['a.ts', 'shared.ts'],
      ['shared.ts', 'b.ts'],
      ['b.ts', 'shared.ts'],
    ])

    const result = detectCycles(graph)

    expect(result.totalCycles).toBe(2)
    expect(result.suggestions.some((s) => s.includes('shared.ts'))).toBe(true)
  })
})

describe('formatCycles', () => {
  it('renders a clean-graph message when there are no cycles', () => {
    const result: CyclesResult = detectCycles(graphFromImports([['a.ts', 'b.ts']]))
    const out = formatCycles(result)

    expect(out).toContain('No circular dependencies detected!')
    expect(out).toContain('acyclic')
  })

  it('renders summary counts and the worst cycle when cycles exist', () => {
    const result = detectCycles(
      graphFromImports([
        ['a.ts', 'b.ts'],
        ['b.ts', 'a.ts'],
      ])
    )
    const out = formatCycles(result)

    expect(out).toContain('CIRCULAR DEPENDENCY ANALYSIS')
    expect(out).toContain('Total cycles:')
    expect(out).toContain('WORST CYCLE')
    expect(out).toContain('a.ts')
    expect(out).toContain('b.ts')
  })
})
