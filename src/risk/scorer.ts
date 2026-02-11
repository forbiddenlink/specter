/**
 * Risk Score Calculator
 *
 * Calculates risk scores for changes based on multiple factors.
 */

import type { KnowledgeGraph, GraphNode } from '../graph/types.js';
import type { DiffFile, RiskScore, RiskFactor } from './types.js';
import {
  getStagedChanges,
  getBranchChanges,
  getCommitChanges,
  analyzeDiffSize,
} from './diff-analyzer.js';

// Weight factors (sum to 1.0)
const WEIGHTS = {
  filesChanged: 0.15,
  linesChanged: 0.15,
  complexityTouched: 0.25,
  dependentImpact: 0.25,
  busFactorRisk: 0.10,
  testCoverage: 0.10,
};

/**
 * Calculate risk for number of files changed
 */
function calculateFilesRisk(files: DiffFile[]): RiskFactor {
  const count = files.length;
  let score = 0;
  let details = '';

  if (count === 0) {
    score = 0;
    details = 'No files changed';
  } else if (count <= 3) {
    score = 10;
    details = 'Small, focused change';
  } else if (count <= 10) {
    score = 40;
    details = 'Moderate scope';
  } else if (count <= 20) {
    score = 70;
    details = 'Large change, increased risk';
  } else {
    score = 100;
    details = `Very large change (${count} files), review carefully`;
  }

  return {
    name: 'Files Changed',
    score,
    weight: WEIGHTS.filesChanged,
    details: `${count} files: ${details}`,
    items: count > 5
      ? files.slice(0, 5).map(f => f.filePath)
      : files.map(f => f.filePath),
  };
}

/**
 * Calculate risk for lines changed
 */
function calculateLinesRisk(files: DiffFile[]): RiskFactor {
  const { totalAdditions, totalDeletions, largestFile } = analyzeDiffSize(files);
  const totalLines = totalAdditions + totalDeletions;

  let score = 0;
  let details = '';

  if (totalLines === 0) {
    score = 0;
    details = 'No lines changed';
  } else if (totalLines <= 50) {
    score = 10;
    details = 'Minor changes';
  } else if (totalLines <= 200) {
    score = 30;
    details = 'Moderate changes';
  } else if (totalLines <= 500) {
    score = 50;
    details = 'Significant changes';
  } else if (totalLines <= 1000) {
    score = 75;
    details = 'Large change set';
  } else {
    score = 100;
    details = 'Very large change set';
  }

  const items: string[] = [];
  items.push(`+${totalAdditions} / -${totalDeletions} lines`);
  if (largestFile) {
    items.push(`Largest: ${largestFile.filePath} (+${largestFile.additions}/-${largestFile.deletions})`);
  }

  return {
    name: 'Lines Changed',
    score,
    weight: WEIGHTS.linesChanged,
    details: `${totalLines} lines: ${details}`,
    items,
  };
}

/**
 * Find a file node by matching the file path
 */
function findFileNode(graph: KnowledgeGraph, filePath: string): GraphNode | null {
  // Try exact match first
  if (graph.nodes[filePath]) {
    return graph.nodes[filePath];
  }

  // Try to find by file path property
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file' && node.filePath === filePath) {
      return node;
    }
    // Also try matching the end of the path
    if (node.type === 'file' && node.filePath.endsWith(filePath)) {
      return node;
    }
  }

  return null;
}

/**
 * Calculate risk for complexity of touched files
 */
function calculateComplexityRisk(files: DiffFile[], graph: KnowledgeGraph): RiskFactor {
  const complexFiles: Array<{ path: string; complexity: number }> = [];
  let totalComplexity = 0;
  let maxComplexity = 0;

  for (const file of files) {
    // Find the file node in the graph
    const fileNode = findFileNode(graph, file.filePath);

    if (fileNode) {
      // Get complexity of functions in this file
      for (const node of Object.values(graph.nodes)) {
        if (node.filePath === fileNode.filePath && node.complexity) {
          totalComplexity += node.complexity;
          if (node.complexity > maxComplexity) {
            maxComplexity = node.complexity;
          }
          if (node.complexity > 10) {
            complexFiles.push({ path: file.filePath, complexity: node.complexity });
          }
        }
      }
    }
  }

  let score = 0;
  let details = '';

  if (files.length === 0 || totalComplexity === 0) {
    score = 0;
    details = 'No complexity data available';
  } else if (maxComplexity <= 5) {
    score = 10;
    details = 'Low complexity code';
  } else if (maxComplexity <= 10) {
    score = 30;
    details = 'Moderate complexity';
  } else if (maxComplexity <= 20) {
    score = 60;
    details = 'High complexity - review carefully';
  } else {
    score = 90;
    details = 'Very high complexity - critical review needed';
  }

  return {
    name: 'Complexity Touched',
    score,
    weight: WEIGHTS.complexityTouched,
    details: `Max complexity: ${maxComplexity}. ${details}`,
    items: complexFiles.slice(0, 5).map(f => `${f.path} (C:${f.complexity})`),
  };
}

/**
 * Calculate risk for dependent files (ripple effect)
 */
function calculateDependentRisk(files: DiffFile[], graph: KnowledgeGraph): RiskFactor {
  const changedFilePaths = new Set(files.map(f => f.filePath));
  const dependentFiles = new Set<string>();

  // For each changed file, find what imports it
  for (const file of files) {
    const fileNode = findFileNode(graph, file.filePath);
    if (!fileNode) continue;

    for (const edge of graph.edges) {
      if (edge.type === 'imports') {
        // Find edges where target is our changed file
        const targetNode = graph.nodes[edge.target];
        if (targetNode?.filePath === fileNode.filePath) {
          const sourceNode = graph.nodes[edge.source];
          if (sourceNode?.filePath && !changedFilePaths.has(sourceNode.filePath)) {
            dependentFiles.add(sourceNode.filePath);
          }
        }
      }
    }
  }

  const count = dependentFiles.size;
  let score = 0;
  let details = '';

  if (count === 0) {
    score = 0;
    details = 'No downstream dependencies';
  } else if (count <= 3) {
    score = 15;
    details = 'Few dependents';
  } else if (count <= 10) {
    score = 40;
    details = 'Moderate ripple effect';
  } else if (count <= 25) {
    score = 70;
    details = 'Wide ripple effect';
  } else {
    score = 100;
    details = 'Very wide ripple effect - test extensively';
  }

  return {
    name: 'Dependent Impact',
    score,
    weight: WEIGHTS.dependentImpact,
    details: `${count} files depend on changed code. ${details}`,
    items: Array.from(dependentFiles).slice(0, 5),
  };
}

/**
 * Calculate bus factor risk (single-owner files being modified)
 */
function calculateBusFactorRisk(files: DiffFile[], graph: KnowledgeGraph): RiskFactor {
  const singleOwnerFiles: string[] = [];
  const lowBusFactorFiles: string[] = [];

  for (const file of files) {
    const fileNode = findFileNode(graph, file.filePath);
    if (!fileNode) continue;

    const contributorCount = fileNode.contributors?.length || 0;

    if (contributorCount === 1) {
      singleOwnerFiles.push(file.filePath);
    } else if (contributorCount === 2) {
      lowBusFactorFiles.push(file.filePath);
    }
  }

  const singleOwnerCount = singleOwnerFiles.length;
  const lowBusFactorCount = lowBusFactorFiles.length;
  const totalRisky = singleOwnerCount + lowBusFactorCount;

  let score = 0;
  let details = '';

  if (files.length === 0 || totalRisky === 0) {
    score = 0;
    details = 'No knowledge concentration risk';
  } else {
    const riskyRatio = totalRisky / files.length;

    if (riskyRatio <= 0.2) {
      score = 15;
      details = 'Some files have limited contributors';
    } else if (riskyRatio <= 0.5) {
      score = 40;
      details = 'Moderate knowledge concentration';
    } else {
      score = 70;
      details = 'High knowledge concentration - consider pair review';
    }

    if (singleOwnerCount > 0) {
      score += 15; // Extra penalty for single-owner files
    }
  }

  return {
    name: 'Bus Factor Risk',
    score: Math.min(score, 100),
    weight: WEIGHTS.busFactorRisk,
    details: `${singleOwnerCount} single-owner, ${lowBusFactorCount} low-contributor files. ${details}`,
    items: [...singleOwnerFiles.slice(0, 3), ...lowBusFactorFiles.slice(0, 2)],
  };
}

/**
 * Calculate test coverage risk
 */
function calculateTestCoverageRisk(files: DiffFile[]): RiskFactor {
  const sourceFiles: string[] = [];
  const testFiles: string[] = [];
  const untested: string[] = [];

  for (const file of files) {
    const path = file.filePath.toLowerCase();

    // Identify test files
    if (
      path.includes('.test.') ||
      path.includes('.spec.') ||
      path.includes('__tests__') ||
      path.startsWith('test/') ||
      path.startsWith('tests/')
    ) {
      testFiles.push(file.filePath);
    } else if (
      path.endsWith('.ts') ||
      path.endsWith('.tsx') ||
      path.endsWith('.js') ||
      path.endsWith('.jsx')
    ) {
      sourceFiles.push(file.filePath);
    }
  }

  // Check which source files have corresponding test modifications
  for (const srcFile of sourceFiles) {
    const baseName = srcFile
      .replace(/\.(ts|tsx|js|jsx)$/, '')
      .replace(/^src\//, '');

    const hasTestChange = testFiles.some(testFile => {
      const testBase = testFile
        .toLowerCase()
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '')
        .replace(/^(test|tests|__tests__)\//, '');
      return testBase.includes(baseName.toLowerCase()) ||
             baseName.toLowerCase().includes(testBase);
    });

    if (!hasTestChange) {
      untested.push(srcFile);
    }
  }

  const untestedCount = untested.length;
  const sourceCount = sourceFiles.length;

  let score = 0;
  let details = '';

  if (sourceCount === 0) {
    score = 0;
    details = 'No source files modified';
  } else if (untestedCount === 0) {
    score = 0;
    details = 'All source changes have test changes';
  } else {
    const ratio = untestedCount / sourceCount;

    if (ratio <= 0.25) {
      score = 20;
      details = 'Mostly covered by test changes';
    } else if (ratio <= 0.5) {
      score = 40;
      details = 'Partial test coverage in changes';
    } else if (ratio <= 0.75) {
      score = 60;
      details = 'Limited test coverage in changes';
    } else {
      score = 80;
      details = 'No test changes for modified source files';
    }
  }

  return {
    name: 'Test Coverage',
    score,
    weight: WEIGHTS.testCoverage,
    details: `${testFiles.length} test files, ${untestedCount}/${sourceCount} source files without test changes. ${details}`,
    items: untested.slice(0, 5),
  };
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(
  factors: RiskScore['factors'],
  files: DiffFile[]
): string[] {
  const recs: string[] = [];

  if (factors.filesChanged.score >= 60) {
    recs.push('Consider splitting this into smaller, focused commits');
  }

  if (factors.linesChanged.score >= 60) {
    recs.push('Large change set - consider incremental commits for easier review');
  }

  if (factors.complexityTouched.score >= 50) {
    recs.push('You are touching complex code - extra review recommended');
  }

  if (factors.dependentImpact.score >= 50) {
    recs.push('Many files depend on your changes - test downstream functionality');
  }

  if (factors.busFactorRisk.score >= 40) {
    recs.push('Some files have limited contributors - consider pair review');
  }

  if (factors.testCoverage.score >= 50) {
    recs.push('Consider adding or updating tests for changed files');
  }

  // Add positive feedback if risk is low
  if (recs.length === 0) {
    recs.push('This looks like a safe, focused change. Nice work!');
  }

  return recs;
}

/**
 * Generate first-person summary from the codebase perspective
 */
function generateSummary(
  overall: number,
  level: RiskScore['level'],
  factors: RiskScore['factors']
): string {
  const parts: string[] = [];

  if (level === 'low') {
    parts.push(`This change looks safe to me. Low risk (${overall}/100).`);
  } else if (level === 'medium') {
    parts.push(`This change is moderate risk (${overall}/100). I'd appreciate a careful review.`);
  } else if (level === 'high') {
    parts.push(`Warning: This is a high-risk change (${overall}/100). Please review carefully before committing.`);
  } else {
    parts.push(`CRITICAL: This change has very high risk (${overall}/100). I strongly recommend splitting it up or getting multiple reviewers.`);
  }

  // Add insight about the highest risk factor
  const sortedFactors = Object.entries(factors)
    .sort(([, a], [, b]) => b.score - a.score);

  if (sortedFactors.length > 0) {
    const [factorName, factor] = sortedFactors[0];
    if (factor.score >= 50) {
      parts.push(`Main concern: ${factor.name.toLowerCase()} - ${factor.details.toLowerCase()}`);
    }
  }

  return parts.join(' ');
}

/**
 * Create empty risk score for when no changes exist
 */
function createEmptyRiskScore(): RiskScore {
  const emptyFactor = (name: string, weight: number): RiskFactor => ({
    name,
    score: 0,
    weight,
    details: 'No changes to analyze',
    items: [],
  });

  return {
    overall: 0,
    level: 'low',
    factors: {
      filesChanged: emptyFactor('Files Changed', WEIGHTS.filesChanged),
      linesChanged: emptyFactor('Lines Changed', WEIGHTS.linesChanged),
      complexityTouched: emptyFactor('Complexity Touched', WEIGHTS.complexityTouched),
      dependentImpact: emptyFactor('Dependent Impact', WEIGHTS.dependentImpact),
      busFactorRisk: emptyFactor('Bus Factor Risk', WEIGHTS.busFactorRisk),
      testCoverage: emptyFactor('Test Coverage', WEIGHTS.testCoverage),
    },
    recommendations: ['No changes to analyze - stage some changes or specify a branch/commit'],
    summary: 'Nothing to analyze - no staged changes or specified changes found.',
  };
}

/**
 * Main risk calculation function
 */
export async function calculateRiskScore(
  rootDir: string,
  graph: KnowledgeGraph,
  options: { staged?: boolean; branch?: string; commit?: string } = {}
): Promise<RiskScore> {
  // Get the changes to analyze
  let files: DiffFile[];

  if (options.commit) {
    files = await getCommitChanges(rootDir, options.commit);
  } else if (options.branch) {
    files = await getBranchChanges(rootDir, options.branch);
  } else {
    // Default to staged changes
    files = await getStagedChanges(rootDir);
  }

  if (files.length === 0) {
    return createEmptyRiskScore();
  }

  // Calculate each factor
  const factors: RiskScore['factors'] = {
    filesChanged: calculateFilesRisk(files),
    linesChanged: calculateLinesRisk(files),
    complexityTouched: calculateComplexityRisk(files, graph),
    dependentImpact: calculateDependentRisk(files, graph),
    busFactorRisk: calculateBusFactorRisk(files, graph),
    testCoverage: calculateTestCoverageRisk(files),
  };

  // Calculate weighted overall score
  const overall = Math.round(
    Object.values(factors).reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  // Determine level
  const level: RiskScore['level'] =
    overall <= 25 ? 'low' :
    overall <= 50 ? 'medium' :
    overall <= 75 ? 'high' :
    'critical';

  // Generate recommendations
  const recommendations = generateRecommendations(factors, files);

  // Generate first-person summary
  const summary = generateSummary(overall, level, factors);

  return { overall, level, factors, recommendations, summary };
}
