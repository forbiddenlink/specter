/**
 * Morning - Daily Briefing
 *
 * Provides a quick daily summary of codebase health,
 * recent changes, and areas needing attention.
 */

import { simpleGit } from 'simple-git'
import type { KnowledgeGraph } from './graph/types.js'
import {
  analyzeHotFiles,
  calculateHealthScore,
  fetchRecentActivity,
  generateAlerts,
  generateFocusItems,
} from './morning-helpers.js'

export interface MorningBriefing {
  codebaseName: string
  date: string
  greeting: string
  health: {
    score: number
    trend: 'improving' | 'stable' | 'declining'
    summary: string
  }
  recentActivity: {
    commits: number
    filesChanged: number
    contributors: string[]
  }
  hotFiles: Array<{
    path: string
    changes: number
    reason: string
  }>
  alerts: string[]
  todaysFocus: string[]
}

const greetings = [
  "Good morning! Here's your codebase briefing.",
  "Rise and shine! Let's check on the code.",
  "Coffee time? Here's what's happening in the codebase.",
  "Ready to code? Here's your daily digest.",
  'Welcome back! Quick update on the codebase.',
]

/**
 * Generate morning briefing
 */
export async function generateMorning(
  graph: KnowledgeGraph,
  rootDir: string
): Promise<MorningBriefing> {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown'
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Random greeting based on day
  const greetingIndex = today.getDay() % greetings.length
  const greeting = greetings[greetingIndex] ?? 'Good morning!'

  const git = simpleGit(rootDir)

  // Fetch data using helper functions
  const recentActivity = await fetchRecentActivity(git)
  const hotFiles = await analyzeHotFiles(git)

  // Calculate health
  const nodes = Object.values(graph.nodes)
  const healthResult = calculateHealthScore(nodes)

  // Generate alerts and focus items
  const alerts = generateAlerts(
    hotFiles,
    healthResult.highComplexityNodes.length,
    recentActivity.commits
  )
  const todaysFocus = generateFocusItems(
    hotFiles,
    healthResult.highComplexityNodes.length,
    recentActivity.commits
  )

  return {
    codebaseName,
    date: dateStr,
    greeting,
    health: {
      score: healthResult.score,
      trend: healthResult.trend,
      summary: healthResult.summary,
    },
    recentActivity,
    hotFiles,
    alerts,
    todaysFocus,
  }
}

/**
 * Format morning briefing for display
 */
export function formatMorning(briefing: MorningBriefing): string {
  const lines: string[] = []

  lines.push('╔══════════════════════════════════════════════════╗')
  lines.push('║  ☀️  MORNING BRIEFING                             ║')
  lines.push('╚══════════════════════════════════════════════════╝')
  lines.push('')
  lines.push(`  ${briefing.date}`)
  lines.push(`  ${briefing.greeting}`)
  lines.push('')

  // Health
  const healthEmoji = briefing.health.score >= 70 ? '💚' : briefing.health.score >= 40 ? '💛' : '❤️'
  const healthBar =
    '█'.repeat(Math.floor(briefing.health.score / 10)) +
    '░'.repeat(10 - Math.floor(briefing.health.score / 10))

  lines.push('CODEBASE HEALTH')
  lines.push('─'.repeat(50))
  lines.push(`  ${healthEmoji} ${healthBar} ${briefing.health.score}%`)
  lines.push(`  ${briefing.health.summary}`)
  lines.push('')

  // Recent activity
  lines.push('LAST 24 HOURS')
  lines.push('─'.repeat(50))
  if (briefing.recentActivity.commits > 0) {
    lines.push(`  📊 ${briefing.recentActivity.commits} commits`)
    lines.push(`  📁 ${briefing.recentActivity.filesChanged} files changed`)
    if (briefing.recentActivity.contributors.length > 0) {
      lines.push(`  👥 Active: ${briefing.recentActivity.contributors.join(', ')}`)
    }
  } else {
    lines.push('  No recent commits')
  }
  lines.push('')

  // Hot files
  if (briefing.hotFiles.length > 0) {
    lines.push('HOT FILES THIS WEEK')
    lines.push('─'.repeat(50))
    for (const file of briefing.hotFiles) {
      lines.push(`  🔥 ${file.path}`)
      lines.push(`     ${file.changes} changes - ${file.reason}`)
    }
    lines.push('')
  }

  // Alerts
  if (briefing.alerts.length > 0) {
    lines.push('⚠️  ALERTS')
    lines.push('─'.repeat(50))
    for (const alert of briefing.alerts) {
      lines.push(`  • ${alert}`)
    }
    lines.push('')
  }

  // Today's focus
  lines.push("TODAY'S FOCUS")
  lines.push('─'.repeat(50))
  for (const focus of briefing.todaysFocus) {
    lines.push(`  → ${focus}`)
  }
  lines.push('')

  lines.push('═'.repeat(52))
  lines.push('Have a productive day!')

  return lines.join('\n')
}
