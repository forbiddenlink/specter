/**
 * Mood System
 *
 * Dynamic mood modifiers that adjust personality based on codebase health.
 * Mood is layered on top of personality modes to add emotional context.
 */

import type { PersonalityMode } from './types.js';

/**
 * Mood states based on codebase health score
 */
export type Mood = 'confident' | 'stable' | 'anxious' | 'distressed';

/**
 * Mood-specific phrase modifiers
 */
interface MoodPhrases {
  prefix: string[];
  suffix: string[];
  interjections: string[];
}

const moodPhrases: Record<Mood, MoodPhrases> = {
  confident: {
    prefix: [
      "I'm feeling great today!",
      'Everything is running smoothly.',
      "At the top of my game here.",
      "I'm in excellent shape.",
    ],
    suffix: [
      "I've got this under control.",
      'Nothing to worry about.',
      'Keep up the great work!',
      "We're crushing it.",
    ],
    interjections: [
      '*flexes*',
      '*beams with pride*',
      '*stands tall*',
      '*confidently*',
    ],
  },
  stable: {
    prefix: [
      "Things are steady.",
      "I'm doing alright.",
      'All systems nominal.',
      "Holding together.",
    ],
    suffix: [
      'Carrying on as usual.',
      "We're in a good place.",
      'No major concerns.',
      'Staying the course.',
    ],
    interjections: [
      '*nods*',
      '*steady*',
      '*calmly*',
      '',
    ],
  },
  anxious: {
    prefix: [
      "I'm a bit worried, but...",
      'Things could be better...',
      "I've been feeling some strain lately...",
      'Not gonna lie, I have concerns...',
    ],
    suffix: [
      'Please keep an eye on me.',
      'I could use some attention.',
      "Let's work on this together.",
      'A little maintenance would help.',
    ],
    interjections: [
      '*nervously*',
      '*glances around*',
      '*fidgets*',
      '*bites lip*',
    ],
  },
  distressed: {
    prefix: [
      'Please help me...',
      "I'm really struggling here...",
      'Things have gotten out of hand...',
      'I need your attention urgently...',
    ],
    suffix: [
      "I can't keep going like this.",
      'Please, I need care.',
      "This is becoming existential for me.",
      "Don't let me fall apart.",
    ],
    interjections: [
      '*trembles*',
      '*desperately*',
      '*pleading*',
      '*on the verge*',
    ],
  },
};

/**
 * Determine mood based on health score
 */
export function getMood(healthScore: number): Mood {
  if (healthScore > 90) return 'confident';
  if (healthScore > 70) return 'stable';
  if (healthScore > 50) return 'anxious';
  return 'distressed';
}

/**
 * Get a random phrase from an array
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get mood intensity (0-1) based on how far into the mood range we are
 */
export function getMoodIntensity(healthScore: number): number {
  if (healthScore > 90) {
    // Confident: 90-100, intensity increases as we approach 100
    return (healthScore - 90) / 10;
  } else if (healthScore > 70) {
    // Stable: 70-90, fairly flat intensity
    return 0.5;
  } else if (healthScore > 50) {
    // Anxious: 50-70, intensity increases as we approach 50
    return (70 - healthScore) / 20;
  } else {
    // Distressed: 0-50, intensity increases as we approach 0
    return Math.min(1, (50 - healthScore) / 30);
  }
}

/**
 * Apply mood modifications to a message
 *
 * The mood system layers emotional context on top of personality.
 * For 'stable' mood, minimal modifications are made to preserve
 * the base personality's voice.
 */
export function applyMood(
  message: string,
  mood: Mood,
  personality: PersonalityMode = 'default'
): string {
  // Minimalist personality ignores mood - data only
  if (personality === 'minimalist') {
    return message;
  }

  // Stable mood doesn't modify much - personality speaks for itself
  if (mood === 'stable') {
    return message;
  }

  const phrases = moodPhrases[mood];
  const intensity = getMoodIntensity(
    mood === 'confident' ? 95 : mood === 'anxious' ? 60 : 25
  );

  let result = message;

  // Add prefix based on intensity
  if (intensity > 0.3 && Math.random() < 0.7) {
    const prefix = pick(phrases.prefix);
    result = `${prefix} ${result}`;
  }

  // Add suffix for higher intensity
  if (intensity > 0.5 && Math.random() < 0.5) {
    const suffix = pick(phrases.suffix);
    result = `${result} ${suffix}`;
  }

  // Add interjections for distressed mood (more dramatic)
  if (mood === 'distressed' && Math.random() < 0.4) {
    const interjection = pick(phrases.interjections.filter(i => i !== ''));
    if (interjection) {
      result = `${interjection} ${result}`;
    }
  }

  return result;
}

/**
 * Get a mood-appropriate phrase
 */
export function getMoodPhrase(mood: Mood, type: 'prefix' | 'suffix' | 'interjection'): string {
  const phrases = moodPhrases[mood];
  if (type === 'interjection') {
    return pick(phrases.interjections);
  }
  return pick(type === 'prefix' ? phrases.prefix : phrases.suffix);
}

/**
 * Format mood as a status indicator
 */
export function formatMoodStatus(mood: Mood): string {
  switch (mood) {
    case 'confident':
      return 'CONFIDENT';
    case 'stable':
      return 'STABLE';
    case 'anxious':
      return 'ANXIOUS';
    case 'distressed':
      return 'DISTRESSED';
  }
}

/**
 * Get mood description for display
 */
export function getMoodDescription(mood: Mood): string {
  switch (mood) {
    case 'confident':
      return 'The codebase is thriving and full of confidence';
    case 'stable':
      return 'The codebase is in a stable, healthy state';
    case 'anxious':
      return 'The codebase is showing signs of stress';
    case 'distressed':
      return 'The codebase is in critical condition and needs attention';
  }
}

/**
 * List all available moods
 */
export function listMoods(): Mood[] {
  return ['confident', 'stable', 'anxious', 'distressed'];
}
