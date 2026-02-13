/**
 * Coupling Analysis - Hidden Dependency Discovery
 *
 * Finds files that always change together but aren't directly connected.
 * This reveals hidden coupling - a sign of poor architecture or missing abstractions.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface CoupledPair {
  file1: string;
  file2: string;
  coChangeCount: number; // Times changed together
  totalChanges: number; // Total changes to either file
  couplingStrength: number; // 0-100
  hasDirectDependency: boolean; // Are they imports?
  type: 'hidden' | 'expected' | 'suspicious';
  suggestion: string;
}

export interface CouplingResult {
  pairs: CoupledPair[];
  hiddenCouplings: number; // Count of hidden dependencies
  expectedCouplings: number;
  suspiciousCouplings: number;
  recommendations: string[];
}

interface FileChangeData {
  commitHashes: Set<string>;
  totalChanges: number;
}

/**
 * Build a map of which commits touched which files
 */
async function buildCoChangeMatrix(
  git: SimpleGit,
  maxCommits: number = 500
): Promise<Map<string, FileChangeData>> {
  const fileChanges = new Map<string, FileChangeData>();
  const commitFiles = new Map<string, string[]>(); // commit -> files

  try {
    // Get commit log
    const log = await git.log({ maxCount: maxCommits });

    for (const commit of log.all) {
      try {
        // Get files changed in this commit
        const diffResult = await git.raw([
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit.hash,
        ]);

        const files = diffResult
          .trim()
          .split('\n')
          .filter((f) => f?.match(/\.(ts|tsx|js|jsx)$/));

        if (files.length > 0 && files.length <= 20) {
          // Skip huge commits (likely bulk operations)
          commitFiles.set(commit.hash, files);

          for (const file of files) {
            const existing = fileChanges.get(file);
            if (existing) {
              existing.commitHashes.add(commit.hash);
              existing.totalChanges++;
            } else {
              fileChanges.set(file, {
                commitHashes: new Set([commit.hash]),
                totalChanges: 1,
              });
            }
          }
        }
      } catch {
        // Skip problematic commits
      }
    }
  } catch {
    // Git operation failed
  }

  return fileChanges;
}

/**
 * Build import relationships from the knowledge graph
 */
function buildImportSet(graph: KnowledgeGraph): Set<string> {
  const importEdges = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      // Extract file paths from node IDs
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode && targetNode) {
        const sourceFile = sourceNode.filePath;
        const targetFile = targetNode.filePath;

        if (sourceFile && targetFile) {
          // Store both directions for easy lookup
          importEdges.add(`${sourceFile}:${targetFile}`);
          importEdges.add(`${targetFile}:${sourceFile}`);
        }
      }
    }
  }

  return importEdges;
}

/**
 * Check if two files are in unrelated paths
 */
function arePathsUnrelated(file1: string, file2: string): boolean {
  const parts1 = file1.split('/');
  const parts2 = file2.split('/');

  // Same directory = related
  if (parts1.length > 1 && parts2.length > 1) {
    if (parts1[0] === parts2[0]) {
      // Same top-level directory
      if (parts1.length > 2 && parts2.length > 2) {
        // Check second level too
        return parts1[1] !== parts2[1];
      }
      return false;
    }
  }

  // Different top-level directories = potentially unrelated
  return true;
}

/**
 * Determine coupling type
 */
function determineCouplingType(
  strength: number,
  hasImport: boolean,
  pathsUnrelated: boolean
): 'hidden' | 'expected' | 'suspicious' {
  if (hasImport) {
    return 'expected';
  }

  if (strength >= 70 && pathsUnrelated) {
    return 'suspicious';
  }

  if (strength >= 50 && !hasImport) {
    return 'hidden';
  }

  return 'expected';
}

/**
 * Generate suggestion based on coupling type
 */
function generateSuggestion(
  type: 'hidden' | 'expected' | 'suspicious',
  strength: number,
  _file1: string,
  _file2: string
): string {
  switch (type) {
    case 'suspicious':
      return `Very high correlation (${strength}%) between unrelated areas - investigate if these should share an abstraction`;
    case 'hidden':
      return `Consider extracting shared logic or adding explicit dependency between these files`;
    case 'expected':
      return `Normal coupling through import relationship`;
  }
}

/**
 * Analyze coupling between all files in the codebase
 */
export async function analyzeCoupling(
  rootDir: string,
  graph: KnowledgeGraph,
  options: { minStrength?: number; hiddenOnly?: boolean } = {}
): Promise<CouplingResult> {
  const { minStrength = 30, hiddenOnly = false } = options;
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      pairs: [],
      hiddenCouplings: 0,
      expectedCouplings: 0,
      suspiciousCouplings: 0,
      recommendations: ['This is not a git repository.'],
    };
  }

  // Build co-change matrix
  const fileChanges = await buildCoChangeMatrix(git);

  // Build import set from graph
  const importSet = buildImportSet(graph);

  // Calculate coupling between all file pairs
  const pairs: CoupledPair[] = [];
  const files = [...fileChanges.keys()];
  const processedPairs = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const file1 = files[i];
    if (!file1) continue;
    const data1 = fileChanges.get(file1);
    if (!data1) continue;

    for (let j = i + 1; j < files.length; j++) {
      const file2 = files[j];
      if (!file2) continue;
      const data2 = fileChanges.get(file2);
      if (!data2) continue;

      // Skip already processed
      const pairKey = [file1, file2].sort().join(':');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Count shared commits
      let coChangeCount = 0;
      for (const hash of data1.commitHashes) {
        if (data2.commitHashes.has(hash)) {
          coChangeCount++;
        }
      }

      if (coChangeCount === 0) continue;

      // Calculate coupling strength (Jaccard-like coefficient)
      const totalChanges = data1.totalChanges + data2.totalChanges - coChangeCount;
      const couplingStrength = Math.round(
        (coChangeCount / Math.min(data1.totalChanges, data2.totalChanges)) * 100
      );

      if (couplingStrength < minStrength) continue;

      // Check for import relationship
      const hasDirectDependency =
        importSet.has(`${file1}:${file2}`) || importSet.has(`${file2}:${file1}`);

      // Check if paths are unrelated
      const pathsUnrelated = arePathsUnrelated(file1 as string, file2 as string);

      // Determine coupling type
      const type = determineCouplingType(couplingStrength, hasDirectDependency, pathsUnrelated);

      // Filter if hiddenOnly
      if (hiddenOnly && type === 'expected') continue;

      const suggestion = generateSuggestion(
        type,
        couplingStrength,
        file1 as string,
        file2 as string
      );

      pairs.push({
        file1: file1 as string,
        file2: file2 as string,
        coChangeCount,
        totalChanges,
        couplingStrength,
        hasDirectDependency,
        type,
        suggestion,
      });
    }
  }

  // Sort by coupling strength (descending), then by type priority
  const typePriority = { suspicious: 0, hidden: 1, expected: 2 };
  pairs.sort((a, b) => {
    const typeDiff = typePriority[a.type] - typePriority[b.type];
    if (typeDiff !== 0) return typeDiff;
    return b.couplingStrength - a.couplingStrength;
  });

  // Count by type
  const hiddenCouplings = pairs.filter((p) => p.type === 'hidden').length;
  const expectedCouplings = pairs.filter((p) => p.type === 'expected').length;
  const suspiciousCouplings = pairs.filter((p) => p.type === 'suspicious').length;

  // Generate recommendations
  const recommendations = generateRecommendations(pairs, hiddenCouplings, suspiciousCouplings);

  return {
    pairs,
    hiddenCouplings,
    expectedCouplings,
    suspiciousCouplings,
    recommendations,
  };
}

/**
 * Generate recommendations based on coupling analysis
 */
function generateRecommendations(
  pairs: CoupledPair[],
  hiddenCount: number,
  suspiciousCount: number
): string[] {
  const recommendations: string[] = [];

  if (suspiciousCount > 0) {
    recommendations.push(
      `Found ${suspiciousCount} suspicious coupling(s) between unrelated areas - these may indicate architectural issues`
    );
  }

  if (hiddenCount > 5) {
    recommendations.push(
      `${hiddenCount} hidden dependencies found - consider a refactoring sprint to extract shared abstractions`
    );
  } else if (hiddenCount > 0) {
    recommendations.push(
      `${hiddenCount} hidden dependency pair(s) found - review if explicit imports or shared modules are needed`
    );
  }

  // Find files that appear in multiple hidden couplings
  const fileAppearances = new Map<string, number>();
  for (const pair of pairs.filter((p) => p.type === 'hidden' || p.type === 'suspicious')) {
    fileAppearances.set(pair.file1, (fileAppearances.get(pair.file1) || 0) + 1);
    fileAppearances.set(pair.file2, (fileAppearances.get(pair.file2) || 0) + 1);
  }

  const hotFiles = [...fileAppearances.entries()]
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (hotFiles.length > 0) {
    const topFile = hotFiles[0];
    if (topFile) {
      recommendations.push(
        `"${topFile[0]}" appears in ${topFile[1]} hidden couplings - consider refactoring this file into a shared module`
      );
    }
  }

  if (hiddenCount === 0 && suspiciousCount === 0) {
    recommendations.push('No hidden couplings detected - your codebase has explicit dependencies!');
  }

  return recommendations;
}

/**
 * Format coupling results for CLI output
 */
export function formatCoupling(result: CouplingResult): string {
  const lines: string[] = [];

  // Header
  lines.push(`\u250F${'\u2501'.repeat(53)}\u2513`);
  lines.push('\u2503  \uD83D\uDD17 COUPLING ANALYSIS                               \u2503');
  lines.push(`\u2517${'\u2501'.repeat(53)}\u251B`);
  lines.push('');

  // Summary
  const total = result.hiddenCouplings + result.expectedCouplings + result.suspiciousCouplings;
  lines.push(`Found ${total} coupling pair(s) above threshold:`);
  lines.push(`  \uD83D\uDD34 Suspicious (unrelated paths): ${result.suspiciousCouplings}`);
  lines.push(`  \uD83D\uDFE1 Hidden (no import):           ${result.hiddenCouplings}`);
  lines.push(`  \uD83D\uDFE2 Expected (has import):        ${result.expectedCouplings}`);
  lines.push('');

  // Hidden and suspicious couplings
  const problemPairs = result.pairs.filter((p) => p.type === 'hidden' || p.type === 'suspicious');

  if (problemPairs.length > 0) {
    lines.push('\uD83D\uDD34 HIDDEN COUPLINGS');
    lines.push('\u2500'.repeat(53));
    lines.push('');

    for (const pair of problemPairs.slice(0, 15)) {
      const emoji = pair.type === 'suspicious' ? '\uD83D\uDD34' : '\uD83D\uDFE1';
      const label = pair.type === 'suspicious' ? 'SUSPICIOUS' : 'HIDDEN';

      lines.push(`${emoji} ${label}`);
      lines.push(`   ${pair.file1}`);
      lines.push(`   \u2194 ${pair.file2}`);
      lines.push(
        `   Changed together: ${pair.coChangeCount} times (${pair.couplingStrength}% correlation)`
      );

      if (!pair.hasDirectDependency) {
        lines.push('   \u26A0\uFE0F  No direct import found!');
      }

      lines.push(`   \u2192 ${pair.suggestion}`);
      lines.push('');
    }

    if (problemPairs.length > 15) {
      lines.push(`... and ${problemPairs.length - 15} more hidden couplings`);
      lines.push('');
    }
  }

  // Expected couplings (briefly)
  const expectedPairs = result.pairs.filter((p) => p.type === 'expected');
  if (expectedPairs.length > 0) {
    lines.push('\uD83D\uDFE2 EXPECTED COUPLINGS (have import relationship)');
    lines.push('\u2500'.repeat(53));
    lines.push('');

    for (const pair of expectedPairs.slice(0, 5)) {
      lines.push(`   ${pair.file1} \u2194 ${pair.file2}`);
      lines.push(
        `      ${pair.couplingStrength}% correlation (${pair.coChangeCount} shared commits)`
      );
    }

    if (expectedPairs.length > 5) {
      lines.push(`   ... and ${expectedPairs.length - 5} more`);
    }
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('\u2500'.repeat(53));
    lines.push('');

    for (const rec of result.recommendations) {
      lines.push(`  \u2022 ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
