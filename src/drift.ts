/**
 * Drift - Architecture Drift Detection
 *
 * Detects architectural violations by comparing the current graph structure
 * against best practices and identifying patterns that have drifted.
 */

import type { KnowledgeGraph } from './graph/types.js';

// Types
export type DriftType = 'complexity' | 'dependency' | 'layering' | 'coupling';
export type DriftSeverity = 'low' | 'medium' | 'high';

export interface DriftViolation {
  type: DriftType;
  severity: DriftSeverity;
  file: string;
  message: string;
  suggestion: string;
}

export interface DriftResult {
  violations: DriftViolation[];
  score: number; // 0-100, 100 = no drift
  summary: {
    total: number;
    byType: Record<DriftType, number>;
    bySeverity: Record<DriftSeverity, number>;
    cleanFiles: number;
    totalFiles: number;
  };
}

// Layer definitions for common project structures
const LAYER_RULES: Array<{
  layer: string;
  patterns: RegExp[];
  cannotImportFrom: string[];
  description: string;
}> = [
  {
    layer: 'ui',
    patterns: [/components?\//, /pages?\//, /views?\//, /ui\//],
    cannotImportFrom: ['db', 'database', 'models', 'repositories'],
    description: 'UI layer should not directly access database/models',
  },
  {
    layer: 'utils',
    patterns: [/utils?\//, /helpers?\//, /lib\/utils/],
    cannotImportFrom: ['components', 'pages', 'views', 'ui', 'services'],
    description: 'Utils should be leaf nodes, not import from higher layers',
  },
  {
    layer: 'api',
    patterns: [/api\//, /routes?\//, /controllers?\//],
    cannotImportFrom: ['components', 'pages', 'views', 'ui'],
    description: 'API layer should not import from UI layer',
  },
];

/**
 * Detect complexity drift - files that are too complex
 */
function detectComplexityDrift(graph: KnowledgeGraph): DriftViolation[] {
  const violations: DriftViolation[] = [];
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');

  // Calculate average complexity
  const complexities = fileNodes.map((n) => n.complexity ?? 0).filter((c) => c > 0);
  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 5;

  for (const node of fileNodes) {
    const complexity = node.complexity ?? 0;

    // High threshold: complexity > 20 or > 2x average
    if (complexity > 20) {
      violations.push({
        type: 'complexity',
        severity: complexity > 30 ? 'high' : 'medium',
        file: node.filePath,
        message: `Complexity ${complexity} exceeds threshold of 20`,
        suggestion: 'Consider breaking this file into smaller, focused modules',
      });
    } else if (complexity > avgComplexity * 2 && complexity > 10) {
      violations.push({
        type: 'complexity',
        severity: 'low',
        file: node.filePath,
        message: `Complexity ${complexity} is 2x above average (${Math.round(avgComplexity)})`,
        suggestion: 'This file is growing more complex than its peers',
      });
    }
  }

  return violations;
}

/**
 * Detect dependency drift - files with too many dependencies
 */
function detectDependencyDrift(graph: KnowledgeGraph): DriftViolation[] {
  const violations: DriftViolation[] = [];

  // Count imports per file
  const importCounts = new Map<string, number>();
  const dependentCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode?.filePath) {
        importCounts.set(sourceNode.filePath, (importCounts.get(sourceNode.filePath) ?? 0) + 1);
      }
      if (targetNode?.filePath) {
        dependentCounts.set(
          targetNode.filePath,
          (dependentCounts.get(targetNode.filePath) ?? 0) + 1
        );
      }
    }
  }

  // Check for files with too many imports
  for (const [filePath, count] of importCounts.entries()) {
    if (count > 15) {
      violations.push({
        type: 'dependency',
        severity: count > 25 ? 'high' : 'medium',
        file: filePath,
        message: `File imports ${count} modules (threshold: 15)`,
        suggestion: 'Consider grouping related imports or creating a facade module',
      });
    } else if (count > 10) {
      violations.push({
        type: 'dependency',
        severity: 'low',
        file: filePath,
        message: `File imports ${count} modules`,
        suggestion: 'Monitor this file as it may be doing too much',
      });
    }
  }

  // Check for files that are imported by too many others (high coupling)
  for (const [filePath, count] of dependentCounts.entries()) {
    if (count > 20) {
      violations.push({
        type: 'coupling',
        severity: count > 30 ? 'high' : 'medium',
        file: filePath,
        message: `File is imported by ${count} other files`,
        suggestion: 'High coupling detected - consider if this module is doing too much',
      });
    }
  }

  return violations;
}

/**
 * Detect layering drift - violations of architectural layers
 */
function detectLayeringDrift(graph: KnowledgeGraph): DriftViolation[] {
  const violations: DriftViolation[] = [];

  // Build a map of file paths to their layers
  function getLayer(filePath: string): (typeof LAYER_RULES)[0] | undefined {
    for (const rule of LAYER_RULES) {
      if (rule.patterns.some((p) => p.test(filePath))) {
        return rule;
      }
    }
    return undefined;
  }

  // Check each import edge
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (!sourceNode?.filePath || !targetNode?.filePath) continue;

      const sourceLayer = getLayer(sourceNode.filePath);
      if (!sourceLayer) continue;

      // Check if the target file is in a forbidden layer
      for (const forbidden of sourceLayer.cannotImportFrom) {
        if (targetNode.filePath.toLowerCase().includes(forbidden)) {
          violations.push({
            type: 'layering',
            severity: 'high',
            file: sourceNode.filePath,
            message: `${sourceLayer.layer} layer imports from ${forbidden}`,
            suggestion: sourceLayer.description,
          });
          break;
        }
      }
    }
  }

  // Detect circular dependencies between layers
  const layerImports = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (!sourceNode?.filePath || !targetNode?.filePath) continue;

      const sourceLayer = getLayer(sourceNode.filePath);
      const targetLayer = getLayer(targetNode.filePath);

      if (sourceLayer && targetLayer && sourceLayer.layer !== targetLayer.layer) {
        if (!layerImports.has(sourceLayer.layer)) {
          layerImports.set(sourceLayer.layer, new Set());
        }
        layerImports.get(sourceLayer.layer)!.add(targetLayer.layer);
      }
    }
  }

  // Check for bidirectional layer dependencies
  for (const [layer1, imports1] of layerImports.entries()) {
    for (const layer2 of imports1) {
      const imports2 = layerImports.get(layer2);
      if (imports2?.has(layer1)) {
        // Only report once per pair
        if (layer1 < layer2) {
          violations.push({
            type: 'layering',
            severity: 'medium',
            file: `${layer1} <-> ${layer2}`,
            message: `Circular dependency between ${layer1} and ${layer2} layers`,
            suggestion: 'Consider introducing an abstraction to break the cycle',
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Main function to detect all types of drift
 */
export async function detectDrift(_rootDir: string, graph: KnowledgeGraph): Promise<DriftResult> {
  const violations: DriftViolation[] = [];

  // Run all drift detectors
  violations.push(...detectComplexityDrift(graph));
  violations.push(...detectDependencyDrift(graph));
  violations.push(...detectLayeringDrift(graph));

  // Sort by severity (high first) then by type
  const severityOrder: Record<DriftSeverity, number> = { high: 0, medium: 1, low: 2 };
  violations.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.type.localeCompare(b.type);
  });

  // Calculate summary
  const byType: Record<DriftType, number> = {
    complexity: 0,
    dependency: 0,
    layering: 0,
    coupling: 0,
  };
  const bySeverity: Record<DriftSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const v of violations) {
    byType[v.type]++;
    bySeverity[v.severity]++;
  }

  // Count files
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
  const affectedFiles = new Set(violations.map((v) => v.file));
  const cleanFiles = fileNodes.length - affectedFiles.size;

  // Calculate drift score (100 = perfect, 0 = drifted)
  // Weight: high = 10, medium = 5, low = 2
  const totalPenalty = bySeverity.high * 10 + bySeverity.medium * 5 + bySeverity.low * 2;

  // Max penalty is based on file count
  const maxPenalty = Math.max(fileNodes.length * 5, 100);
  const score = Math.max(0, Math.round(100 - (totalPenalty / maxPenalty) * 100));

  return {
    violations,
    score,
    summary: {
      total: violations.length,
      byType,
      bySeverity,
      cleanFiles,
      totalFiles: fileNodes.length,
    },
  };
}

/**
 * Format drift result for display
 */
export function formatDrift(result: DriftResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  ARCHITECTURE DRIFT ANALYSIS                      ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.violations.length === 0) {
    lines.push('No architectural drift detected!');
    lines.push('');
    lines.push('Your codebase is following best practices.');
    lines.push(`Drift Score: 100/100`);
    return lines.join('\n');
  }

  // Score display
  const scoreEmoji =
    result.score >= 80 ? '🟢' : result.score >= 60 ? '🟡' : result.score >= 40 ? '🟠' : '🔴';

  lines.push('DRIFT SCORE');
  lines.push('─'.repeat(50));
  lines.push(`  ${scoreEmoji} ${result.score}/100`);
  lines.push('');
  lines.push(`  Clean files: ${result.summary.cleanFiles}/${result.summary.totalFiles}`);
  lines.push(`  Violations:  ${result.summary.total}`);
  lines.push('');

  // Summary by severity
  if (result.summary.bySeverity.high > 0) {
    lines.push(`  🔴 High severity:   ${result.summary.bySeverity.high}`);
  }
  if (result.summary.bySeverity.medium > 0) {
    lines.push(`  🟡 Medium severity: ${result.summary.bySeverity.medium}`);
  }
  if (result.summary.bySeverity.low > 0) {
    lines.push(`  🟢 Low severity:    ${result.summary.bySeverity.low}`);
  }
  lines.push('');

  // Group violations by type
  const types: DriftType[] = ['layering', 'complexity', 'dependency', 'coupling'];
  const typeLabels: Record<DriftType, string> = {
    layering: 'LAYERING VIOLATIONS',
    complexity: 'COMPLEXITY ISSUES',
    dependency: 'DEPENDENCY ISSUES',
    coupling: 'COUPLING ISSUES',
  };
  const typeEmojis: Record<DriftType, string> = {
    layering: '🏗️',
    complexity: '🧩',
    dependency: '🔗',
    coupling: '🕸️',
  };

  for (const type of types) {
    const typeViolations = result.violations.filter((v) => v.type === type);
    if (typeViolations.length === 0) continue;

    lines.push(`${typeEmojis[type]}  ${typeLabels[type]}`);
    lines.push('─'.repeat(50));

    for (const v of typeViolations.slice(0, 5)) {
      const severityIcon = v.severity === 'high' ? '🔴' : v.severity === 'medium' ? '🟡' : '🟢';

      lines.push(`${severityIcon} ${v.file}`);
      lines.push(`   ${v.message}`);
      lines.push(`   → ${v.suggestion}`);
      lines.push('');
    }

    if (typeViolations.length > 5) {
      lines.push(`   ... and ${typeViolations.length - 5} more ${type} issues`);
      lines.push('');
    }
  }

  // Recommendations
  lines.push('💡 RECOMMENDATIONS');
  lines.push('─'.repeat(50));

  if (result.summary.bySeverity.high > 0) {
    lines.push('  • Address high-severity issues first');
  }
  if (result.summary.byType.layering > 0) {
    lines.push('  • Review your layer boundaries and import rules');
  }
  if (result.summary.byType.complexity > 0) {
    lines.push('  • Consider refactoring complex files into smaller modules');
  }
  if (result.summary.byType.coupling > 0) {
    lines.push('  • Reduce coupling by introducing abstractions or facades');
  }
  if (result.score < 50) {
    lines.push('  • Consider a focused refactoring sprint');
  }

  lines.push('');
  lines.push('━'.repeat(51));

  return lines.join('\n');
}
