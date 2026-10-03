/**
 * Claude Code PreToolUse hook logic: Edit/Write in, change-risk brief out.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { KnowledgeGraph } from '../graph/types.js'
import { buildFileBrief, renderAgentBrief } from './brief.js'

export interface HookInput {
  session_id?: string
  cwd?: string
  hook_event_name?: string
  tool_name?: string
  tool_input?: { file_path?: string; notebook_path?: string }
}

export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])

/** Walk up from `start` to the directory holding `.specter/graph.json`. */
export function findGraphRoot(start: string): string | null {
  let dir = path.resolve(start)
  for (;;) {
    if (fs.existsSync(path.join(dir, '.specter', 'graph.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Pure core: hook input in, hook output object (or null for no-op) out.
 */
export function runHook(input: HookInput, seen?: Set<string>): object | null {
  if (!input.tool_name || !EDIT_TOOLS.has(input.tool_name)) return null
  const target = input.tool_input?.file_path
  if (!target) return null

  const absolute = path.resolve(input.cwd ?? process.cwd(), target)
  const root = findGraphRoot(path.dirname(absolute))
  if (!root) return null

  const relative = path.relative(root, absolute)
  if (relative.startsWith('..')) return null
  if (seen?.has(absolute)) return null

  if (!isLocallyBuiltGraph(root)) return null

  const graph = JSON.parse(
    fs.readFileSync(path.join(root, '.specter', 'graph.json'), 'utf-8')
  ) as KnowledgeGraph
  const text = renderAgentBrief(buildFileBrief(graph, root, relative))
  if (!text) return null

  seen?.add(absolute)
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: text,
    },
  }
}

/**
 * The graph's text goes straight into the agent's context, so only trust a graph
 * this machine built. A repository could commit a crafted `.specter/graph.json`
 * (or symlink it elsewhere) to smuggle instructions into every edit.
 */
export function isLocallyBuiltGraph(root: string): boolean {
  try {
    const dir = path.join(root, '.specter')
    if (fs.lstatSync(dir).isSymbolicLink()) return false
    if (fs.lstatSync(path.join(dir, 'graph.json')).isSymbolicLink()) return false
  } catch {
    return false
  }
  try {
    const tracked = execFileSync('git', ['ls-files', '--', '.specter'], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return tracked.trim() === ''
  } catch {
    // Not a git repo (or git missing): nothing could have shipped the graph to us
    return true
  }
}

const SESSION_DIR = path.join(os.homedir(), '.cache', 'specter', 'hook-sessions')
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Files already briefed this session, so repeated edits do not repeat the brief */
export function sessionStore(sessionId: string | undefined, dir: string = SESSION_DIR) {
  const safe = (sessionId ?? '').replace(/[^\w-]/g, '')
  if (!safe) return { seen: undefined, save: () => {} }
  const file = path.join(dir, `${safe}.json`)
  let seen = new Set<string>()
  let isNew = true
  try {
    seen = new Set(JSON.parse(fs.readFileSync(file, 'utf-8')) as string[])
    isNew = false
  } catch {
    // first edit in this session
  }
  return {
    seen,
    save: () => {
      // Per-user and private: not the shared temp dir another user could pre-create
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      // Hooks for parallel edits in one session race: merge with what is on disk now
      try {
        for (const f of JSON.parse(fs.readFileSync(file, 'utf-8')) as string[]) seen.add(f)
      } catch {
        // nothing saved yet
      }
      const temp = `${file}.${process.pid}.${Date.now()}.tmp`
      fs.writeFileSync(temp, JSON.stringify([...seen]), { mode: 0o600, flag: 'wx' })
      fs.renameSync(temp, file)
      if (isNew) pruneOldSessions(dir)
    },
  }
}

function pruneOldSessions(dir: string): void {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    try {
      if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full)
    } catch {
      // raced with another session's prune
    }
  }
}
