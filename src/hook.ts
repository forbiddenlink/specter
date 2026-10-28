#!/usr/bin/env node

/**
 * specter-hook: Claude Code PreToolUse hook for Edit/Write.
 *
 * Before an agent edits a file, injects a short change-risk brief as
 * `additionalContext`. Prints nothing (a no-op) when the repo has no Specter graph,
 * the file is unremarkable, or this session already saw the brief for this file.
 * Never blocks the edit and never fails loudly: any error means no output.
 *
 * Deliberately imports only the brief module, so it starts fast on every edit.
 */

import { type HookInput, runHook, sessionStore } from './risk/agent-hook.js'

async function main(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  const input = JSON.parse(Buffer.concat(chunks).toString() || '{}') as HookInput

  const store = sessionStore(input.session_id)
  const output = runHook(input, store.seen)
  if (output) {
    store.save()
    process.stdout.write(JSON.stringify(output))
  }
}

main().catch(() => {
  // A hook must never break the edit it observes
})
