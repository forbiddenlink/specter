/**
 * Specter UI Colors
 *
 * Centralized color scheme for consistent terminal output.
 * Uses semantic naming for different severity levels and UI elements.
 */

import chalk from 'chalk';

/**
 * Centralized color palette for Specter UI
 */
export const colors = {
  // Health/severity levels
  healthy: chalk.green,
  warning: chalk.yellow,
  danger: chalk.hex('#FFA500'), // orange
  critical: chalk.red,

  // Semantic colors
  primary: chalk.cyan,
  secondary: chalk.magenta,
  muted: chalk.dim,
  accent: chalk.bold.white,

  // Specific UI elements
  file: chalk.cyan,
  symbol: chalk.yellow,
  complexity: chalk.red,
  success: chalk.green,
  error: chalk.red,
  info: chalk.blue,

  // Box drawing
  border: chalk.bold,
  header: chalk.bold.white,
};

/**
 * Health score thresholds for color mapping
 */
export const HEALTH_THRESHOLDS = {
  excellent: 90,
  good: 70,
  fair: 50,
  poor: 30,
} as const;

/**
 * Complexity thresholds for color mapping
 */
export const COMPLEXITY_THRESHOLDS = {
  low: 5,
  medium: 10,
  high: 20,
} as const;

/**
 * Get the appropriate color function for a health score (0-100)
 * Higher scores are better (green), lower are worse (red)
 */
export function getHealthColor(score: number): (s: string) => string {
  if (score >= HEALTH_THRESHOLDS.excellent) return colors.healthy;
  if (score >= HEALTH_THRESHOLDS.good) return chalk.hex('#90EE90'); // light green
  if (score >= HEALTH_THRESHOLDS.fair) return colors.warning;
  if (score >= HEALTH_THRESHOLDS.poor) return colors.danger;
  return colors.critical;
}

/**
 * Get the appropriate color function for a complexity value
 * Lower complexity is better (green), higher is worse (red)
 */
export function getComplexityColor(complexity: number): (s: string) => string {
  if (complexity <= COMPLEXITY_THRESHOLDS.low) return colors.healthy;
  if (complexity <= COMPLEXITY_THRESHOLDS.medium) return colors.warning;
  if (complexity <= COMPLEXITY_THRESHOLDS.high) return colors.danger;
  return colors.critical;
}

/**
 * Get emoji indicator for health score
 */
export function getHealthEmoji(score: number): string {
  if (score >= HEALTH_THRESHOLDS.excellent) return '\u{1F7E2}'; // green circle
  if (score >= HEALTH_THRESHOLDS.good) return '\u{1F7E1}'; // yellow circle
  if (score >= HEALTH_THRESHOLDS.fair) return '\u{1F7E0}'; // orange circle
  return '\u{1F534}'; // red circle
}

/**
 * Get letter grade from health score (0-100)
 */
export function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get colored grade with appropriate formatting
 */
export function getColoredGrade(score: number): string {
  const grade = getGrade(score);
  const color = getHealthColor(score);
  return color(grade);
}

/**
 * Get complexity category name
 */
export function getComplexityCategory(complexity: number): 'low' | 'medium' | 'high' | 'critical' {
  if (complexity <= COMPLEXITY_THRESHOLDS.low) return 'low';
  if (complexity <= COMPLEXITY_THRESHOLDS.medium) return 'medium';
  if (complexity <= COMPLEXITY_THRESHOLDS.high) return 'high';
  return 'critical';
}

/**
 * Get emoji for complexity level
 */
export function getComplexityEmoji(complexity: number): string {
  const category = getComplexityCategory(complexity);
  switch (category) {
    case 'low':
      return '\u{1F7E2}'; // green circle
    case 'medium':
      return '\u{1F7E1}'; // yellow circle
    case 'high':
      return '\u{1F7E0}'; // orange circle
    case 'critical':
      return '\u{1F534}'; // red circle
  }
}

/**
 * Apply color based on a ratio (0-1) where higher is worse
 * Useful for metrics like churn, coupling strength, etc.
 */
export function getRatioColor(ratio: number): (s: string) => string {
  if (ratio <= 0.25) return colors.healthy;
  if (ratio <= 0.5) return colors.warning;
  if (ratio <= 0.75) return colors.danger;
  return colors.critical;
}

/**
 * Apply color based on a ratio (0-1) where higher is better
 * Useful for metrics like code coverage, test coverage, etc.
 */
export function getInverseRatioColor(ratio: number): (s: string) => string {
  return getRatioColor(1 - ratio);
}
