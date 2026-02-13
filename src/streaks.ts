/**
 * Streak Tracking System
 *
 * Tracks daily CLI usage to maintain engagement streaks.
 * Stores streak data in `.specter/streaks.json` in the project root.
 */

import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

export interface StreakData {
  /** Current consecutive days of usage */
  currentStreak: number;
  /** Longest streak ever recorded */
  longestStreak: number;
  /** ISO date string (YYYY-MM-DD) of last active day */
  lastActiveDate: string;
  /** Total number of unique days with activity */
  totalDays: number;
  /** Map of command name to invocation count */
  commandCounts: Record<string, number>;
}

const DEFAULT_STREAK_DATA: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  totalDays: 0,
  commandCounts: {},
};

/**
 * Get the path to the streaks JSON file for a given project root.
 */
function getStreakPath(rootDir: string): string {
  return path.join(rootDir, '.specter', 'streaks.json');
}

/**
 * Get today's date as a YYYY-MM-DD string in local time.
 */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the number of calendar days between two YYYY-MM-DD date strings.
 * Returns the absolute difference in days.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Load streak data from disk. Returns default data if file doesn't exist.
 */
function loadStreakData(rootDir: string): StreakData {
  const filePath = getStreakPath(rootDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return {
      ...DEFAULT_STREAK_DATA,
      ...parsed,
      commandCounts: { ...parsed.commandCounts },
    };
  } catch {
    return { ...DEFAULT_STREAK_DATA, commandCounts: {} };
  }
}

/**
 * Save streak data to disk, creating the .specter directory if needed.
 */
function saveStreakData(rootDir: string, data: StreakData): void {
  const dirPath = path.join(rootDir, '.specter');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = getStreakPath(rootDir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Record activity for the current day.
 * Updates the streak counters and command usage counts.
 *
 * @param rootDir - Project root directory
 * @param command - Name of the command that was invoked
 */
export function recordActivity(rootDir: string, command: string): void {
  const data = loadStreakData(rootDir);
  const today = getTodayDate();

  if (data.lastActiveDate === today) {
    // Already recorded activity today - just increment command count
    data.commandCounts[command] = (data.commandCounts[command] ?? 0) + 1;
    saveStreakData(rootDir, data);
    return;
  }

  // New day of activity
  const gap = data.lastActiveDate ? daysBetween(data.lastActiveDate, today) : 0;

  if (gap === 1) {
    // Consecutive day - extend streak
    data.currentStreak += 1;
  } else if (gap === 0 && data.lastActiveDate === '') {
    // First ever activity
    data.currentStreak = 1;
  } else {
    // Streak broken (gap > 1) or first activity
    data.currentStreak = 1;
  }

  data.totalDays += 1;
  data.lastActiveDate = today;
  data.commandCounts[command] = (data.commandCounts[command] ?? 0) + 1;

  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  saveStreakData(rootDir, data);
}

/**
 * Get the current streak information for a project.
 *
 * @param rootDir - Project root directory
 * @returns Current streak data
 */
export function getStreakInfo(rootDir: string): StreakData {
  const data = loadStreakData(rootDir);
  const today = getTodayDate();

  // If the last active date is more than 1 day ago, the streak is broken
  if (data.lastActiveDate && daysBetween(data.lastActiveDate, today) > 1) {
    return {
      ...data,
      currentStreak: 0,
    };
  }

  return data;
}

/**
 * Get fire emoji progression based on streak length.
 *
 * - 1-3 days: single fire
 * - 4-7 days: double fire
 * - 8-14 days: triple fire
 * - 15+ days: lightning fire combo
 */
export function getStreakEmoji(days: number): string {
  if (days <= 0) return '';
  if (days <= 3) return '\u{1F525}';
  if (days <= 7) return '\u{1F525}\u{1F525}';
  if (days <= 14) return '\u{1F525}\u{1F525}\u{1F525}';
  return '\u{26A1}\u{1F525}\u{26A1}';
}

/**
 * Format a one-line streak banner for display.
 *
 * Example: "🔥 3-day streak! (longest: 7)"
 */
export function formatStreakBanner(info: StreakData): string {
  if (info.currentStreak <= 0) {
    return 'No active streak. Run a command to start one!';
  }

  const emoji = getStreakEmoji(info.currentStreak);
  const dayLabel = info.currentStreak === 1 ? 'day' : 'days';
  return `${emoji} ${info.currentStreak}-${dayLabel} streak! (longest: ${info.longestStreak})`;
}

/**
 * Daily Challenge System
 *
 * Deterministically picks a challenge each day from a fixed pool,
 * using the current date as a seed.
 */

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  command: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const CHALLENGE_POOL: DailyChallenge[] = [
  {
    id: 'health-check',
    title: 'Health Check',
    description: 'Run `specter health` and check your score',
    emoji: '\u{1FA7A}',
    command: 'health',
    difficulty: 'easy',
  },
  {
    id: 'reduce-complexity',
    title: 'Complexity Crusher',
    description: 'Reduce complexity in your hottest file',
    emoji: '\u{1F9E0}',
    command: 'health',
    difficulty: 'hard',
  },
  {
    id: 'roast',
    title: 'Roast Session',
    description: 'Run `specter roast` and share the results',
    emoji: '\u{1F525}',
    command: 'roast',
    difficulty: 'easy',
  },
  {
    id: 'dead-code',
    title: 'Dead Code Hunter',
    description: 'Fix a dead code issue found by `specter dead-code`',
    emoji: '\u{1F480}',
    command: 'dead-code',
    difficulty: 'medium',
  },
  {
    id: 'bus-factor',
    title: 'Bus Factor Audit',
    description: 'Check your bus factor with `specter bus-factor`',
    emoji: '\u{1F68C}',
    command: 'bus-factor',
    difficulty: 'easy',
  },
  {
    id: 'morning',
    title: 'Morning Briefing',
    description: 'Run `specter morning` for your daily briefing',
    emoji: '\u{2615}',
    command: 'morning',
    difficulty: 'easy',
  },
  {
    id: 'review',
    title: 'PR Reviewer',
    description: 'Review a PR with `specter review`',
    emoji: '\u{1F50D}',
    command: 'review',
    difficulty: 'medium',
  },
  {
    id: 'coupling',
    title: 'Decoupler',
    description: 'Find and fix a coupling issue with `specter coupling`',
    emoji: '\u{1F517}',
    command: 'coupling',
    difficulty: 'hard',
  },
  {
    id: 'dora',
    title: 'DORA Deep Dive',
    description: 'Check your DORA metrics with `specter dora`',
    emoji: '\u{1F4CA}',
    command: 'dora',
    difficulty: 'easy',
  },
  {
    id: 'achievements',
    title: 'Badge Collector',
    description: 'Run `specter achievements` to unlock new badges',
    emoji: '\u{1F3C6}',
    command: 'achievements',
    difficulty: 'easy',
  },
  {
    id: 'scan',
    title: 'Full Scan',
    description: 'Scan your codebase with `specter scan --force`',
    emoji: '\u{1F4E1}',
    command: 'scan --force',
    difficulty: 'easy',
  },
  {
    id: 'horoscope',
    title: 'Code Horoscope',
    description: 'Get your code horoscope with `specter horoscope`',
    emoji: '\u{1F52E}',
    command: 'horoscope',
    difficulty: 'easy',
  },
  {
    id: 'dna',
    title: 'Code DNA',
    description: 'Generate your code DNA with `specter dna`',
    emoji: '\u{1F9EC}',
    command: 'dna',
    difficulty: 'easy',
  },
  {
    id: 'tinder',
    title: 'Code Tinder',
    description: 'Create a Tinder profile for your code with `specter tinder`',
    emoji: '\u{1F496}',
    command: 'tinder',
    difficulty: 'easy',
  },
  {
    id: 'confess',
    title: 'Code Confession',
    description: 'Confess a coding sin with `specter confess`',
    emoji: '\u{1F64F}',
    command: 'confess',
    difficulty: 'easy',
  },
];

/**
 * Get the daily challenge for today.
 * Uses the current date as a deterministic seed to pick from the pool.
 *
 * @param _rootDir - Project root directory (reserved for future per-project tracking)
 * @returns The challenge for today
 */
export function getDailyChallenge(_rootDir: string): DailyChallenge {
  const today = getTodayDate();
  // Simple deterministic hash from date string
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    const ch = today.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const index = Math.abs(hash) % CHALLENGE_POOL.length;
  const challenge = CHALLENGE_POOL[index];
  // CHALLENGE_POOL is non-empty and index is always valid, but TypeScript needs this guard
  if (!challenge) {
    throw new Error('Challenge pool is empty');
  }
  return challenge;
}

/**
 * Format a daily challenge for terminal display.
 */
export function formatDailyChallenge(challenge: DailyChallenge): string {
  const difficultyColors: Record<DailyChallenge['difficulty'], (text: string) => string> = {
    easy: chalk.green,
    medium: chalk.yellow,
    hard: chalk.red,
  };

  const colorFn = difficultyColors[challenge.difficulty];
  const lines = [
    '',
    `  ${challenge.emoji} ${chalk.bold.white('Daily Challenge:')} ${chalk.bold.cyan(challenge.title)}`,
    `     ${chalk.white(challenge.description)}`,
    `     ${chalk.dim('Run:')} ${chalk.white(`specter ${challenge.command}`)}`,
    `     ${chalk.dim('Difficulty:')} ${colorFn(challenge.difficulty)}`,
  ];

  return lines.join('\n');
}
