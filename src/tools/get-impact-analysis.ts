/**
 * get_impact_analysis Tool
 *
 * Answers the critical question: "What will break if I change this file?"
 * Combines dependency graph, change coupling, complexity, and churn
 * into a comprehensive risk assessment.
 */

import { z } from 'zod';
import { analyzeChangeCoupling } from '../analyzers/git.js';
import type { GraphNode, KnowledgeGraph } from '../graph/types.js';

export const schema = {
  filePath: z.string().describe('Path to the file you want to change (relative to project root)'),
  includeIndirect: z.boolean().optional().describe('Include indirect dependencies (2+ hops away)'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface ImpactAnalysisResult {
  filePath: string;
  found: boolean;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  directDependents: string[];
  indirectDependents: string[];
  historicalCoChangers: string[];
  hiddenDependencies: string[];
  complexity: number;
  factors: {
    dependencyScore: number;
    couplingScore: number;
    complexityScore: number;
    churnScore: number;
  };
  recommendations: string[];
  summary: string;
}

export async function execute(graph: KnowledgeGraph, input: Input): Promise<ImpactAnalysisResult> {
  const { filePath, includeIndirect = true } = input;

  // Check if file exists
  const fileNode = graph.nodes[filePath];
  if (!fileNode) {
    return {
      filePath,
      found: false,
      riskScore: 0,
      riskLevel: 'low',
      directDependents: [],
      indirectDependents: [],
      historicalCoChangers: [],
      hiddenDependencies: [],
      complexity: 0,
      factors: { dependencyScore: 0, couplingScore: 0, complexityScore: 0, churnScore: 0 },
      recommendations: [],
      summary: `I don't have a file at "${filePath}" in my knowledge graph.`,
    };
  }

  // 1. Find direct dependents (files that import this file)
  const directDependents = findDirectDependents(graph, filePath);

  // 2. Find indirect dependents (2+ hops) if requested
  const indirectDependents = includeIndirect
    ? findIndirectDependents(graph, filePath, directDependents)
    : [];

  // 3. Get change coupling data
  const importEdges = buildImportEdges(graph);
  const coupling = await analyzeChangeCoupling(graph.metadata.rootDir, filePath, {
    minCouplingStrength: 0.3,
    importEdges,
  });

  const historicalCoChangers = coupling.coupledFiles.map((c) => c.file2);
  const hiddenDependencies = coupling.coupledFiles
    .filter((c) => c.couplingStrength >= 0.5 && !c.hasImportRelationship)
    .map((c) => c.file2);

  // 4. Calculate complexity of the file and its functions
  const complexity = calculateFileComplexity(graph, filePath);

  // 5. Calculate churn score
  const churnScore = calculateChurn(fileNode);

  // 6. Calculate component scores
  const dependencyScore = calculateDependencyScore(
    directDependents.length,
    indirectDependents.length
  );
  const couplingScore = calculateCouplingScore(
    coupling.coupledFiles.length,
    hiddenDependencies.length
  );
  const complexityScore = calculateComplexityScore(complexity);

  // 7. Calculate overall risk score (0-100)
  const riskScore = Math.round(
    dependencyScore * 0.35 + couplingScore * 0.25 + complexityScore * 0.25 + churnScore * 0.15
  );

  const riskLevel = getRiskLevel(riskScore);

  // 8. Generate recommendations
  const recommendations = generateRecommendations({
    filePath,
    directDependents,
    hiddenDependencies,
    complexity,
    churnScore,
    riskLevel,
  });

  // 9. Generate summary
  const summary = generateSummary({
    filePath,
    riskScore,
    riskLevel,
    directDependents,
    indirectDependents,
    hiddenDependencies,
    complexity,
    factors: { dependencyScore, couplingScore, complexityScore, churnScore },
  });

  return {
    filePath,
    found: true,
    riskScore,
    riskLevel,
    directDependents,
    indirectDependents,
    historicalCoChangers,
    hiddenDependencies,
    complexity,
    factors: { dependencyScore, couplingScore, complexityScore, churnScore },
    recommendations,
    summary,
  };
}

function findDirectDependents(graph: KnowledgeGraph, filePath: string): string[] {
  const dependents = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const targetNode = graph.nodes[edge.target];
      if (targetNode?.filePath === filePath) {
        const sourceNode = graph.nodes[edge.source];
        if (sourceNode?.filePath && sourceNode.filePath !== filePath) {
          dependents.add(sourceNode.filePath);
        }
      }
    }
  }

  return [...dependents];
}

function findIndirectDependents(
  graph: KnowledgeGraph,
  filePath: string,
  directDependents: string[]
): string[] {
  const indirect = new Set<string>();
  const visited = new Set<string>([filePath, ...directDependents]);

  // BFS to find 2nd and 3rd level dependents
  let currentLevel = directDependents;
  let depth = 0;
  const maxDepth = 2;

  while (currentLevel.length > 0 && depth < maxDepth) {
    const nextLevel: string[] = [];

    for (const file of currentLevel) {
      const deps = findDirectDependents(graph, file);
      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          indirect.add(dep);
          nextLevel.push(dep);
        }
      }
    }

    currentLevel = nextLevel;
    depth++;
  }

  return [...indirect];
}

function buildImportEdges(graph: KnowledgeGraph): Set<string> {
  const edges = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];
      if (sourceNode?.filePath && targetNode?.filePath) {
        edges.add(`${sourceNode.filePath}->${targetNode.filePath}`);
      }
    }
  }

  return edges;
}

function calculateFileComplexity(graph: KnowledgeGraph, filePath: string): number {
  let maxComplexity = 0;

  for (const node of Object.values(graph.nodes)) {
    if (node.filePath === filePath && node.complexity) {
      maxComplexity = Math.max(maxComplexity, node.complexity);
    }
  }

  return maxComplexity;
}

function calculateChurn(node: GraphNode): number {
  const modCount = node.modificationCount || 0;
  const contributors = node.contributors?.length || 0;

  // Normalize to 0-100
  const modScore = Math.min(modCount / 50, 1) * 50;
  const contribScore = Math.min(contributors / 5, 1) * 50;

  return Math.round(modScore + contribScore);
}

function calculateDependencyScore(direct: number, indirect: number): number {
  // 0 deps = 0, 1-2 = 20, 3-5 = 40, 6-10 = 60, 11-20 = 80, 20+ = 100
  const total = direct + indirect * 0.3;

  if (total === 0) return 0;
  if (total <= 2) return 20;
  if (total <= 5) return 40;
  if (total <= 10) return 60;
  if (total <= 20) return 80;
  return 100;
}

function calculateCouplingScore(coupled: number, hidden: number): number {
  // Hidden dependencies are weighted more heavily
  const base = Math.min(coupled * 10, 50);
  const hiddenPenalty = Math.min(hidden * 20, 50);
  return Math.round(base + hiddenPenalty);
}

function calculateComplexityScore(complexity: number): number {
  // 1-5 = low (0-20), 6-10 = moderate (20-40), 11-15 = high (40-70), 15+ = critical
  if (complexity <= 5) return complexity * 4;
  if (complexity <= 10) return 20 + (complexity - 5) * 4;
  if (complexity <= 15) return 40 + (complexity - 10) * 6;
  return Math.min(70 + (complexity - 15) * 3, 100);
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

function generateRecommendations(data: {
  filePath: string;
  directDependents: string[];
  hiddenDependencies: string[];
  complexity: number;
  churnScore: number;
  riskLevel: string;
}): string[] {
  const recs: string[] = [];

  if (data.directDependents.length > 10) {
    recs.push(
      `This file has ${data.directDependents.length} direct dependents. ` +
        'Consider if some functionality could be split into separate modules.'
    );
  }

  if (data.hiddenDependencies.length > 0) {
    recs.push(
      `Found ${data.hiddenDependencies.length} hidden dependencies: ` +
        `${data.hiddenDependencies.slice(0, 3).join(', ')}. ` +
        'These files change together but have no import relationship.'
    );
  }

  if (data.complexity > 15) {
    recs.push(
      `High complexity (${data.complexity}). Consider breaking this into smaller functions.`
    );
  }

  if (data.riskLevel === 'high' || data.riskLevel === 'critical') {
    recs.push('Write tests before making changes to catch regressions.');
    recs.push('Consider making changes incrementally with frequent commits.');
  }

  if (data.directDependents.length > 5) {
    recs.push(`Suggested test priority: ${data.directDependents.slice(0, 3).join(', ')}`);
  }

  if (recs.length === 0) {
    recs.push('This file is relatively safe to modify. Low risk of ripple effects.');
  }

  return recs;
}

function generateSummary(data: {
  filePath: string;
  riskScore: number;
  riskLevel: string;
  directDependents: string[];
  indirectDependents: string[];
  hiddenDependencies: string[];
  complexity: number;
  factors: {
    dependencyScore: number;
    couplingScore: number;
    complexityScore: number;
    churnScore: number;
  };
}): string {
  const parts: string[] = [];

  const riskEmoji =
    {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    }[data.riskLevel] || '⚪';

  parts.push(`## Impact Analysis: ${data.filePath}`);
  parts.push('');
  parts.push(
    `${riskEmoji} **Risk Score: ${data.riskScore}/100** (${data.riskLevel.toUpperCase()})`
  );
  parts.push('');

  // Breakdown
  parts.push('### Risk Factors');
  parts.push('');
  parts.push(`| Factor | Score | Description |`);
  parts.push(`|--------|-------|-------------|`);
  parts.push(
    `| Dependencies | ${data.factors.dependencyScore}/100 | ${data.directDependents.length} direct, ${data.indirectDependents.length} indirect |`
  );
  parts.push(
    `| Change Coupling | ${data.factors.couplingScore}/100 | ${data.hiddenDependencies.length} hidden dependencies |`
  );
  parts.push(
    `| Complexity | ${data.factors.complexityScore}/100 | Max function complexity: ${data.complexity} |`
  );
  parts.push(`| Churn | ${data.factors.churnScore}/100 | Activity and contributor count |`);
  parts.push('');

  // Direct dependents
  if (data.directDependents.length > 0) {
    parts.push('### Files That Will Be Affected');
    parts.push('');
    parts.push('**Direct dependents** (import this file):');
    for (const dep of data.directDependents.slice(0, 8)) {
      parts.push(`- ${dep}`);
    }
    if (data.directDependents.length > 8) {
      parts.push(`- ...and ${data.directDependents.length - 8} more`);
    }
  }

  // Indirect dependents
  if (data.indirectDependents.length > 0) {
    parts.push('');
    parts.push(`**Indirect dependents** (${data.indirectDependents.length} files, 2-3 hops away)`);
  }

  // Hidden dependencies
  if (data.hiddenDependencies.length > 0) {
    parts.push('');
    parts.push('### 👻 Hidden Dependencies');
    parts.push('');
    parts.push('These files frequently change together but have NO import relationship:');
    for (const h of data.hiddenDependencies) {
      parts.push(`- ⚠️ ${h}`);
    }
    parts.push('');
    parts.push('*Changes to this file often require changes to these files too.*');
  }

  return parts.join('\n');
}
