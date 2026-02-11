/**
 * Specter UI Utilities
 *
 * Centralized exports for all terminal UI components.
 */

// Color utilities
export {
  colors,
  HEALTH_THRESHOLDS,
  COMPLEXITY_THRESHOLDS,
  getHealthColor,
  getComplexityColor,
  getHealthEmoji,
  getGrade,
  getColoredGrade,
  getComplexityCategory,
  getComplexityEmoji,
  getRatioColor,
  getInverseRatioColor,
} from './colors.js';

// Progress bar utilities
export {
  type ProgressBarOptions,
  progressBar,
  healthBar,
  complexityMeter,
  sparkline,
  coloredSparkline,
  compareBar,
  stackedBar,
  miniBar,
  percentIndicator,
} from './progress.js';

// Box drawing utilities
export {
  type BoxOptions,
  type TableOptions,
  box,
  headerBox,
  section,
  divider,
  keyValue,
  keyValueList,
  table,
  panel,
  indent,
  bulletList,
  numberedList,
  tree,
  wrapText,
} from './boxes.js';
