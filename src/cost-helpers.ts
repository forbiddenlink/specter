/**
 * Helper functions for cost analysis - extracted from analyzeCost
 * Each function handles analysis for a specific cost category
 */

import { analyzeBusFactor } from './analyzers/bus-factor.js';
import { analyzeHotspots } from './analyzers/hotspots.js';
import type { CostlyFile, DebtCategory } from './cost.js';
import { detectCycles } from './graph/cycles.js';
import type { KnowledgeGraph } from './graph/types.js';

/**
 * Analyze complexity hotspots and calculate their cost
 */
export async function analyzeComplexityCosts(
  rootDir: string,
  graph: KnowledgeGraph,
  hourlyRate: number
): Promise<{
  category: DebtCategory | null;
  fileCosts: Map<string, CostlyFile>;
}> {
  const fileCosts = new Map<string, CostlyFile>();

  try {
    const hotspots = await analyzeHotspots(rootDir, graph, {});

    if (!hotspots || hotspots.hotspots.length === 0) {
      return { category: null, fileCosts };
    }

    let totalComplexityCost = 0;

    for (const spot of hotspots.hotspots) {
      // Calculate cost based on complexity score, churn, and priority
      const baseCost = spot.hotspotScore * spot.churnRate * 100;
      const priorityMultiplier =
        spot.priority === 'critical' ? 1.5 : spot.priority === 'high' ? 1.2 : 1;
      const cost = baseCost * priorityMultiplier;

      totalComplexityCost += cost;

      const existing = fileCosts.get(spot.file) || {
        file: spot.file,
        totalCost: 0,
        breakdown: { complexity: 0, deadCode: 0, busFactor: 0, cycles: 0 },
        priority: spot.priority as 'critical' | 'high' | 'medium' | 'low',
        estimatedFixTime: Math.ceil(spot.hotspotScore / 10),
      };
      existing.breakdown.complexity = (existing.breakdown.complexity || 0) + cost;
      existing.totalCost += cost;
      fileCosts.set(spot.file, existing);
    }

    return {
      category: {
        name: 'Complexity Hotspots',
        cost: totalComplexityCost,
        hours: Math.round(totalComplexityCost / hourlyRate),
        fileCount: hotspots.hotspots.length,
        description: 'Annual cost of maintaining high-complexity code',
        emoji: '🔥',
      },
      fileCosts,
    };
  } catch {
    return { category: null, fileCosts };
  }
}

/**
 * Analyze bus factor (single-owner) risks and calculate their cost
 */
export async function analyzeBusFactorCosts(
  graph: KnowledgeGraph,
  hourlyRate: number
): Promise<{
  category: DebtCategory | null;
  fileCosts: Map<string, CostlyFile>;
}> {
  const fileCosts = new Map<string, CostlyFile>();

  try {
    const busFactor = await analyzeBusFactor(graph, {});

    if (!busFactor?.risks || busFactor.risks.length === 0) {
      return { category: null, fileCosts };
    }

    let totalBusFactorCost = 0;

    for (const risk of busFactor.risks) {
      if (risk.busFactor === 1) {
        // Calculate cost: single owner high risk
        const baseCost = (risk.linesOfCode || 500) * 0.5;
        const criticalityMultiplier = risk.criticality === 'critical' ? 2 : 1;
        const cost = baseCost * criticalityMultiplier;

        totalBusFactorCost += cost;

        const filePath = risk.area || 'unknown';
        const existing = fileCosts.get(filePath) || {
          file: filePath,
          totalCost: 0,
          breakdown: { complexity: 0, deadCode: 0, busFactor: 0, cycles: 0 },
          priority: (risk.criticality as 'critical' | 'high' | 'medium' | 'low') || 'medium',
          estimatedFixTime: 8,
        };
        existing.breakdown.busFactor = (existing.breakdown.busFactor || 0) + cost;
        existing.totalCost += cost;
        fileCosts.set(filePath, existing);
      }
    }

    if (totalBusFactorCost === 0) {
      return { category: null, fileCosts };
    }

    return {
      category: {
        name: 'Bus Factor Risk',
        cost: totalBusFactorCost,
        hours: Math.round(totalBusFactorCost / hourlyRate),
        fileCount: busFactor.risks.filter((r: any) => r.busFactor === 1).length,
        description: 'Risk cost of single-owner critical areas',
        emoji: '🚌',
      },
      fileCosts,
    };
  } catch {
    return { category: null, fileCosts };
  }
}

/**
 * Analyze circular dependencies and calculate their cost
 */
export function analyzeCycleCosts(
  graph: KnowledgeGraph,
  hourlyRate: number
): {
  category: DebtCategory | null;
  fileCosts: Map<string, CostlyFile>;
} {
  const fileCosts = new Map<string, CostlyFile>();

  try {
    const cycles = detectCycles(graph);

    if (!cycles || cycles.cycles.length === 0) {
      return { category: null, fileCosts };
    }

    let totalCycleCost = 0;

    for (const cycle of cycles.cycles) {
      // Cost increases with cycle length
      const cost = cycle.length * cycle.length * 100;
      totalCycleCost += cost;

      for (const file of cycle.files) {
        const existing = fileCosts.get(file) || {
          file,
          totalCost: 0,
          breakdown: { complexity: 0, deadCode: 0, busFactor: 0, cycles: 0 },
          priority: (cycle.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium',
          estimatedFixTime: 4,
        };
        existing.breakdown.cycles = (existing.breakdown.cycles || 0) + cost / cycle.length;
        existing.totalCost += cost / cycle.length;
        fileCosts.set(file, existing);
      }
    }

    return {
      category: {
        name: 'Circular Dependencies',
        cost: totalCycleCost,
        hours: Math.round(totalCycleCost / hourlyRate),
        fileCount: cycles.affectedFiles,
        description: 'Cost to refactor tangled dependencies',
        emoji: '🔄',
      },
      fileCosts,
    };
  } catch {
    return { category: null, fileCosts };
  }
}

/**
 * Analyze dead code and calculate maintenance cost
 */
export function analyzeDeadCodeCosts(
  graph: KnowledgeGraph,
  hourlyRate: number
): DebtCategory | null {
  const importedSymbols = new Set(
    graph.edges.filter((e: any) => e.type === 'imports').map((e: any) => e.target)
  );

  const unusedCount = Object.values(graph.nodes).filter((n: any) => {
    return (n.type === 'function' || n.type === 'class') && !importedSymbols.has(n.id);
  }).length;

  if (unusedCount === 0) {
    return null;
  }

  // Cost: unused code maintenance burden
  const costPerUnused = 50; // $ per unused function/class
  const totalDeadCodeCost = unusedCount * costPerUnused;

  return {
    name: 'Dead Code',
    cost: totalDeadCodeCost,
    hours: Math.round(totalDeadCodeCost / hourlyRate),
    fileCount: unusedCount,
    description: 'Wasted maintenance on unused code',
    emoji: '💀',
  };
}

/**
 * Consolidate costs across all categories and files into aggregate data
 */
export function consolidateCosts(
  fileCoststMap: Map<string, CostlyFile>[],
  categories: DebtCategory[]
): {
  topFiles: CostlyFile[];
  allFiles: Map<string, CostlyFile>;
} {
  const allFiles = new Map<string, CostlyFile>();

  // Merge all file costs
  for (const costMap of fileCoststMap) {
    for (const [file, data] of costMap) {
      const existing = allFiles.get(file);
      if (existing) {
        existing.totalCost += data.totalCost;
        existing.breakdown.complexity += data.breakdown.complexity;
        existing.breakdown.deadCode += data.breakdown.deadCode;
        existing.breakdown.busFactor += data.breakdown.busFactor;
        existing.breakdown.cycles += data.breakdown.cycles;
      } else {
        allFiles.set(file, { ...data });
      }
    }
  }

  // Get top files by cost
  const topFiles = Array.from(allFiles.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  return { topFiles, allFiles };
}
