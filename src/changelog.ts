/**
 * Changelog - Auto-generate release notes with personality
 *
 * Generates changelogs from git history with Specter's personality modes.
 */

import { execSync } from 'node:child_process';
import { getPersonality } from './personality/modes.js';
import type { PersonalityMode } from './personality/types.js';

export interface ChangelogEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
  type: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore' | 'other';
  scope?: string;
  breaking: boolean;
}

export interface ChangelogResult {
  entries: ChangelogEntry[];
  fromRef: string;
  toRef: string;
  dateRange: { from: string; to: string };
  stats: {
    features: number;
    fixes: number;
    breaking: number;
    total: number;
    contributors: string[];
  };
}

/**
 * Parse conventional commit message
 */
function parseCommitMessage(message: string): { type: ChangelogEntry['type']; scope?: string; breaking: boolean; description: string } {
  const breakingMatch = message.match(/^(\w+)(?:\(([^)]+)\))?!:\s*(.+)$/);
  const normalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);

  if (breakingMatch) {
    const [, type, scope, description] = breakingMatch;
    return {
      type: mapCommitType(type),
      scope,
      breaking: true,
      description,
    };
  }

  if (normalMatch) {
    const [, type, scope, description] = normalMatch;
    return {
      type: mapCommitType(type),
      scope,
      breaking: message.includes('BREAKING CHANGE'),
      description,
    };
  }

  return {
    type: 'other',
    breaking: false,
    description: message.split('\n')[0],
  };
}

/**
 * Map commit type string to category
 */
function mapCommitType(type: string): ChangelogEntry['type'] {
  const typeMap: Record<string, ChangelogEntry['type']> = {
    feat: 'feat',
    feature: 'feat',
    fix: 'fix',
    bugfix: 'fix',
    refactor: 'refactor',
    docs: 'docs',
    test: 'test',
    tests: 'test',
    chore: 'chore',
    build: 'chore',
    ci: 'chore',
    style: 'chore',
    perf: 'feat',
  };
  return typeMap[type.toLowerCase()] || 'other';
}

/**
 * Generate changelog from git history
 */
export async function generateChangelog(
  rootDir: string,
  options: { since?: string; until?: string; fromTag?: string } = {}
): Promise<ChangelogResult> {
  const { since, until, fromTag } = options;

  // Build git log command
  let range = '';
  if (fromTag) {
    range = `${fromTag}..HEAD`;
  } else if (since) {
    range = `--since="${since}"`;
    if (until) {
      range += ` --until="${until}"`;
    }
  } else {
    // Default: last 50 commits
    range = '-n 50';
  }

  const format = '%H|%s|%an|%ai';
  const cmd = `git log ${range} --format="${format}" --no-merges`;

  let logOutput: string;
  try {
    logOutput = execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
  } catch {
    logOutput = '';
  }

  const entries: ChangelogEntry[] = [];
  const contributors = new Set<string>();

  for (const line of logOutput.split('\n').filter(Boolean)) {
    const [hash, message, author, date] = line.split('|');
    if (!hash || !message) continue;

    const parsed = parseCommitMessage(message);
    contributors.add(author);

    entries.push({
      hash: hash.slice(0, 7),
      message: parsed.description || message,
      author,
      date: date.split(' ')[0], // Just the date part
      type: parsed.type,
      scope: parsed.scope,
      breaking: parsed.breaking,
    });
  }

  // Calculate stats
  const stats = {
    features: entries.filter((e) => e.type === 'feat').length,
    fixes: entries.filter((e) => e.type === 'fix').length,
    breaking: entries.filter((e) => e.breaking).length,
    total: entries.length,
    contributors: Array.from(contributors),
  };

  // Get date range
  const dates = entries.map((e) => e.date).sort();
  const dateRange = {
    from: dates[dates.length - 1] || 'unknown',
    to: dates[0] || 'unknown',
  };

  return {
    entries,
    fromRef: fromTag || since || 'recent',
    toRef: until || 'HEAD',
    dateRange,
    stats,
  };
}

/**
 * Format changelog for display
 */
export function formatChangelog(result: ChangelogResult, personality: PersonalityMode = 'default'): string {
  const config = getPersonality(personality);
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('\u{1F4DD} CHANGELOG');
  lines.push('\u2500'.repeat(50));
  lines.push(`  ${result.dateRange.from} \u2192 ${result.dateRange.to}`);
  lines.push('');

  // Intro with personality
  if (personality === 'roast') {
    lines.push(`  Oh look, ${result.stats.total} commits. Let's see what "progress" looks like...`);
  } else if (personality === 'cheerleader') {
    lines.push(`  \u{1F389} Amazing work! ${result.stats.total} commits of pure awesomeness!`);
  } else if (personality === 'noir') {
    lines.push(`  *flips through the records* ${result.stats.total} changes since last we spoke...`);
  } else if (personality === 'executive') {
    lines.push(`  Executive Summary: ${result.stats.total} changes delivered.`);
  } else {
    lines.push(`  ${result.stats.total} changes since ${result.fromRef}`);
  }
  lines.push('');

  // Breaking Changes (if any)
  const breaking = result.entries.filter((e) => e.breaking);
  if (breaking.length > 0) {
    lines.push('\u{1F6A8} BREAKING CHANGES');
    for (const entry of breaking) {
      lines.push(`   \u2022 ${entry.message} (${entry.hash})`);
    }
    lines.push('');
  }

  // Features
  const features = result.entries.filter((e) => e.type === 'feat');
  if (features.length > 0) {
    lines.push('\u2728 NEW FEATURES');
    for (const entry of features.slice(0, 10)) {
      const scope = entry.scope ? `[${entry.scope}] ` : '';
      lines.push(`   \u2022 ${scope}${entry.message}`);
    }
    if (features.length > 10) {
      lines.push(`   ... and ${features.length - 10} more`);
    }
    lines.push('');
  }

  // Bug Fixes
  const fixes = result.entries.filter((e) => e.type === 'fix');
  if (fixes.length > 0) {
    lines.push('\u{1F41B} BUG FIXES');
    for (const entry of fixes.slice(0, 10)) {
      const scope = entry.scope ? `[${entry.scope}] ` : '';
      lines.push(`   \u2022 ${scope}${entry.message}`);
    }
    if (fixes.length > 10) {
      lines.push(`   ... and ${fixes.length - 10} more`);
    }
    lines.push('');
  }

  // Refactoring
  const refactors = result.entries.filter((e) => e.type === 'refactor');
  if (refactors.length > 0) {
    lines.push('\u{1F527} REFACTORING');
    for (const entry of refactors.slice(0, 5)) {
      lines.push(`   \u2022 ${entry.message}`);
    }
    if (refactors.length > 5) {
      lines.push(`   ... and ${refactors.length - 5} more`);
    }
    lines.push('');
  }

  // Other changes (grouped)
  const other = result.entries.filter((e) => ['docs', 'test', 'chore', 'other'].includes(e.type));
  if (other.length > 0) {
    lines.push('\u{1F4E6} OTHER CHANGES');
    lines.push(`   ${other.length} documentation, test, and maintenance updates`);
    lines.push('');
  }

  // Contributors
  if (result.stats.contributors.length > 0) {
    lines.push('\u{1F465} CONTRIBUTORS');
    lines.push(`   ${result.stats.contributors.slice(0, 5).join(', ')}`);
    if (result.stats.contributors.length > 5) {
      lines.push(`   ... and ${result.stats.contributors.length - 5} others`);
    }
    lines.push('');
  }

  // Closing with personality
  lines.push('\u2500'.repeat(50));
  if (personality === 'roast') {
    lines.push(`  ${result.stats.features} features, ${result.stats.fixes} fixes. Could be worse.`);
  } else if (personality === 'cheerleader') {
    lines.push(`  ${result.stats.features} features + ${result.stats.fixes} fixes = PROGRESS! \u{1F680}`);
  } else if (personality === 'executive') {
    lines.push(`  Delivery metrics: ${result.stats.features} features, ${result.stats.fixes} defect resolutions.`);
  } else {
    lines.push(`  ${result.stats.features} features, ${result.stats.fixes} bug fixes`);
  }
  lines.push('');

  return lines.join('\n');
}
