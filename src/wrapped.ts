/**
 * Wrapped Summary Generator
 *
 * Creates a Spotify Wrapped-style yearly summary of codebase activity.
 * Analyzes git history to produce shareable, fun statistics.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';
import {
  analyzeContributors,
  analyzeFileChanges,
  analyzeLanguages,
  analyzeLinesChanged,
  analyzeTimePatterns,
  fetchPeriodCommits,
  getTopEntry,
} from './wrapped-helpers.js';

export interface WrappedData {
  codebaseName: string;
  year: number;
  periodStart: string;
  periodEnd: string;
  isGitRepo: boolean;

  // Core stats
  totalCommits: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  filesChanged: number;

  // Top contributors
  topContributors: Array<{
    name: string;
    commits: number;
    percentage: number;
  }>;

  // Top files (most edited)
  topFiles: Array<{
    path: string;
    commits: number;
    nickname: string;
  }>;

  // Time patterns
  busiestMonth: { month: string; commits: number } | null;
  busiestDay: { day: string; commits: number } | null;
  busiestHour: { hour: number; commits: number } | null;
  lateNightCommits: number; // commits between midnight and 5am
  weekendCommits: number;

  // Streaks
  longestStreak: number; // consecutive days with commits
  currentStreak: number;

  // Languages ("genres")
  topLanguages: Array<{ lang: string; percentage: number }>;

  // Fun facts
  funFacts: string[];
}

const fileNicknames: Record<string, string[]> = {
  'package.json': ['The Dependency Whisperer', 'Your Node Bestie', 'The Config King'],
  'tsconfig.json': ['The Type Guardian', 'Strictness Incarnate', 'Your TS BFF'],
  '.gitignore': ['The Gatekeeper', 'Secret Keeper', 'The Bouncer'],
  'README.md': ['The Storyteller', 'First Impressions', 'The Welcome Mat'],
  'index.ts': ['Ground Zero', 'The Entry Point', 'Where It All Begins'],
  'index.js': ['Ground Zero', 'The Entry Point', 'Where It All Begins'],
};

function getFileNickname(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;

  // Check for exact matches
  const nicknames = fileNicknames[fileName];
  if (nicknames && nicknames.length > 0) {
    const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];
    return nickname ?? 'A Familiar Friend';
  }

  // Pattern-based nicknames
  if (filePath.includes('test')) return 'The Quality Guardian';
  if (filePath.includes('config')) return 'The Configurator';
  if (filePath.includes('util')) return 'The Swiss Army Knife';
  if (filePath.includes('hook')) return 'The Event Listener';
  if (filePath.includes('component')) return 'The UI Builder';
  if (filePath.includes('service')) return 'The Backend Hero';
  if (filePath.includes('api')) return 'The Data Bridge';
  if (filePath.includes('style') || filePath.includes('css')) return 'The Stylist';
  if (filePath.includes('type')) return 'The Type Definer';
  if (fileName.endsWith('.md')) return 'The Documenter';

  return 'A Familiar Friend';
}

export type WrappedPeriod = 'year' | 'quarter' | 'month' | 'week';

interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Calculate date range for a given period
 */
function calculatePeriodRange(
  period: WrappedPeriod,
  year?: number,
  periodNum?: number
): PeriodRange {
  const now = new Date();
  const targetYear = year || now.getFullYear();

  switch (period) {
    case 'week': {
      // Last 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start, end, label: 'This Week' };
    }
    case 'month': {
      const month = periodNum !== undefined ? periodNum - 1 : now.getMonth();
      const start = new Date(targetYear, month, 1);
      const end = new Date(targetYear, month + 1, 0);
      const monthName = start.toLocaleDateString('en-US', { month: 'long' });
      return { start, end, label: `${monthName} ${targetYear}` };
    }
    case 'quarter': {
      const quarter = periodNum || Math.ceil((now.getMonth() + 1) / 3);
      const startMonth = (quarter - 1) * 3;
      const start = new Date(targetYear, startMonth, 1);
      const end = new Date(targetYear, startMonth + 3, 0);
      return { start, end, label: `Q${quarter} ${targetYear}` };
    }
    default: {
      const start = new Date(targetYear, 0, 1);
      const end = new Date(targetYear, 11, 31);
      return { start, end, label: `${targetYear}` };
    }
  }
}

/**
 * Gather wrapped data from git history
 */
export async function gatherWrappedData(
  graph: KnowledgeGraph,
  rootDir: string,
  options: { year?: number; period?: WrappedPeriod; periodNum?: number } = {}
): Promise<WrappedData> {
  const { year, period = 'year', periodNum } = options;
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';
  const targetYear = year || new Date().getFullYear();
  const git: SimpleGit = simpleGit(rootDir);

  // Calculate period range
  const range = calculatePeriodRange(period, targetYear, periodNum);
  const periodStart = range.start.toISOString().split('T')[0];
  const periodEnd = range.end.toISOString().split('T')[0];

  // Check if git repo
  let _isGitRepo = false;
  try {
    await git.status();
    _isGitRepo = true;
  } catch {
    return createEmptyWrappedData(codebaseName, targetYear, graph, range.label);
  }

  // Get all commits for the period
  let commits: Array<{
    hash: string;
    date: string;
    author: string;
    message: string;
  }> = [];

  try {
    commits = await fetchPeriodCommits(git, range);
  } catch {
    return createEmptyWrappedData(codebaseName, targetYear, graph);
  }

  if (commits.length === 0) {
    return createEmptyWrappedData(codebaseName, targetYear, graph);
  }

  // Analyze data in parallel where possible
  const topContributors = analyzeContributors(commits);
  const { topFiles, totalFilesChanged } = await analyzeFileChanges(git, commits, getFileNickname);
  const timePatterns = analyzeTimePatterns(commits);
  const { added: totalLinesAdded, removed: totalLinesRemoved } = await analyzeLinesChanged(
    git,
    targetYear
  );
  const topLanguages = analyzeLanguages(graph);

  // Calculate streaks
  const commitDays = new Set(
    commits
      .map((c) => new Date(c.date).toISOString().split('T')[0])
      .filter((d): d is string => d !== undefined)
  );
  const { longestStreak, currentStreak } = calculateStreaks(commitDays, targetYear);

  // Get busiest periods
  const busiestMonth = getTopEntry(timePatterns.monthCounts);
  const busiestDay = getTopEntry(timePatterns.dayCounts);
  const busiestHour = getTopEntry(timePatterns.hourCounts);

  // Generate fun facts
  const funFacts = generateFunFacts({
    totalCommits: commits.length,
    lateNightCommits: timePatterns.lateNightCommits,
    weekendCommits: timePatterns.weekendCommits,
    topContributor: topContributors[0],
    topFile: topFiles[0],
    busiestHour: busiestHour ? busiestHour[0] : null,
    longestStreak,
  });

  return {
    codebaseName,
    year: targetYear,
    periodStart: periodStart ?? '',
    periodEnd: periodEnd ?? '',
    isGitRepo: true,
    totalCommits: commits.length,
    totalLinesAdded,
    totalLinesRemoved,
    filesChanged: totalFilesChanged,
    topContributors,
    topFiles,
    busiestMonth: busiestMonth ? { month: busiestMonth[0], commits: busiestMonth[1] } : null,
    busiestDay: busiestDay ? { day: busiestDay[0], commits: busiestDay[1] } : null,
    busiestHour: busiestHour ? { hour: busiestHour[0], commits: busiestHour[1] } : null,
    lateNightCommits: timePatterns.lateNightCommits,
    weekendCommits: timePatterns.weekendCommits,
    longestStreak,
    currentStreak,
    topLanguages,
    funFacts,
  };
}

function createEmptyWrappedData(
  codebaseName: string,
  year: number,
  graph: KnowledgeGraph,
  periodLabel?: string
): WrappedData {
  return {
    codebaseName,
    year,
    periodStart: periodLabel || `${year}-01-01`,
    periodEnd: periodLabel || `${year}-12-31`,
    isGitRepo: false,
    totalCommits: 0,
    totalLinesAdded: 0,
    totalLinesRemoved: 0,
    filesChanged: 0,
    topContributors: [],
    topFiles: [],
    busiestMonth: null,
    busiestDay: null,
    busiestHour: null,
    lateNightCommits: 0,
    weekendCommits: 0,
    longestStreak: 0,
    currentStreak: 0,
    topLanguages: Object.entries(graph.metadata.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => ({
        lang,
        percentage: Math.round(
          (count / Object.values(graph.metadata.languages).reduce((a, b) => a + b, 0)) * 100
        ),
      })),
    funFacts: ['No git history found for this year.'],
  };
}

function calculateStreaks(
  commitDays: Set<string>,
  _year: number
): { longestStreak: number; currentStreak: number } {
  const sortedDays = [...commitDays].sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let streak = 0;
  let prevDate: Date | null = null;

  for (const day of sortedDays) {
    const date = new Date(day);
    if (prevDate) {
      const diffDays = Math.floor((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
    prevDate = date;
  }

  // Check if current streak is still active (includes today or yesterday)
  const today = new Date().toISOString().split('T')[0] ?? '';
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0] ?? '';
  if (commitDays.has(today) || commitDays.has(yesterday)) {
    currentStreak = streak;
  }

  return { longestStreak, currentStreak };
}

function generateFunFacts(data: {
  totalCommits: number;
  lateNightCommits: number;
  weekendCommits: number;
  topContributor: { name: string; commits: number; percentage: number } | undefined;
  topFile: { path: string; commits: number; nickname: string } | undefined;
  busiestHour: number | null;
  longestStreak: number;
}): string[] {
  const facts: string[] = [];

  if (data.lateNightCommits > 0) {
    const percentage = Math.round((data.lateNightCommits / data.totalCommits) * 100);
    if (percentage > 20) {
      facts.push(
        `You're a night owl! ${percentage}% of commits happened between midnight and 5am.`
      );
    } else if (percentage > 5) {
      facts.push(
        `${data.lateNightCommits} commits were made in the dead of night. Sleep is for the weak.`
      );
    }
  }

  if (data.weekendCommits > 0) {
    const percentage = Math.round((data.weekendCommits / data.totalCommits) * 100);
    if (percentage > 30) {
      facts.push(`Weekend warrior! ${percentage}% of commits happened on weekends.`);
    }
  }

  if (data.topContributor && data.topContributor.percentage > 80) {
    facts.push(
      `${data.topContributor.name} carried the team with ${data.topContributor.percentage}% of all commits.`
    );
  }

  if (data.topFile) {
    facts.push(`Your most-edited file was ${data.topFile.path} — you clearly have a favorite.`);
  }

  if (data.busiestHour !== null) {
    const hourStr =
      data.busiestHour === 0
        ? 'midnight'
        : data.busiestHour < 12
          ? `${data.busiestHour}am`
          : data.busiestHour === 12
            ? 'noon'
            : `${data.busiestHour - 12}pm`;
    facts.push(`Peak productivity hour: ${hourStr}. That's when the magic happens.`);
  }

  if (data.longestStreak >= 7) {
    facts.push(`Your longest commit streak was ${data.longestStreak} days. Consistency is key!`);
  }

  if (data.totalCommits >= 365) {
    facts.push(`With ${data.totalCommits} commits, you averaged more than one per day!`);
  } else if (data.totalCommits >= 100) {
    facts.push(`${data.totalCommits} commits this year. That's dedication.`);
  }

  return facts.slice(0, 4);
}

/**
 * Format wrapped data as a shareable summary
 */
export function formatWrapped(data: WrappedData): string {
  const lines: string[] = [];

  lines.push(`YOUR ${data.year} WRAPPED`);
  lines.push(`${data.codebaseName.toUpperCase()} EDITION`);
  lines.push('━'.repeat(45));
  lines.push('');

  if (!data.isGitRepo || data.totalCommits === 0) {
    lines.push('No activity found for this year.');
    lines.push('Either this is a new project, or git history is missing.');
    return lines.join('\n');
  }

  // Big number
  lines.push('THIS YEAR YOU MADE');
  lines.push(`   ${data.totalCommits.toLocaleString()} COMMITS`);
  lines.push('');

  // Lines changed
  if (data.totalLinesAdded > 0 || data.totalLinesRemoved > 0) {
    lines.push(`   +${data.totalLinesAdded.toLocaleString()} lines added`);
    lines.push(`   -${data.totalLinesRemoved.toLocaleString()} lines removed`);
    lines.push('');
  }

  // Top contributors
  if (data.topContributors.length > 0) {
    lines.push('YOUR TOP CONTRIBUTORS');
    lines.push('─'.repeat(30));
    for (let i = 0; i < Math.min(3, data.topContributors.length); i++) {
      const c = data.topContributors[i];
      if (!c) continue;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      lines.push(`${medal} ${c.name} (${c.commits} commits, ${c.percentage}%)`);
    }
    lines.push('');
  }

  // Top files
  if (data.topFiles.length > 0) {
    lines.push('YOUR TOP TRACKS (Most Edited Files)');
    lines.push('─'.repeat(30));
    for (let i = 0; i < Math.min(5, data.topFiles.length); i++) {
      const f = data.topFiles[i];
      if (!f) continue;
      lines.push(`${i + 1}. ${f.path}`);
      lines.push(`   "${f.nickname}" — ${f.commits} edits`);
    }
    lines.push('');
  }

  // Languages
  if (data.topLanguages.length > 0) {
    lines.push('YOUR TOP GENRES (Languages)');
    lines.push('─'.repeat(30));
    for (const lang of data.topLanguages) {
      const bar = '█'.repeat(Math.ceil(lang.percentage / 10));
      lines.push(`${lang.lang.padEnd(12)} ${bar} ${lang.percentage}%`);
    }
    lines.push('');
  }

  // Time patterns
  if (data.busiestMonth) {
    lines.push('BUSIEST MONTH');
    lines.push(`   📅 ${data.busiestMonth.month} (${data.busiestMonth.commits} commits)`);
    lines.push('');
  }

  // Streaks
  if (data.longestStreak > 0) {
    lines.push('STREAKS');
    lines.push(`   🔥 Longest streak: ${data.longestStreak} days`);
    if (data.currentStreak > 0) {
      lines.push(`   ⚡ Current streak: ${data.currentStreak} days`);
    }
    lines.push('');
  }

  // Fun facts
  if (data.funFacts.length > 0) {
    lines.push('FUN FACTS');
    lines.push('─'.repeat(30));
    for (const fact of data.funFacts) {
      lines.push(`• ${fact}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(45));
  lines.push(`Thanks for coding with ${data.codebaseName} in ${data.year}!`);
  lines.push('#SpecterWrapped');

  return lines.join('\n');
}
