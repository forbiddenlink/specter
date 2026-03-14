/**
 * Knowledge Map Helpers
 *
 * Extracted helper functions for the knowledge map module.
 * Handles git log parsing, contributor expertise aggregation,
 * and knowledge area risk calculations.
 */

import type { DefaultLogFields, LogResult, SimpleGit } from 'simple-git';
import { calculateContributionScore } from './contribution-helpers.js';

export interface ContributorStats {
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  lastCommit: Date;
}

export interface ContributorExpertise {
  contributor: string;
  areas: Map<string, number>; // directory -> expertise score (0-100)
  primaryExpertise: string[]; // Top 3 areas
  totalContributions: number;
}

export interface KnowledgeArea {
  path: string; // Directory or file pattern
  experts: Array<{ name: string; score: number }>;
  busFactor: number; // 1 = single person, higher = distributed
  coverage: 'solo' | 'pair' | 'team' | 'distributed';
}

/**
 * Parse git log output into area contributions map.
 *
 * This function handles both detailed git log with numstat and fallback
 * to basic log analysis when numstat is not available.
 *
 * @param git - SimpleGit instance
 * @param areaFiles - Map of areas to their files
 * @param getAreaForFile - Function to find which area a file belongs to
 * @returns Map of area names to contributor stats
 */
export async function parseGitLog(
  git: SimpleGit,
  areaFiles: Map<string, string[]>,
  getAreaForFile: (file: string, areaFiles: Map<string, string[]>) => string | null
): Promise<Map<string, Map<string, ContributorStats>>> {
  const areaContributions = new Map<string, Map<string, ContributorStats>>();

  try {
    // Get commit log with numstat for line counts
    const _log = await git.log({
      maxCount: 500,
      '--numstat': null,
      '--format': '%H|%an|%ae|%aI',
    });

    // Parse the raw output to get file-level stats
    const rawLog = await git.raw(['log', '--numstat', '--format=%H|%an|%aI', '-500']);

    let currentAuthor = '';
    let currentDate = new Date();

    for (const line of rawLog.split('\n')) {
      if (line.includes('|')) {
        const parts = line.split('|');
        const author = parts[1];
        const dateStr = parts[2];
        if (parts.length >= 3 && author && dateStr) {
          currentAuthor = author;
          currentDate = new Date(dateStr);
        }
      } else if (line.match(/^\d+\s+\d+\s+.+/)) {
        const match = line.match(/^(\d+)\s+(\d+)\s+(.+)/);
        const addedStr = match?.[1];
        const removedStr = match?.[2];
        const file = match?.[3];
        if (match && currentAuthor && addedStr && removedStr && file) {
          const added = parseInt(addedStr, 10) || 0;
          const removed = parseInt(removedStr, 10) || 0;

          // Find which area this file belongs to
          const area = getAreaForFile(file, areaFiles);
          if (area) {
            if (!areaContributions.has(area)) {
              areaContributions.set(area, new Map());
            }

            const areaMap = areaContributions.get(area)!;
            const existing = areaMap.get(currentAuthor);

            if (existing) {
              existing.commits++;
              existing.linesAdded += added;
              existing.linesRemoved += removed;
              if (currentDate > existing.lastCommit) {
                existing.lastCommit = currentDate;
              }
            } else {
              areaMap.set(currentAuthor, {
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
    // Fall back to basic log analysis
    const log = await git.log({ maxCount: 200 });

    await parseGitLogFallback(git, log, areaFiles, areaContributions, getAreaForFile);
  }

  return areaContributions;
}

/**
 * Fallback git log parsing using diff-tree when numstat is not available.
 */
async function parseGitLogFallback(
  git: SimpleGit,
  log: LogResult<DefaultLogFields>,
  areaFiles: Map<string, string[]>,
  areaContributions: Map<string, Map<string, ContributorStats>>,
  getAreaForFile: (file: string, areaFiles: Map<string, string[]>) => string | null
): Promise<void> {
  for (const commit of log.all) {
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
        const area = getAreaForFile(file, areaFiles);
        if (area) {
          if (!areaContributions.has(area)) {
            areaContributions.set(area, new Map());
          }

          const areaMap = areaContributions.get(area)!;
          const existing = areaMap.get(commit.author_name);

          if (existing) {
            existing.commits++;
          } else {
            areaMap.set(commit.author_name, {
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
}

/**
 * Build contributor expertise map from area contributions.
 *
 * Calculates expertise scores for each contributor in each area,
 * and identifies their primary areas of expertise (top 3).
 *
 * @param areaContributions - Map of areas to contributor stats
 * @returns Map of contributor names to their expertise data
 */
export function buildContributorExpertise(
  areaContributions: Map<string, Map<string, ContributorStats>>
): Map<string, ContributorExpertise> {
  const contributorMap = new Map<string, ContributorExpertise>();

  for (const [area, contributors] of areaContributions.entries()) {
    const totalContributions = [...contributors.values()].reduce(
      (sum, c) => sum + calculateContributionScore(c.commits, c.linesAdded, c.linesRemoved),
      0
    );

    for (const [name, stats] of contributors.entries()) {
      if (!contributorMap.has(name)) {
        contributorMap.set(name, {
          contributor: name,
          areas: new Map(),
          primaryExpertise: [],
          totalContributions: 0,
        });
      }

      const expert = contributorMap.get(name)!;
      const contribution = calculateContributionScore(
        stats.commits,
        stats.linesAdded,
        stats.linesRemoved
      );
      const score = Math.min(100, Math.round((contribution / totalContributions) * 100));

      expert.areas.set(area, score);
      expert.totalContributions += stats.commits;
    }
  }

  // Calculate primary expertise (top 3 areas) for each contributor
  for (const expert of contributorMap.values()) {
    const sortedAreas = [...expert.areas.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([area]) => area);
    expert.primaryExpertise = sortedAreas;
  }

  return contributorMap;
}

/**
 * Build knowledge areas with experts and bus factor calculations.
 *
 * For each area, identifies experts, calculates bus factor, and
 * determines coverage level (solo, pair, team, or distributed).
 *
 * @param areaContributions - Map of areas to contributor stats
 * @returns Array of knowledge areas sorted by risk (lowest bus factor first)
 */
export function buildKnowledgeAreas(
  areaContributions: Map<string, Map<string, ContributorStats>>
): KnowledgeArea[] {
  const knowledgeAreas: KnowledgeArea[] = [];

  for (const [area, contributors] of areaContributions.entries()) {
    const totalContributions = [...contributors.values()].reduce(
      (sum, c) => sum + calculateContributionScore(c.commits, c.linesAdded, c.linesRemoved),
      0
    );

    const experts = [...contributors.entries()]
      .map(([name, stats]) => ({
        name,
        score: Math.min(
          100,
          Math.round(
            (calculateContributionScore(stats.commits, stats.linesAdded, stats.linesRemoved) /
              totalContributions) *
              100
          )
        ),
      }))
      .sort((a, b) => b.score - a.score);

    // Calculate bus factor (significant contributors >= 20% contribution)
    const significantThreshold = 20;
    const significantContributors = experts.filter((e) => e.score >= significantThreshold);
    const busFactor = Math.max(1, significantContributors.length);

    // Determine coverage
    let coverage: KnowledgeArea['coverage'];
    if (busFactor === 1) {
      coverage = 'solo';
    } else if (busFactor === 2) {
      coverage = 'pair';
    } else if (busFactor <= 4) {
      coverage = 'team';
    } else {
      coverage = 'distributed';
    }

    knowledgeAreas.push({
      path: area,
      experts: experts.slice(0, 5),
      busFactor,
      coverage,
    });
  }

  // Sort areas by risk (lowest bus factor first)
  knowledgeAreas.sort((a, b) => a.busFactor - b.busFactor);

  return knowledgeAreas;
}
