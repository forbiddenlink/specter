/**
 * Graph provenance
 *
 * The edit hook puts text from `.specter/graph.json` into an agent's context, and a
 * repository can ship any file it likes, including that one. So the hook only uses a
 * graph whose exact bytes this user's Specter wrote: every save records a SHA-256 of
 * the content in a private per-user registry, and the hook checks the bytes it is
 * about to parse against it. No match, no brief.
 */

import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function registryDir(): string {
  return process.env['SPECTER_CACHE_DIR']
    ? path.join(process.env['SPECTER_CACHE_DIR'], 'graphs')
    : path.join(os.homedir(), '.cache', 'specter', 'graphs')
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function entryFor(rootDir: string): string {
  let real = path.resolve(rootDir)
  try {
    real = fs.realpathSync(real)
  } catch {
    // keep the resolved path
  }
  return path.join(registryDir(), `${sha256(real)}.json`)
}

/** Record that this machine wrote `content` as the graph for `rootDir`. */
export function recordGraph(rootDir: string, content: string): void {
  const dir = registryDir()
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const target = entryFor(rootDir)
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ sha256: sha256(content) }), { mode: 0o600, flag: 'wx' })
  fs.renameSync(temp, target)
}

/** True only when `content` is byte-for-byte the graph this machine last wrote for `rootDir`. */
export function isRecordedGraph(rootDir: string, content: string | Buffer): boolean {
  try {
    const entry = JSON.parse(fs.readFileSync(entryFor(rootDir), 'utf-8')) as { sha256?: string }
    return typeof entry.sha256 === 'string' && entry.sha256 === sha256(content)
  } catch {
    return false
  }
}
