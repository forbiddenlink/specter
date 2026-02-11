/**
 * Health History Module
 *
 * Track and analyze codebase health over time.
 */

// Snapshot creation
export {
  createSnapshot,
  diffSnapshots,
  percentChange,
} from './snapshot.js';
// Storage
export {
  clearHistory,
  getHistoryDir,
  getLatestSnapshot,
  getSnapshotById,
  getSnapshotCount,
  loadSnapshots,
  loadSnapshotsInRange,
  saveSnapshot,
} from './storage.js';
// Trend analysis
export {
  analyzeTrends,
  calculateTrend,
  filterByPeriod,
  getTimeSpan,
} from './trends.js';
// Types
export type {
  HealthSnapshot,
  HealthTrend,
  TrendAnalysis,
} from './types.js';
