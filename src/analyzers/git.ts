/**
 * Git Analyzer
 *
 * Analyzes git history to enrich the knowledge graph with
 * modification patterns, contributors, and file churn data.
 */

import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import path from 'path';
import type { GitFileHistory, ChangeCoupling, ChangeCouplingResult } from '../graph/types.js';

export interface GitAnalysisResult {
  isGitRepo: boolean;
  fileHistories: Map<string, GitFileHistory>;
  repoStats: {
    totalCommits: number;
    totalContributors: number;
    oldestCommit?: string;
    newestCommit?: string;
  };
}

/**
 * Initialize git client for a directory
 */
export function createGitClient(rootDir: string): SimpleGit {
  return simpleGit(rootDir);
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepository(git: SimpleGit): Promise<boolean> {
  try {
    await git.status();
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyze git history for a specific file
 */
export async function analyzeFileHistory(
  git: SimpleGit,
  filePath: string,
  rootDir: string,
  maxCommits: number = 50
): Promise<GitFileHistory | null> {
  try {
    const log = await git.log({
      file: filePath,
      maxCount: maxCommits,
    });

    if (log.total === 0) {
      return null;
    }

    // Group commits by author
    const contributorMap = new Map<string, {
      name: string;
      email: string;
      commits: number;
      lastCommit: string;
    }>();

    for (const commit of log.all) {
      const key = commit.author_email;
      const existing = contributorMap.get(key);

      if (existing) {
        existing.commits++;
        if (new Date(commit.date) > new Date(existing.lastCommit)) {
          existing.lastCommit = commit.date;
        }
      } else {
        contributorMap.set(key, {
          name: commit.author_name,
          email: commit.author_email,
          commits: 1,
          lastCommit: commit.date,
        });
      }
    }

    const contributors = [...contributorMap.values()]
      .sort((a, b) => b.commits - a.commits);

    const recentCommits = log.all.slice(0, 10).map(c => ({
      hash: c.hash.substring(0, 7),
      message: c.message.split('\n')[0].substring(0, 80),
      author: c.author_name,
      date: c.date,
    }));

    return {
      filePath: path.relative(rootDir, filePath),
      lastModified: log.latest?.date || '',
      commitCount: log.total,
      contributorCount: contributors.length,
      contributors,
      recentCommits,
    };
  } catch (error) {
    // File might not be tracked or other git error
    return null;
  }
}

/**
 * Get repository-wide statistics
 */
export async function getRepoStats(git: SimpleGit): Promise<{
  totalCommits: number;
  totalContributors: number;
  oldestCommit?: string;
  newestCommit?: string;
}> {
  try {
    const log = await git.log({ maxCount: 1 });
    const shortlog = await git.raw(['shortlog', '-sn', '--all']);

    const contributorLines = shortlog.trim().split('\n').filter(Boolean);
    const totalContributors = contributorLines.length;

    // Get total commit count
    const countResult = await git.raw(['rev-list', '--count', 'HEAD']);
    const totalCommits = parseInt(countResult.trim(), 10) || 0;

    // Get oldest commit
    const oldestLog = await git.raw(['log', '--reverse', '--format=%aI', '-1']);
    const oldestCommit = oldestLog.trim() || undefined;

    return {
      totalCommits,
      totalContributors,
      oldestCommit,
      newestCommit: log.latest?.date,
    };
  } catch {
    return {
      totalCommits: 0,
      totalContributors: 0,
    };
  }
}

/**
 * Analyze git history for multiple files
 */
export async function analyzeGitHistory(
  rootDir: string,
  filePaths: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<GitAnalysisResult> {
  const git = createGitClient(rootDir);
  const isRepo = await isGitRepository(git);

  if (!isRepo) {
    return {
      isGitRepo: false,
      fileHistories: new Map(),
      repoStats: {
        totalCommits: 0,
        totalContributors: 0,
      },
    };
  }

  const fileHistories = new Map<string, GitFileHistory>();
  const repoStats = await getRepoStats(git);

  // Analyze files in batches to avoid overwhelming git
  const batchSize = 10;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (filePath) => {
        const history = await analyzeFileHistory(git, path.join(rootDir, filePath), rootDir);
        if (history) {
          fileHistories.set(filePath, history);
        }
      })
    );

    if (onProgress) {
      onProgress(Math.min(i + batchSize, filePaths.length), filePaths.length);
    }
  }

  return {
    isGitRepo: true,
    fileHistories,
    repoStats,
  };
}

/**
 * Identify "hot" files based on change frequency
 */
export function identifyHotFiles(
  fileHistories: Map<string, GitFileHistory>,
  threshold: number = 10
): string[] {
  return [...fileHistories.entries()]
    .filter(([_, history]) => history.commitCount >= threshold)
    .sort((a, b) => b[1].commitCount - a[1].commitCount)
    .map(([path]) => path);
}

/**
 * Calculate file churn score (higher = more volatile)
 */
export function calculateChurnScore(history: GitFileHistory): number {
  // Factors: commit count, number of contributors, recency
  const commitFactor = Math.min(history.commitCount / 50, 1) * 0.4;
  const contributorFactor = Math.min(history.contributorCount / 5, 1) * 0.3;

  // Recency: if last modified within 30 days, higher score
  const lastModified = new Date(history.lastModified);
  const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.max(0, 1 - daysSinceModified / 180) * 0.3;

  return commitFactor + contributorFactor + recencyFactor;
}

/**
 * Analyze change coupling - find files that frequently change together
 * This reveals hidden dependencies not visible in import graphs
 */
export async function analyzeChangeCoupling(
  rootDir: string,
  targetFile: string,
  options: {
    maxCommits?: number;
    minCouplingStrength?: number;
    importEdges?: Set<string>; // Set of "file1->file2" import relationships
  } = {}
): Promise<ChangeCouplingResult> {
  const { maxCommits = 200, minCouplingStrength = 0.3, importEdges = new Set() } = options;
  const git = createGitClient(rootDir);

  const isRepo = await isGitRepository(git);
  if (!isRepo) {
    return { targetFile, coupledFiles: [], insights: ['Not a git repository'] };
  }

  try {
    // Get commits that touched the target file
    const targetLog = await git.log({
      file: targetFile,
      maxCount: maxCommits,
    });

    if (targetLog.total === 0) {
      return { targetFile, coupledFiles: [], insights: ['No git history for this file'] };
    }

    // For each commit, get all files that changed
    const coChangeCount = new Map<string, {
      count: number;
      commits: Array<{ hash: string; message: string; date: string }>;
    }>();

    for (const commit of targetLog.all) {
      try {
        // Get files changed in this commit
        const diffResult = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);

        const changedFiles = diffResult
          .trim()
          .split('\n')
          .filter(f => f && f !== targetFile);

        for (const file of changedFiles) {
          // Skip non-source files
          if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;

          const existing = coChangeCount.get(file);
          if (existing) {
            existing.count++;
            if (existing.commits.length < 5) {
              existing.commits.push({
                hash: commit.hash.substring(0, 7),
                message: commit.message.split('\n')[0].substring(0, 60),
                date: commit.date,
              });
            }
          } else {
            coChangeCount.set(file, {
              count: 1,
              commits: [{
                hash: commit.hash.substring(0, 7),
                message: commit.message.split('\n')[0].substring(0, 60),
                date: commit.date,
              }],
            });
          }
        }
      } catch {
        // Skip commits that fail (e.g., root commits)
        continue;
      }
    }

    // Calculate coupling strength and filter
    const coupledFiles: ChangeCoupling[] = [];
    const totalTargetCommits = targetLog.total;

    for (const [file, data] of coChangeCount.entries()) {
      const couplingStrength = data.count / totalTargetCommits;

      if (couplingStrength >= minCouplingStrength) {
        // Check if there's an import relationship
        const hasImport = importEdges.has(`${targetFile}->${file}`) ||
                         importEdges.has(`${file}->${targetFile}`);

        // Get the other file's commit count for context
        let totalCommitsFile2 = data.count;
        try {
          const otherLog = await git.log({ file, maxCount: 1 });
          totalCommitsFile2 = otherLog.total;
        } catch {
          // Use co-change count as fallback
        }

        coupledFiles.push({
          file1: targetFile,
          file2: file,
          couplingStrength: Math.round(couplingStrength * 100) / 100,
          sharedCommits: data.count,
          totalCommitsFile1: totalTargetCommits,
          totalCommitsFile2,
          hasImportRelationship: hasImport,
          recentExamples: data.commits.slice(0, 3),
        });
      }
    }

    // Sort by coupling strength
    coupledFiles.sort((a, b) => b.couplingStrength - a.couplingStrength);

    // Generate insights
    const insights = generateCouplingInsights(targetFile, coupledFiles);

    return { targetFile, coupledFiles, insights };
  } catch (error) {
    return {
      targetFile,
      coupledFiles: [],
      insights: [`Error analyzing coupling: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Generate human-readable insights about change coupling
 */
function generateCouplingInsights(targetFile: string, couplings: ChangeCoupling[]): string[] {
  const insights: string[] = [];

  if (couplings.length === 0) {
    insights.push('This file changes independently - no strong coupling detected.');
    return insights;
  }

  // Hidden dependencies (high coupling but no import)
  const hidden = couplings.filter(c => !c.hasImportRelationship && c.couplingStrength >= 0.5);
  if (hidden.length > 0) {
    insights.push(
      `Found ${hidden.length} hidden dependency: ${hidden.map(h => h.file2).join(', ')} ` +
      `always changes with this file but has no import relationship.`
    );
  }

  // Very strong coupling
  const strong = couplings.filter(c => c.couplingStrength >= 0.7);
  if (strong.length > 0) {
    for (const c of strong.slice(0, 2)) {
      const pct = Math.round(c.couplingStrength * 100);
      insights.push(
        `${c.file2} changes together ${pct}% of the time (${c.sharedCommits} shared commits). ` +
        (c.hasImportRelationship
          ? 'They have a direct dependency.'
          : 'Consider if these should be merged or if there\'s a missing abstraction.')
      );
    }
  }

  // Coupling cluster warning
  if (couplings.length >= 5) {
    insights.push(
      `This file is part of a change cluster with ${couplings.length} files. ` +
      'Changes here tend to ripple. Consider refactoring to reduce coupling.'
    );
  }

  return insights;
}
