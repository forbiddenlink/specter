/**
 * Morning - Daily Briefing
 *
 * Provides a quick daily summary of codebase health,
 * recent changes, and areas needing attention.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface MorningBriefing {
  codebaseName: string;
  date: string;
  greeting: string;
  health: {
    score: number;
    trend: 'improving' | 'stable' | 'declining';
    summary: string;
  };
  recentActivity: {
    commits: number;
    filesChanged: number;
    contributors: string[];
  };
  hotFiles: Array<{
    path: string;
    changes: number;
    reason: string;
  }>;
  alerts: string[];
  todaysFocus: string[];
}

const greetings = [
  "Good morning! Here's your codebase briefing.",
  "Rise and shine! Let's check on the code.",
  "Coffee time? Here's what's happening in the codebase.",
  "Ready to code? Here's your daily digest.",
  'Welcome back! Quick update on the codebase.',
];

/**
 * Generate morning briefing
 */
export async function generateMorning(
  graph: KnowledgeGraph,
  rootDir: string
): Promise<MorningBriefing> {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Random greeting based on day
  const greetingIndex = today.getDay() % greetings.length;
  const greeting = greetings[greetingIndex] ?? 'Good morning!';

  const git: SimpleGit = simpleGit(rootDir);

  // Recent activity (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let recentActivity = { commits: 0, filesChanged: 0, contributors: [] as string[] };

  try {
    const recentLog = await git.log({
      '--after': yesterday.toISOString(),
    });

    const contributors = new Set<string>();
    const filesChanged = new Set<string>();

    for (const commit of recentLog.all) {
      contributors.add(commit.author_name);

      try {
        const diff = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);
        for (const file of diff.trim().split('\n').filter(Boolean)) {
          filesChanged.add(file);
        }
      } catch {
        // Skip
      }
    }

    recentActivity = {
      commits: recentLog.total,
      filesChanged: filesChanged.size,
      contributors: [...contributors].slice(0, 3),
    };
  } catch {
    // Not a git repo or other error
  }

  // Hot files (most changed recently)
  const hotFiles: MorningBriefing['hotFiles'] = [];
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekLog = await git.log({
      '--after': weekAgo.toISOString(),
    });

    const fileChanges = new Map<string, number>();
    for (const commit of weekLog.all.slice(0, 50)) {
      try {
        const diff = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);
        for (const file of diff.trim().split('\n').filter(Boolean)) {
          if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            fileChanges.set(file, (fileChanges.get(file) || 0) + 1);
          }
        }
      } catch {
        // Skip
      }
    }

    const sorted = [...fileChanges.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    for (const [path, changes] of sorted) {
      let reason = 'Active development';
      if (changes >= 5) reason = 'Heavy activity this week';
      if (changes >= 10) reason = 'Hotspot - many recent changes';

      hotFiles.push({ path, changes, reason });
    }
  } catch {
    // Skip
  }

  // Calculate health
  const nodes = Object.values(graph.nodes);
  const complexities = nodes
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity as number);
  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0;

  const healthScore = Math.max(0, Math.min(100, 100 - avgComplexity * 2));
  const healthTrend: 'improving' | 'stable' | 'declining' =
    recentActivity.commits > 5 ? 'stable' : 'stable';

  let healthSummary: string;
  if (healthScore >= 70) {
    healthSummary = 'Looking good! Codebase is in healthy shape.';
  } else if (healthScore >= 40) {
    healthSummary = 'Moderate health. Some areas could use attention.';
  } else {
    healthSummary = 'Health needs attention. Consider addressing complexity.';
  }

  // Generate alerts
  const alerts: string[] = [];

  const firstHotFile = hotFiles[0];
  if (firstHotFile && firstHotFile.changes >= 5) {
    alerts.push(`${firstHotFile.path} has been very active - check for conflicts`);
  }

  const highComplexity = nodes.filter((n) => (n.complexity || 0) > 20);
  if (highComplexity.length > 0) {
    alerts.push(`${highComplexity.length} files have high complexity`);
  }

  if (recentActivity.commits === 0) {
    alerts.push('No commits in the last 24 hours');
  }

  // Today's focus suggestions
  const todaysFocus: string[] = [];

  if (recentActivity.commits > 0) {
    todaysFocus.push('Review recent changes before starting new work');
  }

  if (firstHotFile) {
    todaysFocus.push(`Check ${firstHotFile.path} for potential conflicts`);
  }

  if (highComplexity.length > 0) {
    todaysFocus.push('Consider refactoring high-complexity areas');
  }

  if (todaysFocus.length === 0) {
    todaysFocus.push('Ready for new work - codebase is calm');
  }

  return {
    codebaseName,
    date: dateStr,
    greeting,
    health: {
      score: Math.round(healthScore),
      trend: healthTrend,
      summary: healthSummary,
    },
    recentActivity,
    hotFiles,
    alerts,
    todaysFocus,
  };
}

/**
 * Format morning briefing for display
 */
export function formatMorning(briefing: MorningBriefing): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════╗');
  lines.push('║  ☀️  MORNING BRIEFING                             ║');
  lines.push('╚══════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  ${briefing.date}`);
  lines.push(`  ${briefing.greeting}`);
  lines.push('');

  // Health
  const healthEmoji = briefing.health.score >= 70 ? '💚' : briefing.health.score >= 40 ? '💛' : '❤️';
  const healthBar =
    '█'.repeat(Math.floor(briefing.health.score / 10)) +
    '░'.repeat(10 - Math.floor(briefing.health.score / 10));

  lines.push('CODEBASE HEALTH');
  lines.push('─'.repeat(50));
  lines.push(`  ${healthEmoji} ${healthBar} ${briefing.health.score}%`);
  lines.push(`  ${briefing.health.summary}`);
  lines.push('');

  // Recent activity
  lines.push('LAST 24 HOURS');
  lines.push('─'.repeat(50));
  if (briefing.recentActivity.commits > 0) {
    lines.push(`  📊 ${briefing.recentActivity.commits} commits`);
    lines.push(`  📁 ${briefing.recentActivity.filesChanged} files changed`);
    if (briefing.recentActivity.contributors.length > 0) {
      lines.push(`  👥 Active: ${briefing.recentActivity.contributors.join(', ')}`);
    }
  } else {
    lines.push('  No recent commits');
  }
  lines.push('');

  // Hot files
  if (briefing.hotFiles.length > 0) {
    lines.push('HOT FILES THIS WEEK');
    lines.push('─'.repeat(50));
    for (const file of briefing.hotFiles) {
      lines.push(`  🔥 ${file.path}`);
      lines.push(`     ${file.changes} changes - ${file.reason}`);
    }
    lines.push('');
  }

  // Alerts
  if (briefing.alerts.length > 0) {
    lines.push('⚠️  ALERTS');
    lines.push('─'.repeat(50));
    for (const alert of briefing.alerts) {
      lines.push(`  • ${alert}`);
    }
    lines.push('');
  }

  // Today's focus
  lines.push("TODAY'S FOCUS");
  lines.push('─'.repeat(50));
  for (const focus of briefing.todaysFocus) {
    lines.push(`  → ${focus}`);
  }
  lines.push('');

  lines.push('═'.repeat(52));
  lines.push('Have a productive day!');

  return lines.join('\n');
}
