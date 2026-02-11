/**
 * Specter Configuration System
 *
 * Provides typed, validated configuration with sensible defaults.
 * Configuration can be customized via specter.config.json in project root.
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Complexity thresholds for categorizing functions
 */
const ComplexityThresholdsSchema = z.object({
  /** Upper bound for "low" complexity (default: 5) */
  low: z.number().min(1).max(50).default(5),
  /** Upper bound for "medium" complexity (default: 10) */
  medium: z.number().min(1).max(100).default(10),
  /** Upper bound for "high" complexity (default: 20) */
  high: z.number().min(1).max(200).default(20),
});

/**
 * Risk scoring weights (should sum to 1.0)
 */
const RiskWeightsSchema = z.object({
  /** Weight for files changed factor (default: 0.15) */
  filesChanged: z.number().min(0).max(1).default(0.15),
  /** Weight for lines changed factor (default: 0.15) */
  linesChanged: z.number().min(0).max(1).default(0.15),
  /** Weight for complexity touched factor (default: 0.25) */
  complexityTouched: z.number().min(0).max(1).default(0.25),
  /** Weight for dependent impact factor (default: 0.25) */
  dependentImpact: z.number().min(0).max(1).default(0.25),
  /** Weight for bus factor risk (default: 0.1) */
  busFactorRisk: z.number().min(0).max(1).default(0.1),
  /** Weight for test coverage factor (default: 0.1) */
  testCoverage: z.number().min(0).max(1).default(0.1),
});

/**
 * Risk level thresholds
 */
const RiskLevelsSchema = z.object({
  /** Max score for "low" risk (default: 25) */
  low: z.number().min(0).max(100).default(25),
  /** Max score for "medium" risk (default: 50) */
  medium: z.number().min(0).max(100).default(50),
  /** Max score for "high" risk (default: 75) */
  high: z.number().min(0).max(100).default(75),
});

/**
 * Files changed thresholds for risk scoring
 */
const FilesChangedThresholdsSchema = z.object({
  /** Max files for "small" change (default: 3) */
  small: z.number().min(1).default(3),
  /** Max files for "moderate" change (default: 10) */
  moderate: z.number().min(1).default(10),
  /** Max files for "large" change (default: 20) */
  large: z.number().min(1).default(20),
});

/**
 * Lines changed thresholds for risk scoring
 */
const LinesChangedThresholdsSchema = z.object({
  /** Max lines for "minor" change (default: 50) */
  minor: z.number().min(1).default(50),
  /** Max lines for "moderate" change (default: 200) */
  moderate: z.number().min(1).default(200),
  /** Max lines for "significant" change (default: 500) */
  significant: z.number().min(1).default(500),
  /** Max lines for "large" change (default: 1000) */
  large: z.number().min(1).default(1000),
});

/**
 * Dashboard configuration
 */
const DashboardSchema = z.object({
  /** Default port for dashboard server (default: 3333) */
  port: z.number().min(1024).max(65535).default(3333),
  /** Default host for dashboard server (default: localhost) */
  host: z.string().default('localhost'),
});

/**
 * History configuration
 */
const HistorySchema = z.object({
  /** Maximum number of health snapshots to keep (default: 100) */
  maxSnapshots: z.number().min(1).max(10000).default(100),
});

/**
 * Git analysis configuration
 */
const GitSchema = z.object({
  /** Max commits to analyze per file (default: 50) */
  maxCommitsPerFile: z.number().min(1).max(1000).default(50),
  /** Max commits to analyze for change coupling (default: 200) */
  maxCommitsForCoupling: z.number().min(1).max(2000).default(200),
  /** Minimum coupling strength to report (default: 0.3) */
  minCouplingStrength: z.number().min(0).max(1).default(0.3),
  /** Commit threshold for "hot" files (default: 10) */
  hotFileThreshold: z.number().min(1).default(10),
  /** Batch size for git operations (default: 10) */
  batchSize: z.number().min(1).max(100).default(10),
});

/**
 * Impact analysis configuration
 */
const ImpactAnalysisSchema = z.object({
  /** Max depth for indirect dependency search (default: 2) */
  maxIndirectDepth: z.number().min(1).max(10).default(2),
  /** Weights for impact score calculation */
  weights: z
    .object({
      dependency: z.number().min(0).max(1).default(0.35),
      coupling: z.number().min(0).max(1).default(0.25),
      complexity: z.number().min(0).max(1).default(0.25),
      churn: z.number().min(0).max(1).default(0.15),
    })
    .default({}),
});

/**
 * Health scoring configuration
 */
const HealthSchema = z.object({
  /** Multiplier for complexity impact on health score (default: 5) */
  complexityMultiplier: z.number().min(1).max(20).default(5),
  /** Grade thresholds */
  grades: z
    .object({
      a: z.number().min(0).max(100).default(90),
      b: z.number().min(0).max(100).default(80),
      c: z.number().min(0).max(100).default(70),
      d: z.number().min(0).max(100).default(60),
    })
    .default({}),
  /** Threshold for trend direction change (default: 2) */
  trendChangeThreshold: z.number().min(0).max(20).default(2),
});

/**
 * Analysis limits
 */
const LimitsSchema = z.object({
  /** Default limit for hotspots to display (default: 10) */
  defaultHotspotsLimit: z.number().min(1).max(1000).default(10),
  /** Max hotspots in complexity report (default: 20) */
  maxReportHotspots: z.number().min(1).max(1000).default(20),
  /** Max items to show in risk factor lists (default: 5) */
  maxRiskFactorItems: z.number().min(1).max(50).default(5),
});

/**
 * Full Specter configuration schema
 */
const SpecterConfigSchema = z.object({
  /** Complexity thresholds for categorizing functions */
  complexity: ComplexityThresholdsSchema.default({}),
  /** Risk scoring configuration */
  risk: z
    .object({
      weights: RiskWeightsSchema.default({}),
      levels: RiskLevelsSchema.default({}),
      filesChanged: FilesChangedThresholdsSchema.default({}),
      linesChanged: LinesChangedThresholdsSchema.default({}),
    })
    .default({}),
  /** Dashboard server configuration */
  dashboard: DashboardSchema.default({}),
  /** History/snapshots configuration */
  history: HistorySchema.default({}),
  /** Git analysis configuration */
  git: GitSchema.default({}),
  /** Impact analysis configuration */
  impact: ImpactAnalysisSchema.default({}),
  /** Health scoring configuration */
  health: HealthSchema.default({}),
  /** Various limits and display options */
  limits: LimitsSchema.default({}),
});

/**
 * Type for the full Specter configuration
 */
export type SpecterConfig = z.infer<typeof SpecterConfigSchema>;

/**
 * Type for complexity thresholds
 */
export type ComplexityThresholds = z.infer<typeof ComplexityThresholdsSchema>;

/**
 * Type for risk weights
 */
export type RiskWeights = z.infer<typeof RiskWeightsSchema>;

/**
 * Type for risk levels
 */
export type RiskLevels = z.infer<typeof RiskLevelsSchema>;

/**
 * Default configuration (used when no config file exists)
 */
export const DEFAULT_CONFIG: SpecterConfig = SpecterConfigSchema.parse({});

// Cached configuration per root directory
const configCache = new Map<string, SpecterConfig>();

/**
 * Load configuration from specter.config.json if it exists
 */
export function loadConfig(rootDir: string): SpecterConfig {
  // Check cache first
  const cached = configCache.get(rootDir);
  if (cached) {
    return cached;
  }

  const configPath = path.join(rootDir, 'specter.config.json');

  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = JSON.parse(configContent);
      const validated = SpecterConfigSchema.parse(rawConfig);
      configCache.set(rootDir, validated);
      return validated;
    }
  } catch (error) {
    // Log warning but continue with defaults
    console.warn(
      `Warning: Failed to load specter.config.json: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Return defaults if no config file or error
  configCache.set(rootDir, DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Get config synchronously, initializing with defaults if needed
 */
export function getConfig(rootDir: string): SpecterConfig {
  return loadConfig(rootDir);
}

/**
 * Clear the config cache (useful for testing or when config changes)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Validate a partial config object
 */
export function validateConfig(config: unknown): SpecterConfig {
  return SpecterConfigSchema.parse(config);
}

/**
 * Get the config schema for documentation purposes
 */
export function getConfigSchema() {
  return SpecterConfigSchema;
}

// Re-export the schema for external use
export { SpecterConfigSchema };
