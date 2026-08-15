/**
 * Drift Tests
 *
 * Architecture drift detection. detectDrift only reads the graph (its
 * rootDir arg is unused), so these are deterministic known-answer tests.
 */

import { describe, expect, it } from 'vitest'
import { type DriftResult, detectDrift, formatDrift } from '../src/drift.js'
import type { GraphEdge, GraphNode, KnowledgeGraph } from '../src/graph/types.js'

function fileNode(filePath: string, complexity?: number): GraphNode {
  return {
    id: filePath,
    type: 'file',
    name: filePath.split('/').pop() ?? filePath,
    filePath,
    lineStart: 1,
    lineEnd: 100,
    exported: true,
    ...(complexity !== undefined ? { complexity } : {}),
  }
}

function importEdge(from: string, to: string): GraphEdge {
  return { id: `${from}->${to}`, source: from, target: to, type: 'imports' }
}

function graph(nodes: GraphNode[], edges: GraphEdge[] = []): KnowledgeGraph {
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
      edgeCount: edges.length,
    },
    nodes: nodeMap,
    edges,
  }
}

/** N import edges from one source to N distinct synthetic targets. */
function fanOutImports(source: string, count: number): GraphEdge[] {
  return Array.from({ length: count }, (_, i) => importEdge(source, `dep${i}.ts`))
}

/** N import edges from N distinct sources into one target. */
function fanInImports(target: string, count: number): GraphEdge[] {
  return Array.from({ length: count }, (_, i) => importEdge(`src${i}.ts`, target))
}

describe('detectDrift', () => {
  it('reports a perfect score and no violations for a clean graph', async () => {
    const result = await detectDrift('/x', graph([fileNode('a.ts', 3), fileNode('b.ts', 4)]))
    expect(result.violations).toEqual([])
    expect(result.score).toBe(100)
    expect(result.summary.total).toBe(0)
    expect(result.summary.cleanFiles).toBe(2)
    expect(result.summary.totalFiles).toBe(2)
  })

  it('flags complexity over 30 as high severity', async () => {
    const result = await detectDrift('/x', graph([fileNode('big.ts', 35)]))
    const v = result.violations.find((x) => x.type === 'complexity')!
    expect(v.severity).toBe('high')
    expect(result.summary.byType.complexity).toBe(1)
    // 1 high penalty (10) over maxPenalty max(1*5,100)=100 -> 90
    expect(result.score).toBe(90)
  })

  it('flags complexity between 20 and 30 as medium severity', async () => {
    const result = await detectDrift('/x', graph([fileNode('med.ts', 25)]))
    expect(result.violations[0]!.severity).toBe('medium')
  })

  it('flags a file 2x above average (but <=20) as low severity', async () => {
    // avg of [3,3,3,15] = 6; 15 > 12 and > 10, and <= 20 -> low
    const result = await detectDrift(
      '/x',
      graph([fileNode('a.ts', 3), fileNode('b.ts', 3), fileNode('c.ts', 3), fileNode('d.ts', 15)])
    )
    const v = result.violations.find((x) => x.file === 'd.ts')!
    expect(v.type).toBe('complexity')
    expect(v.severity).toBe('low')
  })

  it('flags files importing more than 15 modules as a dependency violation', async () => {
    const result = await detectDrift(
      '/x',
      graph([fileNode('hub.ts', 1)], fanOutImports('hub.ts', 16))
    )
    const v = result.violations.find((x) => x.type === 'dependency')!
    expect(v.severity).toBe('medium')
    expect(v.file).toBe('hub.ts')
  })

  it('flags files imported by more than 20 others as a coupling violation', async () => {
    const result = await detectDrift(
      '/x',
      graph([fileNode('core.ts', 1)], fanInImports('core.ts', 21))
    )
    const v = result.violations.find((x) => x.type === 'coupling')!
    expect(v.severity).toBe('medium')
    expect(v.file).toBe('core.ts')
  })

  it('flags a UI file importing from models as a high-severity layering violation', async () => {
    const nodes = [fileNode('src/components/button.ts', 1), fileNode('src/models/user.ts', 1)]
    const edges = [importEdge('src/components/button.ts', 'src/models/user.ts')]
    const result = await detectDrift('/x', graph(nodes, edges))
    const v = result.violations.find((x) => x.type === 'layering')!
    expect(v.severity).toBe('high')
    expect(v.file).toBe('src/components/button.ts')
    expect(v.message).toContain('models')
  })

  it('sorts violations with high severity first', async () => {
    // high complexity (35) + a low-severity dependency (11 imports)
    const result = await detectDrift(
      '/x',
      graph([fileNode('big.ts', 35), fileNode('hub.ts', 1)], fanOutImports('hub.ts', 11))
    )
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
    expect(result.violations[0]!.severity).toBe('high')
  })
})

describe('formatDrift', () => {
  it('renders a clean message and 100 score when there is no drift', () => {
    const result: DriftResult = {
      violations: [],
      score: 100,
      summary: {
        total: 0,
        byType: { complexity: 0, dependency: 0, layering: 0, coupling: 0 },
        bySeverity: { low: 0, medium: 0, high: 0 },
        cleanFiles: 5,
        totalFiles: 5,
      },
    }
    const out = formatDrift(result)
    expect(out).toContain('No architectural drift detected!')
    expect(out).toContain('Drift Score: 100/100')
  })

  it('renders score, grouped violations, and recommendations', () => {
    const result: DriftResult = {
      violations: [
        {
          type: 'layering',
          severity: 'high',
          file: 'src/components/x.ts',
          message: 'ui layer imports from models',
          suggestion: 'fix layers',
        },
      ],
      score: 55,
      summary: {
        total: 1,
        byType: { complexity: 0, dependency: 0, layering: 1, coupling: 0 },
        bySeverity: { low: 0, medium: 0, high: 1 },
        cleanFiles: 4,
        totalFiles: 5,
      },
    }
    const out = formatDrift(result)
    expect(out).toContain('DRIFT SCORE')
    expect(out).toContain('55/100')
    expect(out).toContain('LAYERING VIOLATIONS')
    expect(out).toContain('src/components/x.ts')
    expect(out).toContain('Address high-severity issues first')
  })
})
