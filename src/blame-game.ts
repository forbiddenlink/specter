/**
 * Blame Game
 *
 * Gamified blame analysis with funny awards for contributors.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

interface ContributorStats {
  name: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  complexityIntroduced: number;
  fixCommits: number;
  revertCommits: number;
  weekendCommits: number;
  lateNightCommits: number;
  averageCommitSize: number;
}

interface Award {
  emoji: string;
  title: string;
  description: string;
  winner: string;
  stat: string;
}

async function getContributorStats(rootDir: string): Promise<Map<string, ContributorStats>> {
  const stats = new Map<string, ContributorStats>();

  try {
    const git: SimpleGit = simpleGit(rootDir);

    // Get commit log with stats using simple-git
    // Use raw to get the custom format we need
    const logResult = await git.raw([
      'log',
      '--format=%aN|%ad|%s',
      '--date=format:%u %H',
      '--numstat',
      '--since=1 year ago',
    ]);

    let currentAuthor = '';
    let currentDay = 0;
    let currentHour = 0;
    let currentMessage = '';

    for (const line of logResult.split('\n')) {
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          currentAuthor = parts[0];
          const [day, hour] = (parts[1] || '1 12').split(' ').map(Number);
          currentDay = day;
          currentHour = hour;
          currentMessage = parts[2] || '';

          if (!stats.has(currentAuthor)) {
            stats.set(currentAuthor, {
              name: currentAuthor,
              commits: 0,
              linesAdded: 0,
              linesRemoved: 0,
              filesChanged: 0,
              complexityIntroduced: 0,
              fixCommits: 0,
              revertCommits: 0,
              weekendCommits: 0,
              lateNightCommits: 0,
              averageCommitSize: 0,
            });
          }

          const s = stats.get(currentAuthor)!;
          s.commits++;

          if (currentDay >= 6) s.weekendCommits++;
          if (currentHour >= 22 || currentHour <= 5) s.lateNightCommits++;
          if (/fix|bug|patch|hotfix/i.test(currentMessage)) s.fixCommits++;
          if (/revert/i.test(currentMessage)) s.revertCommits++;
        }
      } else if (line.match(/^\d+\t\d+\t/)) {
        const [added, removed] = line.split('\t').map(Number);
        if (currentAuthor && stats.has(currentAuthor)) {
          const s = stats.get(currentAuthor)!;
          s.linesAdded += added || 0;
          s.linesRemoved += removed || 0;
          s.filesChanged++;
        }
      }
    }

    // Calculate averages
    for (const s of stats.values()) {
      s.averageCommitSize =
        s.commits > 0 ? Math.round((s.linesAdded + s.linesRemoved) / s.commits) : 0;
    }
  } catch {
    // Git not available or no history
  }

  return stats;
}

function generateAwards(stats: Map<string, ContributorStats>): Award[] {
  const awards: Award[] = [];
  const contributors = Array.from(stats.values());

  if (contributors.length === 0) return awards;

  // Most commits
  const mostCommits = contributors.reduce((a, b) => (a.commits > b.commits ? a : b));
  if (mostCommits.commits > 0) {
    awards.push({
      emoji: '👑',
      title: 'Commit Royalty',
      description: 'Most commits in the past year',
      winner: mostCommits.name,
      stat: `${mostCommits.commits} commits`,
    });
  }

  // Most lines added
  const mostAdded = contributors.reduce((a, b) => (a.linesAdded > b.linesAdded ? a : b));
  if (mostAdded.linesAdded > 0) {
    awards.push({
      emoji: '📝',
      title: 'The Novelist',
      description: 'Added the most lines of code',
      winner: mostAdded.name,
      stat: `+${mostAdded.linesAdded.toLocaleString()} lines`,
    });
  }

  // Most lines removed
  const mostRemoved = contributors.reduce((a, b) => (a.linesRemoved > b.linesRemoved ? a : b));
  if (mostRemoved.linesRemoved > 0) {
    awards.push({
      emoji: '🧹',
      title: 'The Janitor',
      description: 'Deleted the most code (hero!)',
      winner: mostRemoved.name,
      stat: `-${mostRemoved.linesRemoved.toLocaleString()} lines`,
    });
  }

  // Most fix commits
  const mostFixes = contributors.reduce((a, b) => (a.fixCommits > b.fixCommits ? a : b));
  if (mostFixes.fixCommits > 0) {
    awards.push({
      emoji: '🔧',
      title: 'Bug Whisperer',
      description: 'Most bug fix commits',
      winner: mostFixes.name,
      stat: `${mostFixes.fixCommits} fixes`,
    });
  }

  // Most weekend commits
  const weekendWarrior = contributors.reduce((a, b) =>
    a.weekendCommits > b.weekendCommits ? a : b
  );
  if (weekendWarrior.weekendCommits > 0) {
    awards.push({
      emoji: '🦸',
      title: 'Weekend Warrior',
      description: 'Most commits on weekends',
      winner: weekendWarrior.name,
      stat: `${weekendWarrior.weekendCommits} weekend commits`,
    });
  }

  // Most late night commits
  const nightOwl = contributors.reduce((a, b) => (a.lateNightCommits > b.lateNightCommits ? a : b));
  if (nightOwl.lateNightCommits > 0) {
    awards.push({
      emoji: '🦉',
      title: 'Night Owl',
      description: 'Most commits after 10pm or before 5am',
      winner: nightOwl.name,
      stat: `${nightOwl.lateNightCommits} late nights`,
    });
  }

  // Largest average commit
  const bigCommitter = contributors.reduce((a, b) =>
    a.averageCommitSize > b.averageCommitSize ? a : b
  );
  if (bigCommitter.averageCommitSize > 100) {
    awards.push({
      emoji: '🎰',
      title: 'YOLO Committer',
      description: 'Largest average commit size',
      winner: bigCommitter.name,
      stat: `${bigCommitter.averageCommitSize} lines/commit`,
    });
  }

  // Most reverts
  const mostReverts = contributors.reduce((a, b) => (a.revertCommits > b.revertCommits ? a : b));
  if (mostReverts.revertCommits > 0) {
    awards.push({
      emoji: '⏪',
      title: 'Time Traveler',
      description: 'Most revert commits',
      winner: mostReverts.name,
      stat: `${mostReverts.revertCommits} reverts`,
    });
  }

  // Best ratio (removed > added)
  const bestRatio = contributors
    .filter((c) => c.linesAdded > 100)
    .reduce((a, b) => {
      const ratioA = a.linesRemoved / (a.linesAdded || 1);
      const ratioB = b.linesRemoved / (b.linesAdded || 1);
      return ratioA > ratioB ? a : b;
    }, contributors[0]);
  if (bestRatio && bestRatio.linesRemoved > bestRatio.linesAdded) {
    awards.push({
      emoji: '✨',
      title: 'Code Minimalist',
      description: 'Removed more than they added',
      winner: bestRatio.name,
      stat: `${((bestRatio.linesRemoved / bestRatio.linesAdded) * 100 - 100).toFixed(0)}% net reduction`,
    });
  }

  return awards;
}

export async function generateBlameGame(_graph: KnowledgeGraph, rootDir: string): Promise<string> {
  const stats = await getContributorStats(rootDir);
  const awards = generateAwards(stats);
  const contributors = Array.from(stats.values()).sort((a, b) => b.commits - a.commits);

  const lines: string[] = [];

  lines.push('');
  lines.push('  ╔════════════════════════════════════════════════════╗');
  lines.push('  ║           🎮 THE BLAME GAME 🎮                     ║');
  lines.push("  ║         Who's responsible for this mess?          ║");
  lines.push('  ╚════════════════════════════════════════════════════╝');
  lines.push('');

  if (awards.length === 0) {
    lines.push('  No git history found. Nothing to blame... yet.');
    return lines.join('\n');
  }

  lines.push('  🏆 AWARDS CEREMONY');
  lines.push('  ────────────────────────────────────────────────────');
  lines.push('');

  for (const award of awards) {
    lines.push(`  ${award.emoji} ${award.title.toUpperCase()}`);
    lines.push(`     "${award.description}"`);
    lines.push(`     Winner: ${award.winner}`);
    lines.push(`     ${award.stat}`);
    lines.push('');
  }

  lines.push('  📊 LEADERBOARD');
  lines.push('  ────────────────────────────────────────────────────');
  lines.push('');

  const medals = ['🥇', '🥈', '🥉'];
  contributors.slice(0, 10).forEach((c, i) => {
    const medal = medals[i] || '  ';
    const bar = '█'.repeat(
      Math.min(20, Math.round((c.commits / (contributors[0]?.commits || 1)) * 20))
    );
    lines.push(`  ${medal} ${c.name.padEnd(20)} ${bar} ${c.commits}`);
  });

  lines.push('');
  lines.push('  ────────────────────────────────────────────────────');
  lines.push("  Remember: We're all in this together... but some");
  lines.push('  of us are more "in it" than others. 😏');
  lines.push('');

  return lines.join('\n');
}
