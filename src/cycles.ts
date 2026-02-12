/**
 * Cycles - Circular Dependency Detection
 *
 * Detects circular dependencies in the codebase using the import graph.
 * Visualizes dependency cycles in a readable format and ranks by severity.
 */

import type { KnowledgeGraph } from './graph/types.js';

// Types
export type CycleSeverity = 'low' | 'medium' | 'high';

export interface Cycle {
  files: string[]; // Files in the cycle, in order
  length: number;
  severity: CycleSeverity; // 2-3 nodes = low, 4-5 = medium, 6+ = high
}

export interface CyclesResult {
  cycles: Cycle[];
  totalCycles: number;
  affectedFiles: number;
  worstCycle: Cycle | null;
  suggestions: string[];
}

/**
 * Build an adjacency list from import edges in the graph
 */
function buildAdjacencyList(graph: KnowledgeGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  // Initialize all file nodes
  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') {
      adjacency.set(node.filePath, new Set());
    }
  }

  // Add import edges
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode?.filePath && targetNode?.filePath) {
        // Source imports target, so source depends on target
        const deps = adjacency.get(sourceNode.filePath);
        if (deps) {
          deps.add(targetNode.filePath);
        }
      }
    }
  }

  return adjacency;
}

/**
 * Find all cycles in the graph using DFS
 */
function findCycles(adjacency: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    pathStack.push(node);

    const neighbors = adjacency.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle! Extract it from the path
        const cycleStart = pathStack.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = pathStack.slice(cycleStart);
          cycles.push(cycle);
        }
      }
    }

    pathStack.pop();
    recursionStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Normalize a cycle by rotating to start with the lexicographically smallest element
 * This helps with de-duplication (A->B->A is the same as B->A->B)
 */
function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) return cycle;

  // Find the index of the lexicographically smallest element
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIdx]) {
      minIdx = i;
    }
  }

  // Rotate the cycle to start with the smallest element
  return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
}

/**
 * Convert cycle to a string key for de-duplication
 */
function cycleKey(cycle: string[]): string {
  return normalizeCycle(cycle).join('::');
}

/**
 * Determine severity based on cycle length
 */
function getSeverity(length: number): CycleSeverity {
  if (length <= 3) return 'low';
  if (length <= 5) return 'medium';
  return 'high';
}

/**
 * Generate suggestions for breaking cycles
 */
function generateSuggestions(cycles: Cycle[]): string[] {
  const suggestions: string[] = [];

  if (cycles.length === 0) {
    return ['No circular dependencies detected - great job!'];
  }

  // Count files in cycles
  const fileCounts = new Map<string, number>();
  for (const cycle of cycles) {
    for (const file of cycle.files) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  // Find the most common files in cycles
  const sortedFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  if (sortedFiles.length > 0) {
    const [topFile, count] = sortedFiles[0];
    const shortName = topFile.split('/').pop() ?? topFile;
    suggestions.push(`Consider refactoring "${shortName}" - it appears in ${count} cycle(s)`);
  }

  // General suggestions based on cycle count and severity
  const highSeverity = cycles.filter((c) => c.severity === 'high').length;
  const mediumSeverity = cycles.filter((c) => c.severity === 'medium').length;

  if (highSeverity > 0) {
    suggestions.push(
      'Focus on breaking long cycles first - they indicate deeper architectural issues'
    );
  }

  if (cycles.length > 5) {
    suggestions.push('Consider introducing interface modules to break dependency chains');
  }

  if (cycles.some((c) => c.length === 2)) {
    suggestions.push(
      '2-file cycles can often be resolved by extracting shared logic to a third module'
    );
  }

  if (mediumSeverity > 3) {
    suggestions.push('Many medium cycles suggest the need for clearer module boundaries');
  }

  suggestions.push(
    'Use dependency injection or event-based patterns to decouple tightly coupled modules'
  );

  return suggestions;
}

/**
 * Detect circular dependencies in the codebase
 */
export function detectCycles(graph: KnowledgeGraph): CyclesResult {
  // Build adjacency list
  const adjacency = buildAdjacencyList(graph);

  // Find all cycles
  const rawCycles = findCycles(adjacency);

  // De-duplicate cycles
  const seenCycles = new Set<string>();
  const uniqueCycles: string[][] = [];

  for (const cycle of rawCycles) {
    const key = cycleKey(cycle);
    if (!seenCycles.has(key)) {
      seenCycles.add(key);
      uniqueCycles.push(normalizeCycle(cycle));
    }
  }

  // Convert to Cycle objects
  const cycles: Cycle[] = uniqueCycles.map((files) => ({
    files,
    length: files.length,
    severity: getSeverity(files.length),
  }));

  // Sort by severity (high first) then by length (longest first)
  const severityOrder: Record<CycleSeverity, number> = { high: 0, medium: 1, low: 2 };
  cycles.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.length - a.length;
  });

  // Count affected files
  const affectedFilesSet = new Set<string>();
  for (const cycle of cycles) {
    for (const file of cycle.files) {
      affectedFilesSet.add(file);
    }
  }

  // Find worst cycle (longest high-severity, or longest overall)
  const worstCycle = cycles.length > 0 ? cycles[0] : null;

  // Generate suggestions
  const suggestions = generateSuggestions(cycles);

  return {
    cycles,
    totalCycles: cycles.length,
    affectedFiles: affectedFilesSet.size,
    worstCycle,
    suggestions,
  };
}

/**
 * Format a file path for display (truncate if needed)
 */
function formatFilePath(filePath: string, maxLen: number = 40): string {
  const parts = filePath.split('/');
  const fileName = parts.pop() ?? filePath;

  if (filePath.length <= maxLen) {
    return filePath;
  }

  // Try to keep the filename and some path context
  if (fileName.length >= maxLen - 3) {
    return `...${fileName.slice(-(maxLen - 3))}`;
  }

  const remaining = maxLen - fileName.length - 4; // 4 for ".../"
  const pathPart = parts.join('/').slice(-remaining);
  return `.../${pathPart}/${fileName}`;
}

/**
 * Format cycles result for display
 */
export function formatCycles(result: CyclesResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  CIRCULAR DEPENDENCY ANALYSIS                     ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  if (result.totalCycles === 0) {
    lines.push('No circular dependencies detected!');
    lines.push('');
    lines.push('Your dependency graph is clean and acyclic.');
    lines.push('This is excellent for maintainability and testability.');
    return lines.join('\n');
  }

  // Summary
  lines.push('SUMMARY');
  lines.push('─'.repeat(50));

  const highCount = result.cycles.filter((c) => c.severity === 'high').length;
  const mediumCount = result.cycles.filter((c) => c.severity === 'medium').length;
  const lowCount = result.cycles.filter((c) => c.severity === 'low').length;

  lines.push(`  Total cycles:    ${result.totalCycles}`);
  lines.push(`  Affected files:  ${result.affectedFiles}`);
  lines.push('');

  if (highCount > 0) {
    lines.push(`  🔴 High severity (6+ files):   ${highCount}`);
  }
  if (mediumCount > 0) {
    lines.push(`  🟡 Medium severity (4-5 files): ${mediumCount}`);
  }
  if (lowCount > 0) {
    lines.push(`  🟢 Low severity (2-3 files):   ${lowCount}`);
  }
  lines.push('');

  // Worst cycle highlight
  if (result.worstCycle) {
    lines.push('WORST CYCLE');
    lines.push('─'.repeat(50));

    const severityIcon =
      result.worstCycle.severity === 'high'
        ? '🔴'
        : result.worstCycle.severity === 'medium'
          ? '🟡'
          : '🟢';

    lines.push(`  ${severityIcon} ${result.worstCycle.length} files in cycle:`);

    // Display the cycle as a chain
    const cycleDisplay = result.worstCycle.files.map((f) => formatFilePath(f, 35)).join(' -> ');

    // Wrap long lines
    const maxLineLen = 48;
    let currentLine = '  ';
    const words = cycleDisplay.split(' -> ');

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const connector = i < words.length - 1 ? ' -> ' : '';

      if (
        currentLine.length + word.length + connector.length > maxLineLen &&
        currentLine !== '  '
      ) {
        lines.push(currentLine);
        currentLine = `    ${word}${connector}`;
      } else {
        currentLine += word + connector;
      }
    }

    if (currentLine.trim()) {
      // Add arrow back to first file to show the cycle
      lines.push(`${currentLine} -> [first]`);
    }
    lines.push('');
  }

  // All cycles grouped by severity
  const severities: CycleSeverity[] = ['high', 'medium', 'low'];
  const severityLabels: Record<CycleSeverity, string> = {
    high: 'HIGH SEVERITY CYCLES (6+ files)',
    medium: 'MEDIUM SEVERITY CYCLES (4-5 files)',
    low: 'LOW SEVERITY CYCLES (2-3 files)',
  };
  const severityEmojis: Record<CycleSeverity, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  for (const severity of severities) {
    const severityCycles = result.cycles.filter((c) => c.severity === severity);
    if (severityCycles.length === 0) continue;

    lines.push(`${severityEmojis[severity]}  ${severityLabels[severity]}`);
    lines.push('─'.repeat(50));

    // Show up to 5 cycles per severity
    for (const cycle of severityCycles.slice(0, 5)) {
      const cycleChain = cycle.files
        .map((f) => {
          const parts = f.split('/');
          return parts.pop() ?? f;
        })
        .join(' -> ');

      lines.push(`  ${cycleChain} -> [loop]`);
    }

    if (severityCycles.length > 5) {
      lines.push(`  ... and ${severityCycles.length - 5} more ${severity} severity cycles`);
    }
    lines.push('');
  }

  // Suggestions
  lines.push('💡 SUGGESTIONS');
  lines.push('─'.repeat(50));

  for (const suggestion of result.suggestions) {
    lines.push(`  • ${suggestion}`);
  }
  lines.push('');

  lines.push('━'.repeat(51));

  return lines.join('\n');
}
