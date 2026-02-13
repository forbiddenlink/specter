/**
 * Achievements System
 *
 * Gamified badges based on codebase metrics. Each achievement
 * has a check function that evaluates against the knowledge graph
 * and computed statistics.
 */

import type { KnowledgeGraph } from './graph/types.js';

export interface CodebaseStats {
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  maxComplexity: number;
  hotspots: number;
  deadExports: number;
  busFactor: number;
  tsPercentage: number;
  health: number;
  functionCount: number;
  classCount: number;
  contributors: number;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  check: (graph: KnowledgeGraph, stats: CodebaseStats) => boolean;
}

export const achievements: Achievement[] = [
  // Always unlocked
  {
    id: 'first_scan',
    name: 'First Blood',
    emoji: '\u2b50',
    description: 'Complete your first scan',
    check: () => true,
  },

  // Complexity achievements
  {
    id: 'low_complexity',
    name: 'Zen Master',
    emoji: '\ud83e\uddd8',
    description: 'Average complexity under 5',
    check: (_g, s) => s.avgComplexity < 5,
  },
  {
    id: 'no_hotspots',
    name: 'Cool & Collected',
    emoji: '\u2744\ufe0f',
    description: 'Zero complexity hotspots',
    check: (_g, s) => s.hotspots === 0,
  },
  {
    id: 'complexity_warrior',
    name: 'Complexity Tamer',
    emoji: '\ud83d\udc09',
    description: 'No function over complexity 20',
    check: (_g, s) => s.maxComplexity <= 20,
  },

  // Size achievements
  {
    id: 'many_files',
    name: 'Empire Builder',
    emoji: '\ud83c\udff0',
    description: 'Over 100 files',
    check: (_g, s) => s.fileCount > 100,
  },
  {
    id: 'small_codebase',
    name: 'Minimalist',
    emoji: '\ud83c\udfaf',
    description: 'Under 20 files, but powerful',
    check: (_g, s) => s.fileCount < 20 && s.fileCount > 0,
  },
  {
    id: 'many_lines',
    name: 'Prolific Author',
    emoji: '\ud83d\udcda',
    description: 'Over 10,000 lines of code',
    check: (_g, s) => s.totalLines > 10000,
  },

  // Health achievements
  {
    id: 'high_health',
    name: 'Health Nut',
    emoji: '\ud83d\udcaa',
    description: 'Health score over 90',
    check: (_g, s) => s.health > 90,
  },
  {
    id: 'perfect_health',
    name: 'Immaculate',
    emoji: '\ud83c\udf1f',
    description: 'Perfect health score of 100',
    check: (_g, s) => s.health === 100,
  },

  // Code quality achievements
  {
    id: 'no_dead_code',
    name: 'Ghost Buster',
    emoji: '\ud83d\udc7b',
    description: 'No dead code detected',
    check: (_g, s) => s.deadExports === 0,
  },
  {
    id: 'good_bus_factor',
    name: 'Team Player',
    emoji: '\ud83e\udd1d',
    description: 'Bus factor over 3',
    check: (_g, s) => s.busFactor > 3,
  },
  {
    id: 'lone_wolf',
    name: 'Lone Wolf',
    emoji: '\ud83d\udc3a',
    description: 'Solo developer (1 contributor)',
    check: (_g, s) => s.contributors === 1,
  },

  // TypeScript achievements
  {
    id: 'typescript',
    name: 'Type Safe',
    emoji: '\ud83d\udee1\ufe0f',
    description: '100% TypeScript',
    check: (_g, s) => s.tsPercentage === 100,
  },
  {
    id: 'mostly_typescript',
    name: 'Type Curious',
    emoji: '\ud83d\udd0d',
    description: 'Over 80% TypeScript',
    check: (_g, s) => s.tsPercentage >= 80 && s.tsPercentage < 100,
  },

  // Structure achievements
  {
    id: 'many_functions',
    name: 'Functional',
    emoji: '\u2699\ufe0f',
    description: 'Over 100 functions',
    check: (_g, s) => s.functionCount > 100,
  },
  {
    id: 'class_oriented',
    name: 'Class Act',
    emoji: '\ud83c\udfad',
    description: 'Over 10 classes',
    check: (_g, s) => s.classCount > 10,
  },

  // Fun/edge case achievements
  {
    id: 'spaghetti',
    name: 'Pasta Chef',
    emoji: '\ud83c\udf5d',
    description: 'A function with complexity over 50',
    check: (_g, s) => s.maxComplexity > 50,
  },
  {
    id: 'baby_steps',
    name: 'Baby Steps',
    emoji: '\ud83d\udc76',
    description: 'Under 100 lines of code',
    check: (_g, s) => s.totalLines < 100,
  },
];

/**
 * Calculate codebase statistics from the knowledge graph
 */
export function calculateStats(
  graph: KnowledgeGraph,
  deadExportCount?: number,
  busFactorValue?: number
): CodebaseStats {
  const nodes = Object.values(graph.nodes);

  // Count by type
  const fileNodes = nodes.filter((n) => n.type === 'file');
  const functionNodes = nodes.filter((n) => n.type === 'function');
  const classNodes = nodes.filter((n) => n.type === 'class');

  // Language distribution
  const languages = graph.metadata.languages;
  const tsFiles = (languages['typescript'] || 0) + (languages['tsx'] || 0);
  const jsFiles = (languages['javascript'] || 0) + (languages['jsx'] || 0);
  const totalLangFiles = tsFiles + jsFiles;
  const tsPercentage = totalLangFiles > 0 ? Math.round((tsFiles / totalLangFiles) * 100) : 0;

  // Complexity stats
  const complexities = nodes.filter((n) => n.complexity !== undefined).map((n) => n.complexity!);
  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0;
  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;

  // Hotspots (complexity > 10)
  const hotspots = complexities.filter((c) => c > 10).length;

  // Health score (inverse of complexity, capped at 100)
  const health = Math.max(0, Math.min(100, Math.round(100 - avgComplexity * 5)));

  // Contributors (unique)
  const contributorSet = new Set<string>();
  for (const node of nodes) {
    if (node.contributors) {
      for (const c of node.contributors) {
        contributorSet.add(c);
      }
    }
  }

  return {
    fileCount: fileNodes.length,
    totalLines: graph.metadata.totalLines,
    avgComplexity: Math.round(avgComplexity * 100) / 100,
    maxComplexity,
    hotspots,
    deadExports: deadExportCount ?? 0,
    busFactor: busFactorValue ?? 0,
    tsPercentage,
    health,
    functionCount: functionNodes.length,
    classCount: classNodes.length,
    contributors: contributorSet.size,
  };
}

/**
 * Check which achievements are unlocked
 */
export function checkAchievements(
  graph: KnowledgeGraph,
  stats: CodebaseStats
): { unlocked: Achievement[]; locked: Achievement[] } {
  const unlocked: Achievement[] = [];
  const locked: Achievement[] = [];

  for (const achievement of achievements) {
    if (achievement.check(graph, stats)) {
      unlocked.push(achievement);
    } else {
      locked.push(achievement);
    }
  }

  return { unlocked, locked };
}
