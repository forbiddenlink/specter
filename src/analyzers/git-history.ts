/**
 * Single-pass git history mining
 *
 * Reads the whole history window with ONE `git log --name-only` call and derives
 * per-file churn, ownership and change coupling (co-change) from it. The previous
 * approach spawned one `git log` per file, which took minutes on large repos and
 * capped churn at the per-file commit limit.
 */

import type { SimpleGit } from 'simple-git'
import type { CoChangePartner, GitFileHistory } from '../graph/types.js'

export type { CoChangePartner }

export interface MinedCommit {
  hash: string
  author: string
  email: string
  date: string
  subject: string
  files: string[]
}

export interface CoChangeOptions {
  /** Ignore commits that touch more files than this (bulk renames, formatting, lockfile bumps) */
  maxFilesPerCommit?: number
  /** Minimum commits two files must share before the pair is reported */
  minShared?: number
  /** Minimum confidence (shared / target commits) before the pair is reported */
  minConfidence?: number
  /** Partners kept per file */
  maxPartners?: number
}

const RECORD_SEP = '\x1e'
const FIELD_SEP = '\x1f'

/** Files that change in lockstep for mechanical reasons and carry no design signal */
const NOISE_FILE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|CHANGELOG\.md)$/

/**
 * Run the single git log call. Returns raw output for parseGitLog.
 */
export async function readGitLog(git: SimpleGit, maxCommits: number): Promise<string> {
  return git.raw([
    // Literal UTF-8 paths instead of "\303\251"-style quoting
    '-c',
    'core.quotePath=false',
    'log',
    // A user's diff.relative=true would make paths subdirectory-relative; callers strip the prefix themselves
    '--no-relative',
    '--no-merges',
    '--no-renames',
    `--max-count=${maxCommits}`,
    `--format=${RECORD_SEP}%H${FIELD_SEP}%aN${FIELD_SEP}%aE${FIELD_SEP}%aI${FIELD_SEP}%s`,
    '--name-only',
  ])
}

/**
 * Parse `git log --name-only` output produced by readGitLog. Newest commit first.
 */
export function parseGitLog(raw: string): MinedCommit[] {
  const commits: MinedCommit[] = []

  for (const record of raw.split(RECORD_SEP)) {
    if (!record.trim()) continue
    const [header = '', ...fileLines] = record.split('\n')
    const [hash, author, email, date, subject] = header.split(FIELD_SEP)
    if (!hash || !date) continue

    commits.push({
      hash,
      author: author ?? '',
      email: email ?? '',
      date,
      subject: subject ?? '',
      files: fileLines.map((f) => f.replace(/\r$/, '')).filter(Boolean),
    })
  }

  return commits
}

/**
 * Per-file churn and ownership for the given files.
 */
export function summarizeFileHistories(
  commits: MinedCommit[],
  filePaths: Iterable<string>
): Map<string, GitFileHistory> {
  const wanted = new Set(filePaths)
  const byFile = new Map<string, MinedCommit[]>()

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!wanted.has(file)) continue
      const list = byFile.get(file)
      if (list) list.push(commit)
      else byFile.set(file, [commit])
    }
  }

  const histories = new Map<string, GitFileHistory>()

  for (const [filePath, fileCommits] of byFile) {
    const contributorMap = new Map<
      string,
      { name: string; email: string; commits: number; lastCommit: string }
    >()

    for (const commit of fileCommits) {
      const existing = contributorMap.get(commit.email)
      if (existing) {
        existing.commits++
        if (commit.date > existing.lastCommit) existing.lastCommit = commit.date
      } else {
        contributorMap.set(commit.email, {
          name: commit.author,
          email: commit.email,
          commits: 1,
          lastCommit: commit.date,
        })
      }
    }

    const contributors = [...contributorMap.values()].sort((a, b) => b.commits - a.commits)

    histories.set(filePath, {
      filePath,
      lastModified: fileCommits[0]?.date ?? '',
      commitCount: fileCommits.length,
      contributorCount: contributors.length,
      contributors,
      recentCommits: fileCommits.slice(0, 10).map((c) => ({
        hash: c.hash.substring(0, 7),
        message: c.subject.substring(0, 80),
        author: c.author,
        date: c.date,
      })),
    })
  }

  return histories
}

/**
 * Change coupling: which files tend to change in the same commit.
 *
 * Only pairs inside `filePaths` are counted, so docs and config churn do not
 * dominate. Huge commits are skipped because a 200-file reformat says nothing
 * about which files depend on each other.
 */
export function computeCoChange(
  commits: MinedCommit[],
  filePaths: Iterable<string>,
  options: CoChangeOptions = {}
): Record<string, CoChangePartner[]> {
  const { maxFilesPerCommit = 30, minShared = 3, minConfidence = 0.3, maxPartners = 5 } = options
  const wanted = new Set(filePaths)
  const commitCount = new Map<string, number>()
  const pairCount = new Map<string, Map<string, number>>()

  for (const commit of commits) {
    const files = [...new Set(commit.files)].filter((f) => wanted.has(f) && !NOISE_FILE.test(f))
    if (files.length === 0 || files.length > maxFilesPerCommit) continue

    for (const file of files) {
      commitCount.set(file, (commitCount.get(file) ?? 0) + 1)
    }

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const a = files[i] as string
        const b = files[j] as string
        bump(pairCount, a, b)
        bump(pairCount, b, a)
      }
    }
  }

  const result: Record<string, CoChangePartner[]> = {}

  for (const [file, partners] of pairCount) {
    const total = commitCount.get(file) ?? 0
    if (total === 0) continue

    const kept: CoChangePartner[] = []
    for (const [other, shared] of partners) {
      const confidence = shared / total
      if (shared >= minShared && confidence >= minConfidence) {
        kept.push({ file: other, shared, confidence: Math.round(confidence * 100) / 100 })
      }
    }

    if (kept.length > 0) {
      kept.sort((x, y) => y.confidence - x.confidence || y.shared - x.shared)
      result[file] = kept.slice(0, maxPartners)
    }
  }

  return result
}

function bump(map: Map<string, Map<string, number>>, a: string, b: string): void {
  let inner = map.get(a)
  if (!inner) {
    inner = new Map()
    map.set(a, inner)
  }
  inner.set(b, (inner.get(b) ?? 0) + 1)
}

const BOT_AUTHOR = /\[bot\]|(^|[^a-z])bot@|-bot\b|noreply@anthropic\.com|^copilot$/i

/**
 * Count distinct human authors across the mined window. Bots and coding agents
 * are skipped, and identities that share a name or an email are merged, since
 * one person commonly commits under several emails.
 */
export function countAuthors(commits: MinedCommit[]): number {
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = k
    while (parent.get(root) !== root) root = parent.get(root) as string
    parent.set(k, root)
    return root
  }
  const union = (a: string, b: string): void => {
    for (const k of [a, b]) if (!parent.has(k)) parent.set(k, k)
    parent.set(find(a), find(b))
  }

  for (const { author, email } of commits) {
    if (BOT_AUTHOR.test(author) || BOT_AUTHOR.test(email)) continue
    union(`name:${author.trim().toLowerCase()}`, `email:${email.trim().toLowerCase()}`)
  }
  return new Set([...parent.keys()].map(find)).size
}
