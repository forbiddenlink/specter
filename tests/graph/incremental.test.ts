/**
 * Incremental scan equivalence: updating a graph with only the changed files must
 * produce the same graph as a full rescan. Runs against a real temporary git repo.
 *
 * @vitest-environment node
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildKnowledgeGraph, updateGraphIncremental } from '../../src/graph/builder.js'
import { getChangedFiles } from '../../src/graph/changes.js'
import type { KnowledgeGraph } from '../../src/graph/types.js'

// Real git + ts-morph work: give each test room on a loaded machine
vi.setConfig({ testTimeout: 30_000 })

let dir: string

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      // Temp repo must not inherit the developer's global config (hooks, commit signing)
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  })
}

function write(file: string, content: string): void {
  const full = path.join(dir, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function commit(message: string): void {
  git('add', '-A')
  git('commit', '-q', '-m', message)
}

/** Everything that matters about a graph, minus timings and ids */
function shape(graph: KnowledgeGraph) {
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes).map(([id, node]) => {
      const { lastModified: _lm, ...rest } = node
      return [id, rest]
    })
  )
  const edges = graph.edges.map((e) => `${e.type}:${e.source}->${e.target}`).sort()
  const { scannedAt: _s, scanDurationMs: _d, ...metadata } = graph.metadata
  return { nodes, edges, metadata, coChange: graph.coChange }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-incr-'))
  git('init', '-q')
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }))
  write('src/util.ts', 'export function add(a: number, b: number) { return a + b }\n')
  write('src/api.ts', "import { add } from '@/util'\nexport const total = () => add(1, 2)\n")
  write('src/old.ts', "import { add } from './util'\nexport const legacy = add(2, 2)\n")
  write('src/consumer.ts', "import { legacy } from './old'\nexport const x = legacy\n")
  commit('initial')
  for (let i = 0; i < 3; i++) {
    write('src/util.ts', `export function add(a: number, b: number) { return a + b + ${i} }\n`)
    write('src/api.ts', `import { add } from '@/util'\nexport const total = () => add(1, ${i})\n`)
    commit(`change ${i}`)
  }
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('updateGraphIncremental', () => {
  it('matches a full rescan after edits, a deletion, an addition and a new commit', async () => {
    const before = (await buildKnowledgeGraph({ rootDir: dir })).graph
    expect(before.metadata.headCommit).toBeTruthy()

    // Committed change, uncommitted edit, deletion, untracked addition
    write(
      'src/util.ts',
      'export function add(a: number, b: number) { if (a > b) { return a } return b }\n'
    )
    commit('committed edit')
    write(
      'src/api.ts',
      "import { add } from '@/util'\nimport { fresh } from './fresh'\nexport const total = () => add(1, fresh)\n"
    )
    fs.rmSync(path.join(dir, 'src/old.ts'))
    write('src/fresh.ts', 'export const fresh = 7\n')

    const changed = await getChangedFiles(dir, before)
    expect(changed).not.toBeNull()
    expect(new Set(changed)).toEqual(
      new Set(['src/util.ts', 'src/api.ts', 'src/old.ts', 'src/fresh.ts'])
    )

    const incremental = (await updateGraphIncremental(before, changed ?? [], { rootDir: dir }))
      .graph
    const full = (await buildKnowledgeGraph({ rootDir: dir })).graph

    expect(shape(incremental)).toEqual(shape(full))
    // consumer.ts imported the deleted file: its stale edge must be gone
    expect(incremental.edges.some((e) => e.target === 'src/old.ts')).toBe(false)
  })

  it('falls back to a full scan when tsconfig changes', async () => {
    const before = (await buildKnowledgeGraph({ rootDir: dir })).graph
    write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '~/*': ['./src/*'] } } }))
    expect(await getChangedFiles(dir, before)).toBeNull()
  })

  it('falls back to a full scan for graphs without a recorded commit', async () => {
    const before = (await buildKnowledgeGraph({ rootDir: dir })).graph
    delete before.metadata.headCommit
    expect(await getChangedFiles(dir, before)).toBeNull()
  })
})

describe('full build', () => {
  it('resolves tsconfig path aliases into import edges', async () => {
    const graph = (await buildKnowledgeGraph({ rootDir: dir })).graph
    const edges = graph.edges
      .filter((e) => e.type === 'imports')
      .map((e) => `${e.source}->${e.target}`)
    expect(edges).toContain('src/api.ts->src/util.ts')
    expect(edges).toContain('src/consumer.ts->src/old.ts')
  })

  it('records churn from a single history pass and co-change between files', async () => {
    const graph = (await buildKnowledgeGraph({ rootDir: dir })).graph
    expect(graph.nodes['src/util.ts']?.modificationCount).toBe(4)
    expect(graph.metadata.authorCount).toBe(1)
    const partners = graph.coChange?.['src/util.ts'] ?? []
    expect(partners[0]).toMatchObject({ file: 'src/api.ts', shared: 4, confidence: 1 })
  })
})
