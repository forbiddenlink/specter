import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './src/mocks/server'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())

// Graph provenance records go to a throwaway dir, never the developer's ~/.cache
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env['SPECTER_CACHE_DIR'] = mkdtempSync(join(tmpdir(), 'specter-cache-'))
