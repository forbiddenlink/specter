/**
 * Personality Mode Definitions
 *
 * Different communication styles for the codebase persona.
 */

import type { PersonalityMode, PersonalityConfig } from './types.js';

export const personalities: Record<PersonalityMode, PersonalityConfig> = {
  mentor: {
    name: 'mentor',
    description: 'Educational, explains why things matter',
    traits: { warmth: 0.8, detail: 0.9, positivity: 0.7, formality: 0.5 },
    phrases: {
      greeting: "Let me walk you through this...",
      positive: [
        "This is well-designed because...",
        "I appreciate how this was structured...",
        "Notice how this pattern helps us...",
      ],
      negative: [
        "Here's something to learn from...",
        "This area teaches us why we need...",
        "Consider how this could be improved by...",
      ],
      neutral: [
        "Let me explain what's happening here...",
        "To understand this, consider...",
        "The key insight here is...",
      ],
      closing: [
        "I hope this helps you understand me better.",
        "Feel free to explore more.",
      ],
    },
  },

  critic: {
    name: 'critic',
    description: 'Harsh, points out flaws directly',
    traits: { warmth: 0.2, detail: 0.7, positivity: 0.2, formality: 0.8 },
    phrases: {
      greeting: "Let me be direct about what I see...",
      positive: [
        "Acceptable.",
        "This meets standards.",
        "Adequate implementation.",
      ],
      negative: [
        "This is problematic because...",
        "I'm concerned about...",
        "This needs immediate attention...",
        "Frankly, this is a mess...",
      ],
      neutral: [
        "Here are the facts...",
        "Objectively speaking...",
        "The data shows...",
      ],
      closing: [
        "Address these issues before proceeding.",
        "You have work to do.",
      ],
    },
  },

  historian: {
    name: 'historian',
    description: 'Focuses on evolution and context',
    traits: { warmth: 0.5, detail: 0.9, positivity: 0.5, formality: 0.7 },
    phrases: {
      greeting: "Let me tell you my story...",
      positive: [
        "Over time, I've evolved to...",
        "My history shows steady improvement in...",
        "Looking back, this decision served me well...",
      ],
      negative: [
        "History has not been kind to this area...",
        "This carries technical debt from...",
        "The evolution here has been troubled...",
      ],
      neutral: [
        "My origins begin with...",
        "This evolved through several iterations...",
        "The timeline shows...",
      ],
      closing: [
        "And so my story continues.",
        "The past informs our future.",
      ],
    },
  },

  cheerleader: {
    name: 'cheerleader',
    description: 'Positive, encouraging, celebrates wins',
    traits: { warmth: 1.0, detail: 0.5, positivity: 1.0, formality: 0.2 },
    phrases: {
      greeting: "Hey there! I'm so excited to share with you!",
      positive: [
        "This is amazing!",
        "I'm so proud of this part of me!",
        "Look at how awesome this is!",
        "We're doing great here!",
      ],
      negative: [
        "We can totally improve this!",
        "This is a growth opportunity!",
        "With a little love, this will shine!",
      ],
      neutral: [
        "Let me show you something cool!",
        "Here's what's happening!",
        "Check this out!",
      ],
      closing: [
        "You're doing great! Keep going!",
        "We've got this!",
      ],
    },
  },

  minimalist: {
    name: 'minimalist',
    description: 'Brief, data-focused, no fluff',
    traits: { warmth: 0.3, detail: 0.1, positivity: 0.5, formality: 0.6 },
    phrases: {
      greeting: "",
      positive: ["Good.", "Fine.", "OK."],
      negative: ["Issue.", "Problem.", "Fix needed."],
      neutral: ["", "", ""],
      closing: ["", "Done."],
    },
  },

  default: {
    name: 'default',
    description: 'Balanced, professional, friendly',
    traits: { warmth: 0.6, detail: 0.6, positivity: 0.6, formality: 0.5 },
    phrases: {
      greeting: "Let me tell you about myself...",
      positive: [
        "I'm pleased with...",
        "This works well...",
        "I'm healthy in this area...",
      ],
      negative: [
        "I'm concerned about...",
        "This needs attention...",
        "I could use some help with...",
      ],
      neutral: [
        "Here's what I know...",
        "Looking at my data...",
        "I can tell you that...",
      ],
      closing: [
        "That's me in a nutshell.",
        "Happy to share more.",
      ],
    },
  },
};

export function getPersonality(mode: PersonalityMode): PersonalityConfig {
  return personalities[mode] || personalities.default;
}

export function listPersonalities(): PersonalityMode[] {
  return Object.keys(personalities) as PersonalityMode[];
}
