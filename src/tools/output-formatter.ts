/**
 * Output formatting utilities for reducing complexity in commands
 */

import chalk from 'chalk';

/**
 * Color rules for different line patterns
 */
const DEFAULT_COLOR_RULES: Array<{ pattern: RegExp; color: (text: string) => string }> = [
  { pattern: /[\u250F\u2517\u2503]/, color: (t) => chalk.bold.red(`  ${t}`) },
  {
    pattern: /^(SCATTER PLOT|QUADRANT|TOP|FROM|ORIGIN)/i,
    color: (t) => chalk.bold.magenta(`  ${t}`),
  },
  {
    pattern: /^(SUMMARY|RECOMMENDATIONS|AUTHOR|CONNECTIONS|PATTERNS|MAJOR)/i,
    color: (t) => chalk.bold.cyan(`  ${t}`),
  },
  { pattern: /^(Period|Legend|─)/, color: (t) => chalk.dim(`  ${t}`) },
  { pattern: /\uD83D\uDD34 (CRITICAL|DANGER)/, color: (t) => chalk.bold.red(`  ${t}`) },
  { pattern: /\uD83D\uDFE0 (HIGH|Legacy)/, color: (t) => chalk.yellow(`  ${t}`) },
  { pattern: /\uD83D\uDFE1 (MEDIUM|Active)/, color: (t) => chalk.cyan(`  ${t}`) },
  { pattern: /\uD83D\uDFE2|Healthy/i, color: (t) => chalk.green(`  ${t}`) },
  { pattern: /Score:/, color: (t) => chalk.yellow(`  ${t}`) },
  { pattern: /(Complexity|Churn):/, color: (t) => chalk.dim.cyan(`  ${t}`) },
  { pattern: /Contributors:/, color: (t) => chalk.dim(`  ${t}`) },
  { pattern: /Estimated effort:/, color: (t) => chalk.dim.yellow(`  ${t}`) },
  { pattern: /(\uD83D\uDEA8|\u26A0|\uD83D\uDCCA)/, color: (t) => chalk.italic.yellow(`  ${t}`) },
  { pattern: /[\u25B2\u25B6\u2502\u2514]/, color: (t) => chalk.white(`  ${t}`) },
  { pattern: /[\u25CF\u25CB\u25E6]/, color: (t) => chalk.white(`  ${t}`) },
  { pattern: /\.\.\. and/, color: (t) => chalk.dim(`  ${t}`) },
];

/**
 * Format and colorize output lines based on content patterns
 * Reduces complexity in command register() functions
 */
export function colorizeOutput(
  lines: string[],
  rules: Array<{ pattern: string | RegExp; color: (text: string) => string }> = []
): string[] {
  // Combine default rules with custom rules
  const allRules = [...DEFAULT_COLOR_RULES, ...rules];

  return lines.map((line) => {
    // Apply rules in order
    for (const rule of allRules) {
      const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
      if (pattern.test(line)) {
        return rule.color(line);
      }
    }

    // Default: white text with left padding
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
