/**
 * Tech Debt Cost Analysis
 *
 * Estimates technical debt in dollar terms based on:
 * - Complexity hotspots (time to understand/modify)
 * - Dead code (wasted maintenance)
 * - Bus factor risk (replacement cost)
 * - Circular dependencies (refactoring cost)
 */

import type { KnowledgeGraph } from './graph/types.js';
import { analyzeHotspots, type HotspotsResult } from './hotspots.js';
import { analyzeBusFactor, type BusFactorResult } from './bus-factor.js';
import { detectCycles, type CyclesResult } from './cycles.js';

export interface DebtCategory {
  name: string;
  cost: number;
  hours: number;
  fileCount: number;
  description: string;
  emoji: string;
}

export interface CostlyFile {
  file: string;
  totalCost: number;
  breakdown: {
    complexity?: number;
    deadCode?: number;
    busFactor?: number;
    cycles?: number;
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedFixTime: number;
}

export interface QuickWin {
  file: string;
  cost: number;
  fixTime: number;
  roi: number;
  recommendation: string;
}

export interface CostAnalysis {
  totalDebt: number;
  categories: DebtCategory[];
  topFiles: CostlyFile[];
  quickWins: QuickWin[];
  estimatedSavings: number;
  hourlyRate: number;
  currency: string;
  analysisDate: string;
}

export interface CostOptions {
  hourlyRate?: number;
  currency?: string;
  includeDeadCode?: boolean;
}

const DEFAULT_HOURLY_RATE = 75;
const DEFAULT_CURRENCY = 'USD';

/**
 * Calculate complexity cost for a hotspot
 */
function calculateComplexityCost(
  complexity: number,
  churnRate: number,
  priority: string,
  hourlyRate: number
): number {
  const priorityMultiplier: Record<string, number> = {
    critical: 2.0,
    high: 1.5,
    medium: 1.0,
    low: 0.5,
  };

  const baseHours = complexity / 10;
  const annualTouches = Math.max(1, churnRate * 52);
  const annualHours = baseHours * (priorityMultiplier[priority] || 1) * Math.min(annualTouches, 50);

  return Math.round(annualHours * hourlyRate);
}

/**
 * Calculate bus factor risk cost
 */
function calculateBusFactorCost(
  busFactor: number,
  linesOfCode: number,
  criticality: string,
  hourlyRate: number
): number {
  if (busFactor > 1) return 0;

  const riskMultiplier: Record<string, number> = {
    critical: 10,
    high: 6,
    medium: 3,
    low: 1,
  };

  const replacementWeeks = riskMultiplier[criticality] || 1;
  const replacementHours = replacementWeeks * 40 * (linesOfCode / 1000);

  return Math.round(Math.min(replacementHours, 400) * hourlyRate);
}

/**
 * Calculate cycle refactoring cost
 */
function calculateCycleCost(cycleLength: number, hourlyRate: number): number {
  let hours: number;
  if (cycleLength <= 3) {
    hours = 4;
  } else if (cycleLength <= 5) {
    hours = 12;
  } else {
    hours = 40;
  }

  return hours * hourlyRate;
}

/**
 * Calculate dead code maintenance cost
 */
function calculateDeadCodeCost(
  unusedExports: number,
  totalLines: number,
  hourlyRate: number
): number {
  const wastedMaintenanceRatio = unusedExports / Math.max(1, totalLines / 100);
  const annualHours = wastedMaintenanceRatio * 10;

  return Math.round(Math.min(annualHours, 100) * hourlyRate);
}

/**
 * Analyze tech debt and estimate costs
 */
export async function analyzeCost(
  rootDir: string,
  graph: KnowledgeGraph,
  options: CostOptions = {}
): Promise<CostAnalysis> {
  const hourlyRate = options.hourlyRate || DEFAULT_HOURLY_RATE;
  const currency = options.currency || DEFAULT_CURRENCY;

  const categories: DebtCategory[] = [];
  const fileCosts: Map<string, CostlyFile> = new Map();

  // Analyze complexity hotspots
  let hotspots: HotspotsResult | null = null;
  try {
    hotspots = await analyzeHotspots(rootDir, graph, {});
  } catch {
    // Hotspots analysis not available
  }

  let complexityCost = 0;
  if (hotspots && hotspots.hotspots.length > 0) {
    for (const spot of hotspots.hotspots) {
      const cost = calculateComplexityCost(
        spot.hotspotScore,
        spot.churnRate,
        spot.priority,
        hourlyRate
      );
      complexityCost += cost;

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

    categories.push({
      name: 'Complexity Hotspots',
      cost: complexityCost,
      hours: Math.round(complexityCost / hourlyRate),
      fileCount: hotspots.hotspots.length,
      description: 'Annual cost of maintaining high-complexity code',
      emoji: '\u{1F525}',
    });
  }

  // Analyze bus factor
  let busFactor: BusFactorResult | null = null;
  try {
    busFactor = await analyzeBusFactor(graph, {});
  } catch {
    // Bus factor analysis not available
  }

  let busFactorCost = 0;
  if (busFactor && busFactor.risks && busFactor.risks.length > 0) {
    for (const risk of busFactor.risks) {
      if (risk.busFactor === 1) {
        const cost = calculateBusFactorCost(
          risk.busFactor,
          risk.linesOfCode || 500,
          risk.criticality,
          hourlyRate
        );
        busFactorCost += cost;

        const filePath = risk.area || 'unknown';
        const existing = fileCosts.get(filePath) || {
          file: filePath,
          totalCost: 0,
          breakdown: { complexity: 0, deadCode: 0, busFactor: 0, cycles: 0 },
          priority: risk.criticality as 'critical' | 'high' | 'medium' | 'low',
          estimatedFixTime: 8,
        };
        existing.breakdown.busFactor = (existing.breakdown.busFactor || 0) + cost;
        existing.totalCost += cost;
        fileCosts.set(filePath, existing);
      }
    }

    if (busFactorCost > 0) {
      categories.push({
        name: 'Bus Factor Risk',
        cost: busFactorCost,
        hours: Math.round(busFactorCost / hourlyRate),
        fileCount: busFactor.risks.filter((r: { busFactor: number }) => r.busFactor === 1).length,
        description: 'Risk cost of single-owner critical areas',
        emoji: '\u{1F68C}',
      });
    }
  }

  // Analyze circular dependencies
  let cycles: CyclesResult | null = null;
  try {
    cycles = detectCycles(graph);
  } catch {
    // Cycles analysis not available
  }

  let cycleCost = 0;
  if (cycles && cycles.cycles.length > 0) {
    for (const cycle of cycles.cycles) {
      const cost = calculateCycleCost(cycle.length, hourlyRate);
      cycleCost += cost;

      for (const file of cycle.files) {
        const existing = fileCosts.get(file) || {
          file,
          totalCost: 0,
          breakdown: { complexity: 0, deadCode: 0, busFactor: 0, cycles: 0 },
          priority: cycle.severity as 'critical' | 'high' | 'medium' | 'low',
          estimatedFixTime: 4,
        };
        existing.breakdown.cycles = (existing.breakdown.cycles || 0) + cost / cycle.length;
        existing.totalCost += cost / cycle.length;
        fileCosts.set(file, existing);
      }
    }

    categories.push({
      name: 'Circular Dependencies',
      cost: cycleCost,
      hours: Math.round(cycleCost / hourlyRate),
      fileCount: cycles.affectedFiles,
      description: 'Cost to refactor tangled dependencies',
      emoji: '\u{1F504}',
    });
  }

  // Calculate dead code cost
  if (options.includeDeadCode !== false) {
    const unusedExports = Object.values(graph.nodes).filter(
      (n) => n.type === 'function' || n.type === 'class'
    ).length;
    const importedSymbols = new Set(graph.edges.filter((e) => e.type === 'imports').map((e) => e.target));
    const actualUnused = Object.values(graph.nodes).filter(
      (n) => (n.type === 'function' || n.type === 'class') && !importedSymbols.has(n.id)
    ).length;

    const deadCodeCostValue = calculateDeadCodeCost(
      actualUnused,
      graph.metadata.totalLines,
      hourlyRate
    );

    if (deadCodeCostValue > 0) {
      categories.push({
        name: 'Dead Code',
        cost: deadCodeCostValue,
        hours: Math.round(deadCodeCostValue / hourlyRate),
        fileCount: actualUnused,
        description: 'Wasted maintenance on unused code',
        emoji: '\u{1F480}',
      });
    }
  }

  // Calculate totals
  const totalDebt = categories.reduce((sum, cat) => sum + cat.cost, 0);

  // Sort files by cost
  const topFiles = Array.from(fileCosts.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  // Identify quick wins (high ROI, low effort)
  const quickWins: QuickWin[] = Array.from(fileCosts.values())
    .filter((f) => f.estimatedFixTime <= 8 && f.totalCost > 500)
    .map((f) => ({
      file: f.file,
      cost: f.totalCost,
      fixTime: f.estimatedFixTime,
      roi: Math.round(f.totalCost / f.estimatedFixTime),
      recommendation: getRecommendation(f),
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  // Estimate savings from fixing top issues
  const topFileCost = topFiles.slice(0, 5).reduce((sum, f) => sum + f.totalCost, 0);
  const estimatedSavings = Math.round(topFileCost * 0.7);

  return {
    totalDebt,
    categories,
    topFiles,
    quickWins,
    estimatedSavings,
    hourlyRate,
    currency,
    analysisDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Get recommendation for a costly file
 */
function getRecommendation(file: CostlyFile): string {
  if (file.breakdown.deadCode && file.breakdown.deadCode > file.totalCost * 0.5) {
    return 'Remove unused exports';
  }
  if (file.breakdown.complexity && file.breakdown.complexity > file.totalCost * 0.5) {
    return 'Extract complex logic into smaller functions';
  }
  if (file.breakdown.busFactor && file.breakdown.busFactor > file.totalCost * 0.5) {
    return 'Document and cross-train team members';
  }
  if (file.breakdown.cycles && file.breakdown.cycles > file.totalCost * 0.5) {
    return 'Break circular dependency';
  }
  return 'Review and refactor';
}

/**
 * Format currency value
 */
function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
    JPY: '\u00A5',
  };
  const symbol = symbols[currency] || '$';
  return `${symbol}${value.toLocaleString()}`;
}

/**
 * Format cost analysis as ASCII report
 */
export function formatCost(analysis: CostAnalysis): string {
  const lines: string[] = [];
  const W = 60;

  // Header
  lines.push('\u250F' + '\u2501'.repeat(W) + '\u2513');
  lines.push('\u2503  \u{1F4B0} TECH DEBT COST ANALYSIS' + ' '.repeat(W - 28) + '\u2503');
  lines.push('\u2503  Estimated Annual Maintenance Burden' + ' '.repeat(W - 40) + '\u2503');
  lines.push('\u2517' + '\u2501'.repeat(W) + '\u251B');
  lines.push('');

  // Total
  const totalStr = `Total Tech Debt: ${formatCurrency(analysis.totalDebt, analysis.currency)}`;
  lines.push(totalStr);
  lines.push(`  (Based on ${formatCurrency(analysis.hourlyRate, analysis.currency)}/hour developer cost)`);
  lines.push('');

  // Category breakdown
  if (analysis.categories.length > 0) {
    lines.push('COST BREAKDOWN');
    lines.push('\u2500'.repeat(W));

    const maxCost = Math.max(...analysis.categories.map((c) => c.cost));

    for (const cat of analysis.categories.sort((a, b) => b.cost - a.cost)) {
      const barLen = Math.round((cat.cost / maxCost) * 20);
      const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(20 - barLen);
      const pct = Math.round((cat.cost / analysis.totalDebt) * 100);
      const costStr = formatCurrency(cat.cost, analysis.currency).padStart(10);
      lines.push(`  ${cat.emoji} ${cat.name.padEnd(24)} ${costStr}  ${bar} ${pct}%`);
    }
    lines.push('');
  }

  // Top files
  if (analysis.topFiles.length > 0) {
    lines.push('TOP 5 MOST EXPENSIVE FILES');
    lines.push('\u2500'.repeat(W));

    const priorityEmoji: Record<string, string> = {
      critical: '\u{1F534}',
      high: '\u{1F7E0}',
      medium: '\u{1F7E1}',
      low: '\u{1F7E2}',
    };

    for (const file of analysis.topFiles.slice(0, 5)) {
      const emoji = priorityEmoji[file.priority] || '\u{1F7E1}';
      const shortPath = file.file.length > 45 ? '...' + file.file.slice(-42) : file.file;
      lines.push(`${emoji} ${file.priority.toUpperCase()}  ${shortPath}`);
      lines.push(`   Cost: ${formatCurrency(file.totalCost, analysis.currency)}/year | Fix: ~${file.estimatedFixTime}h`);

      const breakdown: string[] = [];
      if (file.breakdown.complexity) breakdown.push(`Complexity: ${formatCurrency(file.breakdown.complexity, analysis.currency)}`);
      if (file.breakdown.busFactor) breakdown.push(`Bus Factor: ${formatCurrency(file.breakdown.busFactor, analysis.currency)}`);
      if (file.breakdown.deadCode) breakdown.push(`Dead Code: ${formatCurrency(file.breakdown.deadCode, analysis.currency)}`);
      if (file.breakdown.cycles) breakdown.push(`Cycles: ${formatCurrency(Math.round(file.breakdown.cycles), analysis.currency)}`);

      if (breakdown.length > 0) {
        lines.push(`   Breakdown: ${breakdown.join(' | ')}`);
      }
      lines.push('');
    }
  }

  // Quick wins
  if (analysis.quickWins.length > 0) {
    lines.push('QUICK WINS (High ROI, Low Effort)');
    lines.push('\u2500'.repeat(W));

    for (let i = 0; i < analysis.quickWins.length; i++) {
      const win = analysis.quickWins[i];
      const shortPath = win.file.length > 40 ? '...' + win.file.slice(-37) : win.file;
      lines.push(`  ${i + 1}. ${shortPath}`);
      lines.push(`     Cost: ${formatCurrency(win.cost, analysis.currency)}/year | Fix: ${win.fixTime}h | ROI: ${formatCurrency(win.roi, analysis.currency)}/hour`);
      lines.push(`     \u2192 ${win.recommendation}`);
      lines.push('');
    }
  }

  // Recommendations
  lines.push('RECOMMENDATIONS');
  lines.push('\u2500'.repeat(W));

  const topFileCost = analysis.topFiles.slice(0, 5).reduce((sum, f) => sum + f.totalCost, 0);
  const topFilePct = Math.round((topFileCost / analysis.totalDebt) * 100);
  lines.push(`  \u{1F3AF} Fix top 5 files to reduce debt by ${formatCurrency(topFileCost, analysis.currency)} (${topFilePct}%)`);

  if (analysis.quickWins.length > 0) {
    const quickWinTotal = analysis.quickWins.reduce((sum, w) => sum + w.cost, 0);
    const quickWinHours = analysis.quickWins.reduce((sum, w) => sum + w.fixTime, 0);
    lines.push(`  \u26A1 Implement quick wins to save ${formatCurrency(quickWinTotal, analysis.currency)} in ${quickWinHours} hours`);
  }

  lines.push(`  \u{1F4CA} Estimated annual savings: ${formatCurrency(analysis.estimatedSavings, analysis.currency)}`);
  lines.push(`  \u{1F4A1} Allocate 10% of sprint capacity to debt reduction`);
  lines.push('');

  lines.push(`Run with --rate <n> to adjust developer cost (default: $${DEFAULT_HOURLY_RATE}/hr)`);

  return lines.join('\n');
}
