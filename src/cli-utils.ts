/**
 * Global CLI utilities for consistent behavior across commands
 */

import chalk from 'chalk';

interface GlobalOptions {
  quiet: boolean;
  noEmoji: boolean;
  accessible: boolean;
}

export let globalOptions: GlobalOptions = {
  quiet: false,
  noEmoji: false,
  accessible: process.env.SPECTER_ACCESSIBLE === 'true',
};

export function setGlobalOptions(opts: Partial<GlobalOptions>): void {
  globalOptions = { ...globalOptions, ...opts };
}

/**
 * Log output respecting quiet mode
 */
export function log(message: string, force = false): void {
  if (force || !globalOptions.quiet) {
    console.log(message);
  }
}

/**
 * Log error (always shown, even in quiet mode)
 */
export function logError(message: string): void {
  console.error(chalk.red(message));
}

/**
 * Log warning (always shown, even in quiet mode)
 */
export function logWarning(message: string): void {
  console.warn(chalk.yellow(message));
}

/**
 * Get emoji if not disabled
 */
export function emoji(char: string): string {
  return globalOptions.noEmoji ? '' : char;
}

/**
 * Format with accessibility-friendly colors if enabled
 */
export function accessibleColor(
  text: string,
  type: 'success' | 'warning' | 'error' | 'info'
): string {
  if (!globalOptions.accessible) {
    // Standard colors
    switch (type) {
      case 'success':
        return chalk.green(text);
      case 'warning':
        return chalk.yellow(text);
      case 'error':
        return chalk.red(text);
      case 'info':
        return chalk.cyan(text);
    }
  }

  // Accessible colors (colorblind-friendly)
  switch (type) {
    case 'success':
      return chalk.blue(text); // Blue instead of green
    case 'warning':
      return chalk.hex('#FFA500')(text); // Orange instead of yellow
    case 'error':
      return chalk.magenta(text); // Magenta instead of red
    case 'info':
      return chalk.cyan(text); // Cyan is fine
  }
}

/**
 * Progress bar with patterns for accessibility
 */
export function accessibleProgressBar(
  filled: number,
  empty: number,
  type: 'success' | 'warning' | 'error'
): string {
  if (!globalOptions.accessible) {
    // Standard filled/empty characters
    const colors = {
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
    };
    return colors[type]('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  }

  // Accessible version with patterns
  const patterns = {
    success: { filled: '▓', empty: '░', color: chalk.blue },
    warning: { filled: '▒', empty: '░', color: chalk.hex('#FFA500') },
    error: { filled: '▓', empty: '░', color: chalk.magenta },
  };

  const pattern = patterns[type];
  return pattern.color(pattern.filled.repeat(filled)) + chalk.dim(pattern.empty.repeat(empty));
}

/**
 * Show "Next Steps" suggestions after a command
 */
export function showNextSteps(suggestions: Array<{ description: string; command: string }>): void {
  if (globalOptions.quiet || suggestions.length === 0) return;

  console.log();
  console.log(chalk.bold("🔮 WHAT'S NEXT?"));
  for (const suggestion of suggestions) {
    console.log(chalk.dim(`  → ${suggestion.description}`));
    console.log(chalk.cyan(`    ${suggestion.command}`));
  }

  // Occasionally hint about Copilot CLI integration (don't show every time)
  if (Math.random() < 0.15) {
    console.log();
    console.log(chalk.dim('  💡 Tip: Use with GitHub Copilot CLI:'));
    console.log(chalk.dim('     gh copilot suggest "what should I do next with specter?"'));
  }
}

/**
 * Format file path as clickable terminal link
 */
export function fileLink(filePath: string, lineNumber?: number): string {
  const link = lineNumber ? `${filePath}:${lineNumber}` : filePath;
  // Terminal links work in most modern terminals
  return chalk.cyan(link);
}

/**
 * Suggest related commands based on current command
 */
export function getRelatedCommands(currentCommand: string): string[] {
  const related: Record<string, string[]> = {
    health: ['hotspots', 'bus-factor', 'vitals', 'trajectory'],
    hotspots: ['health', 'coupling', 'fix', 'who'],
    scan: ['health', 'hotspots', 'dashboard', 'ask'],
    'bus-factor': ['who', 'knowledge-map', 'reviewers'],
    coupling: ['cycles', 'drift', 'diagram'],
    vitals: ['health', 'trends', 'morning'],
    morning: ['standup', 'precommit', 'achievements'],
    wrapped: ['origin', 'leaderboard', 'achievements'],
    roast: ['health', 'hotspots', 'wrapped'],
  };

  return related[currentCommand] || [];
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for finding similar command names
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Suggest similar commands when user types a typo
 * Returns the closest match if distance <= 2
 */
export function suggestCommand(input: string, allCommands: string[]): string | null {
  let bestMatch: { command: string; distance: number } | null = null;

  for (const cmd of allCommands) {
    const distance = levenshteinDistance(input.toLowerCase(), cmd.toLowerCase());
    // Only suggest if reasonably close (distance <= 2) and better than current best
    if (distance <= 2 && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = { command: cmd, distance };
    }
  }

  return bestMatch?.command ?? null;
}
