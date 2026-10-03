/**
 * Changed-file detection for incremental scans
 */

import { simpleGit } from 'simple-git'
import type { KnowledgeGraph } from './types.js'

/** Changing any of these can change how every file resolves, so they force a full scan */
const FULL_RESCAN_TRIGGERS = /(^|\/)(tsconfig[^/]*\.json|jsconfig\.json|package\.json)$/

/** Above this share of known files changed, a full scan is about as fast and simpler */
const MAX_INCREMENTAL_SHARE = 0.4

/**
 * Files (relative to rootDir) that changed since the graph was built: commits since
 * `metadata.headCommit`, uncommitted edits, and untracked files.
 *
 * Returns null when an incremental update is not safe: no recorded commit, the
 * commit is gone (rebase, shallow clone), a resolution config changed, or most of
 * the repo changed. The caller then does a full scan.
 */
export async function getChangedFiles(
  rootDir: string,
  graph: KnowledgeGraph
): Promise<string[] | null> {
  const since = graph.metadata.headCommit
  if (!since) return null

  const git = simpleGit(rootDir)
  try {
    await git.raw(['cat-file', '-e', `${since}^{commit}`])
    // Commit vs working tree: covers new commits and uncommitted edits in one call
    const diff = await git.raw(['diff', '--name-only', '--no-renames', '--relative', since])
    const untracked = await git.raw(['ls-files', '--others', '--exclude-standard'])

    const changed = [
      ...new Set([...diff.split('\n'), ...untracked.split('\n')].map((f) => f.trim())),
    ].filter(Boolean)

    if (changed.some((f) => FULL_RESCAN_TRIGGERS.test(f))) return null
    if (changed.length > Math.max(50, graph.metadata.fileCount * MAX_INCREMENTAL_SHARE)) {
      return null
    }
    return changed
  } catch {
    return null
  }
}
