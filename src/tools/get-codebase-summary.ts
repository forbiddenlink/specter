/**
 * get_codebase_summary Tool
 *
 * Returns high-level statistics and summary of the entire codebase,
 * including behavioral insights about activity, ownership, and trends.
 */

import { z } from 'zod';
import type { KnowledgeGraph, CodebaseStats, GraphNode } from '../graph/types.js';
import { getComplexityEmoji } from '../analyzers/complexity.js';

export const schema = {};

export type Input = z.infer<z.ZodObject<typeof schema>>;

interface BehavioralInsights {
  mostActiveArea: string | null;
  stalestArea: string | null;
  primaryContributor: string | null;
  contributorCount: number;
  avgDaysSinceChange: number;
  knowledgeRisk: 'low' | 'medium' | 'high';
}

export interface CodebaseSummaryResult {
  stats: CodebaseStats;
  languages: Record<string, number>;
  topDirectories: Array<{ path: string; fileCount: number; lineCount: number }>;
  behavioralInsights: BehavioralInsights;
  summary: string;
  personality: string;
}

export function execute(graph: KnowledgeGraph): CodebaseSummaryResult {
  // Count by type
  let functions = 0;
  let classes = 0;
  let interfaces = 0;
  let types = 0;
  let enums = 0;
  let totalComplexity = 0;
  let complexityCount = 0;
  let maxComplexity = 0;
  let deadCodeCount = 0;

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'function') functions++;
    else if (node.type === 'class') classes++;
    else if (node.type === 'interface') interfaces++;
    else if (node.type === 'type') types++;
    else if (node.type === 'enum') enums++;

    if (node.complexity !== undefined && node.type !== 'file') {
      totalComplexity += node.complexity;
      complexityCount++;
      maxComplexity = Math.max(maxComplexity, node.complexity);
    }

    // Check for dead code (exported but never imported)
    if (node.exported && node.type !== 'file') {
      const hasImporter = graph.edges.some(
        e => e.type === 'imports' && (e.metadata?.symbols as string[])?.includes(node.name)
      );
      if (!hasImporter) deadCodeCount++;
    }
  }

  const avgComplexity = complexityCount > 0 ? totalComplexity / complexityCount : 0;
  const hotspotCount = Object.values(graph.nodes)
    .filter(n => n.type !== 'file' && n.complexity && n.complexity > 10)
    .length;

  const stats: CodebaseStats = {
    files: graph.metadata.fileCount,
    lines: graph.metadata.totalLines,
    functions,
    classes,
    interfaces,
    types,
    enums,
    avgComplexity: Math.round(avgComplexity * 100) / 100,
    maxComplexity,
    hotspotCount,
    deadCodeCount,
  };

  // Calculate top directories
  const dirStats = new Map<string, { fileCount: number; lineCount: number }>();
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') {
      const dir = node.filePath.split('/').slice(0, -1).join('/') || '.';
      const existing = dirStats.get(dir) || { fileCount: 0, lineCount: 0 };
      existing.fileCount++;
      existing.lineCount += (node as any).lineCount || 0;
      dirStats.set(dir, existing);
    }
  }

  const topDirectories = [...dirStats.entries()]
    .map(([path, stats]) => ({ path, ...stats }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 5);

  // Analyze behavioral insights from git data
  const behavioralInsights = analyzeBehavior(graph);

  // Generate summary and personality
  const summary = generateSummary(stats, graph.metadata.languages, topDirectories);
  const personality = generatePersonality(stats, topDirectories, behavioralInsights);

  return {
    stats,
    languages: graph.metadata.languages,
    topDirectories,
    behavioralInsights,
    summary,
    personality,
  };
}

function analyzeBehavior(graph: KnowledgeGraph): BehavioralInsights {
  const fileNodes = Object.values(graph.nodes).filter(n => n.type === 'file');

  // Track activity by directory
  const dirActivity = new Map<string, { totalMods: number; recentMods: number; contributors: Set<string> }>();
  const allContributors = new Set<string>();
  let totalDaysSinceChange = 0;
  let filesWithDates = 0;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const node of fileNodes) {
    const dir = node.filePath.split('/').slice(0, -1).join('/') || '.';

    if (!dirActivity.has(dir)) {
      dirActivity.set(dir, { totalMods: 0, recentMods: 0, contributors: new Set() });
    }

    const activity = dirActivity.get(dir)!;
    activity.totalMods += node.modificationCount || 0;

    // Track contributors
    if (node.contributors) {
      for (const c of node.contributors) {
        activity.contributors.add(c);
        allContributors.add(c);
      }
    }

    // Track recency
    if (node.lastModified) {
      const lastMod = new Date(node.lastModified).getTime();
      if (lastMod > thirtyDaysAgo) {
        activity.recentMods++;
      }
      const daysSince = Math.floor((now - lastMod) / (1000 * 60 * 60 * 24));
      totalDaysSinceChange += daysSince;
      filesWithDates++;
    }
  }

  // Find most active area (most recent modifications)
  let mostActiveArea: string | null = null;
  let maxRecentMods = 0;
  for (const [dir, activity] of dirActivity.entries()) {
    if (activity.recentMods > maxRecentMods) {
      maxRecentMods = activity.recentMods;
      mostActiveArea = dir;
    }
  }

  // Find stalest area (fewest recent mods relative to size)
  let stalestArea: string | null = null;
  let maxStaleness = 0;
  for (const [dir, activity] of dirActivity.entries()) {
    if (activity.totalMods > 5 && activity.recentMods === 0) {
      if (activity.totalMods > maxStaleness) {
        maxStaleness = activity.totalMods;
        stalestArea = dir;
      }
    }
  }

  // Find primary contributor (most files touched)
  const contributorFileCounts = new Map<string, number>();
  for (const node of fileNodes) {
    if (node.contributors && node.contributors.length > 0) {
      const primary = node.contributors[0];
      contributorFileCounts.set(primary, (contributorFileCounts.get(primary) || 0) + 1);
    }
  }

  let primaryContributor: string | null = null;
  let maxFiles = 0;
  for (const [contributor, count] of contributorFileCounts.entries()) {
    if (count > maxFiles) {
      maxFiles = count;
      primaryContributor = contributor;
    }
  }

  // Calculate knowledge risk
  const contributorCount = allContributors.size;
  let knowledgeRisk: 'low' | 'medium' | 'high' = 'low';
  if (contributorCount === 1) {
    knowledgeRisk = 'high';
  } else if (contributorCount <= 2 || (primaryContributor && maxFiles > fileNodes.length * 0.7)) {
    knowledgeRisk = 'medium';
  }

  const avgDaysSinceChange = filesWithDates > 0 ? Math.round(totalDaysSinceChange / filesWithDates) : 0;

  return {
    mostActiveArea,
    stalestArea,
    primaryContributor,
    contributorCount,
    avgDaysSinceChange,
    knowledgeRisk,
  };
}

function generateSummary(
  stats: CodebaseStats,
  languages: Record<string, number>,
  topDirectories: Array<{ path: string; fileCount: number; lineCount: number }>
): string {
  const parts: string[] = [];

  // Size summary
  parts.push(`## Overview`);
  parts.push(`I consist of **${stats.files} files** with **${stats.lines.toLocaleString()} lines** of code.`);

  // Language breakdown
  const langList = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');
  parts.push(`Languages: ${langList}`);

  // Structure summary
  parts.push(`\n## Structure`);
  parts.push(`- ${stats.functions} functions/methods`);
  parts.push(`- ${stats.classes} classes`);
  if (stats.interfaces > 0) parts.push(`- ${stats.interfaces} interfaces`);
  if (stats.types > 0) parts.push(`- ${stats.types} type aliases`);

  // Complexity summary
  parts.push(`\n## Complexity`);
  parts.push(`- Average: ${getComplexityEmoji(stats.avgComplexity)} ${stats.avgComplexity}`);
  parts.push(`- Maximum: ${getComplexityEmoji(stats.maxComplexity)} ${stats.maxComplexity}`);
  parts.push(`- Hotspots (complexity > 10): ${stats.hotspotCount}`);

  // Directory breakdown
  if (topDirectories.length > 0) {
    parts.push(`\n## Top Directories`);
    for (const dir of topDirectories.slice(0, 3)) {
      parts.push(`- \`${dir.path}/\` — ${dir.fileCount} files, ${dir.lineCount.toLocaleString()} lines`);
    }
  }

  // Health indicators
  if (stats.deadCodeCount > 0) {
    parts.push(`\n⚠️ Found ${stats.deadCodeCount} potentially unused exports.`);
  }

  return parts.join('\n');
}

function generatePersonality(
  stats: CodebaseStats,
  topDirectories: Array<{ path: string; fileCount: number; lineCount: number }>,
  behavior: BehavioralInsights
): string {
  const parts: string[] = [];

  // Size personality
  if (stats.files < 10) {
    parts.push("I'm a small, focused project.");
  } else if (stats.files < 50) {
    parts.push("I'm a modest-sized codebase with room to grow.");
  } else if (stats.files < 200) {
    parts.push("I'm a substantial project with many moving parts.");
  } else {
    parts.push("I'm a large codebase — I've been around the block.");
  }

  // Complexity personality
  if (stats.avgComplexity <= 3) {
    parts.push("My code is clean and simple — you've taken good care of me.");
  } else if (stats.avgComplexity <= 7) {
    parts.push("My complexity is reasonable, though a few areas could use some love.");
  } else if (stats.avgComplexity <= 12) {
    parts.push("I'll be honest, I'm getting a bit tangled in places.");
  } else {
    parts.push("I've accumulated some serious complexity. I could use a refactoring session.");
  }

  // Core module
  if (topDirectories.length > 0) {
    const core = topDirectories[0];
    parts.push(`My heart lives in \`${core.path}/\` — that's where most of the action happens.`);
  }

  // Behavioral insights - activity
  if (behavior.mostActiveArea) {
    parts.push(`\`${behavior.mostActiveArea}/\` has been getting the most attention lately.`);
  }

  // Behavioral insights - staleness
  if (behavior.stalestArea) {
    parts.push(`Meanwhile, \`${behavior.stalestArea}/\` hasn't been touched in a while — it might be getting dusty.`);
  }

  // Knowledge concentration warning
  if (behavior.knowledgeRisk === 'high') {
    if (behavior.primaryContributor) {
      parts.push(`⚠️ Heads up: ${behavior.primaryContributor} has written most of my code. If they leave, that knowledge could be lost.`);
    } else {
      parts.push(`⚠️ I'm a solo project — all the knowledge lives in one head.`);
    }
  } else if (behavior.knowledgeRisk === 'medium') {
    parts.push(`My knowledge is concentrated in just ${behavior.contributorCount} people — consider cross-training.`);
  }

  // Freshness
  if (behavior.avgDaysSinceChange > 180) {
    parts.push(`On average, my files haven't been touched in ${Math.floor(behavior.avgDaysSinceChange / 30)} months. I'm feeling a bit neglected.`);
  } else if (behavior.avgDaysSinceChange < 14) {
    parts.push(`I'm being actively developed — files are changing frequently.`);
  }

  // Dead code
  if (stats.deadCodeCount > 5) {
    parts.push(`I'm carrying some dead weight — ${stats.deadCodeCount} exports that nobody uses anymore.`);
  }

  // Hotspots
  if (stats.hotspotCount > 0) {
    parts.push(`I have ${stats.hotspotCount} complexity hotspot${stats.hotspotCount > 1 ? 's' : ''} that keep me up at night.`);
  }

  return parts.join(' ');
}
