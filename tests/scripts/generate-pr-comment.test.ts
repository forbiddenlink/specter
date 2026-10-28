// @vitest-environment node
/**
 * The PR comment embeds file paths, warnings and recommendations that come
 * from the pull request itself, so they must not be able to inject markdown,
 * HTML, links or @-mentions into the comment the action posts.
 */

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  escapeMarkdown,
  codeSpan,
  generateComment,
} = require('../../scripts/generate-pr-comment.cjs')

describe('escapeMarkdown', () => {
  it('neutralises links, HTML and mentions', () => {
    const out = escapeMarkdown(
      '[click](https://evil.example) <img src=x onerror=alert(1)> @org/team'
    )
    expect(out).not.toMatch(/\[click\]\(/)
    expect(out).not.toContain('<img')
    expect(out).not.toMatch(/(^|[^\\])@org/)
  })

  it('collapses newlines so a value cannot start a new block', () => {
    expect(escapeMarkdown('a\n# heading\n<!-- x -->')).not.toContain('\n')
  })
})

describe('codeSpan', () => {
  it('cannot be broken out of with backticks', () => {
    const span = codeSpan('src/`x` [y](http://z) @alice.ts')
    // fence must be longer than any backtick run in the content
    const fence = span.match(/^`+/)?.[0] ?? ''
    expect(fence.length).toBeGreaterThan(1)
    expect(span.endsWith(fence)).toBe(true)
  })

  it('collapses newlines', () => {
    expect(codeSpan('a\nb')).not.toContain('\n')
  })
})

describe('generateComment', () => {
  it('escapes untrusted predict data', () => {
    const fs = require('node:fs')
    const os = require('node:os')
    const path = require('node:path')
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-comment-'))
    const predictFile = path.join(dir, 'predict.json')
    fs.writeFileSync(
      predictFile,
      JSON.stringify({
        data: {
          summary: { totalFiles: 1 },
          impacts: [{ path: 'src/`evil`<script>.ts', riskScore: 90 }],
          warnings: ['see [here](https://evil.example) @everyone <b>x</b>'],
          recommendations: ['ping @security-team'],
        },
      })
    )
    const md = generateComment({
      healthScore: 50,
      riskLevel: 'high',
      reviewMinutes: 5,
      precommitFile: null,
      predictFile,
      reportFile: null,
    })
    fs.rmSync(dir, { recursive: true, force: true })

    expect(md).not.toContain('](https://evil.example)')
    expect(md).not.toContain('<b>')
    expect(md).not.toMatch(/(^|[^\\])@everyone/m)
    expect(md).not.toMatch(/(^|[^\\])@security-team/m)
    expect(md).toContain('``src/`evil`<script>.ts``')
  })

  it('does not trust the risk level argument either', () => {
    const md = generateComment({
      healthScore: 50,
      riskLevel: 'low <img src=x>',
      reviewMinutes: 5,
      precommitFile: null,
      predictFile: null,
      reportFile: null,
    })
    expect(md).not.toContain('<img')
  })
})
