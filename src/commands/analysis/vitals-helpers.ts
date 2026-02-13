/**
 * Helper functions for vitals command
 * Extracts metric calculation and display logic
 */

export interface VitalsMetrics {
  healthScore: number;
  avgComplexity: number;
  busFactorValue: number;
  deadExports: number;
  coverageEstimate: number;
  healthTrend?: number; // health change from previous snapshot
  fileCount: number;
}

/**
 * Determine health status and color
 */
export function getHealthStatus(healthScore: number): {
  color: (str: string) => string;
  status: string;
  indicator: string;
} {
  const chalk = require('chalk');
  const color = healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
  const status = healthScore >= 80 ? 'STABLE' : healthScore >= 60 ? 'ELEVATED' : 'CRITICAL';
  const indicator = `PULSE: ${status}`;

  return { color, status, indicator };
}

/**
 * Determine complexity status and color
 */
export function getComplexityStatus(avgComplexity: number): {
  color: (str: string) => string;
  status: string;
  statusText: string;
} {
  const chalk = require('chalk');
  const color = avgComplexity <= 5 ? chalk.green : avgComplexity <= 10 ? chalk.yellow : chalk.red;
  const status = `${avgComplexity.toFixed(0)}`;
  const statusText =
    avgComplexity <= 5 ? 'healthy' : avgComplexity <= 10 ? '⚠️  warning' : 'critical';

  return { color, status, statusText };
}

/**
 * Determine bus factor status and color
 */
export function getBusFactorStatus(busFactorValue: number): {
  color: (str: string) => string;
  status: string;
  statusText: string;
} {
  const chalk = require('chalk');
  const color = busFactorValue >= 3 ? chalk.green : busFactorValue >= 2 ? chalk.yellow : chalk.red;
  const status = busFactorValue.toFixed(1);
  const statusText =
    busFactorValue >= 3 ? 'healthy' : busFactorValue >= 2 ? '😰 at risk' : 'critical';

  return { color, status, statusText };
}

/**
 * Determine dead exports status and color
 */
export function getDeadExportsStatus(deadExports: number): {
  color: (str: string) => string;
  status: string;
  statusText: string;
  barValue: number;
} {
  const chalk = require('chalk');
  const color = deadExports === 0 ? chalk.green : deadExports <= 5 ? chalk.yellow : chalk.red;
  const status = String(deadExports);
  const statusText = deadExports === 0 ? 'clean' : deadExports <= 5 ? '👻 haunted' : 'infested';
  const barValue = deadExports === 0 ? 0 : Math.min(deadExports, 20);

  return { color, status, statusText, barValue };
}

/**
 * Determine coverage status and color
 */
export function getCoverageStatus(coverageEstimate: number): {
  color: (str: string) => string;
  percent: string;
  statusText: string;
} {
  const chalk = require('chalk');
  const color =
    coverageEstimate >= 80 ? chalk.green : coverageEstimate >= 50 ? chalk.yellow : chalk.red;
  const percent = Math.round(coverageEstimate).toString();
  const statusText =
    coverageEstimate >= 80 ? '🛡️  solid' : coverageEstimate >= 50 ? '🛡️  decent' : 'sparse';

  return { color, percent, statusText };
}

/**
 * Generate diagnosis and prescription based on health score
 */
export function generateDiagnosis(healthScore: number): {
  diagnosis: string;
  prescription: string;
} {
  let diagnosis = 'Stable with minor concerns';
  let prescription = 'Consider refactoring top hotspots';

  if (healthScore >= 90) {
    diagnosis = 'Excellent health - keep it up!';
    prescription = 'Maintain current practices';
  } else if (healthScore >= 80) {
    diagnosis = 'Good health with room to improve';
    prescription = 'Address any complexity warnings';
  } else if (healthScore >= 60) {
    diagnosis = 'Moderate health - attention needed';
    prescription = 'Prioritize refactoring hotspots';
  } else {
    diagnosis = 'Critical - immediate action needed';
    prescription = 'Emergency complexity reduction';
  }

  return { diagnosis, prescription };
}

/**
 * Format health indicator (trend)
 */
export function formatHealthIndicator(trend?: number): string {
  const chalk = require('chalk');
  if (trend === undefined || trend === 0) {
    return chalk.dim('--');
  }
  return trend > 0 ? chalk.green(`📈 +${trend}`) : chalk.red(`${trend}`);
}

/**
 * Create progress bar
 */
export function makeBar(value: number, max: number, width: number = 10): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
