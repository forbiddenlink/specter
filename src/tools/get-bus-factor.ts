/**
 * get_bus_factor Tool
 *
 * Identifies knowledge concentration risks in the codebase.
 * "Bus factor" = how many people need to be hit by a bus before
 * no one understands this code anymore.
 *
 * Low bus factor = high risk. Single-owner files are especially dangerous.
 */

import { z } from 'zod';
import type { KnowledgeGraph, BusFactorAnalysis, KnowledgeRisk } from '../graph/types.js';
import { analyzeKnowledgeDistribution } from '../analyzers/knowledge.js';

export const schema = {
  directory: z.string().optional().describe('Limit analysis to a specific directory'),
  limit: z.number().optional().describe('Maximum number of risk areas to return (default: 15)'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface BusFactorResult {
  analyzed: boolean;
  overallBusFactor: number;
  riskSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  criticalAreas: Array<{
    path: string;
    owner: string;
    ownershipPct: number;
    busFactor: number;
    daysSinceChange: number;
    verdict: string;
  }>;
  topOwners: Array<{
    name: string;
    filesOwned: number;
    percentage: number;
  }>;
  insights: string[];
  summary: string;
}

export async function execute(
  graph: KnowledgeGraph,
  input: Input
): Promise<BusFactorResult> {
  const { directory, limit = 15 } = input;

  // Get all file paths from graph
  let filePaths = Object.values(graph.nodes)
    .filter(n => n.type === 'file')
    .map(n => n.filePath);

  if (directory) {
    filePaths = filePaths.filter(f => f.startsWith(directory));
  }

  if (filePaths.length === 0) {
    return {
      analyzed: false,
      overallBusFactor: 0,
      riskSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      criticalAreas: [],
      topOwners: [],
      insights: [],
      summary: directory
        ? `No files found in directory "${directory}".`
        : 'No files found in the knowledge graph.',
    };
  }

  const analysis = await analyzeKnowledgeDistribution(graph.metadata.rootDir, filePaths);

  // Count risk levels
  const riskSummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const area of analysis.criticalAreas) {
    riskSummary[area.riskLevel]++;
  }

  // Format critical areas
  const criticalAreas = analysis.criticalAreas
    .slice(0, limit)
    .map(area => ({
      path: area.path,
      owner: area.primaryOwner,
      ownershipPct: area.ownershipPercentage,
      busFactor: area.busFactor,
      daysSinceChange: area.daysSinceLastChange,
      verdict: getVerdict(area),
    }));

  // Format top owners
  const topOwners = analysis.ownershipDistribution.slice(0, 5).map(o => ({
    name: o.contributor,
    filesOwned: o.filesOwned,
    percentage: o.percentage,
  }));

  const summary = generateSummary(analysis, riskSummary, criticalAreas, topOwners, directory);

  return {
    analyzed: true,
    overallBusFactor: analysis.overallBusFactor,
    riskSummary,
    criticalAreas,
    topOwners,
    insights: analysis.insights,
    summary,
  };
}

function getVerdict(area: KnowledgeRisk): string {
  if (area.riskLevel === 'critical') {
    if (area.daysSinceLastChange > 180) {
      return `Only ${area.primaryOwner} understands this, and it's been ${Math.floor(area.daysSinceLastChange / 30)} months since they touched it. They may have forgotten details.`;
    }
    return `${area.primaryOwner} owns ${area.ownershipPercentage}% of this file. If they leave, this knowledge could be lost.`;
  }

  if (area.riskLevel === 'high') {
    return `Single significant contributor. Consider pair programming or code review handoffs.`;
  }

  if (area.daysSinceLastChange > 180) {
    return `Stale code (${Math.floor(area.daysSinceLastChange / 30)} months). Original context may be lost.`;
  }

  return `Moderate risk. ${area.totalContributors} contributors have touched this.`;
}

function generateSummary(
  analysis: BusFactorAnalysis,
  riskSummary: { critical: number; high: number; medium: number; low: number },
  criticalAreas: Array<{ path: string; owner: string; ownershipPct: number; busFactor: number }>,
  topOwners: Array<{ name: string; filesOwned: number; percentage: number }>,
  directory?: string
): string {
  const parts: string[] = [];

  const scope = directory ? `\`${directory}/\`` : 'my codebase';
  parts.push(`## Bus Factor Analysis: ${scope}`);
  parts.push('');

  // Overall assessment
  const emoji = analysis.overallBusFactor < 1.5 ? '🔴' :
                analysis.overallBusFactor < 2.5 ? '🟠' :
                analysis.overallBusFactor < 3.5 ? '🟡' : '🟢';

  parts.push(`${emoji} **Overall Bus Factor: ${analysis.overallBusFactor}**`);
  parts.push('');

  if (analysis.overallBusFactor < 1.5) {
    parts.push(`*This is concerning. Much of my code is understood by only 1-2 people.*`);
  } else if (analysis.overallBusFactor < 2.5) {
    parts.push(`*There's room for improvement. Consider cross-training on critical areas.*`);
  } else {
    parts.push(`*Good knowledge distribution! My team shares understanding of most code.*`);
  }
  parts.push('');

  // Risk breakdown
  parts.push('### Risk Summary');
  parts.push('');
  parts.push(`| Risk Level | Files |`);
  parts.push(`|------------|-------|`);
  if (riskSummary.critical > 0) parts.push(`| 🔴 Critical | ${riskSummary.critical} |`);
  if (riskSummary.high > 0) parts.push(`| 🟠 High | ${riskSummary.high} |`);
  if (riskSummary.medium > 0) parts.push(`| 🟡 Medium | ${riskSummary.medium} |`);
  if (riskSummary.low > 0) parts.push(`| 🟢 Low | ${riskSummary.low} |`);
  parts.push('');

  // Critical areas
  if (criticalAreas.length > 0) {
    parts.push('### Knowledge Concentration Risks');
    parts.push('');

    const critical = criticalAreas.filter(a =>
      analysis.criticalAreas.find(ca => ca.path === a.path)?.riskLevel === 'critical'
    );
    const high = criticalAreas.filter(a =>
      analysis.criticalAreas.find(ca => ca.path === a.path)?.riskLevel === 'high'
    );

    if (critical.length > 0) {
      parts.push('**🔴 Critical Risk** (single owner, 80%+ ownership):');
      for (const area of critical.slice(0, 5)) {
        parts.push(`- \`${area.path}\` — ${area.owner} owns ${area.ownershipPct}%`);
      }
      parts.push('');
    }

    if (high.length > 0) {
      parts.push('**🟠 High Risk**:');
      for (const area of high.slice(0, 5)) {
        parts.push(`- \`${area.path}\` — Owned by ${area.owner}`);
      }
      parts.push('');
    }
  }

  // Ownership distribution
  if (topOwners.length > 0) {
    parts.push('### Code Ownership Distribution');
    parts.push('');
    for (const owner of topOwners) {
      const bar = '█'.repeat(Math.ceil(owner.percentage / 10));
      parts.push(`${owner.name}: ${bar} ${owner.percentage}% (${owner.filesOwned} files)`);
    }
    parts.push('');
  }

  // Insights
  if (analysis.insights.length > 0) {
    parts.push('### Insights');
    parts.push('');
    for (const insight of analysis.insights) {
      parts.push(`- ${insight}`);
    }
    parts.push('');
  }

  // Recommendations
  parts.push('### Recommendations');
  parts.push('');
  if (riskSummary.critical > 0) {
    parts.push('1. **Pair programming sessions** on critical files to spread knowledge');
    parts.push('2. **Code reviews** by people OTHER than the primary owner');
    parts.push('3. **Documentation** of complex logic in high-risk areas');
  } else if (riskSummary.high > 0) {
    parts.push('1. **Cross-training** on high-risk areas');
    parts.push('2. **Rotate ownership** on stale files');
  } else {
    parts.push('Your knowledge distribution looks healthy! Keep up the collaborative practices.');
  }

  return parts.join('\n');
}
