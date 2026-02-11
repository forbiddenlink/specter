/**
 * Risk Scoring Types
 *
 * Interfaces for commit and PR risk analysis.
 */

export type DiffStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface DiffFile {
  filePath: string;
  status: DiffStatus;
  additions: number;
  deletions: number;
  isBinary: boolean;
}

export interface RiskFactor {
  name: string;
  score: number; // 0-100
  weight: number; // How much this contributes to overall
  details: string; // Human-readable explanation
  items?: string[]; // Specific files or issues
}

export interface RiskScore {
  overall: number; // 0-100, weighted average
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    filesChanged: RiskFactor;
    linesChanged: RiskFactor;
    complexityTouched: RiskFactor;
    dependentImpact: RiskFactor;
    busFactorRisk: RiskFactor;
    testCoverage: RiskFactor;
  };
  recommendations: string[];
  summary: string; // First-person summary
}

export interface DiffSizeAnalysis {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  largestFile: DiffFile | null;
}
