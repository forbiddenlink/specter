/**
 * DNA - Codebase Visual Fingerprint
 *
 * Generates a unique visual representation of a codebase
 * based on its structural characteristics.
 */

import type { KnowledgeGraph } from './graph/types.js';

export interface DNAProfile {
  codebaseName: string;
  hash: string;
  strand: string[];
  traits: Array<{ name: string; value: string; gene: string }>;
  genome: string;
}

// DNA base pairs represented with block characters
const basePairs = {
  A: ['▓▓', '░░'], // Adenine
  T: ['░░', '▓▓'], // Thymine
  G: ['▓░', '░▓'], // Guanine
  C: ['░▓', '▓░'], // Cytosine
};

// Gene expressions for different traits
const geneExpressions: Record<string, string[]> = {
  tiny: ['◦', '∘', '○'],
  small: ['●', '◐', '◑'],
  medium: ['◉', '◎', '⊙'],
  large: ['⬤', '◯', '⊕'],
  massive: ['⬢', '⬡', '⎔'],
};

/**
 * Generate a hash from codebase characteristics
 */
function generateHash(graph: KnowledgeGraph): string {
  const data = [
    graph.metadata.fileCount,
    graph.metadata.totalLines,
    graph.metadata.nodeCount,
    graph.metadata.edgeCount,
    Object.keys(graph.metadata.languages).length,
    graph.metadata.rootDir,
  ].join('-');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  // Convert to hex-like string using DNA bases
  const bases = ['A', 'T', 'G', 'C'];
  let result = '';
  let n = Math.abs(hash);
  while (n > 0) {
    result = bases[n % 4] + result;
    n = Math.floor(n / 4);
  }

  return result.padStart(16, 'A').substring(0, 16);
}

/**
 * Generate DNA strand visualization
 */
function generateStrand(hash: string, _width: number = 40): string[] {
  const lines: string[] = [];
  const pairs = hash.split('');

  // Create double helix effect
  const helixWidth = 20;
  const amplitude = 6;

  for (let i = 0; i < pairs.length; i++) {
    const base = pairs[i] as keyof typeof basePairs;
    const pair = basePairs[base] || basePairs.A;

    // Calculate helix position using sine wave
    const phase = (i / pairs.length) * Math.PI * 2;
    const offset1 = Math.round(Math.sin(phase) * amplitude);
    const offset2 = Math.round(Math.sin(phase + Math.PI) * amplitude);

    const center = Math.floor(helixWidth / 2);
    const pos1 = center + offset1;
    const pos2 = center + offset2;

    // Build the line
    const line = ' '.repeat(helixWidth);
    const lineArr = line.split('');

    // Place base pairs
    if (pos1 >= 0 && pos1 < helixWidth - 1) {
      const char1 = pair[0]?.[0];
      const char2 = pair[0]?.[1];
      if (char1) lineArr[pos1] = char1;
      if (char2) lineArr[pos1 + 1] = char2;
    }
    if (pos2 >= 0 && pos2 < helixWidth - 1) {
      const char3 = pair[1]?.[0];
      const char4 = pair[1]?.[1];
      if (char3) lineArr[pos2] = char3;
      if (char4) lineArr[pos2 + 1] = char4;
    }

    // Add connecting bonds between pairs
    const minPos = Math.min(pos1, pos2);
    const maxPos = Math.max(pos1, pos2);
    for (let j = minPos + 2; j < maxPos; j++) {
      if (lineArr[j] === ' ') {
        lineArr[j] = i % 2 === 0 ? '─' : '┄';
      }
    }

    lines.push(lineArr.join(''));
  }

  return lines;
}

/**
 * Determine size category
 */
function getSizeCategory(files: number): string {
  if (files < 10) return 'tiny';
  if (files < 50) return 'small';
  if (files < 200) return 'medium';
  if (files < 1000) return 'large';
  return 'massive';
}

/**
 * Generate trait analysis
 */
function analyzeTraits(graph: KnowledgeGraph): DNAProfile['traits'] {
  const traits: DNAProfile['traits'] = [];

  // Size gene
  const sizeCategory = getSizeCategory(graph.metadata.fileCount);
  const sizeGenes = geneExpressions[sizeCategory] ?? ['●', '◐', '◑'];
  traits.push({
    name: 'Size',
    value: `${graph.metadata.fileCount} files (${sizeCategory})`,
    gene: sizeGenes.join(''),
  });

  // Complexity gene
  const complexities = Object.values(graph.nodes)
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity as number);
  const avgComplexity =
    complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0;

  let complexityLevel: string;
  let complexityGene: string;
  if (avgComplexity < 5) {
    complexityLevel = 'Simple';
    complexityGene = '○○○';
  } else if (avgComplexity < 10) {
    complexityLevel = 'Moderate';
    complexityGene = '◐◐◐';
  } else if (avgComplexity < 20) {
    complexityLevel = 'Complex';
    complexityGene = '●●●';
  } else {
    complexityLevel = 'Intricate';
    complexityGene = '◉◉◉';
  }
  traits.push({
    name: 'Complexity',
    value: `${avgComplexity.toFixed(1)} avg (${complexityLevel})`,
    gene: complexityGene,
  });

  // Language diversity gene
  const langCount = Object.keys(graph.metadata.languages).length;
  let langGene: string;
  let langDesc: string;
  if (langCount === 1) {
    langGene = '█';
    langDesc = 'Purebred';
  } else if (langCount <= 3) {
    langGene = '█░█';
    langDesc = 'Hybrid';
  } else {
    langGene = '░█░█░';
    langDesc = 'Polyglot';
  }
  const primaryLang =
    Object.entries(graph.metadata.languages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  traits.push({
    name: 'Language',
    value: `${primaryLang} (${langDesc})`,
    gene: langGene,
  });

  // Connectivity gene (based on edges/nodes ratio)
  const connectivity =
    graph.metadata.nodeCount > 0 ? graph.metadata.edgeCount / graph.metadata.nodeCount : 0;
  let connectGene: string;
  let connectDesc: string;
  if (connectivity < 1) {
    connectGene = '·  ·  ·';
    connectDesc = 'Loosely coupled';
  } else if (connectivity < 3) {
    connectGene = '·──·──·';
    connectDesc = 'Well connected';
  } else {
    connectGene = '╬══╬══╬';
    connectDesc = 'Highly coupled';
  }
  traits.push({
    name: 'Coupling',
    value: `${connectivity.toFixed(2)} ratio (${connectDesc})`,
    gene: connectGene,
  });

  // Code density gene (lines per file)
  const density =
    graph.metadata.fileCount > 0 ? graph.metadata.totalLines / graph.metadata.fileCount : 0;
  let densityGene: string;
  let densityDesc: string;
  if (density < 50) {
    densityGene = '▁▂▁';
    densityDesc = 'Lean';
  } else if (density < 150) {
    densityGene = '▃▅▃';
    densityDesc = 'Balanced';
  } else if (density < 300) {
    densityGene = '▅▇▅';
    densityDesc = 'Dense';
  } else {
    densityGene = '▇█▇';
    densityDesc = 'Monolithic';
  }
  traits.push({
    name: 'Density',
    value: `${density.toFixed(0)} lines/file (${densityDesc})`,
    gene: densityGene,
  });

  return traits;
}

/**
 * Generate genome string (compact representation)
 */
function generateGenome(traits: DNAProfile['traits']): string {
  return traits.map((t) => t.gene).join(' ');
}

/**
 * Generate full DNA profile
 */
export function generateDNA(graph: KnowledgeGraph): DNAProfile {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';
  const hash = generateHash(graph);
  const strand = generateStrand(hash);
  const traits = analyzeTraits(graph);
  const genome = generateGenome(traits);

  return {
    codebaseName,
    hash,
    strand,
    traits,
    genome,
  };
}

/**
 * Format DNA profile for display
 */
export function formatDNA(profile: DNAProfile): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃           🧬 CODEBASE DNA PROFILE 🧬            ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');
  lines.push(`  Specimen: ${profile.codebaseName}`);
  lines.push(`  Sequence: ${profile.hash}`);
  lines.push('');

  // DNA Strand visualization
  lines.push('  ┌─────────────────────────┐');
  lines.push('  │    DOUBLE HELIX         │');
  lines.push('  │                         │');
  for (const strandLine of profile.strand) {
    lines.push(`  │  ${strandLine}   │`);
  }
  lines.push('  │                         │');
  lines.push('  └─────────────────────────┘');
  lines.push('');

  // Traits
  lines.push('  GENETIC TRAITS');
  lines.push(`  ${'─'.repeat(45)}`);
  for (const trait of profile.traits) {
    const nameCol = trait.name.padEnd(12);
    const geneCol = trait.gene.padEnd(10);
    lines.push(`  ${nameCol} ${geneCol} ${trait.value}`);
  }
  lines.push('');

  // Genome
  lines.push('  GENOME SIGNATURE');
  lines.push(`  ${'─'.repeat(45)}`);
  lines.push(`  ${profile.genome}`);
  lines.push('');

  // Uniqueness statement
  lines.push(`  ${'━'.repeat(45)}`);
  lines.push('  This genetic signature is unique to your codebase.');
  lines.push('  No two projects share the same DNA.');
  lines.push(`  ${'━'.repeat(45)}`);

  return lines.join('\n');
}

/**
 * Generate a compact DNA badge (for sharing)
 */
export function generateBadge(profile: DNAProfile): string {
  const lines: string[] = [];

  lines.push('╭───────────────────────────────╮');
  lines.push(`│ 🧬 ${profile.codebaseName.substring(0, 23).padEnd(23)} │`);
  lines.push('├───────────────────────────────┤');
  lines.push(`│ ${profile.hash.padEnd(29)} │`);
  lines.push(`│ ${profile.genome.substring(0, 29).padEnd(29)} │`);
  lines.push('╰───────────────────────────────╯');

  return lines.join('\n');
}
