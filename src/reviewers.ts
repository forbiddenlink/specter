/**
 * Reviewers - PR Reviewer Suggestions
 *
 * Suggests optimal reviewers for a PR based on who knows
 * the affected files best.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface ReviewerCandidate {
  name: string;
  email: string;
  score: number; // Aggregate expertise score
  filesKnown: number;
  totalCommits: number;
  recentActivity: boolean;
  tier: 'primary' | 'backup' | 'optional';
  knownFiles: string[];
}

export interface ReviewersResult {
  stagedFiles: string[];
  reviewers: ReviewerCandidate[];
  recommendations: string[];
  warnings: string[];
}

/**
 * Get staged file paths from git
 */
async function getStagedFilePaths(git: SimpleGit): Promise<string[]> {
  try {
    const status = await git.diff(['--cached', '--name-only']);
    return status.split('\n').filter((line) => line.trim());
  } catch {
    return [];
  }
}

/**
 * Get expert data for a single file
 */
async function getFileExperts(
  git: SimpleGit,
  filePath: string
): Promise<Map<string, { commits: number; lastTouch: Date }>> {
  const experts = new Map<string, { commits: number; lastTouch: Date }>();

  try {
    const log = await git.log({
      file: filePath,
      maxCount: 50,
    });

    for (const commit of log.all) {
      const key = commit.author_email;
      const existing = experts.get(key);
      const commitDate = new Date(commit.date);

      if (existing) {
        existing.commits++;
        if (commitDate > existing.lastTouch) {
          existing.lastTouch = commitDate;
        }
      } else {
        experts.set(key, {
          commits: 1,
          lastTouch: commitDate,
        });
      }
    }
  } catch {
    // File may not have git history
  }

  return experts;
}

/**
 * Suggest reviewers for staged changes
 */
export async function suggestReviewers(
  rootDir: string,
  _graph: KnowledgeGraph
): Promise<ReviewersResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Get staged files
  const stagedFiles = await getStagedFilePaths(git);

  if (stagedFiles.length === 0) {
    return {
      stagedFiles: [],
      reviewers: [],
      recommendations: [],
      warnings: ['No staged changes found. Stage some files with `git add` first.'],
    };
  }

  // Get current user to exclude from reviewers
  let currentUser = '';
  try {
    currentUser = (await git.raw(['config', 'user.email'])).trim();
  } catch {
    // Can't determine current user
  }

  // Aggregate experts across all files
  const aggregateExperts = new Map<string, {
    name: string;
    email: string;
    totalCommits: number;
    filesKnown: Set<string>;
    lastTouch: Date;
  }>();

  for (const filePath of stagedFiles) {
    const fileExperts = await getFileExperts(git, filePath);

    for (const [email, stats] of fileExperts.entries()) {
      // Skip current user
      if (email === currentUser) continue;

      const existing = aggregateExperts.get(email);
      if (existing) {
        existing.totalCommits += stats.commits;
        existing.filesKnown.add(filePath);
        if (stats.lastTouch > existing.lastTouch) {
          existing.lastTouch = stats.lastTouch;
        }
      } else {
        // Get name from a log entry
        let name = email.split('@')[0];
        try {
          const log = await git.log({
            file: filePath,
            maxCount: 1,
          });
          if (log.all.length > 0 && log.all[0].author_email === email) {
            name = log.all[0].author_name;
          }
        } catch {
          // Use email prefix as name
        }

        aggregateExperts.set(email, {
          name,
          email,
          totalCommits: stats.commits,
          filesKnown: new Set([filePath]),
          lastTouch: stats.lastTouch,
        });
      }
    }
  }

  // Convert to candidates and score
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const candidates: ReviewerCandidate[] = [];

  for (const expert of aggregateExperts.values()) {
    // Score based on:
    // - Files known (50% weight)
    // - Total commits (30% weight)
    // - Recency (20% weight)
    const filesScore = (expert.filesKnown.size / stagedFiles.length) * 50;
    const commitsScore = Math.min(expert.totalCommits / 20, 1) * 30;
    const recencyScore = expert.lastTouch > thirtyDaysAgo ? 20 : 0;

    const score = Math.round(filesScore + commitsScore + recencyScore);

    // Determine tier
    let tier: ReviewerCandidate['tier'] = 'optional';
    if (expert.filesKnown.size >= stagedFiles.length * 0.7 || score >= 70) {
      tier = 'primary';
    } else if (expert.filesKnown.size >= stagedFiles.length * 0.3 || score >= 40) {
      tier = 'backup';
    }

    candidates.push({
      name: expert.name,
      email: expert.email,
      score,
      filesKnown: expert.filesKnown.size,
      totalCommits: expert.totalCommits,
      recentActivity: expert.lastTouch > thirtyDaysAgo,
      tier,
      knownFiles: Array.from(expert.filesKnown).slice(0, 5),
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Generate recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];

  const primaryReviewers = candidates.filter((c) => c.tier === 'primary');
  const backupReviewers = candidates.filter((c) => c.tier === 'backup');

  if (primaryReviewers.length > 0) {
    recommendations.push(
      `Start with ${primaryReviewers[0].name} - they know ${primaryReviewers[0].filesKnown}/${stagedFiles.length} files`
    );
  }

  if (primaryReviewers.length === 0 && backupReviewers.length > 0) {
    recommendations.push('No single expert covers most files - consider multiple reviewers');
  }

  if (candidates.length === 0) {
    warnings.push('No reviewers found for these files');
    recommendations.push('Consider adding documentation or finding domain experts');
  }

  if (stagedFiles.length > 10) {
    recommendations.push('Large PR - consider breaking into smaller reviews');
  }

  // Check for files with no experts
  const coveredFiles = new Set<string>();
  for (const candidate of candidates) {
    for (const file of candidate.knownFiles) {
      coveredFiles.add(file);
    }
  }
  const uncoveredFiles = stagedFiles.filter((f) => !coveredFiles.has(f));
  if (uncoveredFiles.length > 0) {
    warnings.push(`${uncoveredFiles.length} file(s) have no known experts`);
  }

  // Check for single point of knowledge
  const filesWithOneExpert = stagedFiles.filter((file) => {
    const expertsForFile = candidates.filter((c) => c.knownFiles.includes(file));
    return expertsForFile.length === 1;
  });
  if (filesWithOneExpert.length > 0) {
    warnings.push(`${filesWithOneExpert.length} file(s) have only one expert - bus factor risk`);
  }

  return {
    stagedFiles,
    reviewers: candidates.slice(0, 10),
    recommendations,
    warnings,
  };
}

/**
 * Format reviewers result for display
 */
export function formatReviewers(result: ReviewersResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  👥 SUGGESTED REVIEWERS                           ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.stagedFiles.length === 0) {
    lines.push('No staged changes found.');
    lines.push('');
    lines.push('Stage files with `git add <file>` first.');
    return lines.join('\n');
  }

  lines.push(`Analyzing ${result.stagedFiles.length} staged file(s)...`);
  lines.push('');

  if (result.reviewers.length === 0) {
    lines.push('No reviewers found for these files.');
    lines.push('');
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        lines.push(`  ⚠️  ${warning}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // Primary reviewers
  const primary = result.reviewers.filter((r) => r.tier === 'primary');
  if (primary.length > 0) {
    lines.push('🥇 PRIMARY REVIEWERS');
    lines.push('─'.repeat(50));
    for (const reviewer of primary) {
      const recentBadge = reviewer.recentActivity ? ' (active)' : '';
      lines.push(`  ${reviewer.name}${recentBadge}`);
      lines.push(`    Score: ${reviewer.score}/100 | Knows: ${reviewer.filesKnown}/${result.stagedFiles.length} files`);
      lines.push(`    Commits: ${reviewer.totalCommits} across affected files`);
      lines.push('');
    }
  }

  // Backup reviewers
  const backup = result.reviewers.filter((r) => r.tier === 'backup');
  if (backup.length > 0) {
    lines.push('🥈 BACKUP REVIEWERS');
    lines.push('─'.repeat(50));
    for (const reviewer of backup.slice(0, 3)) {
      const recentBadge = reviewer.recentActivity ? ' (active)' : '';
      lines.push(`  ${reviewer.name}${recentBadge}`);
      lines.push(`    Score: ${reviewer.score}/100 | Knows: ${reviewer.filesKnown}/${result.stagedFiles.length} files`);
      lines.push('');
    }
  }

  // Optional reviewers (just names)
  const optional = result.reviewers.filter((r) => r.tier === 'optional');
  if (optional.length > 0) {
    lines.push('👤 OPTIONAL REVIEWERS');
    lines.push('─'.repeat(50));
    const names = optional.slice(0, 5).map((r) => r.name).join(', ');
    lines.push(`  ${names}`);
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('⚠️  WARNINGS');
    lines.push('─'.repeat(50));
    for (const warning of result.warnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(50));
    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(51));

  return lines.join('\n');
}
