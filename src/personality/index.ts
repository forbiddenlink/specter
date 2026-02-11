/**
 * Personality Module
 *
 * Provides personality modes for the codebase voice.
 */

export type { PersonalityMode, PersonalityConfig, FormatterOptions } from './types.js';
export { personalities, getPersonality, listPersonalities } from './modes.js';
export {
  formatHealthComment,
  formatComplexityComment,
  formatSummary,
  formatTrendComment,
  formatRiskComment,
  applyPersonality,
} from './formatter.js';
