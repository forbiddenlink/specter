/**
 * Fortune / Tarot System
 *
 * Pattern-based predictions using tarot-style cards
 * themed around software development.
 */

import type { KnowledgeGraph } from './graph/types.js';

// The Major Arcana of Code
const majorArcana = [
  {
    number: 0,
    name: 'The Fool',
    code: 'THE JUNIOR DEV',
    upright: 'New beginnings, innocence, spontaneity. A fresh perspective approaches.',
    reversed: 'Recklessness, risk-taking, holding back. Beware of deploying on Friday.',
    advice: 'Embrace beginner\'s mind. The "dumb" questions often reveal hidden bugs.',
  },
  {
    number: 1,
    name: 'The Magician',
    code: 'THE FULL STACK',
    upright: 'Manifestation, resourcefulness, power. You have all the tools you need.',
    reversed: "Manipulation, poor planning, untapped talents. Don't overcomplicate.",
    advice: 'Master one thing before adding another framework to the stack.',
  },
  {
    number: 2,
    name: 'The High Priestess',
    code: 'THE DOCUMENTATION',
    upright: 'Intuition, sacred knowledge, divine feminine. The answer is in the docs.',
    reversed: 'Secrets, disconnection, withdrawal. RTFM before asking.',
    advice: 'Write the documentation you wish existed.',
  },
  {
    number: 3,
    name: 'The Empress',
    code: 'THE CODEBASE',
    upright: 'Femininity, beauty, nature, abundance. Your code is fertile ground.',
    reversed: 'Creative block, dependence, overbearing. Too many abstractions.',
    advice: "Nurture what you've built before adding more.",
  },
  {
    number: 4,
    name: 'The Emperor',
    code: 'THE ARCHITECTURE',
    upright: 'Authority, structure, control, fatherhood. Strong foundations.',
    reversed: 'Tyranny, rigidity, coldness. Overengineering detected.',
    advice: 'Good architecture enables; great architecture disappears.',
  },
  {
    number: 5,
    name: 'The Hierophant',
    code: 'THE SENIOR DEV',
    upright: 'Tradition, conformity, morality, ethics. Wisdom of experience.',
    reversed:
      'Rebellion, subversiveness, new approaches. Challenge the "we\'ve always done it this way."',
    advice: 'Respect the patterns, but know when to break them.',
  },
  {
    number: 6,
    name: 'The Lovers',
    code: 'THE MERGE CONFLICT',
    upright: 'Love, harmony, relationships, values alignment. Integration ahead.',
    reversed: 'Disharmony, imbalance, misalignment. Communication breakdown.',
    advice: 'Resolve conflicts early. The longer you wait, the harder it gets.',
  },
  {
    number: 7,
    name: 'The Chariot',
    code: 'THE SPRINT',
    upright: 'Control, willpower, success, action. Momentum is with you.',
    reversed: 'Opposition, lack of direction. Scope creep threatens.',
    advice: 'Stay focused. Velocity without direction is just spinning wheels.',
  },
  {
    number: 8,
    name: 'Strength',
    code: 'THE TEST SUITE',
    upright: 'Strength, courage, patience, control. Your tests will hold.',
    reversed: 'Weakness, self-doubt, lack of confidence. Coverage gaps lurk.',
    advice: "True strength is testing the edge cases you'd rather ignore.",
  },
  {
    number: 9,
    name: 'The Hermit',
    code: 'THE DEEP WORK',
    upright: 'Soul-searching, introspection, being alone. Focus time needed.',
    reversed: "Isolation, loneliness, withdrawal. Don't suffer in silence.",
    advice: 'Sometimes you need to close Slack and just code.',
  },
  {
    number: 10,
    name: 'Wheel of Fortune',
    code: 'THE DEPLOY',
    upright: 'Good luck, karma, life cycles, destiny. The release will go well.',
    reversed: 'Bad luck, resistance to change. Rollback plan ready?',
    advice: 'What goes up must come down. Plan for both.',
  },
  {
    number: 11,
    name: 'Justice',
    code: 'THE CODE REVIEW',
    upright: 'Justice, fairness, truth, law. Objective feedback incoming.',
    reversed: 'Unfairness, lack of accountability, dishonesty. Rubber-stamping.',
    advice: "Review others as you'd have them review you.",
  },
  {
    number: 12,
    name: 'The Hanged Man',
    code: 'THE BLOCKED PR',
    upright: 'Pause, surrender, letting go, new perspectives. Wait for clarity.',
    reversed: 'Stalling, needless sacrifice, fear of change. Ship it.',
    advice: 'Sometimes the best action is no action. Let it breathe.',
  },
  {
    number: 13,
    name: 'Death',
    code: 'THE DEPRECATION',
    upright: 'Endings, change, transformation. Out with the old.',
    reversed: 'Resistance to change, unable to move on. Legacy code clings.',
    advice: 'Every deprecation creates space for something better.',
  },
  {
    number: 14,
    name: 'Temperance',
    code: 'THE REFACTOR',
    upright: 'Balance, moderation, patience, purpose. Gradual improvement.',
    reversed: 'Imbalance, excess, lack of patience. Big bang rewrites fail.',
    advice: 'Small, consistent refactors beat heroic rewrites.',
  },
  {
    number: 15,
    name: 'The Devil',
    code: 'THE TECH DEBT',
    upright: 'Shadow self, attachment, addiction, restriction. Face your demons.',
    reversed: 'Releasing limiting beliefs, detachment. Freedom from legacy.',
    advice: 'Acknowledge the debt. Ignoring it only increases the interest.',
  },
  {
    number: 16,
    name: 'The Tower',
    code: 'THE OUTAGE',
    upright: 'Sudden change, upheaval, chaos, revelation. Crisis incoming.',
    reversed: 'Fear of change, avoiding disaster. Near miss.',
    advice: 'Every outage teaches. Document the postmortem.',
  },
  {
    number: 17,
    name: 'The Star',
    code: 'THE GREEN BUILD',
    upright: 'Hope, faith, purpose, renewal. All tests passing.',
    reversed: 'Lack of faith, despair, discouragement. Flaky tests.',
    advice: 'Trust the process. The pipeline will turn green.',
  },
  {
    number: 18,
    name: 'The Moon',
    code: 'THE BUG',
    upright: 'Illusion, fear, anxiety, subconscious. Something lurks beneath.',
    reversed: 'Release of fear, repressed emotion. Bug found and fixed.',
    advice: 'Trust your instincts. If something feels wrong, investigate.',
  },
  {
    number: 19,
    name: 'The Sun',
    code: 'THE SHIP',
    upright: 'Positivity, fun, warmth, success. Launch day energy.',
    reversed: 'Inner child, feeling down, overly optimistic. Reality check.',
    advice: 'Celebrate the wins. Shipping is an accomplishment.',
  },
  {
    number: 20,
    name: 'Judgement',
    code: 'THE RETROSPECTIVE',
    upright: 'Judgement, rebirth, inner calling. Time to reflect.',
    reversed: 'Self-doubt, refusal to self-examine. Skip the blame.',
    advice: 'Judge the code, not the coder. What did we learn?',
  },
  {
    number: 21,
    name: 'The World',
    code: 'THE RELEASE',
    upright: 'Completion, integration, accomplishment. A cycle ends.',
    reversed: 'Incompletion, shortcuts. Almost but not quite.',
    advice: 'Celebrate completion, then begin again.',
  },
];

export interface TarotCard {
  number: number;
  name: string;
  code: string;
  meaning: string;
  advice: string;
  reversed: boolean;
}

export interface TarotReading {
  date: string;
  codebaseName: string;
  spread: 'single' | 'three-card' | 'celtic-cross';
  cards: TarotCard[];
  interpretation: string;
}

/**
 * Simple deterministic hash
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Draw cards for a reading
 */
function drawCards(random: () => number, count: number, graph: KnowledgeGraph): TarotCard[] {
  const cards: TarotCard[] = [];
  const usedIndices = new Set<number>();

  // Bias card selection based on codebase characteristics
  const stats = {
    complexity: 0,
    fileCount: graph.metadata.fileCount,
    hasTests: Object.keys(graph.nodes).some((k) => k.includes('test')),
  };

  // Calculate average complexity if available
  const complexities = Object.values(graph.nodes)
    .filter((n) => n.complexity !== undefined)
    .map((n) => n.complexity as number);
  if (complexities.length > 0) {
    stats.complexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
  }

  for (let i = 0; i < count; i++) {
    let index: number;
    do {
      // Slight bias based on codebase state
      if (stats.complexity > 15 && random() < 0.3) {
        // High complexity? More likely to draw challenging cards
        index = [13, 15, 16, 18][Math.floor(random() * 4)] ?? 13; // Death, Devil, Tower, Moon
      } else if (stats.hasTests && random() < 0.2) {
        // Has tests? More positive cards
        index = [8, 17, 19][Math.floor(random() * 3)] ?? 8; // Strength, Star, Sun
      } else {
        index = Math.floor(random() * majorArcana.length);
      }
    } while (usedIndices.has(index));

    usedIndices.add(index);
    const arcana = majorArcana[index];
    if (!arcana) continue;
    const reversed = random() < 0.3; // 30% chance of reversal

    cards.push({
      number: arcana.number,
      name: arcana.name,
      code: arcana.code,
      meaning: reversed ? arcana.reversed : arcana.upright,
      advice: arcana.advice,
      reversed,
    });
  }

  return cards;
}

/**
 * Generate interpretation based on cards drawn
 */
function generateInterpretation(cards: TarotCard[], spread: string): string {
  if (spread === 'single') {
    const card = cards[0];
    if (!card) return 'No card drawn.';
    return `The ${card.code} speaks directly to your current situation. ${card.meaning}`;
  }

  if (spread === 'three-card') {
    const past = cards[0];
    const present = cards[1];
    const future = cards[2];
    if (!past || !present || !future) return 'Incomplete reading.';
    return (
      `PAST (${past.code}): ${past.meaning}\n\n` +
      `PRESENT (${present.code}): ${present.meaning}\n\n` +
      `FUTURE (${future.code}): ${future.meaning}`
    );
  }

  return cards.map((c) => `${c.code}: ${c.meaning}`).join('\n\n');
}

/**
 * Generate a tarot reading
 */
export function generateReading(
  graph: KnowledgeGraph,
  spread: 'single' | 'three-card' = 'three-card'
): TarotReading {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';

  // Deterministic seed for today's reading
  const seed = simpleHash(`${dateStr}-${codebaseName}-tarot`);
  const random = seededRandom(seed);

  const cardCount = spread === 'single' ? 1 : 3;
  const cards = drawCards(random, cardCount, graph);
  const interpretation = generateInterpretation(cards, spread);

  return {
    date: today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    codebaseName,
    spread,
    cards,
    interpretation,
  };
}

/**
 * Format a tarot card for display
 */
function formatCard(card: TarotCard, position?: string): string[] {
  const lines: string[] = [];
  const width = 44;

  lines.push(`┌${'─'.repeat(width)}┐`);

  // Card number and name
  const numeral = [
    '0',
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
    'XIII',
    'XIV',
    'XV',
    'XVI',
    'XVII',
    'XVIII',
    'XIX',
    'XX',
    'XXI',
  ][card.number];
  const header = `${numeral}. ${card.name}${card.reversed ? ' (Reversed)' : ''}`;
  lines.push(`│ ${header.padEnd(width - 1)}│`);

  // Code name
  lines.push(`│ ${card.code.padEnd(width - 1)}│`);
  lines.push(`│${'─'.repeat(width)}│`);

  // Position if provided
  if (position) {
    lines.push(`│ ${position.toUpperCase().padEnd(width - 1)}│`);
    lines.push(`│${' '.repeat(width)}│`);
  }

  // Meaning (wrapped)
  const meaningWords = card.meaning.split(' ');
  let currentLine = '';
  for (const word of meaningWords) {
    if (`${currentLine} ${word}`.length > width - 2) {
      lines.push(`│ ${currentLine.padEnd(width - 1)}│`);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) {
    lines.push(`│ ${currentLine.padEnd(width - 1)}│`);
  }

  lines.push(`│${' '.repeat(width)}│`);

  // Advice (wrapped)
  lines.push(`│ ${'💡 Advice:'.padEnd(width - 1)}│`);
  const adviceWords = card.advice.split(' ');
  currentLine = '';
  for (const word of adviceWords) {
    if (`${currentLine} ${word}`.length > width - 2) {
      lines.push(`│ ${currentLine.padEnd(width - 1)}│`);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) {
    lines.push(`│ ${currentLine.padEnd(width - 1)}│`);
  }

  lines.push(`└${'─'.repeat(width)}┘`);

  return lines;
}

/**
 * Format reading for display
 */
export function formatReading(reading: TarotReading): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════╗');
  lines.push('║           🔮 CODEBASE TAROT 🔮              ║');
  lines.push('╚══════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Reading for: ${reading.codebaseName}`);
  lines.push(`Date: ${reading.date}`);
  lines.push(
    `Spread: ${reading.spread === 'single' ? 'Single Card' : 'Three Card (Past-Present-Future)'}`
  );
  lines.push('');

  if (reading.spread === 'single') {
    const firstCard = reading.cards[0];
    if (firstCard) {
      lines.push(...formatCard(firstCard));
    }
  } else {
    const positions = ['Past', 'Present', 'Future'];
    for (let i = 0; i < reading.cards.length; i++) {
      const card = reading.cards[i];
      if (!card) continue;
      lines.push(...formatCard(card, positions[i]));
      if (i < reading.cards.length - 1) {
        lines.push('');
      }
    }
  }

  lines.push('');
  lines.push('═'.repeat(46));
  lines.push('Remember: The cards reflect the code,');
  lines.push('but you write the commits.');
  lines.push('═'.repeat(46));

  return lines.join('\n');
}
