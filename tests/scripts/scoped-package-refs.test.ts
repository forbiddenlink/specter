// @vitest-environment node
/**
 * The unscoped npm package `specter-mcp` belongs to an unrelated author.
 * Any `npx`/`npm install` of it runs a stranger's code, so every launch or
 * install instruction must use the scoped `@purplegumdropz/specter` package.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !/(^|\/)(pnpm-lock\.yaml|package-lock\.json|CHANGELOG\.md)$/.test(f))
  .filter((f) => f !== 'tests/scripts/scoped-package-refs.test.ts')

// `npx [flags] specter-mcp`, `npm i[nstall] [flags] specter-mcp`, same for pnpm/yarn/bunx dlx
const UNSCOPED =
  /\b(?:npx|bunx|pnpm\s+(?:dlx|add)|yarn\s+(?:dlx|add)|npm\s+(?:i|install|exec))\s+(?:-{1,2}[\w-]+\s+)*specter-mcp\b/

describe('scoped package references', () => {
  it('matches the unscoped forms it is meant to catch', () => {
    expect(UNSCOPED.test('npx specter-mcp scan')).toBe(true)
    expect(UNSCOPED.test('npx -y specter-mcp')).toBe(true)
    expect(UNSCOPED.test('npm install -g specter-mcp')).toBe(true)
    expect(UNSCOPED.test('"args": ["-y", "specter-mcp"]')).toBe(false)
    expect(UNSCOPED.test('npx -y -p @purplegumdropz/specter specter-mcp')).toBe(false)
    expect(UNSCOPED.test('npm install -g @purplegumdropz/specter')).toBe(false)
  })

  it('has no unscoped specter-mcp npx/npm install in tracked files', () => {
    const offenders = files.flatMap((f) => {
      let text: string
      try {
        text = readFileSync(resolve(root, f), 'utf8')
      } catch {
        return []
      }
      return text
        .split('\n')
        .map((line, i) => ({ f, n: i + 1, line }))
        .filter(({ line }) => UNSCOPED.test(line))
        .map(({ f: file, n, line }) => `${file}:${n}: ${line.trim()}`)
    })
    expect(offenders).toEqual([])
  })

  it('launches the MCP server from the scoped package in the plugin config', () => {
    const cfg = JSON.parse(readFileSync(resolve(root, 'plugin/mcp-config.json'), 'utf8'))
    expect(cfg.mcpServers.specter.args).toEqual([
      '-y',
      '-p',
      '@purplegumdropz/specter',
      'specter-mcp',
    ])
  })
})
