/**
 * Zones - Safe and Danger Zone Mapping
 *
 * Identifies areas of the codebase that are safe for new developers
 * versus high-risk areas that require extra caution.
 */

import type { KnowledgeGraph, GraphNode } from './graph/types.js';

export interface ZoneFile {
  path: string;
  score: number; // 0-100, higher = safer
  factors: string[];
  recommendation: string;
}

export interface ZoneMap {
  codebaseName: string;
  safeZones: ZoneFile[];
  dangerZones: ZoneFile[];
  neutralZones: ZoneFile[];
  summary: {
    safeCount: number;
    dangerCount: number;
    neutralCount: number;
    overallRisk: 'low' | 'medium' | 'high';
  };
}

/**
 * Calculate safety score for a file (0-100, higher = safer)
 */
function calculateSafetyScore(node: GraphNode, graph: KnowledgeGraph): {
  score: number;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 50; // Start neutral

  // Complexity factor (lower is safer)
  if (node.complexity !== undefined) {
    if (node.complexity < 5) {
      score += 15;
      factors.push('Low complexity');
    } else if (node.complexity < 10) {
      score += 5;
      factors.push('Moderate complexity');
    } else if (node.complexity < 20) {
      score -= 10;
      factors.push('High complexity');
    } else {
      score -= 25;
      factors.push('Very high complexity');
    }
  }

  // Import count (fewer imports = simpler)
  const importEdges = graph.edges.filter(
    (e) => e.type === 'imports' && graph.nodes[e.source]?.filePath === node.filePath
  );
  if (importEdges.length < 3) {
    score += 10;
    factors.push('Few dependencies');
  } else if (importEdges.length > 10) {
    score -= 10;
    factors.push('Many dependencies');
  }

  // How many files depend on this (more = riskier to change)
  const dependents = graph.edges.filter(
    (e) => e.type === 'imports' && graph.nodes[e.target]?.filePath === node.filePath
  );
  if (dependents.length === 0) {
    score += 10;
    factors.push('No dependents');
  } else if (dependents.length > 5) {
    score -= 15;
    factors.push(`${dependents.length} files depend on this`);
  }

  // File type patterns
  if (node.filePath.includes('test') || node.filePath.includes('spec')) {
    score += 20;
    factors.push('Test file (safe to modify)');
  }
  if (node.filePath.includes('util') || node.filePath.includes('helper')) {
    score += 5;
    factors.push('Utility file');
  }
  if (node.filePath.includes('config')) {
    score -= 10;
    factors.push('Configuration (affects entire app)');
  }
  if (node.filePath.includes('index') && node.filePath.split('/').length <= 2) {
    score -= 15;
    factors.push('Root entry point');
  }

  // Line count (smaller files are safer)
  const fileNode = node as { lineCount?: number };
  if (fileNode.lineCount !== undefined) {
    if (fileNode.lineCount < 100) {
      score += 10;
      factors.push('Small file');
    } else if (fileNode.lineCount > 500) {
      score -= 10;
      factors.push('Large file');
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, factors };
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score: number, factors: string[]): string {
  if (score >= 70) {
    return 'Good for new contributors. Feel free to make changes.';
  } else if (score >= 40) {
    return 'Moderate risk. Review changes carefully before committing.';
  } else {
    const riskFactors = factors.filter((f) =>
      f.includes('complexity') || f.includes('depend') || f.includes('entry')
    );
    if (riskFactors.length > 0) {
      return `High risk (${riskFactors[0].toLowerCase()}). Pair with an expert.`;
    }
    return 'High risk area. Seek review from experienced team members.';
  }
}

/**
 * Analyze codebase zones
 */
export function analyzeZones(graph: KnowledgeGraph): ZoneMap {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');

  const allZones: ZoneFile[] = [];

  for (const node of fileNodes) {
    const { score, factors } = calculateSafetyScore(node, graph);
    const recommendation = getRecommendation(score, factors);

    allZones.push({
      path: node.filePath,
      score,
      factors,
      recommendation,
    });
  }

  // Sort by score
  allZones.sort((a, b) => b.score - a.score);

  // Categorize
  const safeZones = allZones.filter((z) => z.score >= 70);
  const dangerZones = allZones.filter((z) => z.score < 40);
  const neutralZones = allZones.filter((z) => z.score >= 40 && z.score < 70);

  // Overall risk assessment
  const avgScore = allZones.reduce((sum, z) => sum + z.score, 0) / allZones.length;
  const overallRisk: 'low' | 'medium' | 'high' =
    avgScore >= 60 ? 'low' : avgScore >= 40 ? 'medium' : 'high';

  return {
    codebaseName,
    safeZones: safeZones.slice(0, 10),
    dangerZones: dangerZones.slice(0, 10),
    neutralZones: neutralZones.slice(0, 5),
    summary: {
      safeCount: safeZones.length,
      dangerCount: dangerZones.length,
      neutralCount: neutralZones.length,
      overallRisk,
    },
  };
}

/**
 * Format safe zones for display
 */
export function formatSafeZones(zones: ZoneMap): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  🟢 SAFE ZONES                                    ┃');
  lines.push('┃  Good areas for new contributors                  ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (zones.safeZones.length === 0) {
    lines.push('No clearly safe zones found.');
    lines.push('Consider adding tests or breaking down complex files.');
    return lines.join('\n');
  }

  lines.push(`Found ${zones.summary.safeCount} safe files in ${zones.codebaseName}`);
  lines.push('');

  for (const zone of zones.safeZones.slice(0, 10)) {
    const scoreBar = '█'.repeat(Math.floor(zone.score / 10)) + '░'.repeat(10 - Math.floor(zone.score / 10));
    lines.push(`🟢 ${zone.path}`);
    lines.push(`   Safety: ${scoreBar} ${zone.score}%`);
    lines.push(`   ✓ ${zone.factors.slice(0, 2).join(', ')}`);
    lines.push('');
  }

  lines.push('─'.repeat(51));
  lines.push('These files are good starting points for new developers.');
  lines.push('─'.repeat(51));

  return lines.join('\n');
}

/**
 * Format danger zones for display
 */
export function formatDangerZones(zones: ZoneMap): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  🔴 DANGER ZONES                                  ┃');
  lines.push('┃  High-risk areas requiring caution                ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (zones.dangerZones.length === 0) {
    lines.push('No high-risk zones detected!');
    lines.push('Your codebase is well-structured.');
    return lines.join('\n');
  }

  lines.push(`Found ${zones.summary.dangerCount} high-risk files in ${zones.codebaseName}`);
  lines.push('');

  for (const zone of zones.dangerZones.slice(0, 10)) {
    const scoreBar = '█'.repeat(Math.floor(zone.score / 10)) + '░'.repeat(10 - Math.floor(zone.score / 10));
    lines.push(`🔴 ${zone.path}`);
    lines.push(`   Risk: ${scoreBar} ${100 - zone.score}%`);
    lines.push(`   ⚠️  ${zone.factors.slice(0, 2).join(', ')}`);
    lines.push(`   💡 ${zone.recommendation}`);
    lines.push('');
  }

  lines.push('─'.repeat(51));
  lines.push('Approach these files with extra care. Consider pairing.');
  lines.push('─'.repeat(51));

  return lines.join('\n');
}
