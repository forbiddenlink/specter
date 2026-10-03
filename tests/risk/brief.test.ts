/**
 * @vitest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode, KnowledgeGraph } from '../../src/graph/types.js'
import { runHook } from '../../src/risk/agent-hook.js'
import { buildFileBrief, renderAgentBrief } from '../../src/risk/brief.js'

let root: string

function fileNode(filePath: string, commits: number, complexity = 1): GraphNode[] {
  return [
    {
      id: filePath,
      type: 'file',
      name: path.basename(filePath),
      filePath,
      lineStart: 1,
      lineEnd: 10,
      exported: true,
      modificationCount: commits,
      contributors: ['Liz'],
    },
    {
      id: `${filePath}:fn`,
      type: 'function',
      name: 'work',
      filePath,
      lineStart: 1,
      lineEnd: 5,
      exported: true,
      complexity,
    },
  ]
}

function graphOf(
  nodes: GraphNode[],
  edges: GraphEdge[],
  coChange: KnowledgeGraph['coChange']
): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: '2026-10-03T00:00:00Z',
      scanDurationMs: 1,
      rootDir: root,
      fileCount: nodes.filter((n) => n.type === 'file').length,
      totalLines: 0,
      languages: {},
      nodeCount: nodes.length,
      edgeCount: edges.length,
      authorCount: 1,
    },
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges,
    coChange,
  }
}

const imp = (source: string, target: string): GraphEdge => ({
  id: `${source}>${target}`,
  source,
  target,
  type: 'imports',
})

function touch(file: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), '')
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-brief-'))
  for (const f of [
    'src/core.ts',
    'src/quiet.ts',
    'src/schema.ts',
    'src/linked.ts',
    'src/core.test.ts',
  ])
    touch(f)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('renderAgentBrief', () => {
  it('stays silent for an unremarkable file', () => {
    const graph = graphOf([...fileNode('src/quiet.ts', 2), ...fileNode('src/core.ts', 3)], [], {})
    expect(renderAgentBrief(buildFileBrief(graph, root, 'src/quiet.ts'))).toBeNull()
  })

  it('names strong co-change partners, unlinked ones first, plus the test file', () => {
    const graph = graphOf(
      [
        ...fileNode('src/core.ts', 10),
        ...fileNode('src/schema.ts', 8),
        ...fileNode('src/linked.ts', 8),
      ],
      [imp('src/core.ts', 'src/linked.ts')],
      {
        'src/core.ts': [
          { file: 'src/linked.ts', shared: 9, confidence: 0.9 },
          { file: 'src/schema.ts', shared: 6, confidence: 0.6 },
        ],
      }
    )
    const text = renderAgentBrief(buildFileBrief(graph, root, 'src/core.ts')) ?? ''
    expect(text.indexOf('src/schema.ts')).toBeLessThan(text.indexOf('src/linked.ts'))
    expect(text).toContain('src/schema.ts (60% of its changes, 6 commits, no import link)')
    expect(text).toContain('Tests: src/core.test.ts')
    expect(text.split('\n').length).toBeLessThanOrEqual(6)
  })

  it('states the repo-measured hit rate, and goes quiet where co-change proved unreliable', () => {
    const make = (precision: number, predictions: number) => {
      const graph = graphOf([...fileNode('src/core.ts', 10), ...fileNode('src/schema.ts', 8)], [], {
        'src/core.ts': [{ file: 'src/schema.ts', shared: 6, confidence: 0.6 }],
      })
      graph.metadata.coChangeAccuracy = { precision, predictions }
      return renderAgentBrief(buildFileBrief(graph, root, 'src/core.ts'))
    }
    expect(make(0.51, 120)).toContain('held 51% of the time')
    expect(make(0.1, 120)).toBeNull()
    // Too few predictions to judge: keep the line, without a claimed rate
    expect(make(0.1, 5)).not.toContain('held')
    expect(make(0.1, 5)).toContain('src/schema.ts')
  })

  it('drops partners below the support or confidence thresholds', () => {
    const graph = graphOf([...fileNode('src/core.ts', 10), ...fileNode('src/schema.ts', 8)], [], {
      'src/core.ts': [
        { file: 'src/schema.ts', shared: 4, confidence: 0.9 },
        { file: 'src/linked.ts', shared: 9, confidence: 0.4 },
      ],
    })
    expect(renderAgentBrief(buildFileBrief(graph, root, 'src/core.ts'))).toBeNull()
  })

  it('ignores partners that no longer exist on disk', () => {
    const graph = graphOf([...fileNode('src/core.ts', 10)], [], {
      'src/core.ts': [{ file: 'src/deleted.ts', shared: 9, confidence: 0.9 }],
    })
    expect(renderAgentBrief(buildFileBrief(graph, root, 'src/core.ts'))).toBeNull()
  })

  it('reports wide fan-in', () => {
    const importers = ['a', 'b', 'c', 'd', 'e'].map((n) => `src/${n}.ts`)
    const graph = graphOf(
      [...fileNode('src/core.ts', 1), ...importers.flatMap((f) => fileNode(f, 1))],
      importers.map((f) => imp(f, 'src/core.ts')),
      {}
    )
    expect(renderAgentBrief(buildFileBrief(graph, root, 'src/core.ts'))).toContain(
      'Imported by 5 files'
    )
  })

  it('flags a top hotspot only when it is also complex', () => {
    const others = Array.from({ length: 20 }, (_, i) => fileNode(`src/f${i}.ts`, 2, 2)).flat()
    const hot = graphOf([...fileNode('src/core.ts', 40, 30), ...others], [], {})
    expect(renderAgentBrief(buildFileBrief(hot, root, 'src/core.ts'))).toContain('Hotspot: top')

    const simple = graphOf([...fileNode('src/core.ts', 40, 5), ...others], [], {})
    expect(renderAgentBrief(buildFileBrief(simple, root, 'src/core.ts'))).toBeNull()
  })

  it('hides owners on solo projects', () => {
    const graph = graphOf(fileNode('src/core.ts', 3), [], {})
    expect(buildFileBrief(graph, root, 'src/core.ts').owners).toEqual([])
  })
})

describe('runHook', () => {
  function writeGraph(): void {
    const importers = ['a', 'b', 'c', 'd', 'e'].map((n) => `src/${n}.ts`)
    const graph = graphOf(
      [...fileNode('src/core.ts', 1), ...importers.flatMap((f) => fileNode(f, 1))],
      importers.map((f) => imp(f, 'src/core.ts')),
      {}
    )
    fs.mkdirSync(path.join(root, '.specter'), { recursive: true })
    fs.writeFileSync(path.join(root, '.specter', 'graph.json'), JSON.stringify(graph))
  }

  it('returns PreToolUse additionalContext for a risky file', () => {
    writeGraph()
    const out = runHook({
      tool_name: 'Edit',
      tool_input: { file_path: path.join(root, 'src/core.ts') },
    })
    expect(out).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: expect.stringContaining('Imported by 5'),
      },
    })
    // Never makes a permission decision on the user's behalf
    expect(JSON.stringify(out)).not.toContain('permissionDecision')
  })

  it('briefs each file once per session', () => {
    writeGraph()
    const seen = new Set<string>()
    const input = { tool_name: 'Write', tool_input: { file_path: path.join(root, 'src/core.ts') } }
    expect(runHook(input, seen)).not.toBeNull()
    expect(runHook(input, seen)).toBeNull()
  })

  it('is a no-op for other tools, missing graphs, and files outside the repo', () => {
    expect(runHook({ tool_name: 'Bash', tool_input: {} })).toBeNull()
    expect(
      runHook({ tool_name: 'Edit', tool_input: { file_path: path.join(root, 'src/core.ts') } })
    ).toBeNull()
    writeGraph()
    expect(
      runHook({ tool_name: 'Edit', tool_input: { file_path: path.join(os.tmpdir(), 'x.ts') } })
    ).toBeNull()
  })

  it('resolves a relative file_path against cwd', () => {
    writeGraph()
    expect(
      runHook({ tool_name: 'Edit', cwd: root, tool_input: { file_path: 'src/core.ts' } })
    ).not.toBeNull()
  })
})
