/**
 * Morning Helpers - Extracted helper functions for morning briefing
 */

import type { SimpleGit } from 'simple-git'
import type { GraphNode } from './graph/types.js'
import type { MorningBriefing } from './morning.js'

// Health score thresholds
const HEALTH_EXCELLENT = 70
const HEALTH_MODERATE = 40
const COMPLEXITY_MULTIPLIER = 2
const HIGH_COMPLEXITY_THRESHOLD = 20

// Activity thresholds
const HEAVY_ACTIVITY_THRESHOLD = 5
const HOTSPOT_THRESHOLD = 10

/**
 * Fetch recent activity from the last 24 hours
 */
export async function fetchRecentActivity(
  git: SimpleGit
): Promise<MorningBriefing['recentActivity']> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  try {
    const recentLog = await git.log({
      '--after': yesterday.toISOString(),
    })

    const contributors = new Set<string>()
    const filesChanged = new Set<string>()

    for (const commit of recentLog.all) {
      contributors.add(commit.author_name)

      try {
        const diff = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ])
        for (const file of diff.trim().split('\n').filter(Boolean)) {
          filesChanged.add(file)
        }
      } catch {
        // Skip individual commit errors
      }
    }

    return {
      commits: recentLog.total,
      filesChanged: filesChanged.size,
      contributors: [...contributors].slice(0, 3),
    }
  } catch {
    // Not a git repo or other error
    return { commits: 0, filesChanged: 0, contributors: [] }
  }
}

/**
 * Analyze hot files from the past week
 */
export async function analyzeHotFiles(git: SimpleGit): Promise<MorningBriefing['hotFiles']> {
  const hotFiles: MorningBriefing['hotFiles'] = []

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekLog = await git.log({
      '--after': weekAgo.toISOString(),
    })

    const fileChanges = new Map<string, number>()
    for (const commit of weekLog.all.slice(0, 50)) {
      try {
        const diff = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ])
        for (const file of diff.trim().split('\n').filter(Boolean)) {
          if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            fileChanges.set(file, (fileChanges.get(file) || 0) + 1)
          }
        }
      } catch {
        // Skip individual commit errors
      }
    }

    const sorted = [...fileChanges.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

    for (const [path, changes] of sorted) {
      let reason = 'Active development'
      if (changes >= HEAVY_ACTIVITY_THRESHOLD) reason = 'Heavy activity this week'
      if (changes >= HOTSPOT_THRESHOLD) reason = 'Hotspot - many recent changes'

      hotFiles.push({ path, changes, reason })
    }
  } catch {
    // Skip git errors
  }

  return hotFiles
}

/**
 * Calculate health score from graph nodes
 */
export function calculateHealthScore(nodes: GraphNode[]): {
  score: number
  trend: 'improving' | 'stable' | 'declining'
  summary: string
  highComplexityNodes: GraphNode[]
} {
  const complexities = nodes
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity as number)

  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0

  const score = Math.max(0, Math.min(100, 100 - avgComplexity * COMPLEXITY_MULTIPLIER))
  const trend: 'improving' | 'stable' | 'declining' = 'stable'

  let summary: string
  if (score >= HEALTH_EXCELLENT) {
    summary = 'Looking good! Codebase is in healthy shape.'
  } else if (score >= HEALTH_MODERATE) {
    summary = 'Moderate health. Some areas could use attention.'
  } else {
    summary = 'Health needs attention. Consider addressing complexity.'
  }

  const highComplexityNodes = nodes.filter((n) => (n.complexity || 0) > HIGH_COMPLEXITY_THRESHOLD)

  return { score: Math.round(score), trend, summary, highComplexityNodes }
}

/**
 * Generate alerts based on activity and health
 */
export function generateAlerts(
  hotFiles: MorningBriefing['hotFiles'],
  highComplexityCount: number,
  recentCommits: number
): string[] {
  const alerts: string[] = []

  const firstHotFile = hotFiles[0]
  if (firstHotFile && firstHotFile.changes >= HEAVY_ACTIVITY_THRESHOLD) {
    alerts.push(`${firstHotFile.path} has been very active - check for conflicts`)
  }

  if (highComplexityCount > 0) {
    alerts.push(`${highComplexityCount} files have high complexity`)
  }

  if (recentCommits === 0) {
    alerts.push('No commits in the last 24 hours')
  }

  return alerts
}

/**
 * Generate focus suggestions for the day
 */
export function generateFocusItems(
  hotFiles: MorningBriefing['hotFiles'],
  highComplexityCount: number,
  recentCommits: number
): string[] {
  const todaysFocus: string[] = []

  if (recentCommits > 0) {
    todaysFocus.push('Review recent changes before starting new work')
  }

  const firstHotFile = hotFiles[0]
  if (firstHotFile) {
    todaysFocus.push(`Check ${firstHotFile.path} for potential conflicts`)
  }

  if (highComplexityCount > 0) {
    todaysFocus.push('Consider refactoring high-complexity areas')
  }

  if (todaysFocus.length === 0) {
    todaysFocus.push('Ready for new work - codebase is calm')
  }

  return todaysFocus
}
