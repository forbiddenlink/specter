/**
 * Compare - Branch Health Comparison
 *
 * Compare codebase health between branches for pre-PR review.
 * Shows what changed: complexity delta, new hotspots, health score diff.
 */

import { spawnSync } from 'node:child_process';
import { type ComplexityReport, generateComplexityReport } from './analyzers/complexity.js';
import { buildKnowledgeGraph } from './graph/builder.js';
import { loadGraph } from './graph/persistence.js';
import { getPersonality } from './personality/modes.js';
import type { PersonalityMode } from './personality/types.js';

export interface CompareResult {
  currentBranch: string;
  compareBranch: string;
  currentHealth: number;
  compareHealth: number;
  healthDelta: number;
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
  complexityDelta: number;
  newHotspots: Array<{ file: string; complexity: number }>;
  resolvedHotspots: Array<{ file: string; complexity: number }>;
  riskLevel: 'safe' | 'caution' | 'danger';
  summary: string;
}

/**
 * Execute git command safely using spawnSync with argument array
 * Avoids shell injection by not interpolating user input into shell strings
 */
function gitCommand(args: string[], rootDir: string): string {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed');
  return result.stdout?.toString() || '';
}

/**
 * Get current git branch name
 */
function getCurrentBranch(rootDir: string): string {
  try {
    return gitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Get files changed between branches
 */
function getChangedFiles(
  rootDir: string,
  compareBranch: string
): { added: string[]; removed: string[]; modified: string[] } {
  try {
    const diff = gitCommand(['diff', '--name-status', `${compareBranch}...HEAD`], rootDir);

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    for (const line of diff.split('\n').filter(Boolean)) {
      const [status, file] = line.split('\t');
      if (!file) continue;

      // Only count source files
      if (!file.match(/\.(ts|tsx|js|jsx|py|java|go|rs|rb|php|cs|cpp|c|h)$/)) continue;

      switch (status) {
        case 'A':
          added.push(file);
          break;
        case 'D':
          removed.push(file);
          break;
        case 'M':
        case 'R':
          modified.push(file);
          break;
      }
    }

    return { added, removed, modified };
  } catch {
    return { added: [], removed: [], modified: [] };
  }
}

/**
 * Calculate health score from complexity report
 */
function calculateHealthScore(report: ComplexityReport): number {
  const avgComplexity = report.averageComplexity || 1;
  return Math.max(0, Math.min(100, 100 - avgComplexity * 5));
}

/**
 * Compare current branch against another branch
 */
export async function compareBranches(
  rootDir: string,
  compareBranch: string = 'main'
): Promise<CompareResult> {
  const currentBranch = getCurrentBranch(rootDir);
  const changedFiles = getChangedFiles(rootDir, compareBranch);

  // Load current graph
  let currentGraph = await loadGraph(rootDir);
  if (!currentGraph) {
    // Build it if not exists
    const result = await buildKnowledgeGraph({ rootDir });
    currentGraph = result.graph;
  }

  const currentReport = generateComplexityReport(currentGraph);
  const currentHealth = calculateHealthScore(currentReport);

  // Try to get comparison data from the other branch
  let compareHealth = currentHealth; // Default to same if we can't compare
  let compareReport = currentReport;

  let checkedOutCompareBranch = false;
  try {
    // Check if working tree is clean before switching branches
    const hasChanges = gitCommand(['status', '--porcelain'], rootDir).trim();

    if (!hasChanges) {
      // Only do full comparison if working tree is clean
      gitCommand(['checkout', compareBranch], rootDir);
      checkedOutCompareBranch = true;

      try {
        const compareResult = await buildKnowledgeGraph({ rootDir, onProgress: () => {} });
        compareReport = generateComplexityReport(compareResult.graph);
        compareHealth = calculateHealthScore(compareReport);
      } finally {
        // Always return to original branch if we checked out compare branch
        if (checkedOutCompareBranch) {
          gitCommand(['checkout', currentBranch], rootDir);
        }
      }
    }
  } catch {
    // Comparison branch might not exist or other issues
    // Try to return to original branch if we're on the wrong one
    if (checkedOutCompareBranch) {
      try {
        gitCommand(['checkout', currentBranch], rootDir);
      } catch {
        // Last resort: warn but continue
        console.error(`Warning: Could not return to branch ${currentBranch}`);
      }
    }
    // Continue with current-only analysis
  }

  const healthDelta = currentHealth - compareHealth;
  const complexityDelta = currentReport.averageComplexity - compareReport.averageComplexity;

  // Find new hotspots (files that became complex)
  const hotspotThreshold = 15;
  const currentHotspotSet = new Set(
    currentReport.hotspots.filter((h) => h.complexity >= hotspotThreshold).map((h) => h.filePath)
  );
  const compareHotspotSet = new Set(
    compareReport.hotspots.filter((h) => h.complexity >= hotspotThreshold).map((h) => h.filePath)
  );

  const newHotspots = currentReport.hotspots
    .filter((h) => h.complexity >= hotspotThreshold && !compareHotspotSet.has(h.filePath))
    .map((h) => ({ file: h.filePath, complexity: h.complexity }))
    .slice(0, 5);

  const resolvedHotspots = compareReport.hotspots
    .filter((h) => h.complexity >= hotspotThreshold && !currentHotspotSet.has(h.filePath))
    .map((h) => ({ file: h.filePath, complexity: h.complexity }))
    .slice(0, 5);

  // Determine risk level
  let riskLevel: 'safe' | 'caution' | 'danger' = 'safe';
  if (healthDelta < -10 || newHotspots.length >= 3) {
    riskLevel = 'danger';
  } else if (healthDelta < -5 || newHotspots.length >= 1 || complexityDelta > 2) {
    riskLevel = 'caution';
  }

  // Generate summary
  const totalChanges =
    changedFiles.added.length + changedFiles.modified.length + changedFiles.removed.length;
  let summary = '';
  if (riskLevel === 'safe') {
    summary = `Safe to merge. ${totalChanges} files changed with minimal health impact.`;
  } else if (riskLevel === 'caution') {
    summary = `Review recommended. Health ${healthDelta >= 0 ? 'improved' : 'decreased'} by ${Math.abs(healthDelta).toFixed(1)} points.`;
  } else {
    summary = `High risk. Health dropped ${Math.abs(healthDelta).toFixed(1)} points with ${newHotspots.length} new complexity hotspots.`;
  }

  return {
    currentBranch,
    compareBranch,
    currentHealth,
    compareHealth,
    healthDelta,
    filesAdded: changedFiles.added,
    filesRemoved: changedFiles.removed,
    filesModified: changedFiles.modified,
    complexityDelta,
    newHotspots,
    resolvedHotspots,
    riskLevel,
    summary,
  };
}

/**
 * Format compare result for display
 */
export function formatCompare(
  result: CompareResult,
  personality: PersonalityMode = 'default'
): string {
  const _config = getPersonality(personality);
  const lines: string[] = [];

  // Header
  const riskEmoji =
    result.riskLevel === 'safe'
      ? '\u2705'
      : result.riskLevel === 'caution'
        ? '\u26A0\uFE0F'
        : '\u{1F6A8}';
  const _riskColor =
    result.riskLevel === 'safe' ? 'green' : result.riskLevel === 'caution' ? 'yellow' : 'red';

  lines.push('');
  lines.push(
    `${riskEmoji} PR HEALTH CHECK: ${result.currentBranch} \u2192 ${result.compareBranch}`
  );
  lines.push('\u2500'.repeat(50));
  lines.push('');

  // Health Score Delta
  const deltaSign = result.healthDelta >= 0 ? '+' : '';
  const healthEmoji = result.healthDelta >= 0 ? '\u{1F4C8}' : '\u{1F4C9}';
  lines.push(
    `${healthEmoji} Health Score: ${Math.round(result.compareHealth)} \u2192 ${Math.round(result.currentHealth)} (${deltaSign}${result.healthDelta.toFixed(1)})`
  );

  // Complexity Delta
  const complexityEmoji = result.complexityDelta <= 0 ? '\u2728' : '\u26A0\uFE0F';
  lines.push(`${complexityEmoji} Avg Complexity: ${deltaSign}${result.complexityDelta.toFixed(2)}`);
  lines.push('');

  // Files Changed
  lines.push('\u{1F4C1} FILES CHANGED');
  lines.push(`   Added:    ${result.filesAdded.length} files`);
  lines.push(`   Modified: ${result.filesModified.length} files`);
  lines.push(`   Removed:  ${result.filesRemoved.length} files`);
  lines.push('');

  // New Hotspots (if any)
  if (result.newHotspots.length > 0) {
    lines.push('\u{1F525} NEW COMPLEXITY HOTSPOTS');
    for (const hotspot of result.newHotspots) {
      lines.push(`   \u{1F534} ${hotspot.file} (complexity: ${hotspot.complexity})`);
    }
    lines.push('');
  }

  // Resolved Hotspots (if any)
  if (result.resolvedHotspots.length > 0) {
    lines.push('\u{1F389} RESOLVED HOTSPOTS');
    for (const hotspot of result.resolvedHotspots) {
      lines.push(`   \u{1F7E2} ${hotspot.file} (was: ${hotspot.complexity})`);
    }
    lines.push('');
  }

  // Risk Assessment
  lines.push('\u{1F3AF} RISK ASSESSMENT');
  lines.push(`   Status: ${result.riskLevel.toUpperCase()}`);
  lines.push('');

  // Summary with personality
  lines.push('\u{1F4AC} VERDICT');
  if (personality === 'roast') {
    if (result.riskLevel === 'danger') {
      lines.push(`   ${result.summary} Did you even test this?`);
    } else if (result.riskLevel === 'caution') {
      lines.push(`   ${result.summary} I guess it could be worse.`);
    } else {
      lines.push(`   ${result.summary} Congrats on the bare minimum.`);
    }
  } else if (personality === 'cheerleader') {
    if (result.riskLevel === 'danger') {
      lines.push(`   ${result.summary} But we can fix this together!`);
    } else if (result.riskLevel === 'caution') {
      lines.push(`   ${result.summary} You're making progress!`);
    } else {
      lines.push(`   ${result.summary} Amazing work! \u{1F389}`);
    }
  } else if (personality === 'executive') {
    if (result.riskLevel === 'danger') {
      lines.push(`   Risk exposure: HIGH. Recommend additional review before deployment.`);
    } else if (result.riskLevel === 'caution') {
      lines.push(`   Moderate risk. Standard review process recommended.`);
    } else {
      lines.push(`   Low risk. Cleared for standard deployment pipeline.`);
    }
  } else {
    lines.push(`   ${result.summary}`);
  }

  lines.push('');

  return lines.join('\n');
}
