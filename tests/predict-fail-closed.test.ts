// @vitest-environment node
/**
 * Predict must fail closed when the base-branch diff cannot be computed.
 * A swallowed git error used to surface as "0 files, low risk", which the
 * GitHub Action's fail-on-high-risk gate reads as a pass.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { KnowledgeGraph } from '../src/graph/types.js'
import { generatePrediction } from '../src/predict.js'

const emptyGraph = { nodes: {}, edges: [] } as unknown as KnowledgeGraph

function git(dir: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
}

describe('generatePrediction with a base branch', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'specter-predict-'))
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'config', 'user.email', 't@example.com')
    git(dir, 'config', 'user.name', 'T')
    git(dir, 'config', 'commit.gpgsign', 'false')
    git(dir, 'config', 'core.hooksPath', '/dev/null')
    writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1\n')
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'init')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('throws instead of reporting low risk when the base ref does not exist', async () => {
    await expect(
      generatePrediction(dir, emptyGraph, { baseBranch: 'origin/does-not-exist' })
    ).rejects.toThrow(/does-not-exist/)
  })

  it('still reports no changes (low risk) when the diff genuinely is empty', async () => {
    const result = await generatePrediction(dir, emptyGraph, { baseBranch: 'main' })
    expect(result.summary.totalFiles).toBe(0)
    expect(result.summary.overallRisk).toBe('low')
  })
})
