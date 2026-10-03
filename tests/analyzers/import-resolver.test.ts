/**
 * @vitest-environment node
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createImportResolver } from '../../src/analyzers/imports.js'

let root: string
const from = () => path.join(root, 'src/app/page.tsx')

function touch(file: string, content = ''): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), content)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-resolve-'))
  touch(
    'tsconfig.json',
    JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'], '@lib': ['./src/lib.ts'] } } })
  )
  touch('src/lib.ts')
  touch('src/components/button.tsx')
  touch('src/utils/index.ts')
  touch('src/esm.ts')
  touch('src/app/page.tsx')
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('createImportResolver', () => {
  it('resolves wildcard aliases to the file that exists', () => {
    expect(createImportResolver(root)('@/components/button', from())).toBe(
      'src/components/button.tsx'
    )
  })

  it('resolves directory imports to index files', () => {
    expect(createImportResolver(root)('../utils', from())).toBe('src/utils/index.ts')
  })

  it('maps ESM .js specifiers to their .ts source', () => {
    expect(createImportResolver(root)('../esm.js', from())).toBe('src/esm.ts')
  })

  it('matches exact aliases exactly', () => {
    const resolve = createImportResolver(root)
    expect(resolve('@lib', from())).toBe('src/lib.ts')
    expect(resolve('@lib/other', from())).toBeNull()
  })

  it('returns null for packages and for files that do not exist', () => {
    const resolve = createImportResolver(root)
    expect(resolve('react', from())).toBeNull()
    expect(resolve('./missing', from())).toBeNull()
  })
})
