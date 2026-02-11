/**
 * Personality Types
 *
 * Defines personality modes for the codebase voice.
 */

export type PersonalityMode = 'mentor' | 'critic' | 'historian' | 'cheerleader' | 'minimalist' | 'default';

export interface PersonalityConfig {
  name: PersonalityMode;
  description: string;
  traits: {
    warmth: number;       // 0-1: cold to warm
    detail: number;       // 0-1: brief to verbose
    positivity: number;   // 0-1: critical to encouraging
    formality: number;    // 0-1: casual to formal
  };
  phrases: {
    greeting: string;
    positive: string[];
    negative: string[];
    neutral: string[];
    closing: string[];
  };
}

export interface FormatterOptions {
  personality: PersonalityMode;
  includeEmoji?: boolean;
  maxLength?: number;
}
