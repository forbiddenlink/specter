/**
 * get_file_history Tool
 *
 * Returns git history and churn information for a specific file.
 */

import { z } from 'zod';
import type { KnowledgeGraph, GitFileHistory } from '../graph/types.js';

export const schema = {
  filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

export interface FileHistoryResult {
  filePath: string;
  exists: boolean;
  hasGitHistory: boolean;
  lastModified?: string;
  commitCount?: number;
  contributorCount?: number;
  contributors?: Array<{
    name: string;
    commits: number;
    percentage: number;
  }>;
  recentActivity?: Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>;
  churnScore?: number;
  summary: string;
}

export function execute(graph: KnowledgeGraph, input: Input): FileHistoryResult {
  const { filePath } = input;

  // Check if file exists in graph
  const fileNode = graph.nodes[filePath];

  if (!fileNode) {
    return {
      filePath,
      exists: false,
      hasGitHistory: false,
      summary: `File "${filePath}" not found in the knowledge graph.`,
    };
  }

  // Check if git history is available
  if (!fileNode.lastModified) {
    return {
      filePath,
      exists: true,
      hasGitHistory: false,
      summary: `No git history available for "${filePath}". The project may not be a git repository, or this file is not tracked.`,
    };
  }

  // Calculate contributor percentages
  const contributors = fileNode.contributors || [];
  const modificationCount = fileNode.modificationCount || 0;

  // We don't have full contributor data in the basic node, but we have the names
  const contributorList = contributors.map((name, i) => ({
    name,
    commits: Math.max(1, Math.round(modificationCount / (i + 1))), // Rough estimate
    percentage: Math.round(100 / (i + 1)),
  }));

  // Calculate churn score (higher = more volatile)
  const daysSinceModified = Math.floor(
    (Date.now() - new Date(fileNode.lastModified).getTime()) / (1000 * 60 * 60 * 24)
  );
  const churnScore = calculateChurnScore(modificationCount, contributors.length, daysSinceModified);

  // Generate summary
  const summary = generateSummary(filePath, {
    lastModified: fileNode.lastModified,
    modificationCount,
    contributors,
    daysSinceModified,
    churnScore,
  });

  return {
    filePath,
    exists: true,
    hasGitHistory: true,
    lastModified: fileNode.lastModified,
    commitCount: modificationCount,
    contributorCount: contributors.length,
    contributors: contributorList,
    churnScore: Math.round(churnScore * 100) / 100,
    summary,
  };
}

function calculateChurnScore(commits: number, contributors: number, daysSinceModified: number): number {
  // Factors: commit frequency, contributor count, recency
  const commitFactor = Math.min(commits / 50, 1) * 0.4;
  const contributorFactor = Math.min(contributors / 5, 1) * 0.3;
  const recencyFactor = Math.max(0, 1 - daysSinceModified / 180) * 0.3;

  return commitFactor + contributorFactor + recencyFactor;
}

function generateSummary(
  filePath: string,
  data: {
    lastModified: string;
    modificationCount: number;
    contributors: string[];
    daysSinceModified: number;
    churnScore: number;
  }
): string {
  const parts: string[] = [];

  parts.push(`## ${filePath}`);

  // Last modified
  if (data.daysSinceModified === 0) {
    parts.push(`Last touched **today**.`);
  } else if (data.daysSinceModified === 1) {
    parts.push(`Last touched **yesterday**.`);
  } else if (data.daysSinceModified < 7) {
    parts.push(`Last touched **${data.daysSinceModified} days ago**.`);
  } else if (data.daysSinceModified < 30) {
    parts.push(`Last touched **${Math.floor(data.daysSinceModified / 7)} weeks ago**.`);
  } else if (data.daysSinceModified < 180) {
    parts.push(`Last touched **${Math.floor(data.daysSinceModified / 30)} months ago**.`);
  } else {
    parts.push(`Last touched **${Math.floor(data.daysSinceModified / 30)} months ago** — I might be getting stale.`);
  }

  // Modification frequency
  if (data.modificationCount <= 5) {
    parts.push(`Been modified ${data.modificationCount} times — I'm pretty stable.`);
  } else if (data.modificationCount <= 20) {
    parts.push(`Been modified ${data.modificationCount} times — actively maintained.`);
  } else if (data.modificationCount <= 50) {
    parts.push(`Been modified ${data.modificationCount} times — I see a lot of action.`);
  } else {
    parts.push(`Been modified **${data.modificationCount} times** — I'm a hot file, frequently changed.`);
  }

  // Contributors
  if (data.contributors.length === 1) {
    parts.push(`Written by a single author: ${data.contributors[0]}.`);
  } else if (data.contributors.length <= 3) {
    parts.push(`${data.contributors.length} people have worked on me: ${data.contributors.join(', ')}.`);
  } else {
    parts.push(`${data.contributors.length} contributors have touched me — I've had many hands.`);
    parts.push(`Key contributors: ${data.contributors.slice(0, 3).join(', ')}.`);
  }

  // Churn assessment
  if (data.churnScore > 0.7) {
    parts.push(`\n⚠️ **High churn file** — changes here frequently cause ripple effects. Review carefully.`);
  } else if (data.churnScore > 0.4) {
    parts.push(`\nModerate activity level — this file sees regular updates.`);
  } else if (data.churnScore < 0.1 && data.daysSinceModified > 90) {
    parts.push(`\n💤 This file hasn't been touched in a while. It may be stable, or it may be forgotten.`);
  }

  return parts.join('\n');
}
