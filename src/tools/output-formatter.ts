/**
 * Output formatting utilities for reducing complexity in commands
 */

import chalk from 'chalk';

/**
 * Format and colorize output lines based on content patterns
 * Reduces complexity in command register() functions
 */
export function colorizeOutput(
  lines: string[],
  rules: Array<{ pattern: string | RegExp; color: (text: string) => string }> = []
): string[] {
  return lines.map((line) => {
    // Apply custom rules first
    for (const rule of rules) {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
      if (pattern.test(line)) {
        return rule.color(line);
      }
    }

    // Apply default color rules for common patterns
    if (line.includes('\u250F') || line.includes('\u2517') || line.includes('\u2503')) {
      return chalk.bold.red(`  ${line}`);
    }
    if (line.startsWith('SCATTER PLOT') || line.startsWith('QUADRANT') || line.startsWith('TOP')) {
      return chalk.bold.magenta(`  ${line}`);
    }
    if (
      line.startsWith('SUMMARY') ||
      line.startsWith('RECOMMENDATIONS') ||
      line.startsWith('ORIGIN') ||
      line.startsWith('AUTHOR')
    ) {
      return chalk.bold.cyan(`  ${line}`);
    }
    if (line.startsWith('Period:') || line.startsWith('\u2500') || line.startsWith('Legend:')) {
      return chalk.dim(`  ${line}`);
    }
    if (line.includes('\uD83D\uDD34 CRITICAL') || line.includes('\uD83D\uDD34 DANGER')) {
      return chalk.bold.red(`  ${line}`);
    }
    if (line.includes('\uD83D\uDFE0 HIGH') || line.includes('\uD83D\uDFE0 Legacy')) {
      return chalk.yellow(`  ${line}`);
    }
    if (line.includes('\uD83D\uDFE1 MEDIUM') || line.includes('\uD83D\uDFE1 Active')) {
      return chalk.cyan(`  ${line}`);
    }
    if (line.includes('\uD83D\uDFE2') || (line.includes('Healthy') && !line.includes('--'))) {
      return chalk.green(`  ${line}`);
    }
    if (line.includes('Score:')) {
      return chalk.yellow(`  ${line}`);
    }
    if (line.includes('Complexity:') || line.includes('Churn:')) {
      return chalk.dim.cyan(`  ${line}`);
    }
    if (line.includes('Contributors:')) {
      return chalk.dim(`  ${line}`);
    }
    if (line.includes('Estimated effort:')) {
      return chalk.dim.yellow(`  ${line}`);
    }
    if (
      line.includes('\uD83D\uDEA8') ||
      line.includes('\u26A0\uFE0F') ||
      line.includes('\uD83D\uDCCA')
    ) {
      return chalk.italic.yellow(`  ${line}`);
    }
    if (line.includes('\u25B2') || line.includes('\u25B6') || line.includes('\u2502')) {
      return chalk.white(`  ${line}`);
    }
    if (line.includes('\u25CF') || line.includes('\u25CB') || line.includes('\u25E6')) {
      return chalk.white(`  ${line}`);
    }
    if (line.includes('... and')) {
      return chalk.dim(`  ${line}`);
    }

    return chalk.white(`  ${line}`);
  });
}

/**
 * Print formatted lines to console
 */
export function printFormatted(lines: string[]): void {
  console.log();
  for (const line of lines) {
    console.log(line);
  }
  console.log();
}

/**
 * Create simple formatter for command output with default styling
 */
export function createFormatter(defaultColor: (text: string) => string = chalk.white) {
  return (text: string): string => defaultColor(`  ${text}`);
}
