import { describe, expect, it } from 'vitest'
import {
  computeCoChange,
  countAuthors,
  type MinedCommit,
  parseGitLog,
  summarizeFileHistories,
} from '../../src/analyzers/git-history.js'

const R = '\x1e'
const F = '\x1f'

function commit(
  hash: string,
  files: string[],
  email = 'a@x.com',
  date = '2026-01-01T00:00:00Z'
): MinedCommit {
  return { hash, author: email.split('@')[0] ?? '', email, date, subject: `commit ${hash}`, files }
}

describe('parseGitLog', () => {
  it('parses records with files and skips blank lines', () => {
    const raw =
      `${R}abc${F}Ann${F}ann@x.com${F}2026-02-02T00:00:00Z${F}feat: one\n\nsrc/a.ts\nsrc/b.ts\n` +
      `${R}def${F}Bo${F}bo@x.com${F}2026-01-01T00:00:00Z${F}fix: two\n\nsrc/a.ts\n`
    const commits = parseGitLog(raw)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({
      hash: 'abc',
      author: 'Ann',
      subject: 'feat: one',
      files: ['src/a.ts', 'src/b.ts'],
    })
    expect(commits[1]?.files).toEqual(['src/a.ts'])
  })

  it('keeps commits that touched no files (empty commits)', () => {
    const commits = parseGitLog(
      `${R}abc${F}Ann${F}ann@x.com${F}2026-02-02T00:00:00Z${F}chore: empty\n`
    )
    expect(commits[0]?.files).toEqual([])
  })

  it('returns nothing for empty output', () => {
    expect(parseGitLog('')).toEqual([])
  })
})

describe('summarizeFileHistories', () => {
  it('counts every commit in the window, not a capped sample', () => {
    const commits = Array.from({ length: 120 }, (_, i) => commit(`h${i}`, ['src/a.ts']))
    const histories = summarizeFileHistories(commits, ['src/a.ts'])
    expect(histories.get('src/a.ts')?.commitCount).toBe(120)
    expect(histories.get('src/a.ts')?.recentCommits).toHaveLength(10)
  })

  it('orders contributors by commit count and ignores files outside the set', () => {
    const histories = summarizeFileHistories(
      [
        commit('1', ['src/a.ts', 'docs/x.md'], 'b@x.com'),
        commit('2', ['src/a.ts'], 'a@x.com'),
        commit('3', ['src/a.ts'], 'a@x.com'),
      ],
      ['src/a.ts']
    )
    expect(histories.get('src/a.ts')?.contributors.map((c) => c.email)).toEqual([
      'a@x.com',
      'b@x.com',
    ])
    expect(histories.has('docs/x.md')).toBe(false)
  })
})

describe('computeCoChange', () => {
  const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts']

  it('reports partners that clear both support and confidence', () => {
    const commits = [
      commit('1', ['a.ts', 'b.ts']),
      commit('2', ['a.ts', 'b.ts']),
      commit('3', ['a.ts', 'b.ts']),
      commit('4', ['a.ts', 'c.ts']),
    ]
    const result = computeCoChange(commits, files)
    expect(result['a.ts']).toEqual([{ file: 'b.ts', shared: 3, confidence: 0.75 }])
    // Directional: b.ts changed 3 times, always with a.ts
    expect(result['b.ts']).toEqual([{ file: 'a.ts', shared: 3, confidence: 1 }])
    expect(result['c.ts']).toBeUndefined()
  })

  it('ignores commits larger than maxFilesPerCommit', () => {
    const bulk = Array.from({ length: 5 }, (_, i) => commit(`b${i}`, ['a.ts', 'b.ts', 'c.ts']))
    expect(computeCoChange(bulk, files, { maxFilesPerCommit: 2 })).toEqual({})
  })

  it('applies minShared and minConfidence', () => {
    const commits = [
      commit('1', ['a.ts', 'b.ts']),
      commit('2', ['a.ts', 'b.ts']),
      commit('3', ['a.ts']),
      commit('4', ['a.ts']),
      commit('5', ['a.ts']),
    ]
    expect(
      computeCoChange(commits, files, { minShared: 2, minConfidence: 0.3 })['a.ts']
    ).toHaveLength(1)
    expect(
      computeCoChange(commits, files, { minShared: 2, minConfidence: 0.5 })['a.ts']
    ).toBeUndefined()
    expect(
      computeCoChange(commits, files, { minShared: 3, minConfidence: 0.1 })['a.ts']
    ).toBeUndefined()
  })

  it('never pairs lockfiles even when they are in the file set', () => {
    const commits = Array.from({ length: 4 }, (_, i) => commit(`l${i}`, ['a.ts', 'pnpm-lock.yaml']))
    expect(computeCoChange(commits, ['a.ts', 'pnpm-lock.yaml'])).toEqual({})
  })
})

describe('countAuthors', () => {
  const who = (author: string, email: string): MinedCommit => ({
    ...commit('x', []),
    author,
    email,
  })

  it('merges one person committing under several names and emails', () => {
    expect(
      countAuthors([
        who('Elizabeth Stein', 'liz@gmail.com'),
        who('liz stein', 'liz@gmail.com'),
        who('Elizabeth Stein', '123+liz@users.noreply.github.com'),
        who('forbiddenlink', 'liz@gmail.com'),
      ])
    ).toBe(1)
  })

  it('skips bots and coding agents', () => {
    expect(
      countAuthors([
        who('Liz', 'liz@x.com'),
        who('github-actions[bot]', '41898282+github-actions[bot]@users.noreply.github.com'),
        who('snyk-bot', 'snyk-bot@snyk.io'),
        who('Claude', 'noreply@anthropic.com'),
      ])
    ).toBe(1)
  })

  it('counts different people separately', () => {
    expect(countAuthors([who('Ann', 'ann@x.com'), who('Bo', 'bo@x.com')])).toBe(2)
  })
})
