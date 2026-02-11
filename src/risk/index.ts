/**
 * Risk Scoring Module
 *
 * Exports for PR/commit risk analysis functionality.
 */

// Types
export type {
  DiffFile,
  DiffStatus,
  RiskFactor,
  RiskScore,
  DiffSizeAnalysis,
} from './types.js';

// Diff analyzer
export {
  getStagedChanges,
  getBranchChanges,
  getCommitChanges,
  getUnstagedChanges,
  analyzeDiffSize,
} from './diff-analyzer.js';

// Risk scorer
export { calculateRiskScore } from './scorer.js';
