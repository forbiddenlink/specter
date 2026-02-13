/**
 * ANSI escape code utilities for terminal output
 */

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

/**
 * Strip ANSI escape codes from a string
 * Useful for calculating visible text length or plain-text output
 */
export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

/**
 * Get the visible length of a string (excluding ANSI codes)
 */
export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Pad a string to a target visible length (accounting for ANSI codes)
 */
export function padToVisible(str: string, targetLength: number, padChar = ' '): string {
  const visible = visibleLength(str);
  if (visible >= targetLength) return str;
  return str + padChar.repeat(targetLength - visible);
}
