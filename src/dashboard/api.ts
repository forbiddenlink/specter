/**
 * Dashboard REST API
 *
 * API endpoints for the web dashboard.
 */

import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { analyzeKnowledgeDistribution } from '../analyzers/knowledge.js'
import { loadGraph } from '../graph/persistence.js'
import { loadSnapshots } from '../history/storage.js'
import { analyzeTrends } from '../history/trends.js'
import * as getCodebaseSummary from '../tools/get-codebase-summary.js'
import * as getComplexityHotspots from '../tools/get-complexity-hotspots.js'

export function registerApiRoutes(app: FastifyInstance, rootDir: string): void {
  // GET /api/graph - Full graph for visualization
  app.get('/api/graph', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) {
      return reply.code(404).send({ error: 'No graph found' })
    }
    // Return nodes and edges formatted for Cytoscape.js
    return {
      nodes: Object.values(graph.nodes).map((n) => ({
        data: {
          id: n.id,
          label: n.name,
          type: n.type,
          filePath: n.filePath,
          complexity: n.complexity || 0,
          lineStart: n.lineStart,
          lineEnd: n.lineEnd,
        },
      })),
      edges: graph.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
        },
      })),
    }
  })

  // GET /api/summary - Codebase stats
  app.get('/api/summary', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })
    return getCodebaseSummary.execute(graph)
  })

  // GET /api/health - Health score and metrics
  app.get('/api/health', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })
    const hotspots = getComplexityHotspots.execute(graph, { limit: 10 })
    // Calculate health score
    const avgComplexity =
      hotspots.hotspots.length > 0
        ? hotspots.hotspots.reduce((sum, h) => sum + h.complexity, 0) / hotspots.hotspots.length
        : 0
    const healthScore = Math.max(0, Math.round(100 - avgComplexity * 3))
    return {
      score: healthScore,
      grade: healthScore >= 80 ? 'A' : healthScore >= 60 ? 'B' : healthScore >= 40 ? 'C' : 'D',
      metrics: graph.metadata,
      hotspots: hotspots.hotspots.slice(0, 5),
    }
  })

  // GET /api/hotspots - Complexity hotspots
  app.get('/api/hotspots', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })
    return getComplexityHotspots.execute(graph, { limit: 20 })
  })

  // GET /api/trends - Historical trends
  app.get('/api/trends', async () => {
    const snapshots = await loadSnapshots(rootDir)
    return analyzeTrends(snapshots)
  })

  // GET /api/file/:path - File details
  app.get('/api/file/*', async (request, reply) => {
    const rawPath = (request.params as { '*': string })['*']

    // Security: Reject path traversal attempts (check before normalization)
    if (rawPath.includes('..') || rawPath.startsWith('/')) {
      return reply.code(400).send({ error: 'Invalid file path' })
    }
    const filePath = path.normalize(rawPath)

    // Security: Verify resolved path stays within rootDir (check after normalization)
    const resolvedPath = path.resolve(rootDir, filePath)
    const resolvedRoot = path.resolve(rootDir)
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      return reply.code(400).send({ error: 'Invalid file path' })
    }

    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })

    const node = Object.values(graph.nodes).find(
      (n) => n.filePath === filePath && n.type === 'file'
    )
    if (!node) return reply.code(404).send({ error: 'File not found' })

    const related = graph.edges.filter((e) => e.source === node.id || e.target === node.id)
    return { file: node, edges: related }
  })

  // GET /api/distribution - Complexity distribution data for charts
  app.get('/api/distribution', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })

    // Count nodes by complexity level
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const node of Object.values(graph.nodes)) {
      if (node.type === 'file' || !node.complexity) continue
      if (node.complexity <= 5) distribution.low++
      else if (node.complexity <= 10) distribution.medium++
      else if (node.complexity <= 20) distribution.high++
      else distribution.critical++
    }

    return {
      distribution,
      labels: ['Low (1-5)', 'Medium (6-10)', 'High (11-20)', 'Critical (21+)'],
      colors: ['#22c55e', '#eab308', '#f97316', '#ef4444'],
    }
  })

  // GET /api/coupling - Coupling data for heatmap visualization
  app.get('/api/coupling', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })

    // Build coupling matrix from edges
    const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file')
    const fileIds = fileNodes.map((n) => n.id)
    const fileLabels = fileNodes.map((n) => n.name)

    // Count edges between files
    const couplingMatrix: number[][] = fileIds.map(() => fileIds.map(() => 0))

    for (const edge of graph.edges) {
      const sourceNode = graph.nodes[edge.source]
      const targetNode = graph.nodes[edge.target]
      if (!sourceNode || !targetNode) continue

      // Find the file each node belongs to
      const sourceFileIdx = fileIds.indexOf(sourceNode.filePath)
      const targetFileIdx = fileIds.indexOf(targetNode.filePath)

      if (sourceFileIdx >= 0 && targetFileIdx >= 0 && sourceFileIdx !== targetFileIdx) {
        const sourceRow = couplingMatrix[sourceFileIdx]
        const targetRow = couplingMatrix[targetFileIdx]
        if (sourceRow && targetRow) {
          sourceRow[targetFileIdx] = (sourceRow[targetFileIdx] ?? 0) + 1
          targetRow[sourceFileIdx] = (targetRow[sourceFileIdx] ?? 0) + 1
        }
      }
    }

    // Only return top files by coupling to avoid huge matrices
    const maxFiles = 20
    const fileCouplingCounts = fileIds.map((_, idx) => {
      const row = couplingMatrix[idx]
      return row ? row.reduce((sum, val) => sum + val, 0) : 0
    })
    const sortedIndices = fileCouplingCounts
      .map((count, idx) => ({ count, idx }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxFiles)
      .map((x) => x.idx)

    return {
      labels: sortedIndices.map((i) => fileLabels[i] ?? ''),
      matrix: sortedIndices.map((i) => sortedIndices.map((j) => couplingMatrix[i]?.[j] ?? 0)),
    }
  })

  // GET /api/bus-factor - Bus factor risk data
  app.get('/api/bus-factor', async (_request, reply) => {
    const graph = await loadGraph(rootDir)
    if (!graph) return reply.code(404).send({ error: 'No graph found' })

    const filePaths = Object.values(graph.nodes)
      .filter((n) => n.type === 'file')
      .map((n) => n.filePath)

    if (filePaths.length === 0) {
      return {
        overallBusFactor: 0,
        riskSummary: { critical: 0, high: 0, medium: 0, low: 0 },
        criticalAreas: [],
        topOwners: [],
      }
    }

    const analysis = await analyzeKnowledgeDistribution(graph.metadata.rootDir, filePaths)

    // Count risk levels
    const riskSummary = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const area of analysis.criticalAreas) {
      riskSummary[area.riskLevel]++
    }

    return {
      overallBusFactor: analysis.overallBusFactor,
      riskSummary,
      criticalAreas: analysis.criticalAreas.slice(0, 10).map((area) => ({
        path: area.path,
        owner: area.primaryOwner,
        ownershipPct: area.ownershipPercentage,
        busFactor: area.busFactor,
        riskLevel: area.riskLevel,
      })),
      topOwners: analysis.ownershipDistribution.slice(0, 5).map((o) => ({
        name: o.contributor,
        filesOwned: o.filesOwned,
        percentage: o.percentage,
      })),
    }
  })

  // GET /api/history - Snapshot history for timeline charts
  app.get('/api/history', async () => {
    const snapshots = await loadSnapshots(rootDir)

    return {
      snapshots: snapshots.slice(0, 50).map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        commitHash: s.commitHash,
        metrics: {
          fileCount: s.metrics.fileCount,
          totalLines: s.metrics.totalLines,
          avgComplexity: s.metrics.avgComplexity,
          maxComplexity: s.metrics.maxComplexity,
          hotspotCount: s.metrics.hotspotCount,
          healthScore: s.metrics.healthScore,
        },
        distribution: s.distribution,
      })),
      trends: analyzeTrends(snapshots),
    }
  })
}
