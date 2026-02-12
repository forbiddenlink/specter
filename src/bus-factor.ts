/**
 * Bus Factor Analysis
 *
 * Surfaces bus factor risks prominently as a standalone, focused alert system.
 * Shows which parts of the codebase are at risk if someone leaves.
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface BusFactorRisk {
  area: string;  // Directory or file
  busFactor: number;  // 1 = single person, higher = safer
  soleOwner?: string;  // If bus factor = 1
  contributors: { name: string; percentage: number }[];
  linesOfCode: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface BusFactorResult {
  overallBusFactor: number;
  riskLevel: 'healthy' | 'concerning' | 'dangerous' | 'critical';
  risks: BusFactorRisk[];
  summary: {
    soloOwnedFiles: number;
    soloOwnedLines: number;
    percentageAtRisk: number;
  };
  recommendations: string[];
}

interface ContributorStats {
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  lastCommit: Date;
}

interface AreaStats {
  files: string[];
  linesOfCode: number;
  contributors: Map<string, ContributorStats>;
  totalCommits: number;
}

/**
 * Analyze bus factor risks across the codebase
 */
export async function analyzeBusFactor(
  graph: KnowledgeGraph,
  options: { criticalOnly?: boolean } = {}
): Promise<BusFactorResult> {
  const rootDir = graph.metadata.rootDir;
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      overallBusFactor: 0,
      riskLevel: 'critical',
      risks: [],
      summary: { soloOwnedFiles: 0, soloOwnedLines: 0, percentageAtRisk: 0 },
      recommendations: ['This is not a git repository.'],
    };
  }

  // Get all source files from the graph
  const sourceFiles = Object.values(graph.nodes)
    .filter((n) => n.type === 'file')
    .map((n) => n.filePath);

  if (sourceFiles.length === 0) {
    return {
      overallBusFactor: 0,
      riskLevel: 'critical',
      risks: [],
      summary: { soloOwnedFiles: 0, soloOwnedLines: 0, percentageAtRisk: 0 },
      recommendations: ['No source files found in the knowledge graph.'],
    };
  }

  // Group files by directory area
  const areaStats = groupFilesByArea(sourceFiles, graph);

  // Analyze git history for contributions
  await analyzeGitHistory(git, areaStats, sourceFiles);

  // Calculate bus factor per area
  const risks = calculateAreaRisks(areaStats, graph);

  // Filter to critical only if requested
  const filteredRisks = options.criticalOnly
    ? risks.filter((r) => r.criticality === 'critical')
    : risks;

  // Calculate summary statistics
  const summary = calculateSummary(risks, graph);

  // Calculate overall bus factor
  const overallBusFactor = calculateOverallBusFactor(risks);

  // Determine risk level
  const riskLevel = determineRiskLevel(overallBusFactor, summary.percentageAtRisk);

  // Generate recommendations
  const recommendations = generateRecommendations(filteredRisks, summary, riskLevel);

  return {
    overallBusFactor,
    riskLevel,
    risks: filteredRisks,
    summary,
    recommendations,
  };
}

/**
 * Group files by top-level directory area
 */
function groupFilesByArea(
  files: string[],
  graph: KnowledgeGraph
): Map<string, AreaStats> {
  const areas = new Map<string, AreaStats>();

  for (const file of files) {
    const parts = file.split('/');
    let area: string;

    // Use top-level directory, or src/subdir for src/
    if (parts.length === 1) {
      area = 'root';
    } else if (parts[0] === 'src' && parts.length > 2) {
      area = `src/${parts[1]}`;
    } else {
      area = parts[0];
    }

    if (!areas.has(area)) {
      areas.set(area, {
        files: [],
        linesOfCode: 0,
        contributors: new Map(),
        totalCommits: 0,
      });
    }

    const areaStats = areas.get(area)!;
    areaStats.files.push(file);

    // Get line count from graph
    const node = Object.values(graph.nodes).find(
      (n) => n.type === 'file' && n.filePath === file
    );
    if (node && 'lineCount' in node) {
      areaStats.linesOfCode += (node as { lineCount: number }).lineCount;
    }
  }

  return areas;
}

/**
 * Analyze git history to get contributor stats per area
 */
async function analyzeGitHistory(
  git: SimpleGit,
  areaStats: Map<string, AreaStats>,
  sourceFiles: string[]
): Promise<void> {
  try {
    // Get commit log with numstat for line counts
    const rawLog = await git.raw([
      'log',
      '--numstat',
      '--format=%H|%an|%aI',
      '-500',
    ]);

    let currentAuthor = '';
    let currentDate = new Date();

    for (const line of rawLog.split('\n')) {
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          currentAuthor = parts[1];
          currentDate = new Date(parts[2]);
        }
      } else if (line.match(/^\d+\s+\d+\s+.+/)) {
        const match = line.match(/^(\d+)\s+(\d+)\s+(.+)/);
        if (match && currentAuthor) {
          const added = parseInt(match[1], 10) || 0;
          const removed = parseInt(match[2], 10) || 0;
          const file = match[3];

          // Find which area this file belongs to
          const area = findAreaForFile(file, areaStats, sourceFiles);
          if (area) {
            const stats = areaStats.get(area)!;
            stats.totalCommits++;

            const existing = stats.contributors.get(currentAuthor);
            if (existing) {
              existing.commits++;
              existing.linesAdded += added;
              existing.linesRemoved += removed;
              if (currentDate > existing.lastCommit) {
                existing.lastCommit = currentDate;
              }
            } else {
              stats.contributors.set(currentAuthor, {
                commits: 1,
                linesAdded: added,
                linesRemoved: removed,
                lastCommit: currentDate,
              });
            }
          }
        }
      }
    }
  } catch {
    // Fall back to simpler analysis if numstat fails
    try {
      const log = await git.log({ maxCount: 200 });

      for (const commit of log.all) {
        try {
          const filesRaw = await git.raw([
            'diff-tree',
            '--no-commit-id',
            '--name-only',
            '-r',
            commit.hash,
          ]);

          const files = filesRaw.trim().split('\n').filter((f) => f);

          for (const file of files) {
            const area = findAreaForFile(file, areaStats, sourceFiles);
            if (area) {
              const stats = areaStats.get(area)!;
              stats.totalCommits++;

              const existing = stats.contributors.get(commit.author_name);
              if (existing) {
                existing.commits++;
              } else {
                stats.contributors.set(commit.author_name, {
                  commits: 1,
                  linesAdded: 0,
                  linesRemoved: 0,
                  lastCommit: new Date(commit.date),
                });
              }
            }
          }
        } catch {
          // Skip problematic commits
        }
      }
    } catch {
      // Git analysis failed completely
    }
  }
}

/**
 * Find which area a file belongs to
 */
function findAreaForFile(
  file: string,
  areaStats: Map<string, AreaStats>,
  sourceFiles: string[]
): string | null {
  // Only track source files
  if (!file.match(/\.(ts|tsx|js|jsx)$/)) return null;
  if (!sourceFiles.includes(file)) return null;

  const parts = file.split('/');

  // Check src/ subdirectories first
  if (parts[0] === 'src' && parts.length > 2) {
    const subArea = `src/${parts[1]}`;
    if (areaStats.has(subArea)) {
      return subArea;
    }
  }

  // Check top-level directory
  if (parts.length === 1) {
    if (areaStats.has('root')) {
      return 'root';
    }
  } else if (areaStats.has(parts[0])) {
    return parts[0];
  }

  return null;
}

/**
 * Calculate bus factor risks for each area
 */
function calculateAreaRisks(
  areaStats: Map<string, AreaStats>,
  graph: KnowledgeGraph
): BusFactorRisk[] {
  const risks: BusFactorRisk[] = [];

  for (const [area, stats] of areaStats.entries()) {
    if (stats.contributors.size === 0) continue;

    // Calculate contribution percentages
    const totalContribution = [...stats.contributors.values()].reduce(
      (sum, c) => sum + c.commits + (c.linesAdded + c.linesRemoved) / 10,
      0
    );

    const contributors = [...stats.contributors.entries()]
      .map(([name, c]) => ({
        name,
        score: c.commits + (c.linesAdded + c.linesRemoved) / 10,
        percentage: Math.round(
          ((c.commits + (c.linesAdded + c.linesRemoved) / 10) / totalContribution) * 100
        ),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Bus factor = number of significant contributors (>= 20% contribution)
    const significantContributors = contributors.filter((c) => c.percentage >= 20);
    const busFactor = Math.max(1, significantContributors.length);

    // Get primary owner
    const primaryOwner = contributors[0];
    const soleOwner = busFactor === 1 ? primaryOwner?.name : undefined;

    // Determine criticality
    const criticality = determineCriticality(
      busFactor,
      primaryOwner?.percentage || 0,
      stats,
      area,
      graph
    );

    // Generate suggestion
    const suggestion = generateSuggestion(
      busFactor,
      soleOwner,
      primaryOwner?.percentage || 0,
      criticality
    );

    risks.push({
      area,
      busFactor,
      soleOwner,
      contributors: contributors.slice(0, 5).map((c) => ({
        name: c.name,
        percentage: c.percentage,
      })),
      linesOfCode: stats.linesOfCode,
      criticality,
      suggestion,
    });
  }

  // Sort by criticality then bus factor
  const criticalityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  risks.sort((a, b) => {
    const critDiff = criticalityOrder[a.criticality] - criticalityOrder[b.criticality];
    if (critDiff !== 0) return critDiff;
    return a.busFactor - b.busFactor;
  });

  return risks;
}

/**
 * Determine criticality based on multiple factors
 */
function determineCriticality(
  busFactor: number,
  primaryOwnershipPct: number,
  stats: AreaStats,
  area: string,
  _graph: KnowledgeGraph
): 'critical' | 'high' | 'medium' | 'low' {
  // Check if this is core infrastructure
  const isCoreArea = ['src/core', 'src/graph', 'src/analyzers', 'core', 'lib'].some(
    (core) => area.startsWith(core)
  );

  // Large areas with single owner are more critical
  const isLargeArea = stats.linesOfCode > 1000 || stats.files.length > 10;

  // Critical: Bus factor 1 AND (80%+ ownership OR core area OR large area)
  if (busFactor === 1 && (primaryOwnershipPct >= 80 || isCoreArea || isLargeArea)) {
    return 'critical';
  }

  // High: Bus factor 1 OR (70%+ ownership AND (core OR large))
  if (busFactor === 1 || (primaryOwnershipPct >= 70 && (isCoreArea || isLargeArea))) {
    return 'high';
  }

  // Medium: Bus factor 2 OR 60%+ ownership
  if (busFactor <= 2 || primaryOwnershipPct >= 60) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate a helpful suggestion for the risk
 */
function generateSuggestion(
  busFactor: number,
  soleOwner: string | undefined,
  ownershipPct: number,
  criticality: 'critical' | 'high' | 'medium' | 'low'
): string {
  if (criticality === 'critical' && soleOwner) {
    if (ownershipPct >= 90) {
      return `Pair ${soleOwner} with another developer on all changes`;
    }
    return `Schedule knowledge transfer sessions with ${soleOwner}`;
  }

  if (criticality === 'high') {
    if (soleOwner) {
      return `Have ${soleOwner} document key decisions and mentor others`;
    }
    return 'Cross-train team members on this area';
  }

  if (criticality === 'medium') {
    if (busFactor <= 2) {
      return 'Add a third contributor through code reviews';
    }
    return 'Consider rotating ownership periodically';
  }

  return 'Knowledge is well-distributed';
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  risks: BusFactorRisk[],
  graph: KnowledgeGraph
): { soloOwnedFiles: number; soloOwnedLines: number; percentageAtRisk: number } {
  const soloOwned = risks.filter((r) => r.busFactor === 1);
  const soloOwnedFiles = soloOwned.reduce((sum, r) => {
    // Count files in the area from graph
    const areaFiles = Object.values(graph.nodes).filter(
      (n) => n.type === 'file' && n.filePath.startsWith(r.area === 'root' ? '' : r.area)
    );
    return sum + areaFiles.length;
  }, 0);

  const soloOwnedLines = soloOwned.reduce((sum, r) => sum + r.linesOfCode, 0);
  const totalLines = graph.metadata.totalLines || 1;
  const percentageAtRisk = Math.round((soloOwnedLines / totalLines) * 100);

  return {
    soloOwnedFiles,
    soloOwnedLines,
    percentageAtRisk,
  };
}

/**
 * Calculate overall bus factor
 */
function calculateOverallBusFactor(risks: BusFactorRisk[]): number {
  if (risks.length === 0) return 0;

  // Weighted average, giving more weight to larger areas
  const totalWeight = risks.reduce((sum, r) => sum + r.linesOfCode, 0);
  if (totalWeight === 0) {
    return Math.round((risks.reduce((sum, r) => sum + r.busFactor, 0) / risks.length) * 10) / 10;
  }

  const weightedSum = risks.reduce((sum, r) => sum + r.busFactor * r.linesOfCode, 0);
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/**
 * Determine overall risk level
 */
function determineRiskLevel(
  overallBusFactor: number,
  percentageAtRisk: number
): 'healthy' | 'concerning' | 'dangerous' | 'critical' {
  if (overallBusFactor >= 3 && percentageAtRisk < 10) {
    return 'healthy';
  }

  if (overallBusFactor >= 2 && percentageAtRisk < 25) {
    return 'concerning';
  }

  if (overallBusFactor >= 1.5 || percentageAtRisk < 50) {
    return 'dangerous';
  }

  return 'critical';
}

/**
 * Generate recommendations based on risks
 */
function generateRecommendations(
  risks: BusFactorRisk[],
  summary: { soloOwnedFiles: number; soloOwnedLines: number; percentageAtRisk: number },
  riskLevel: 'healthy' | 'concerning' | 'dangerous' | 'critical'
): string[] {
  const recommendations: string[] = [];

  const criticalRisks = risks.filter((r) => r.criticality === 'critical');
  const highRisks = risks.filter((r) => r.criticality === 'high');

  if (criticalRisks.length > 0) {
    // Find the most common sole owner
    const soleOwners = criticalRisks
      .filter((r) => r.soleOwner)
      .map((r) => r.soleOwner!);
    const ownerCounts = new Map<string, number>();
    for (const owner of soleOwners) {
      ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
    }
    const topOwner = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    if (topOwner && topOwner[1] >= 2) {
      recommendations.push(
        `Priority: Schedule knowledge transfer sessions with ${topOwner[0]} (owns ${topOwner[1]} critical areas)`
      );
    }

    recommendations.push(
      `Implement mandatory code reviews by non-owners for ${criticalRisks.length} critical area(s)`
    );
  }

  if (highRisks.length > 0) {
    recommendations.push(
      `Start pair programming rotations on ${highRisks.length} high-risk area(s)`
    );
  }

  if (summary.percentageAtRisk > 30) {
    recommendations.push(
      `${summary.percentageAtRisk}% of codebase at risk - consider hiring or cross-training`
    );
  }

  if (riskLevel === 'healthy') {
    recommendations.push(
      'Knowledge distribution is healthy! Maintain current collaborative practices.'
    );
  } else if (recommendations.length === 0) {
    recommendations.push(
      'Consider documenting complex areas and rotating ownership periodically'
    );
  }

  return recommendations;
}

/**
 * Format bus factor results for CLI output
 */
export function formatBusFactor(result: BusFactorResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('+-------------------------------------------------+');
  lines.push('|  BUS FACTOR ANALYSIS                            |');
  lines.push('+-------------------------------------------------+');
  lines.push('');

  // Overall bus factor with risk level
  const riskEmoji = getRiskEmoji(result.riskLevel);
  const riskColor = getRiskLabel(result.riskLevel);
  lines.push(`Overall Bus Factor: ${result.overallBusFactor.toFixed(1)} (${riskEmoji} ${riskColor})`);
  lines.push('');

  // Critical and high risks
  const criticalRisks = result.risks.filter((r) => r.criticality === 'critical');
  const highRisks = result.risks.filter((r) => r.criticality === 'high');

  if (criticalRisks.length > 0 || highRisks.length > 0) {
    lines.push('CRITICAL RISKS');
    lines.push('-'.repeat(49));

    for (const risk of criticalRisks) {
      const emoji = risk.criticality === 'critical' ? '[!]' : '[*]';
      lines.push(`${emoji} ${risk.area.padEnd(24)} Bus Factor: ${risk.busFactor}`);
      if (risk.soleOwner) {
        const topContributor = risk.contributors[0];
        lines.push(`   Solo owner: ${risk.soleOwner} (${topContributor?.percentage || 0}% of commits)`);
      }
      lines.push(`   ${risk.linesOfCode.toLocaleString()} lines at risk`);
      lines.push(`   -> ${risk.suggestion}`);
      lines.push('');
    }

    for (const risk of highRisks) {
      lines.push(`[*] ${risk.area.padEnd(24)} Bus Factor: ${risk.busFactor}`);
      if (risk.soleOwner) {
        const topContributor = risk.contributors[0];
        lines.push(`   Solo owner: ${risk.soleOwner} (${topContributor?.percentage || 0}% of commits)`);
      }
      lines.push(`   ${risk.linesOfCode.toLocaleString()} lines at risk`);
      lines.push(`   -> ${risk.suggestion}`);
      lines.push('');
    }
  }

  // Medium and low risks (abbreviated)
  const mediumRisks = result.risks.filter((r) => r.criticality === 'medium');
  const lowRisks = result.risks.filter((r) => r.criticality === 'low');

  if (mediumRisks.length > 0) {
    lines.push('MODERATE RISKS');
    lines.push('-'.repeat(49));
    for (const risk of mediumRisks.slice(0, 5)) {
      const owner = risk.soleOwner ? ` (${risk.soleOwner})` : '';
      lines.push(`[~] ${risk.area}${owner} - Bus Factor: ${risk.busFactor}`);
    }
    if (mediumRisks.length > 5) {
      lines.push(`    ... and ${mediumRisks.length - 5} more`);
    }
    lines.push('');
  }

  if (lowRisks.length > 0) {
    lines.push('HEALTHY AREAS');
    lines.push('-'.repeat(49));
    for (const risk of lowRisks.slice(0, 3)) {
      lines.push(`[+] ${risk.area} - Bus Factor: ${risk.busFactor}`);
    }
    if (lowRisks.length > 3) {
      lines.push(`    ... and ${lowRisks.length - 3} more`);
    }
    lines.push('');
  }

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(49));
  lines.push(`  Files with single owner:    ${String(result.summary.soloOwnedFiles).padStart(6)}`);
  lines.push(`  Lines at risk:              ${result.summary.soloOwnedLines.toLocaleString().padStart(6)}`);
  lines.push(`  Percentage of codebase:     ${String(result.summary.percentageAtRisk).padStart(5)}%`);
  lines.push('');

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('-'.repeat(49));
    for (const rec of result.recommendations) {
      lines.push(`  * ${rec}`);
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Get emoji for risk level
 */
function getRiskEmoji(level: 'healthy' | 'concerning' | 'dangerous' | 'critical'): string {
  switch (level) {
    case 'healthy':
      return '[OK]';
    case 'concerning':
      return '[~]';
    case 'dangerous':
      return '[!]';
    case 'critical':
      return '[!!]';
  }
}

/**
 * Get label for risk level
 */
function getRiskLabel(level: 'healthy' | 'concerning' | 'dangerous' | 'critical'): string {
  return level.toUpperCase();
}
