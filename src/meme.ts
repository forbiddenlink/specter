/**
 * Meme Generator
 *
 * Generate meme-style text based on codebase metrics.
 */

import type { KnowledgeGraph } from './graph/types.js';

interface MemeTemplate {
  top: string;
  bottom: string;
  condition: (stats: CodeStats) => boolean;
}

interface CodeStats {
  health: number;
  complexity: number;
  files: number;
  lines: number;
  hotspots: number;
  deadCode: number;
  busFactor: number;
}

const memeTemplates: MemeTemplate[] = [
  // Health-based
  {
    top: 'HEALTH SCORE: 100',
    bottom: 'IMPOSSIBLE. CHECK FOR BUGS IN SPECTER.',
    condition: (s) => s.health === 100,
  },
  { top: 'HEALTH SCORE UNDER 30', bottom: 'THIS IS FINE 🔥', condition: (s) => s.health < 30 },
  { top: 'HEALTH SCORE: 69', bottom: 'NICE.', condition: (s) => s.health === 69 },
  { top: 'CODEBASE IS HEALTHY', bottom: 'SAID NO ONE EVER', condition: (s) => s.health > 80 },

  // Complexity
  { top: 'ONE FUNCTION', bottom: 'COMPLEXITY: OVER 9000', condition: (s) => s.complexity > 50 },
  {
    top: 'WROTE SIMPLE CODE',
    bottom: 'COMPLEXITY ANALYZER DISAGREES',
    condition: (s) => s.complexity > 20 && s.complexity < 50,
  },
  { top: 'Y U NO', bottom: 'WRITE SIMPLE FUNCTIONS', condition: (s) => s.hotspots > 20 },

  // Files and lines
  {
    top: 'JUST A SMALL PROJECT',
    bottom: `${'{lines}'} LINES LATER...`,
    condition: (s) => s.lines > 50000,
  },
  {
    top: '99 FILES IN THE REPO',
    bottom: 'TAKE ONE DOWN, BREAK THE BUILD',
    condition: (s) => s.files >= 99,
  },
  {
    top: 'STARTED WITH ONE FILE',
    bottom: `NOW I HAVE ${'{files}'}`,
    condition: (s) => s.files > 100,
  },

  // Dead code
  { top: 'UNUSED EXPORTS', bottom: "THEY'LL BE USEFUL SOMEDAY", condition: (s) => s.deadCode > 50 },
  {
    top: 'DEAD CODE EVERYWHERE',
    bottom: 'BUT I MIGHT NEED IT LATER',
    condition: (s) => s.deadCode > 100,
  },
  {
    top: 'DELETED DEAD CODE',
    bottom: 'PRODUCTION IMMEDIATELY BROKE',
    condition: (s) => s.deadCode > 0,
  },

  // Bus factor
  {
    top: 'BUS FACTOR: 1',
    bottom: 'GUESS WHO CANNOT GO ON VACATION',
    condition: (s) => s.busFactor === 1,
  },
  {
    top: 'ONLY ONE CONTRIBUTOR',
    bottom: 'LONE WOLF OR JUST LONELY?',
    condition: (s) => s.busFactor === 1,
  },
  {
    top: 'ENTIRE TEAM KNOWS THE CODE',
    bottom: "JUST KIDDING, IT'S ONE PERSON",
    condition: (s) => s.busFactor === 1,
  },

  // Hotspots
  { top: 'NO HOTSPOTS FOUND', bottom: 'ARE YOU EVEN CODING?', condition: (s) => s.hotspots === 0 },
  {
    top: 'FOUND THE HOTSPOT',
    bottom: "IT'S THE ENTIRE CODEBASE",
    condition: (s) => s.hotspots > s.files * 0.5,
  },

  // Generic funny ones
  { top: 'WROTE TESTS', bottom: 'SPECTER STILL JUDGES ME', condition: () => Math.random() > 0.8 },
  {
    top: 'CLEAN CODE',
    bottom: "THAT'S A FUNNY WAY TO SPELL TECH DEBT",
    condition: (s) => s.health < 50,
  },
  {
    top: 'REFACTORING TOMORROW',
    bottom: 'SAID DEVELOPER 6 MONTHS AGO',
    condition: (s) => s.complexity > 15,
  },
];

function getStats(graph: KnowledgeGraph): CodeStats {
  const nodes = Object.values(graph.nodes);
  const fileNodes = nodes.filter((n) => n.type === 'file');

  let totalComplexity = 0;
  let hotspots = 0;

  for (const node of nodes) {
    if (node.complexity) {
      totalComplexity += node.complexity;
      if (node.complexity > 15) hotspots++;
    }
  }

  const avgComplexity = nodes.length > 0 ? totalComplexity / nodes.length : 0;
  const totalLines = fileNodes.reduce((sum, n) => sum + ((n as any).lineCount || 0), 0);

  // Estimate health (simplified)
  let health = 100;
  health -= Math.min(30, hotspots * 2);
  health -= Math.min(20, Math.max(0, avgComplexity - 5) * 2);
  health = Math.max(0, Math.min(100, health));

  return {
    health: Math.round(health),
    complexity: Math.round(avgComplexity),
    files: fileNodes.length,
    lines: totalLines,
    hotspots,
    deadCode: Math.floor(Math.random() * 100) + 20, // Approximation
    busFactor: 1, // Usually 1 for personal projects
  };
}

function renderMeme(template: MemeTemplate, stats: CodeStats): string {
  const top = template.top
    .replace('{lines}', stats.lines.toLocaleString())
    .replace('{files}', stats.files.toString())
    .replace('{complexity}', stats.complexity.toString());

  const bottom = template.bottom
    .replace('{lines}', stats.lines.toLocaleString())
    .replace('{files}', stats.files.toString())
    .replace('{complexity}', stats.complexity.toString());

  const width = Math.max(top.length, bottom.length) + 4;
  const border = '═'.repeat(width);

  return `
  ╔${border}╗
  ║${' '.repeat(Math.floor((width - top.length) / 2))}${top}${' '.repeat(Math.ceil((width - top.length) / 2))}║
  ╠${border}╣
  ║${' '.repeat(width)}║
  ║${' '.repeat(Math.floor((width - 8) / 2))}🖼️  📸  🎭${' '.repeat(Math.ceil((width - 8) / 2))}║
  ║${' '.repeat(width)}║
  ╠${border}╣
  ║${' '.repeat(Math.floor((width - bottom.length) / 2))}${bottom}${' '.repeat(Math.ceil((width - bottom.length) / 2))}║
  ╚${border}╝`;
}

export function generateMeme(graph: KnowledgeGraph): string {
  const stats = getStats(graph);

  // Find matching templates
  const matching = memeTemplates.filter((t) => t.condition(stats));

  // Pick a random one, or fallback
  const template =
    matching.length > 0
      ? matching[Math.floor(Math.random() * matching.length)]
      : memeTemplates[Math.floor(Math.random() * memeTemplates.length)];

  const lines: string[] = [];
  lines.push('');
  lines.push('  🎭 CODEBASE MEME GENERATOR 🎭');
  lines.push('');
  lines.push(renderMeme(template, stats));
  lines.push('');
  lines.push('  📊 Based on your stats:');
  lines.push(`     Health: ${stats.health}/100 | Complexity: ${stats.complexity} avg`);
  lines.push(`     Files: ${stats.files} | Hotspots: ${stats.hotspots}`);
  lines.push('');
  lines.push('  💡 Run again for a different meme!');
  lines.push('');

  return lines.join('\n');
}
