import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeGraph } from '../../src/graph/types.js'

vi.mock('../../src/graph/persistence.js', () => ({
  isGraphStale: vi.fn(),
  loadGraph: vi.fn(),
}))

vi.mock('../../src/lib/logger.js', () => ({
  logger: { error: vi.fn() },
}))

import { isGraphStale, loadGraph } from '../../src/graph/persistence.js'
import { clearGraphCache, getGraph } from '../../src/mcp/core.js'

const graph: KnowledgeGraph = {
  version: '1.0.0',
  metadata: {
    scannedAt: '2026-09-17T00:00:00.000Z',
    scanDurationMs: 1,
    rootDir: '/test',
    fileCount: 0,
    totalLines: 0,
    languages: {},
    nodeCount: 0,
    edgeCount: 0,
  },
  nodes: {},
  edges: [],
}

describe('MCP graph freshness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearGraphCache()
  })

  it('returns the cached graph while its source files are unchanged', async () => {
    vi.mocked(isGraphStale).mockResolvedValue(false)
    vi.mocked(loadGraph).mockResolvedValue(graph)

    await expect(getGraph()).resolves.toBe(graph)
    await expect(getGraph()).resolves.toBe(graph)

    expect(loadGraph).toHaveBeenCalledTimes(1)
    expect(isGraphStale).toHaveBeenCalledTimes(1)
  })

  it('refuses to return cached analysis after source files change', async () => {
    vi.mocked(isGraphStale).mockResolvedValue(true)
    vi.mocked(loadGraph).mockResolvedValue(graph)

    await expect(getGraph()).rejects.toThrow('Knowledge graph is stale')
    expect(loadGraph).not.toHaveBeenCalled()
  })
})
