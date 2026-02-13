/**
 * Predict - PR Impact Prediction
 *
 * Analyzes staged changes to predict review time, risk level,
 * and show affected files and dependencies.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { GraphNode, KnowledgeGraph } from './graph/types.js';

export interface StagedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface FileImpact {
  path: string;
  status: StagedFile['status'];
  riskScore: number; // 0-100, higher = riskier
  riskFactors: string[];
  affectedFiles: string[];
  reviewMinutes: number;
}

export interface PredictionResult {
  staged: StagedFile[];
  impacts: FileImpact[];
  summary: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    estimatedReviewMinutes: number;
    reviewerCount: number;
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * Get staged files from git
 */
async function getStagedFiles(git: SimpleGit): Promise<StagedFile[]> {
  const staged: StagedFile[] = [];

  try {
    // Get staged files with status
    const diff = await git.diff(['--cached', '--numstat']);
    const status = await git.diff(['--cached', '--name-status']);

    const statusMap = new Map<string, string>();
    for (const line of status.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      const firstPart = parts[0];
      const lastPart = parts[parts.length - 1];
      if (parts.length >= 2 && firstPart && lastPart) {
        const statusCode = firstPart.charAt(0);
        const filePath = lastPart; // Handle renames
        statusMap.set(filePath, statusCode);
      }
    }

    for (const line of diff.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      const part0 = parts[0];
      const part1 = parts[1];
      const part2 = parts[2];
      if (parts.length >= 3 && part0 !== undefined && part1 !== undefined && part2) {
        const additions = part0 === '-' ? 0 : parseInt(part0, 10) || 0;
        const deletions = part1 === '-' ? 0 : parseInt(part1, 10) || 0;
        const filePath = part2;

        const statusCode = statusMap.get(filePath) || 'M';
        let fileStatus: StagedFile['status'] = 'modified';
        if (statusCode === 'A') fileStatus = 'added';
        else if (statusCode === 'D') fileStatus = 'deleted';
        else if (statusCode === 'R') fileStatus = 'renamed';

        staged.push({
          path: filePath,
          status: fileStatus,
          additions,
          deletions,
        });
      }
    }
  } catch {
    // No staged files or not a git repo
  }

  return staged;
}

/**
 * Calculate risk score for a file change
 */
function calculateRiskScore(
  file: StagedFile,
  node: GraphNode | undefined,
  graph: KnowledgeGraph
): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 30; // Start moderate

  // Change size factor
  const totalChanges = file.additions + file.deletions;
  if (totalChanges > 200) {
    score += 25;
    factors.push(`Large change (${totalChanges} lines)`);
  } else if (totalChanges > 50) {
    score += 10;
    factors.push(`Moderate change (${totalChanges} lines)`);
  } else if (totalChanges < 10) {
    score -= 10;
    factors.push('Small change');
  }

  // File type risk
  if (file.path.includes('config') || file.path.includes('.env')) {
    score += 20;
    factors.push('Configuration file');
  }
  if (file.path.includes('package.json') || file.path.includes('Cargo.toml')) {
    score += 15;
    factors.push('Dependency changes');
  }
  if (file.path.includes('migration') || file.path.includes('schema')) {
    score += 25;
    factors.push('Database changes');
  }
  if (file.path.includes('test') || file.path.includes('spec')) {
    score -= 15;
    factors.push('Test file (lower risk)');
  }

  // Status-based risk
  if (file.status === 'deleted') {
    score += 10;
    factors.push('File deletion');
  }
  if (file.status === 'added') {
    score -= 5;
    factors.push('New file');
  }

  // Graph-based risk (if we have node data)
  if (node) {
    // Complexity
    if (node.complexity !== undefined && node.complexity > 15) {
      score += 15;
      factors.push(`High complexity (${node.complexity})`);
    }

    // Dependents (how many files import this)
    const dependents = graph.edges.filter(
      (e) => e.type === 'imports' && graph.nodes[e.target]?.filePath === node.filePath
    );
    if (dependents.length > 5) {
      score += 20;
      factors.push(`${dependents.length} files depend on this`);
    } else if (dependents.length > 2) {
      score += 10;
      factors.push(`${dependents.length} dependents`);
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return { score, factors };
}

/**
 * Find files affected by a change
 */
function findAffectedFiles(filePath: string, graph: KnowledgeGraph): string[] {
  const affected: string[] = [];

  // Find files that import this file
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const targetNode = graph.nodes[edge.target];
      if (targetNode?.filePath === filePath) {
        const sourceNode = graph.nodes[edge.source];
        if (sourceNode?.filePath) {
          affected.push(sourceNode.filePath);
        }
      }
    }
  }

  return affected.slice(0, 5); // Limit to top 5
}

/**
 * Estimate review time in minutes
 */
function estimateReviewTime(file: StagedFile, riskScore: number): number {
  const baseTime = 2; // Base 2 minutes per file
  const linesPerMinute = 30; // Reasonable review pace

  const totalLines = file.additions + file.deletions;
  const lineTime = totalLines / linesPerMinute;

  // Risk multiplier: higher risk = more careful review
  const riskMultiplier = 1 + riskScore / 100;

  return Math.ceil((baseTime + lineTime) * riskMultiplier);
}

/**
 * Generate prediction for staged changes
 */
export async function generatePrediction(
  rootDir: string,
  graph: KnowledgeGraph
): Promise<PredictionResult> {
  const git: SimpleGit = simpleGit(rootDir);

  // Get staged files
  const staged = await getStagedFiles(git);

  if (staged.length === 0) {
    return {
      staged: [],
      impacts: [],
      summary: {
        totalFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        overallRisk: 'low',
        estimatedReviewMinutes: 0,
        reviewerCount: 1,
      },
      warnings: ['No staged changes found. Stage some files with `git add` first.'],
      recommendations: [],
    };
  }

  // Analyze each file
  const impacts: FileImpact[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalReviewMinutes = 0;

  for (const file of staged) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;

    // Find node in graph
    const node = Object.values(graph.nodes).find(
      (n) => n.type === 'file' && n.filePath === file.path
    );

    const { score, factors } = calculateRiskScore(file, node, graph);
    const affectedFiles = findAffectedFiles(file.path, graph);
    const reviewMinutes = estimateReviewTime(file, score);

    totalReviewMinutes += reviewMinutes;

    impacts.push({
      path: file.path,
      status: file.status,
      riskScore: score,
      riskFactors: factors,
      affectedFiles,
      reviewMinutes,
    });
  }

  // Sort by risk score descending
  impacts.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate overall risk
  const avgRisk = impacts.reduce((sum, i) => sum + i.riskScore, 0) / impacts.length;
  const maxRisk = Math.max(...impacts.map((i) => i.riskScore));

  let overallRisk: PredictionResult['summary']['overallRisk'] = 'low';
  if (maxRisk >= 80 || avgRisk >= 60) {
    overallRisk = 'critical';
  } else if (maxRisk >= 60 || avgRisk >= 45) {
    overallRisk = 'high';
  } else if (maxRisk >= 40 || avgRisk >= 30) {
    overallRisk = 'medium';
  }

  // Recommend reviewers based on complexity
  const reviewerCount = overallRisk === 'critical' ? 3 : overallRisk === 'high' ? 2 : 1;

  // Generate warnings
  const warnings: string[] = [];
  const highRiskFiles = impacts.filter((i) => i.riskScore >= 60);
  if (highRiskFiles.length > 0) {
    warnings.push(`${highRiskFiles.length} high-risk file(s) need careful review`);
  }

  const configChanges = impacts.filter(
    (i) => i.path.includes('config') || i.path.includes('package.json')
  );
  if (configChanges.length > 0) {
    warnings.push('Configuration changes detected - verify in staging environment');
  }

  const totalAffected = new Set(impacts.flatMap((i) => i.affectedFiles)).size;
  if (totalAffected > 10) {
    warnings.push(`Changes may affect ${totalAffected} other files`);
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (staged.length > 10) {
    recommendations.push('Consider splitting into smaller PRs for easier review');
  }

  if (totalAdditions + totalDeletions > 500) {
    recommendations.push('Large changeset - add detailed PR description');
  }

  const hasTests = staged.some((f) => f.path.includes('test') || f.path.includes('spec'));
  const hasCode = staged.some(
    (f) =>
      f.path.endsWith('.ts') ||
      f.path.endsWith('.js') ||
      f.path.endsWith('.py') ||
      f.path.endsWith('.go')
  );
  if (hasCode && !hasTests) {
    recommendations.push('Consider adding tests for code changes');
  }

  if (overallRisk === 'critical') {
    recommendations.push('Request review from senior team member');
  }

  return {
    staged,
    impacts,
    summary: {
      totalFiles: staged.length,
      totalAdditions,
      totalDeletions,
      overallRisk,
      estimatedReviewMinutes: totalReviewMinutes,
      reviewerCount,
    },
    warnings,
    recommendations,
  };
}

/**
 * Format prediction result for display
 */
export function formatPrediction(result: PredictionResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  🔮 PR IMPACT PREDICTION                          ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.staged.length === 0) {
    lines.push('No staged changes found.');
    lines.push('');
    lines.push('Stage files with `git add <file>` first.');
    return lines.join('\n');
  }

  // Summary
  const riskEmoji =
    result.summary.overallRisk === 'critical'
      ? '🔴'
      : result.summary.overallRisk === 'high'
        ? '🟠'
        : result.summary.overallRisk === 'medium'
          ? '🟡'
          : '🟢';

  lines.push('SUMMARY');
  lines.push('─'.repeat(50));
  lines.push(`  Files changed:     ${result.summary.totalFiles}`);
  lines.push(`  Lines added:       +${result.summary.totalAdditions}`);
  lines.push(`  Lines removed:     -${result.summary.totalDeletions}`);
  lines.push(`  Overall risk:      ${riskEmoji} ${result.summary.overallRisk.toUpperCase()}`);
  lines.push(`  Est. review time:  ~${result.summary.estimatedReviewMinutes} minutes`);
  lines.push(`  Reviewers needed:  ${result.summary.reviewerCount}`);
  lines.push('');

  // File impacts (top 10)
  lines.push('FILE IMPACTS');
  lines.push('─'.repeat(50));

  for (const impact of result.impacts.slice(0, 10)) {
    const riskBar =
      '█'.repeat(Math.floor(impact.riskScore / 10)) +
      '░'.repeat(10 - Math.floor(impact.riskScore / 10));
    const statusIcon =
      impact.status === 'added'
        ? '🆕'
        : impact.status === 'deleted'
          ? '🗑️ '
          : impact.status === 'renamed'
            ? '📝'
            : '✏️ ';

    lines.push(`${statusIcon} ${impact.path}`);
    lines.push(`   Risk: ${riskBar} ${impact.riskScore}%`);

    if (impact.riskFactors.length > 0) {
      lines.push(`   Factors: ${impact.riskFactors.slice(0, 2).join(', ')}`);
    }

    if (impact.affectedFiles.length > 0) {
      lines.push(`   Affects: ${impact.affectedFiles.length} file(s)`);
    }

    lines.push('');
  }

  if (result.impacts.length > 10) {
    lines.push(`  ... and ${result.impacts.length - 10} more files`);
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
