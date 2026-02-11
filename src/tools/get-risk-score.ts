/**
 * Get Risk Score Tool
 *
 * MCP tool for analyzing commit/PR risk.
 */

import { z } from 'zod';
import type { KnowledgeGraph } from '../graph/types.js';
import { calculateRiskScore } from '../risk/scorer.js';
import type { RiskScore } from '../risk/types.js';

export const schema = {
  staged: z.boolean().optional().describe('Analyze staged changes (default: true)'),
  branch: z.string().optional().describe('Compare against this branch (e.g., "main")'),
  commit: z.string().optional().describe('Analyze a specific commit hash'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface GetRiskScoreResult {
  risk: RiskScore;
  summary: string;
}

export async function execute(
  graph: KnowledgeGraph,
  input: Input
): Promise<GetRiskScoreResult> {
  const risk = await calculateRiskScore(
    graph.metadata.rootDir,
    graph,
    {
      staged: input.staged !== false,
      branch: input.branch,
      commit: input.commit,
    }
  );

  // Format detailed summary
  const lines: string[] = [];

  // Header with emoji based on risk level
  const levelEmoji = {
    low: '\u{1F7E2}',     // green circle
    medium: '\u{1F7E1}',  // yellow circle
    high: '\u{1F7E0}',    // orange circle
    critical: '\u{1F534}', // red circle
  }[risk.level];

  lines.push(`## ${levelEmoji} Risk Analysis: ${risk.level.toUpperCase()} (${risk.overall}/100)`);
  lines.push('');
  lines.push(risk.summary);
  lines.push('');

  // Factor breakdown
  lines.push('### Risk Factors');
  lines.push('');
  lines.push('| Factor | Score | Details |');
  lines.push('|--------|-------|---------|');

  for (const [, factor] of Object.entries(risk.factors)) {
    const emoji = factor.score <= 25 ? '\u{1F7E2}' :
                  factor.score <= 50 ? '\u{1F7E1}' :
                  factor.score <= 75 ? '\u{1F7E0}' : '\u{1F534}';
    lines.push(`| ${emoji} ${factor.name} | ${factor.score}/100 | ${factor.details} |`);
  }

  lines.push('');

  // Detailed items for high-risk factors
  const highRiskFactors = Object.values(risk.factors).filter(f => f.score >= 50 && f.items && f.items.length > 0);

  if (highRiskFactors.length > 0) {
    lines.push('### Details');
    lines.push('');

    for (const factor of highRiskFactors) {
      lines.push(`**${factor.name}:**`);
      for (const item of factor.items || []) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  // Recommendations
  if (risk.recommendations.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    for (const rec of risk.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return {
    risk,
    summary: lines.join('\n'),
  };
}
