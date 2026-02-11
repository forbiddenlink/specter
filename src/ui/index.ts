/**
 * Specter UI Utilities
 *
 * Centralized exports for all terminal UI components.
 */

// Box drawing utilities
export {
  type BoxOptions,
  box,
  bulletList,
  divider,
  headerBox,
  indent,
  keyValue,
  keyValueList,
  numberedList,
  panel,
  section,
  type TableOptions,
  table,
  tree,
  wrapText,
} from './boxes.js';
// Color utilities
export {
  COMPLEXITY_THRESHOLDS,
  colors,
  getColoredGrade,
  getComplexityCategory,
  getComplexityColor,
  getComplexityEmoji,
  getGrade,
  getHealthColor,
  getHealthEmoji,
  getInverseRatioColor,
  getRatioColor,
  HEALTH_THRESHOLDS,
} from './colors.js';
// Progress bar utilities
export {
  coloredSparkline,
  compareBar,
  complexityMeter,
  healthBar,
  miniBar,
  type ProgressBarOptions,
  percentIndicator,
  progressBar,
  sparkline,
  stackedBar,
} from './progress.js';
