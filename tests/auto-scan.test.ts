/**
 * Auto-Scan Tests
 *
 * Tests for the ensureGraph() utility that auto-scans on first use
 * and warns about stale graphs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeGraph } from '../src/graph/types.js'

// Mock dependencies before importing
vi.mock('../src/graph/persistence.js', () => ({
  graphExists: vi.fn(),
  loadGraph: vi.fn(),
  loadMetadata: vi.fn(),
  saveGraph: vi.fn(),
}))

vi.mock('../src/graph/builder.js', () => ({
  buildKnowledgeGraph: vi.fn(),
}))

vi.mock('../src/scan-lock.js', () => ({
  acquireScanLock: vi.fn(async () => true),
  releaseScanLock: vi.fn(async () => {}),
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    text: '',
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
  })),
}))

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      red: (s: string) => s,
      white: (s: string) => s,
      cyan: (s: string) => s,
    }),
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    hex: () => (s: string) => s,
  },
}))

import { ensureGraph } from '../src/auto-scan.js'
import { buildKnowledgeGraph } from '../src/graph/builder.js'
import { graphExists, loadGraph, loadMetadata, saveGraph } from '../src/graph/persistence.js'

function createMockGraph(overrides: Partial<KnowledgeGraph> = {}): KnowledgeGraph {
  return {
    version: '1.0.0',
    metadata: {
      scannedAt: new Date().toISOString(),
      scanDurationMs: 100,
      rootDir: '/test',
      fileCount: 10,
      totalLines: 1000,
      languages: { typescript: 10 },
      nodeCount: 50,
      edgeCount: 30,
    },
    nodes: {
      'file-1': {
        id: 'file-1',
        type: 'file',
        name: 'test.ts',
        filePath: 'src/test.ts',
        lineStart: 1,
        lineEnd: 100,
        exported: true,
        complexity: 5,
      },
    },
    edges: [],
    ...overrides,
  }
}

describe('ensureGraph', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  describe('when graph exists and is fresh', () => {
    it('returns graph without warning or scan', async () => {
      const mockGraph = createMockGraph()
      vi.mocked(graphExists).mockResolvedValue(true)
      vi.mocked(loadGraph).mockResolvedValue(mockGraph)
      vi.mocked(loadMetadata).mockResolvedValue({
        scannedAt: new Date().toISOString(),
        scanDurationMs: 100,
        rootDir: '/test',
        fileCount: 10,
        totalLines: 1000,
        languages: { typescript: 10 },
        nodeCount: 50,
        edgeCount: 30,
      })

      const result = await ensureGraph('/test')

      expect(result).toEqual(mockGraph)
      expect(buildKnowledgeGraph).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
    })
  })

  describe('when graph exists and is stale (>24h)', () => {
    it('returns graph and prints stale warning', async () => {
      const mockGraph = createMockGraph()
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago

      vi.mocked(graphExists).mockResolvedValue(true)
      vi.mocked(loadGraph).mockResolvedValue(mockGraph)
      vi.mocked(loadMetadata).mockResolvedValue({
        scannedAt: staleDate,
        scanDurationMs: 100,
        rootDir: '/test',
        fileCount: 10,
        totalLines: 1000,
        languages: { typescript: 10 },
        nodeCount: 50,
        edgeCount: 30,
      })

      const result = await ensureGraph('/test')

      expect(result).toEqual(mockGraph)
      expect(buildKnowledgeGraph).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('1 day old'))
    })
  })

  describe('when graph does not exist', () => {
    it('runs buildKnowledgeGraph, saves, and returns graph', async () => {
      const mockGraph = createMockGraph()

      vi.mocked(graphExists).mockResolvedValue(false)
      vi.mocked(buildKnowledgeGraph).mockResolvedValue({
        graph: mockGraph,
        stats: {} as any,
      })
      vi.mocked(saveGraph).mockResolvedValue()

      const result = await ensureGraph('/test')

      expect(result).toEqual(mockGraph)
      expect(buildKnowledgeGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          rootDir: '/test',
          includeGitHistory: true,
        })
      )
      expect(saveGraph).toHaveBeenCalledWith(mockGraph, '/test')
    })

    it('returns null when scan fails', async () => {
      vi.mocked(graphExists).mockResolvedValue(false)
      vi.mocked(buildKnowledgeGraph).mockRejectedValue(new Error('scan failed'))

      const result = await ensureGraph('/test')

      expect(result).toBeNull()
    })

    it('returns null when scan produces empty graph', async () => {
      vi.mocked(graphExists).mockResolvedValue(false)
      vi.mocked(buildKnowledgeGraph).mockResolvedValue({
        graph: { version: '1.0.0', metadata: {} as any, nodes: {}, edges: [] },
        stats: {} as any,
      })

      const result = await ensureGraph('/test')

      expect(result).toBeNull()
      expect(saveGraph).not.toHaveBeenCalled()
    })
  })

  describe('JSON mode with stale graph', () => {
    it('writes warning to stderr, not stdout', async () => {
      const mockGraph = createMockGraph()
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

      vi.mocked(graphExists).mockResolvedValue(true)
      vi.mocked(loadGraph).mockResolvedValue(mockGraph)
      vi.mocked(loadMetadata).mockResolvedValue({
        scannedAt: staleDate,
        scanDurationMs: 100,
        rootDir: '/test',
        fileCount: 10,
        totalLines: 1000,
        languages: { typescript: 10 },
        nodeCount: 50,
        edgeCount: 30,
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await ensureGraph('/test', { json: true })

      // Warning goes to stderr in JSON mode
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('1 day old'))
      // Not to console.log (stdout)
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('quiet mode', () => {
    it('prints no warnings even when stale', async () => {
      const mockGraph = createMockGraph()
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

      vi.mocked(graphExists).mockResolvedValue(true)
      vi.mocked(loadGraph).mockResolvedValue(mockGraph)
      vi.mocked(loadMetadata).mockResolvedValue({
        scannedAt: staleDate,
        scanDurationMs: 100,
        rootDir: '/test',
        fileCount: 10,
        totalLines: 1000,
        languages: { typescript: 10 },
        nodeCount: 50,
        edgeCount: 30,
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await ensureGraph('/test', { quiet: true })

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(stderrSpy).not.toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
