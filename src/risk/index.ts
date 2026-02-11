/**
 * Risk Scoring Module
 *
 * Exports for PR/commit risk analysis functionality.
 */

// Diff analyzer
export {
  analyzeDiffSize,
  getBranchChanges,
  getCommitChanges,
  getStagedChanges,
  getUnstagedChanges,
} from './diff-analyzer.js';
// Risk scorer
export { calculateRiskScore } from './scorer.js';
// Types
export type {
  DiffFile,
  DiffSizeAnalysis,
  DiffStatus,
  RiskFactor,
  RiskScore,
} from './types.js';
