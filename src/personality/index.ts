/**
 * Personality Module
 *
 * Provides personality modes and mood system for the codebase voice.
 */

export {
  applyMood,
  applyPersonality,
  applyPersonalityWithMood,
  formatComplexityComment,
  formatHealthComment,
  formatRiskComment,
  formatSummary,
  formatSummaryWithMood,
  formatTrendComment,
  formatWithMood,
  getMood,
  getMoodDescription,
  getMoodIntensity,
  listMoods,
  type Mood,
  type MoodFormatterOptions,
} from './formatter.js';
export { getPersonality, listPersonalities, personalities } from './modes.js';
export {
  formatMoodStatus,
  getMoodPhrase,
} from './mood.js';
export type { FormatterOptions, PersonalityConfig, PersonalityMode } from './types.js';
