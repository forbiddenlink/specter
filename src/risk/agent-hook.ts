/**
 * Claude Code PreToolUse hook logic: Edit/Write in, change-risk brief out.
 */

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

/** Files already briefed this session, so repeated edits do not repeat the brief */
export function sessionStore(sessionId: string | undefined) {
  const safe = (sessionId ?? '').replace(/[^\w-]/g, '')
  if (!safe) return { seen: undefined, save: () => {} }
  const file = path.join(os.tmpdir(), 'specter-hook', `${safe}.json`)
  let seen = new Set<string>()
  try {
    seen = new Set(JSON.parse(fs.readFileSync(file, 'utf-8')) as string[])
  } catch {
    // first edit in this session
  }
  return {
    seen,
    save: () => {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify([...seen]))
    },
  }
}
