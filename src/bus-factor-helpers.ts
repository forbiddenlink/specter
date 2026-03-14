/**
 * Bus Factor Helper Functions
 *
 * Extracted helper functions for bus factor analysis calculations.
 */

import { calculateContributionScore } from './contribution-helpers.js';
import type { KnowledgeGraph } from './graph/types.js';

export interface ContributorStats {
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  lastCommit: Date;
}

export interface AreaStats {
  files: string[];
  linesOfCode: number;
  contributors: Map<string, ContributorStats>;
  totalCommits: number;
}

export interface ContributorPercentage {
  name: string;
  score: number;
  percentage: number;
}

/**
 * Calculate contribution percentages for all contributors in an area
 */
export function calculateContributorPercentages(
  contributors: Map<string, ContributorStats>
): ContributorPercentage[] {
  const totalContribution = [...contributors.values()].reduce(
    (sum, c) => sum + calculateContributionScore(c.commits, c.linesAdded, c.linesRemoved),
    0
  );

  if (totalContribution === 0) {
    return [];
  }

  return [...contributors.entries()]
    .map(([name, c]) => ({
      name,
      score: calculateContributionScore(c.commits, c.linesAdded, c.linesRemoved),
      percentage: Math.round(
        (calculateContributionScore(c.commits, c.linesAdded, c.linesRemoved) / totalContribution) *
          100
      ),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Determine bus factor based on significant contributors (>= 20% contribution)
 * Returns the bus factor number and the sole owner if bus factor is 1
 */
export function determineBusFactor(contributors: ContributorPercentage[]): {
  busFactor: number;
  soleOwner: string | undefined;
} {
  const significantContributors = contributors.filter((c) => c.percentage >= 20);
  const busFactor = Math.max(1, significantContributors.length);
  const primaryOwner = contributors[0];
  const soleOwner = busFactor === 1 ? primaryOwner?.name : undefined;

  return { busFactor, soleOwner };
}

/**
 * Build a BusFactorRisk object from computed data
 */
export function buildRiskItem(
  area: string,
  busFactor: number,
  soleOwner: string | undefined,
  contributors: ContributorPercentage[],
  linesOfCode: number,
  criticality: 'critical' | 'high' | 'medium' | 'low',
  suggestion: string
): {
  area: string;
  busFactor: number;
  soleOwner?: string;
  contributors: { name: string; percentage: number }[];
  linesOfCode: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
} {
  return {
    area,
    busFactor,
    soleOwner,
    contributors: contributors.slice(0, 5).map((c) => ({
      name: c.name,
      percentage: c.percentage,
    })),
    linesOfCode,
    criticality,
    suggestion,
  };
}

/**
 * Determine criticality based on multiple factors
 * Uses guard clauses for cleaner control flow
 */
export function determineCriticality(
  busFactor: number,
  primaryOwnershipPct: number,
  stats: AreaStats,
  area: string,
  _graph: KnowledgeGraph
): 'critical' | 'high' | 'medium' | 'low' {
  const isCoreArea = ['src/core', 'src/graph', 'src/analyzers', 'core', 'lib'].some((core) =>
    area.startsWith(core)
  );
  const isLargeArea = stats.linesOfCode > 1000 || stats.files.length > 10;

  // Critical: Bus factor 1 AND (80%+ ownership OR core area OR large area)
  if (busFactor === 1 && (primaryOwnershipPct >= 80 || isCoreArea || isLargeArea)) {
    return 'critical';
  }

  // High: Bus factor 1 OR (70%+ ownership AND (core OR large))
  if (busFactor === 1) {
    return 'high';
  }

  if (primaryOwnershipPct >= 70 && (isCoreArea || isLargeArea)) {
    return 'high';
  }

  // Medium: Bus factor 2 OR 60%+ ownership
  if (busFactor <= 2) {
    return 'medium';
  }

  if (primaryOwnershipPct >= 60) {
    return 'medium';
  }

  // Low: Everything else
  return 'low';
}
