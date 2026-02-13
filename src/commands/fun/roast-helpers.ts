/**
 * Helper functions for roast command
 * Extracts roasting logic for different code quality issues
 */

import chalk from 'chalk';
import type { GraphNode, KnowledgeGraph } from '../../graph/types.js';

export interface RoastData {
  hotspots: Array<{ filePath: string; lineStart: number; complexity: number; name: string }>;
  deadCode: { totalCount: number; items?: unknown[] };
  busFactor: {
    analyzed: boolean;
    topOwners: Array<{ name: string; percentage: number }>;
    overallBusFactor: number;
    criticalAreas?: unknown[];
  };
  stats: { fileCount: number; totalLines: number };
  distribution: { veryHigh: number };
  graph: KnowledgeGraph;
}

/**
 * Generate roast lines for hotspots
 */
export function roastHotspots(data: RoastData): string[] {
  const lines: string[] = [];

  if (data.hotspots.length === 0) return lines;

  lines.push(chalk.bold.red('  🌶️ Hottest Takes:'));
  for (const hotspot of data.hotspots.slice(0, 5)) {
    const fileName = hotspot.filePath.split('/').pop() || hotspot.filePath;
    let roastLine = '';

    if (fileName.includes('helper') || fileName.includes('util')) {
      const funcCount = Object.values(data.graph.nodes).filter((n: unknown): n is GraphNode => {
        const node = n as GraphNode;
        return node.filePath === hotspot.filePath && node.type === 'function';
      }).length;
      roastLine = `Ah yes, the junk drawer of code. ${hotspot.complexity > 1 ? `${funcCount} functions, 0 purpose.` : ''}`;
    } else if (fileName === 'index.ts' || fileName === 'index.js') {
      roastLine = `The "I'll organize this later" file. We both know you won't.`;
    } else if (hotspot.complexity > 20) {
      roastLine = `Complexity ${hotspot.complexity}. That's not code, that's job security.`;
    } else if (hotspot.complexity > 15) {
      roastLine = `Complexity ${hotspot.complexity}. Someone really didn't believe in small functions.`;
    } else {
      roastLine = `Complexity ${hotspot.complexity}. It's seen better days.`;
    }

    lines.push(chalk.yellow(`  • ${hotspot.filePath}:${hotspot.lineStart}`));
    lines.push(chalk.dim(`    ${roastLine}`));
  }
  lines.push('');

  return lines;
}

/**
 * Generate roast about dead code
 */
export function roastDeadCode(data: RoastData): string[] {
  const lines: string[] = [];

  if (!data.deadCode || data.deadCode.totalCount === 0) return lines;

  lines.push(chalk.bold.gray('  💀 Dead Code:'));
  lines.push(
    chalk.white(
      `  You have ${data.deadCode.totalCount} unused exports. They're not dead, they're just waiting for someone to care.`
    )
  );
  lines.push(chalk.dim("  They'll keep waiting."));
  lines.push('');

  return lines;
}

/**
 * Generate roast about bus factor
 */
export function roastBusFactor(data: RoastData): string[] {
  const lines: string[] = [];

  if (!data.busFactor || !data.busFactor.analyzed || !data.busFactor.topOwners) return lines;

  const topOwner = data.busFactor.topOwners[0];
  if (!topOwner) return lines;

  lines.push(chalk.bold.magenta('  👻 Bus Factor:'));
  if (topOwner.percentage > 60) {
    lines.push(chalk.white(`  ${topOwner.name} owns ${topOwner.percentage}% of your codebase.`));
    lines.push(chalk.dim('  Hope they like their job here. Forever.'));
  } else if (data.busFactor.overallBusFactor < 2) {
    lines.push(
      chalk.white(
        `  Overall bus factor: ${data.busFactor.overallBusFactor}. That's dangerously low.`
      )
    );
    lines.push(chalk.dim('  One sick day and it all falls apart.'));
  } else {
    lines.push(
      chalk.white(
        `  Bus factor ${data.busFactor.overallBusFactor}. At least ${Math.ceil(data.busFactor.overallBusFactor)} people need to win the lottery for this to be a problem.`
      )
    );
  }
  lines.push('');

  return lines;
}

/**
 * Generate roast about naming crimes
 */
export function roastNamingCrimes(data: RoastData): string[] {
  const lines: string[] = [];

  const suspiciousFiles = Object.values(data.graph.nodes)
    .filter((n: unknown): n is GraphNode => {
      const node = n as GraphNode;
      return node.type === 'file';
    })
    .filter((n: GraphNode) => {
      const name = n.filePath.split('/').pop() || '';
      return (
        name.includes('helper') ||
        name.includes('util') ||
        name.includes('misc') ||
        name.includes('stuff')
      );
    });

  if (suspiciousFiles.length === 0) return lines;

  lines.push(chalk.bold.yellow('  🤔 Naming Crimes:'));
  for (const file of suspiciousFiles.slice(0, 3)) {
    const name = (file as GraphNode).filePath.split('/').pop();
    lines.push(chalk.white(`  • ${(file as GraphNode).filePath}`));
    if (name?.includes('helper')) {
      lines.push(chalk.dim('    "Helpers" - the universal sign for "I gave up on naming things"'));
    } else if (name?.includes('util')) {
      lines.push(chalk.dim('    "Utils" - where functions go to be forgotten'));
    } else if (name?.includes('misc')) {
      lines.push(chalk.dim('    "Misc" - at least you\'re honest about the chaos'));
    } else {
      lines.push(chalk.dim('    This name screams "I\'ll refactor later"'));
    }
  }
  lines.push('');

  return lines;
}

/**
 * Generate roast about complexity distribution
 */
export function roastComplexityDistribution(data: RoastData): string[] {
  const lines: string[] = [];

  if (data.distribution.veryHigh === 0) return lines;

  lines.push(chalk.bold.red('  💣 Complexity Crimes:'));
  lines.push(chalk.white(`  ${data.distribution.veryHigh} functions have complexity over 20.`));
  lines.push(chalk.dim("  These aren't functions, they're escape rooms."));
  lines.push('');

  return lines;
}
