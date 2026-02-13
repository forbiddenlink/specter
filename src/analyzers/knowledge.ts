/**
 * Knowledge Distribution Analyzer
 *
 * Analyzes git history to identify "bus factor" risks - areas of the
 * codebase where knowledge is concentrated in too few people.
 */

import { simpleGit } from 'simple-git';
import type { BusFactorAnalysis, KnowledgeRisk } from '../graph/types.js';

export interface FileOwnership {
  filePath: string;
  contributors: Map<
    string,
    {
      commits: number;
      linesChanged: number;
      lastCommit: Date;
    }
  >;
  totalCommits: number;
  lastModified: Date;
}

/**
 * Analyze knowledge distribution across the codebase
 */
export async function analyzeKnowledgeDistribution(
  rootDir: string,
  filePaths: string[],
  options: {
    maxCommits?: number;
    criticalThreshold?: number; // Bus factor <= this is critical
  } = {}
): Promise<BusFactorAnalysis> {
  const { maxCommits = 500, criticalThreshold: _criticalThreshold = 1 } = options;

  const git = simpleGit(rootDir);

  try {
    await git.status();
  } catch {
    return {
      overallBusFactor: 0,
      criticalAreas: [],
      ownershipDistribution: [],
      insights: ['Not a git repository'],
    };
  }

  // Analyze ownership per file
  const fileOwnership = new Map<string, FileOwnership>();
  const globalContributors = new Map<string, number>();

  // Get commit log with file stats
  try {
    const log = await git.log({
      maxCount: maxCommits,
      '--stat': null,
      '--name-only': null,
    });

    for (const commit of log.all) {
      const author = commit.author_name;
      globalContributors.set(author, (globalContributors.get(author) || 0) + 1);

      // Parse files from the commit (they come in diff.files or we need to fetch separately)
      // Using raw command for more reliable file extraction
      try {
        const filesRaw = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);

        const files = filesRaw
          .trim()
          .split('\n')
          .filter((f) => f);

        for (const file of files) {
          // Only track source files
          if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;
          if (!filePaths.includes(file)) continue;

          if (!fileOwnership.has(file)) {
            fileOwnership.set(file, {
              filePath: file,
              contributors: new Map(),
              totalCommits: 0,
              lastModified: new Date(commit.date),
            });
          }

          const ownership = fileOwnership.get(file)!;
          ownership.totalCommits++;

          if (new Date(commit.date) > ownership.lastModified) {
            ownership.lastModified = new Date(commit.date);
          }

          const contrib = ownership.contributors.get(author);
          if (contrib) {
            contrib.commits++;
            contrib.lastCommit = new Date(commit.date);
          } else {
            ownership.contributors.set(author, {
              commits: 1,
              linesChanged: 0,
              lastCommit: new Date(commit.date),
            });
          }
        }
      } catch {}
    }
  } catch (error) {
    return {
      overallBusFactor: 0,
      criticalAreas: [],
      ownershipDistribution: [],
      insights: [
        `Error analyzing git history: ${error instanceof Error ? error.message : 'Unknown'}`,
      ],
    };
  }

  // Calculate bus factor for each file
  const knowledgeRisks: KnowledgeRisk[] = [];

  for (const [filePath, ownership] of fileOwnership.entries()) {
    const contributors = [...ownership.contributors.entries()].sort(
      (a, b) => b[1].commits - a[1].commits
    );

    if (contributors.length === 0) continue;

    const firstContributor = contributors[0];
    if (!firstContributor) continue;

    const [primaryOwner, primaryStats] = firstContributor;
    const ownershipPercentage = Math.round((primaryStats.commits / ownership.totalCommits) * 100);

    // Bus factor = number of people who have made significant contributions
    // "Significant" = at least 20% of commits
    const significantThreshold = ownership.totalCommits * 0.2;
    const busFactor = contributors.filter(
      ([_, stats]) => stats.commits >= significantThreshold
    ).length;

    const daysSinceLastChange = Math.floor(
      (Date.now() - ownership.lastModified.getTime()) / (1000 * 60 * 60 * 24)
    );

    const riskLevel = calculateRiskLevel(busFactor, ownershipPercentage, daysSinceLastChange);

    knowledgeRisks.push({
      path: filePath,
      type: 'file',
      busFactor: Math.max(1, busFactor),
      primaryOwner,
      ownershipPercentage,
      totalContributors: contributors.length,
      lastTouchedBy: primaryOwner,
      daysSinceLastChange,
      riskLevel,
    });
  }

  // Sort by risk (critical first)
  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  knowledgeRisks.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  // Calculate overall bus factor
  const criticalAreas = knowledgeRisks.filter(
    (r) => r.riskLevel === 'critical' || r.riskLevel === 'high'
  );
  const overallBusFactor = calculateOverallBusFactor(knowledgeRisks);

  // Calculate ownership distribution
  const ownershipDistribution = calculateOwnershipDistribution(fileOwnership);

  // Generate insights
  const insights = generateInsights(knowledgeRisks, ownershipDistribution, criticalAreas);

  return {
    overallBusFactor,
    criticalAreas: criticalAreas.slice(0, 20),
    ownershipDistribution: ownershipDistribution.slice(0, 10),
    insights,
  };
}

function calculateRiskLevel(
  busFactor: number,
  ownershipPercentage: number,
  daysSinceChange: number
): 'critical' | 'high' | 'medium' | 'low' {
  // Critical: Single owner with 80%+ ownership
  if (busFactor <= 1 && ownershipPercentage >= 80) {
    return 'critical';
  }

  // High: Single significant contributor or 70%+ ownership
  if (busFactor <= 1 || ownershipPercentage >= 70) {
    return 'high';
  }

  // Medium: 2 significant contributors or stale (6+ months)
  if (busFactor <= 2 || daysSinceChange > 180) {
    return 'medium';
  }

  return 'low';
}

function calculateOverallBusFactor(risks: KnowledgeRisk[]): number {
  if (risks.length === 0) return 0;

  // Overall bus factor is the average, weighted toward critical areas
  const weighted = risks.map((r) => {
    const weight = r.riskLevel === 'critical' ? 2 : r.riskLevel === 'high' ? 1.5 : 1;
    return r.busFactor * weight;
  });

  const totalWeight = risks.reduce((sum, r) => {
    return sum + (r.riskLevel === 'critical' ? 2 : r.riskLevel === 'high' ? 1.5 : 1);
  }, 0);

  return Math.round((weighted.reduce((a, b) => a + b, 0) / totalWeight) * 10) / 10;
}

function calculateOwnershipDistribution(
  fileOwnership: Map<string, FileOwnership>
): Array<{ contributor: string; filesOwned: number; percentage: number }> {
  const ownerCount = new Map<string, number>();
  const totalFiles = fileOwnership.size;

  for (const ownership of fileOwnership.values()) {
    const contributors = [...ownership.contributors.entries()].sort(
      (a, b) => b[1].commits - a[1].commits
    );

    const firstContrib = contributors[0];
    if (firstContrib) {
      const [primaryOwner] = firstContrib;
      ownerCount.set(primaryOwner, (ownerCount.get(primaryOwner) || 0) + 1);
    }
  }

  return [...ownerCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([contributor, filesOwned]) => ({
      contributor,
      filesOwned,
      percentage: Math.round((filesOwned / totalFiles) * 100),
    }));
}

function generateInsights(
  risks: KnowledgeRisk[],
  distribution: Array<{ contributor: string; filesOwned: number; percentage: number }>,
  criticalAreas: KnowledgeRisk[]
): string[] {
  const insights: string[] = [];

  // Critical single-owner files
  const singleOwner = risks.filter((r) => r.busFactor === 1 && r.ownershipPercentage >= 80);
  if (singleOwner.length > 0) {
    insights.push(
      `⚠️ ${singleOwner.length} files have a single owner with 80%+ ownership. ` +
        `If they leave, this knowledge could be lost.`
    );
  }

  // Knowledge concentration
  const topContributor = distribution[0];
  if (distribution.length > 0 && topContributor && topContributor.percentage > 50) {
    insights.push(
      `${topContributor.contributor} owns ${topContributor.percentage}% of the codebase. ` +
        `Consider knowledge sharing to reduce risk.`
    );
  }

  // Stale critical areas
  const staleCritical = criticalAreas.filter((a) => a.daysSinceLastChange > 180);
  if (staleCritical.length > 0) {
    insights.push(
      `${staleCritical.length} critical areas haven't been touched in 6+ months. ` +
        `The original authors may have forgotten the details.`
    );
  }

  // Positive insight if things are good
  if (criticalAreas.length === 0) {
    insights.push(
      `Good news! No critical knowledge concentration detected. ` +
        `Your team's knowledge is well-distributed.`
    );
  }

  return insights;
}

/**
 * Analyze knowledge risk for a specific directory
 */
export async function analyzeDirectoryKnowledge(
  rootDir: string,
  directory: string,
  filePaths: string[]
): Promise<KnowledgeRisk | null> {
  const dirFiles = filePaths.filter((f) => f.startsWith(directory));
  if (dirFiles.length === 0) return null;

  const analysis = await analyzeKnowledgeDistribution(rootDir, dirFiles);

  // Aggregate to directory level
  const contributors = new Map<string, number>();
  const _totalCommits = 0;

  for (const risk of analysis.criticalAreas) {
    contributors.set(risk.primaryOwner, (contributors.get(risk.primaryOwner) || 0) + 1);
  }

  const sorted = [...contributors.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const topEntry = sorted[0];
  if (!topEntry) return null;
  const [primaryOwner, filesOwned] = topEntry;

  return {
    path: directory,
    type: 'directory',
    busFactor: sorted.filter(([_, count]) => count >= dirFiles.length * 0.2).length,
    primaryOwner,
    ownershipPercentage: Math.round((filesOwned / dirFiles.length) * 100),
    totalContributors: sorted.length,
    lastTouchedBy: primaryOwner,
    daysSinceLastChange: 0,
    riskLevel: 'medium',
  };
}
