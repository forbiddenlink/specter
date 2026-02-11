/**
 * get_change_coupling Tool
 *
 * Analyzes git history to find files that frequently change together,
 * revealing hidden dependencies not visible in import graphs.
 * This is one of the most valuable features for understanding codebases.
 */

import { z } from 'zod';
import type { KnowledgeGraph, ChangeCouplingResult } from '../graph/types.js';
import { analyzeChangeCoupling } from '../analyzers/git.js';

export const schema = {
  filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
  minStrength: z.number().optional().describe('Minimum coupling strength (0-1, default 0.3)'),
  maxResults: z.number().optional().describe('Maximum number of coupled files to return'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface ChangeCouplingToolResult {
  filePath: string;
  found: boolean;
  coupledFiles: Array<{
    file: string;
    strength: number;
    strengthLabel: string;
    sharedCommits: number;
    hasImportRelationship: boolean;
    verdict: string;
  }>;
  hiddenDependencies: string[];
  insights: string[];
  summary: string;
}

export async function execute(
  graph: KnowledgeGraph,
  input: Input
): Promise<ChangeCouplingToolResult> {
  const { filePath, minStrength = 0.3, maxResults = 10 } = input;

  // Check if file exists in graph
  const fileNode = graph.nodes[filePath];
  if (!fileNode) {
    return {
      filePath,
      found: false,
      coupledFiles: [],
      hiddenDependencies: [],
      insights: [],
      summary: `I don't have a file at "${filePath}" in my knowledge graph.`,
    };
  }

  // Build set of known import relationships
  const importEdges = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      // Extract file paths from node IDs
      const sourceFile = graph.nodes[edge.source]?.filePath;
      const targetFile = graph.nodes[edge.target]?.filePath;
      if (sourceFile && targetFile) {
        importEdges.add(`${sourceFile}->${targetFile}`);
      }
    }
  }

  // Analyze change coupling
  const result = await analyzeChangeCoupling(
    graph.metadata.rootDir,
    filePath,
    { minCouplingStrength: minStrength, importEdges }
  );

  // Format results
  const coupledFiles = result.coupledFiles
    .slice(0, maxResults)
    .map(c => ({
      file: c.file2,
      strength: c.couplingStrength,
      strengthLabel: getStrengthLabel(c.couplingStrength),
      sharedCommits: c.sharedCommits,
      hasImportRelationship: c.hasImportRelationship,
      verdict: getVerdict(c.couplingStrength, c.hasImportRelationship),
    }));

  // Identify hidden dependencies (high coupling, no import)
  const hiddenDependencies = result.coupledFiles
    .filter(c => c.couplingStrength >= 0.5 && !c.hasImportRelationship)
    .map(c => c.file2);

  // Generate summary
  const summary = generateSummary(filePath, coupledFiles, hiddenDependencies, result.insights);

  return {
    filePath,
    found: true,
    coupledFiles,
    hiddenDependencies,
    insights: result.insights,
    summary,
  };
}

function getStrengthLabel(strength: number): string {
  if (strength >= 0.8) return 'very strong';
  if (strength >= 0.6) return 'strong';
  if (strength >= 0.4) return 'moderate';
  return 'weak';
}

function getVerdict(strength: number, hasImport: boolean): string {
  if (strength >= 0.7 && !hasImport) {
    return 'Hidden dependency - consider extracting shared logic or adding explicit dependency';
  }
  if (strength >= 0.7 && hasImport) {
    return 'Expected coupling - files are directly related';
  }
  if (strength >= 0.5 && !hasImport) {
    return 'Possible hidden relationship - investigate if these should be connected';
  }
  if (strength >= 0.5 && hasImport) {
    return 'Normal coupling through import relationship';
  }
  return 'Occasional co-changes - may be coincidental';
}

function generateSummary(
  filePath: string,
  coupled: Array<{ file: string; strength: number; strengthLabel: string; hasImportRelationship: boolean }>,
  hidden: string[],
  insights: string[]
): string {
  const parts: string[] = [];

  parts.push(`## Change Coupling Analysis: ${filePath}`);
  parts.push('');

  if (coupled.length === 0) {
    parts.push('This file changes independently - I found no significant coupling with other files.');
    parts.push('');
    parts.push('This could mean:');
    parts.push('- The file is well-isolated (good!)');
    parts.push('- Or it hasn\'t been modified much yet');
    return parts.join('\n');
  }

  parts.push(`Found **${coupled.length}** files that frequently change together with this one:`);
  parts.push('');

  // List top coupled files
  for (const c of coupled.slice(0, 5)) {
    const emoji = c.hasImportRelationship ? '🔗' : '👻';
    const pct = Math.round(c.strength * 100);
    parts.push(`${emoji} **${c.file}** — ${pct}% coupling (${c.strengthLabel})`);
    if (!c.hasImportRelationship && c.strength >= 0.5) {
      parts.push(`   ⚠️ No import relationship - this is a hidden dependency!`);
    }
  }

  if (coupled.length > 5) {
    parts.push(`   ...and ${coupled.length - 5} more`);
  }

  // Hidden dependencies section
  if (hidden.length > 0) {
    parts.push('');
    parts.push('### 👻 Hidden Dependencies Detected');
    parts.push('');
    parts.push('These files change together frequently but have NO import relationship:');
    for (const h of hidden) {
      parts.push(`- ${h}`);
    }
    parts.push('');
    parts.push('**Recommendation:** Consider if these should:');
    parts.push('1. Share a common abstraction');
    parts.push('2. Be merged into one file');
    parts.push('3. Have an explicit dependency added');
  }

  // Add insights
  if (insights.length > 0) {
    parts.push('');
    parts.push('### Insights');
    for (const insight of insights) {
      parts.push(`- ${insight}`);
    }
  }

  return parts.join('\n');
}
