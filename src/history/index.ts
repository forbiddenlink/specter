/**
 * Health History Module
 *
 * Track and analyze codebase health over time.
 */

// Types
export type {
  HealthSnapshot,
  HealthTrend,
  TrendAnalysis,
} from './types.js';

// Snapshot creation
export {
  createSnapshot,
  diffSnapshots,
  percentChange,
} from './snapshot.js';

// Storage
export {
  getHistoryDir,
  saveSnapshot,
  loadSnapshots,
  loadSnapshotsInRange,
  getLatestSnapshot,
  getSnapshotById,
  getSnapshotCount,
  clearHistory,
} from './storage.js';

// Trend analysis
export {
  filterByPeriod,
  calculateTrend,
  analyzeTrends,
  getTimeSpan,
} from './trends.js';
