/**
 * Knowledge Map - Team Expertise Heatmap
 *
 * Shows who knows what in the codebase by creating a heatmap
 * of expertise by contributor and area. Identifies knowledge
 * silos and bus factor risks.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';
import {
  buildContributorExpertise,
  buildKnowledgeAreas,
  type ContributorExpertise,
  type KnowledgeArea,
  parseGitLog,
} from './knowledge-map-helpers.js';

export type { ContributorExpertise, KnowledgeArea };

export interface KnowledgeMapResult {
  contributors: ContributorExpertise[];
  areas: KnowledgeArea[];
  overallBusFactor: number;
  riskAreas: string[]; // Areas with bus factor 1
  suggestions: string[];
}

/**
 * Generate a knowledge map of who knows what in the codebase
 */
export async function generateKnowledgeMap(
  graph: KnowledgeGraph,
  rootDir: string
): Promise<KnowledgeMapResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      contributors: [],
      areas: [],
      overallBusFactor: 0,
      riskAreas: [],
      suggestions: ['This is not a git repository.'],
    };
  }

  // Get all source files from the graph
  const sourceFiles = Object.values(graph.nodes)
    .filter((n) => n.type === 'file')
    .map((n) => n.filePath);

  if (sourceFiles.length === 0) {
    return {
      contributors: [],
      areas: [],
      overallBusFactor: 0,
      riskAreas: [],
      suggestions: ['No source files found in the knowledge graph.'],
    };
  }

  // Group files by directory (top-level areas)
  const areaFiles = groupFilesByArea(sourceFiles);

  // Parse git log and get area contributions
  const areaContributions = await parseGitLog(git, areaFiles, getAreaForFile);

  // Build contributor expertise map
  const contributorMap = buildContributorExpertise(areaContributions);

  // Build knowledge areas with experts and bus factor
  const knowledgeAreas = buildKnowledgeAreas(areaContributions);

  // Calculate overall bus factor
  const overallBusFactor =
    knowledgeAreas.length > 0
      ? Math.round(
          (knowledgeAreas.reduce((sum, a) => sum + a.busFactor, 0) / knowledgeAreas.length) * 10
        ) / 10
      : 0;

  // Identify risk areas (bus factor = 1)
  const riskAreas = knowledgeAreas.filter((a) => a.busFactor === 1).map((a) => a.path);

  // Generate suggestions
  const suggestions = generateSuggestions([...contributorMap.values()], knowledgeAreas, riskAreas);

  // Sort contributors by total contributions
  const contributors = [...contributorMap.values()].sort(
    (a, b) => b.totalContributions - a.totalContributions
  );

  return {
    contributors: contributors.slice(0, 10),
    areas: knowledgeAreas,
    overallBusFactor,
    riskAreas,
    suggestions,
  };
}

/**
 * Group files by their top-level directory/area
 */
function groupFilesByArea(files: string[]): Map<string, string[]> {
  const areas = new Map<string, string[]>();

  for (const file of files) {
    const parts = file.split('/');
    let area: string;

    // Use top-level directory as area, or 'root' for root files
    if (parts.length === 1) {
      area = 'root';
    } else {
      area = parts[0] ?? 'root';
      // For src/, look one level deeper
      if (area === 'src' && parts.length > 2 && parts[1]) {
        area = `src/${parts[1]}`;
      }
    }

    if (!areas.has(area)) {
      areas.set(area, []);
    }
    areas.get(area)!.push(file);
  }

  return areas;
}

/**
 * Find which area a file belongs to
 */
function getAreaForFile(file: string, areaFiles: Map<string, string[]>): string | null {
  const parts = file.split('/');

  // Check src/ subdirectories first
  const firstPart = parts[0];
  const secondPart = parts[1];
  if (firstPart === 'src' && parts.length > 2 && secondPart) {
    const subArea = `src/${secondPart}`;
    if (areaFiles.has(subArea)) {
      return subArea;
    }
  }

  // Check top-level directory
  if (parts.length === 1) {
    if (areaFiles.has('root')) {
      return 'root';
    }
  } else if (firstPart && areaFiles.has(firstPart)) {
    return firstPart;
  }

  return null;
}

/**
 * Generate improvement suggestions
 */
function generateSuggestions(
  contributors: ContributorExpertise[],
  areas: KnowledgeArea[],
  riskAreas: string[]
): string[] {
  const suggestions: string[] = [];

  // Risk area suggestions
  if (riskAreas.length > 0) {
    const topRisk = riskAreas.slice(0, 3);
    suggestions.push(`Consider pair programming on: ${topRisk.join(', ')} (single expert)`);
  }

  // Knowledge concentration suggestions
  const topContributor = contributors[0];
  const secondContributor = contributors[1];
  if (topContributor && contributors.length > 1 && secondContributor) {
    const ratio = topContributor.totalContributions / (secondContributor.totalContributions || 1);
    if (ratio > 3) {
      suggestions.push(
        `${topContributor.contributor} has ${Math.round(ratio)}x more commits than others. Consider knowledge sharing.`
      );
    }
  }

  // Coverage suggestions
  const soloAreas = areas.filter((a) => a.coverage === 'solo');
  if (soloAreas.length > areas.length / 2) {
    suggestions.push(
      `${Math.round((soloAreas.length / areas.length) * 100)}% of areas have single ownership. Consider cross-training.`
    );
  }

  // Distributed praise
  const distributedAreas = areas.filter((a) => a.coverage === 'distributed');
  if (distributedAreas.length > 0) {
    suggestions.push(`Great job! ${distributedAreas.length} area(s) have distributed knowledge.`);
  }

  if (suggestions.length === 0) {
    suggestions.push('Your knowledge distribution looks healthy!');
  }

  return suggestions;
}

/**
 * Format knowledge map for display
 */
export function formatKnowledgeMap(result: KnowledgeMapResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  🗺️  KNOWLEDGE MAP                                          ┃');
  lines.push('┃  Team expertise heatmap                                     ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.contributors.length === 0) {
    lines.push('No contributor data found.');
    if (result.suggestions.length > 0) {
      for (const suggestion of result.suggestions) {
        lines.push(`  ${suggestion}`);
      }
    }
    return lines.join('\n');
  }

  // Overall stats
  const busEmoji = result.overallBusFactor >= 3 ? '🟢' : result.overallBusFactor >= 2 ? '🟡' : '🔴';
  lines.push(`OVERALL BUS FACTOR: ${busEmoji} ${result.overallBusFactor}`);
  lines.push(`Risk Areas: ${result.riskAreas.length > 0 ? result.riskAreas.length : 'None'}`);
  lines.push('');
  lines.push('━'.repeat(62));

  // Heatmap grid
  lines.push('');
  lines.push('EXPERTISE HEATMAP');
  lines.push('─'.repeat(62));

  // Get areas sorted alphabetically for consistent display
  const areas = result.areas.map((a) => a.path).sort();
  const maxAreaLen = Math.min(15, Math.max(...areas.map((a) => a.length)));

  // Header row with areas
  const headerParts = [''.padEnd(12)];
  for (const area of areas.slice(0, 6)) {
    headerParts.push(truncate(area, maxAreaLen).padEnd(maxAreaLen));
  }
  lines.push(headerParts.join(' '));

  // Contributor rows
  for (const contributor of result.contributors.slice(0, 8)) {
    const rowParts = [truncate(contributor.contributor, 10).padEnd(12)];

    for (const area of areas.slice(0, 6)) {
      const score = contributor.areas.get(area) || 0;
      const cell = getHeatmapCell(score);
      rowParts.push(cell.padEnd(maxAreaLen));
    }

    lines.push(rowParts.join(' '));
  }

  lines.push('');
  lines.push('Legend: ░ <20%  ▒ 20-50%  ▓ 50-80%  █ >80%');
  lines.push('');
  lines.push('━'.repeat(62));

  // Knowledge areas with risk
  lines.push('');
  lines.push('AREA DETAILS');
  lines.push('─'.repeat(62));

  for (const area of result.areas.slice(0, 8)) {
    const coverageEmoji = getCoverageEmoji(area.coverage);
    const busColor = area.busFactor === 1 ? '🔴' : area.busFactor === 2 ? '🟡' : '🟢';

    lines.push(`${coverageEmoji} ${area.path}`);
    lines.push(`   Bus Factor: ${busColor} ${area.busFactor} (${area.coverage})`);

    const expertList = area.experts
      .slice(0, 3)
      .map((e) => `${e.name} ${e.score}%`)
      .join(', ');
    lines.push(`   Experts: ${expertList}`);
    lines.push('');
  }

  lines.push('━'.repeat(62));

  // Risk areas highlighted
  if (result.riskAreas.length > 0) {
    lines.push('');
    lines.push('🔴 RISK AREAS (Bus Factor = 1)');
    lines.push('─'.repeat(62));

    for (const area of result.riskAreas.slice(0, 5)) {
      const areaInfo = result.areas.find((a) => a.path === area);
      const expert = areaInfo?.experts[0]?.name || 'Unknown';
      lines.push(`  ⚠️  ${area} — only ${expert} knows this`);
    }

    if (result.riskAreas.length > 5) {
      lines.push(`  ... and ${result.riskAreas.length - 5} more`);
    }

    lines.push('');
    lines.push('━'.repeat(62));
  }

  // Suggestions
  lines.push('');
  lines.push('💡 SUGGESTIONS');
  lines.push('─'.repeat(62));

  for (const suggestion of result.suggestions) {
    lines.push(`  • ${suggestion}`);
  }

  lines.push('');
  lines.push('━'.repeat(62));

  return lines.join('\n');
}

/**
 * Get heatmap cell representation
 */
function getHeatmapCell(score: number): string {
  if (score === 0) return '  ·  ';
  if (score < 20) return '  ░  ';
  if (score < 50) return '  ▒  ';
  if (score < 80) return '  ▓  ';
  return '  █  ';
}

/**
 * Get coverage emoji
 */
function getCoverageEmoji(coverage: KnowledgeArea['coverage']): string {
  switch (coverage) {
    case 'solo':
      return '🔴';
    case 'pair':
      return '🟡';
    case 'team':
      return '🟢';
    case 'distributed':
      return '🌟';
    default:
      return '⚪';
  }
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 2)}..`;
}
