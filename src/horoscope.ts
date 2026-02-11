/**
 * Horoscope System
 *
 * Fun daily fortune based on codebase patterns.
 * Uses deterministic randomness (date + codebase name) so
 * it's consistent for the day.
 */

import type { KnowledgeGraph } from './graph/types.js';

// Zodiac signs with codebase-themed descriptions
const zodiacSigns = [
  { sign: 'Aries', emoji: '\u2648', trait: 'born in a sprint of passion' },
  { sign: 'Taurus', emoji: '\u2649', trait: 'built with stubborn determination' },
  { sign: 'Gemini', emoji: '\u264a', trait: 'dual-natured: elegant API, chaotic internals' },
  { sign: 'Cancer', emoji: '\u264b', trait: 'protective of its core modules' },
  { sign: 'Leo', emoji: '\u264c', trait: 'confident and well-documented' },
  { sign: 'Virgo', emoji: '\u264d', trait: 'meticulously typed and tested' },
  { sign: 'Libra', emoji: '\u264e', trait: 'balanced between features and tech debt' },
  { sign: 'Scorpio', emoji: '\u264f', trait: 'mysterious and deeply nested' },
  { sign: 'Sagittarius', emoji: '\u2650', trait: 'adventurous with dependencies' },
  { sign: 'Capricorn', emoji: '\u2651', trait: 'pragmatic and production-ready' },
  { sign: 'Aquarius', emoji: '\u2652', trait: 'unconventional but innovative' },
  { sign: 'Pisces', emoji: '\u2653', trait: 'dreamy, sometimes losing itself in abstractions' },
];

// Mercury retrograde jokes
const mercuryRetrogrades = [
  'Mercury is in retrograde with your node_modules.',
  'Mercury has entered your CI/CD pipeline.',
  'Mercury is doing a git rebase on your main branch.',
  'Mercury is refactoring without tests.',
  'Mercury is reviewing your oldest PR.',
  'Mercury is auditing your package-lock.json.',
];

// Daily suggestions
const starSuggests = [
  'Avoid major refactors today.',
  'A good day for writing tests.',
  'The cosmos favor documentation.',
  'Consider deleting that TODO you wrote 6 months ago.',
  'The universe whispers: "extract that function."',
  'A debugging breakthrough awaits you.',
  'Your code review karma needs attention.',
  'The stars suggest a coffee break.',
  'Not a good day for production deploys.',
  'Perfect alignment for dependency updates.',
  'The void calls for error handling.',
  'Consider the wisdom of early returns.',
];

// Lucky/unlucky file patterns
const luckyFilePatterns = [
  'src/index',
  'src/main',
  'src/app',
  'src/core',
  'utils/helpers',
  'lib/core',
  'services/main',
  'components/App',
];

const unluckyFileComments = [
  'Wherever you last saw a TODO',
  'That file you keep meaning to refactor',
  'The one with the 500-line function',
  'Anywhere near your oldest code',
  'The module everyone is afraid to touch',
  'That "temporary" file from 2 years ago',
];

// Power moves
const powerMoves = [
  'Delete dead code during the full moon',
  'Refactor a switch statement into a strategy pattern',
  'Convert a callback to async/await',
  'Add JSDoc to a mysterious function',
  'Split a god class into focused modules',
  'Replace magic numbers with named constants',
  'Add error boundaries where none exist',
  'Create a custom hook from duplicated logic',
];

// Compatibility
const compatibilities = [
  'Well-documented codebases',
  'Projects with 100% test coverage',
  'Codebases that use TypeScript strict mode',
  'Teams that do code reviews',
  'Repos with clear contribution guidelines',
  'Projects with semantic versioning',
];

// Things to avoid
const avoidances = [
  'Developers who don\'t write tests',
  'Force pushes to main',
  'Uncommitted changes on Fridays',
  'Dependencies with no maintenance',
  'Monolithic functions',
  'Circular dependencies',
  'any types masquerading as safety',
  'Code without error handling',
];

// Affirmations
const affirmations = [
  'I am more than my complexity score.',
  'My tech debt does not define me.',
  'Every bug is a lesson in disguise.',
  'I ship, therefore I am.',
  'My code works in all environments, not just my machine.',
  'I embrace the refactor.',
  'I am deserving of clear requirements.',
  'My logs are informative and helpful.',
  'I release my attachment to perfect code.',
  'I trust the process (and the tests).',
];

/**
 * Simple deterministic hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded pseudo-random number generator
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Pick random item from array using seeded random
 */
function pick<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

export interface HoroscopeReading {
  date: string;
  codebaseName: string;
  zodiac: { sign: string; emoji: string; trait: string };
  mercury: string;
  starSuggests: string;
  luckyFile: string;
  unluckyFile: string;
  powerMove: string;
  compatible: string;
  avoid: string;
  affirmation: string;
}

/**
 * Generate horoscope for a codebase
 */
export function generateHoroscope(graph: KnowledgeGraph): HoroscopeReading {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';

  // Create deterministic seed from date + codebase name
  const seed = simpleHash(`${dateStr}-${codebaseName}`);
  const random = seededRandom(seed);

  // Determine zodiac based on codebase characteristics
  // Use creation date hints or fall back to name-based selection
  const zodiacIndex = simpleHash(codebaseName) % zodiacSigns.length;
  const zodiac = zodiacSigns[zodiacIndex];

  // Find a "lucky file" - prefer actual files from the codebase
  const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
  let luckyFile = 'src/index.ts';
  if (fileNodes.length > 0) {
    const luckyIndex = Math.floor(random() * fileNodes.length);
    luckyFile = fileNodes[luckyIndex].filePath;
  }

  return {
    date: today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    codebaseName,
    zodiac,
    mercury: pick(mercuryRetrogrades, random),
    starSuggests: pick(starSuggests, random),
    luckyFile,
    unluckyFile: pick(unluckyFileComments, random),
    powerMove: pick(powerMoves, random),
    compatible: pick(compatibilities, random),
    avoid: pick(avoidances, random),
    affirmation: pick(affirmations, random),
  };
}

/**
 * Format horoscope as string output
 */
export function formatHoroscope(reading: HoroscopeReading): string {
  const lines: string[] = [];

  lines.push(`\ud83d\udd2e CODEBASE HOROSCOPE - ${reading.date}`);
  lines.push('');
  lines.push(
    `${reading.zodiac.emoji} Your codebase is a ${reading.zodiac.sign.toUpperCase()} (${reading.zodiac.trait})`
  );
  lines.push('');
  lines.push("Today's reading:");
  lines.push('');
  lines.push(reading.mercury);
  lines.push(`The stars suggest: ${reading.starSuggests}`);
  lines.push('');
  lines.push(`\ud83d\udcab Lucky file: ${reading.luckyFile}`);
  lines.push(`\u26a0\ufe0f  Unlucky file: ${reading.unluckyFile}`);
  lines.push(`\ud83c\udfaf Power move: ${reading.powerMove}`);
  lines.push(`\ud83d\udc95 Compatible with: ${reading.compatible}`);
  lines.push(`\ud83d\udeab Avoid: ${reading.avoid}`);
  lines.push('');
  lines.push("Today's affirmation:");
  lines.push(`"${reading.affirmation}"`);

  return lines.join('\n');
}
