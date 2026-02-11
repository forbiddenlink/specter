/**
 * Health Trends Types
 *
 * Interfaces for historical snapshots and trend analysis.
 */

export interface HealthSnapshot {
  id: string;                    // ISO timestamp as ID
  timestamp: string;             // ISO date string
  commitHash?: string;           // Git commit at snapshot time
  metrics: {
    fileCount: number;
    totalLines: number;
    avgComplexity: number;
    maxComplexity: number;
    hotspotCount: number;        // Files with complexity > 15
    healthScore: number;         // Calculated 0-100 score
  };
  distribution: {
    low: number;                 // Complexity 1-5
    medium: number;              // Complexity 6-10
    high: number;                // Complexity 11-20
    veryHigh: number;            // Complexity 21+
  };
}

export interface HealthTrend {
  period: 'day' | 'week' | 'month' | 'all';
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;         // Percentage change in health score
  insights: string[];            // Human-readable insights
  snapshots: HealthSnapshot[];   // Snapshots in this period
}

export interface TrendAnalysis {
  current: HealthSnapshot | null;
  previous: HealthSnapshot | null;
  trends: {
    day?: HealthTrend;
    week?: HealthTrend;
    month?: HealthTrend;
    all?: HealthTrend;
  };
  summary: string;              // First-person summary from codebase
}
