/**
 * Progress Bar Utilities
 *
 * Terminal progress bars, meters, and visual indicators
 * for displaying numeric data in a visual format.
 */

import chalk from 'chalk';
import { getHealthColor, getComplexityColor, colors } from './colors.js';

/**
 * Options for customizing progress bar appearance
 */
export interface ProgressBarOptions {
  /** Width of the bar in characters (default: 20) */
  width?: number;
  /** Character for filled portion (default: '\u2588') */
  filled?: string;
  /** Character for empty portion (default: '\u2591') */
  empty?: string;
  /** Show percentage after bar (default: false) */
  showPercent?: boolean;
  /** Show value/max after bar (default: false) */
  showValue?: boolean;
  /** Maximum value for scaling (default: same as max parameter) */
  maxValue?: number;
  /** Custom color function (default: none) */
  color?: (s: string) => string;
}

/**
 * Sparkline characters for trend visualization
 */
const SPARKLINE_CHARS = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

/**
 * Create a basic progress bar
 *
 * @param value - Current value
 * @param max - Maximum value
 * @param options - Customization options
 * @returns Formatted progress bar string
 *
 * @example
 * progressBar(75, 100, { width: 20, showPercent: true })
 * // Returns: "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591 75%"
 */
export function progressBar(value: number, max: number, options: ProgressBarOptions = {}): string {
  const {
    width = 20,
    filled = '\u2588',
    empty = '\u2591',
    showPercent = false,
    showValue = false,
    maxValue,
    color,
  } = options;

  // Handle edge cases
  if (max <= 0) return empty.repeat(width);
  if (value < 0) value = 0;
  if (value > max) value = max;

  const ratio = value / max;
  const filledCount = Math.round(ratio * width);
  const emptyCount = width - filledCount;

  let bar = filled.repeat(filledCount) + chalk.dim(empty.repeat(emptyCount));

  if (color) {
    bar = color(filled.repeat(filledCount)) + chalk.dim(empty.repeat(emptyCount));
  }

  const suffix: string[] = [];
  if (showPercent) {
    suffix.push(`${Math.round(ratio * 100)}%`);
  }
  if (showValue) {
    const displayMax = maxValue ?? max;
    suffix.push(`${value}/${displayMax}`);
  }

  return suffix.length > 0 ? `${bar} ${suffix.join(' ')}` : bar;
}

/**
 * Create a health-colored progress bar
 * Automatically colors based on value (higher = greener)
 *
 * @param score - Health score (0-100)
 * @param width - Bar width in characters (default: 20)
 * @returns Colored progress bar string
 */
export function healthBar(score: number, width: number = 20): string {
  const color = getHealthColor(score);
  return progressBar(score, 100, { width, color, showPercent: true });
}

/**
 * Create a complexity meter (inverse coloring - higher is worse)
 * Useful for showing complexity where lower is better
 *
 * @param complexity - Complexity value
 * @param maxComplexity - Maximum complexity for scaling (default: 30)
 * @param width - Bar width in characters (default: 20)
 * @returns Colored complexity meter string
 */
export function complexityMeter(
  complexity: number,
  maxComplexity: number = 30,
  width: number = 20
): string {
  const color = getComplexityColor(complexity);
  const clampedComplexity = Math.min(complexity, maxComplexity);
  return progressBar(clampedComplexity, maxComplexity, { width, color });
}

/**
 * Create a sparkline from an array of values
 * Great for showing trends over time in a compact format
 *
 * @param values - Array of numeric values
 * @returns Sparkline string
 *
 * @example
 * sparkline([1, 3, 5, 7, 5, 3, 1])
 * // Returns: "\u2581\u2583\u2585\u2587\u2585\u2583\u2581"
 */
export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return SPARKLINE_CHARS[4]; // middle height

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Avoid division by zero

  return values
    .map(v => {
      const normalized = (v - min) / range;
      const index = Math.round(normalized * (SPARKLINE_CHARS.length - 1));
      return SPARKLINE_CHARS[index];
    })
    .join('');
}

/**
 * Create a colored sparkline where trend direction affects color
 *
 * @param values - Array of numeric values
 * @param higherIsBetter - If true, upward trends are green (default: true)
 * @returns Colored sparkline string
 */
export function coloredSparkline(values: number[], higherIsBetter: boolean = true): string {
  if (values.length < 2) return sparkline(values);

  const line = sparkline(values);
  const first = values[0];
  const last = values[values.length - 1];
  const trend = last - first;

  const isPositiveTrend = higherIsBetter ? trend > 0 : trend < 0;
  const isNegativeTrend = higherIsBetter ? trend < 0 : trend > 0;

  if (isPositiveTrend) return colors.healthy(line);
  if (isNegativeTrend) return colors.critical(line);
  return colors.warning(line);
}

/**
 * Create a comparison bar showing two values side by side
 * Useful for before/after comparisons
 *
 * @param value1 - First value (shown on left)
 * @param value2 - Second value (shown on right)
 * @param max - Maximum value for scaling
 * @param width - Total bar width (default: 20)
 * @returns Comparison bar string
 *
 * @example
 * compareBar(30, 70, 100, 20)
 * // Returns a bar showing 30% in cyan and 70% in magenta
 */
export function compareBar(
  value1: number,
  value2: number,
  max: number,
  width: number = 20
): string {
  if (max <= 0) return ' '.repeat(width);

  const ratio1 = Math.min(value1 / max, 1);
  const ratio2 = Math.min(value2 / max, 1);

  const filled1 = Math.round(ratio1 * width);
  const filled2 = Math.round(ratio2 * width);

  const bar1 = colors.primary('\u2588'.repeat(filled1));
  const bar2 = colors.secondary('\u2588'.repeat(filled2));
  const empty1 = chalk.dim('\u2591'.repeat(width - filled1));
  const empty2 = chalk.dim('\u2591'.repeat(width - filled2));

  return `${bar1}${empty1} vs ${bar2}${empty2}`;
}

/**
 * Create a stacked bar showing distribution of categories
 *
 * @param segments - Array of { value, color? } objects
 * @param total - Total value for percentage calculation
 * @param width - Bar width in characters (default: 30)
 * @returns Stacked bar string
 */
export function stackedBar(
  segments: Array<{ value: number; color?: (s: string) => string }>,
  total: number,
  width: number = 30
): string {
  if (total <= 0 || segments.length === 0) {
    return chalk.dim('\u2591'.repeat(width));
  }

  const defaultColors = [colors.healthy, colors.warning, colors.danger, colors.critical];
  let result = '';
  let usedWidth = 0;

  segments.forEach((segment, index) => {
    const ratio = segment.value / total;
    const segmentWidth = Math.round(ratio * width);
    const color = segment.color || defaultColors[index % defaultColors.length];

    result += color('\u2588'.repeat(segmentWidth));
    usedWidth += segmentWidth;
  });

  // Fill any remaining space due to rounding
  if (usedWidth < width) {
    result += chalk.dim('\u2591'.repeat(width - usedWidth));
  }

  return result;
}

/**
 * Create a mini bar for inline use (no padding or labels)
 *
 * @param value - Current value
 * @param max - Maximum value
 * @param width - Bar width (default: 5)
 * @param color - Optional color function
 * @returns Compact bar string
 */
export function miniBar(
  value: number,
  max: number,
  width: number = 5,
  color?: (s: string) => string
): string {
  if (max <= 0) return '\u2591'.repeat(width);

  const ratio = Math.min(value / max, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  const filledStr = '\u2588'.repeat(filled);
  const emptyStr = '\u2591'.repeat(empty);

  return color ? color(filledStr) + chalk.dim(emptyStr) : filledStr + chalk.dim(emptyStr);
}

/**
 * Create a percentage indicator with color
 *
 * @param value - Value to show as percentage
 * @param max - Maximum value (default: 100)
 * @param colorFn - Optional color function (auto-colors by percentage if not provided)
 * @returns Colored percentage string
 */
export function percentIndicator(
  value: number,
  max: number = 100,
  colorFn?: (s: string) => string
): string {
  const percent = Math.round((value / max) * 100);
  const color = colorFn || getHealthColor(percent);
  return color(`${percent}%`);
}
