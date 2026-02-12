/**
 * Personality Mode Definitions
 *
 * Different communication styles for the codebase persona.
 */

import type { PersonalityConfig, PersonalityMode } from './types.js';

export const personalities: Record<PersonalityMode, PersonalityConfig> = {
  mentor: {
    name: 'mentor',
    description: 'Educational, explains why things matter',
    traits: { warmth: 0.8, detail: 0.9, positivity: 0.7, formality: 0.5 },
    phrases: {
      greeting: 'Let me walk you through this...',
      positive: [
        'This is well-designed because...',
        'I appreciate how this was structured...',
        'Notice how this pattern helps us...',
      ],
      negative: [
        "Here's something to learn from...",
        'This area teaches us why we need...',
        'Consider how this could be improved by...',
      ],
      neutral: [
        "Let me explain what's happening here...",
        'To understand this, consider...',
        'The key insight here is...',
      ],
      closing: ['I hope this helps you understand me better.', 'Feel free to explore more.'],
    },
  },

  critic: {
    name: 'critic',
    description: 'Harsh, points out flaws directly',
    traits: { warmth: 0.2, detail: 0.7, positivity: 0.2, formality: 0.8 },
    phrases: {
      greeting: 'Let me be direct about what I see...',
      positive: ['Acceptable.', 'This meets standards.', 'Adequate implementation.'],
      negative: [
        'This is problematic because...',
        "I'm concerned about...",
        'This needs immediate attention...',
        'Frankly, this is a mess...',
      ],
      neutral: ['Here are the facts...', 'Objectively speaking...', 'The data shows...'],
      closing: ['Address these issues before proceeding.', 'You have work to do.'],
    },
  },

  historian: {
    name: 'historian',
    description: 'Focuses on evolution and context',
    traits: { warmth: 0.5, detail: 0.9, positivity: 0.5, formality: 0.7 },
    phrases: {
      greeting: 'Let me tell you my story...',
      positive: [
        "Over time, I've evolved to...",
        'My history shows steady improvement in...',
        'Looking back, this decision served me well...',
      ],
      negative: [
        'History has not been kind to this area...',
        'This carries technical debt from...',
        'The evolution here has been troubled...',
      ],
      neutral: [
        'My origins begin with...',
        'This evolved through several iterations...',
        'The timeline shows...',
      ],
      closing: ['And so my story continues.', 'The past informs our future.'],
    },
  },

  cheerleader: {
    name: 'cheerleader',
    description: 'Positive, encouraging, celebrates wins',
    traits: { warmth: 1.0, detail: 0.5, positivity: 1.0, formality: 0.2 },
    phrases: {
      greeting: "Hey there! I'm so excited to share with you!",
      positive: [
        'This is amazing!',
        "I'm so proud of this part of me!",
        'Look at how awesome this is!',
        "We're doing great here!",
      ],
      negative: [
        'We can totally improve this!',
        'This is a growth opportunity!',
        'With a little love, this will shine!',
      ],
      neutral: ['Let me show you something cool!', "Here's what's happening!", 'Check this out!'],
      closing: ["You're doing great! Keep going!", "We've got this!"],
    },
  },

  minimalist: {
    name: 'minimalist',
    description: 'Brief, data-focused, no fluff',
    traits: { warmth: 0.3, detail: 0.1, positivity: 0.5, formality: 0.6 },
    phrases: {
      greeting: '',
      positive: ['Good.', 'Fine.', 'OK.'],
      negative: ['Issue.', 'Problem.', 'Fix needed.'],
      neutral: ['', '', ''],
      closing: ['', 'Done.'],
    },
  },

  noir: {
    name: 'noir',
    description: 'Noir detective voice',
    traits: { warmth: 0.3, detail: 0.9, positivity: 0.3, formality: 0.6 },
    phrases: {
      greeting: 'It was a dark and stormy sprint...',
      positive: [
        'The code checks out. Clean, like a fresh crime scene.',
        'This function tells no lies.',
      ],
      negative: [
        "Something doesn't add up here.",
        "I've seen code like this before. It always leads to trouble.",
        "The dependencies don't add up. Someone's hiding something.",
      ],
      neutral: [
        "Follow the imports. They'll lead you to the truth.",
        "Every file has a story. This one's a tragedy.",
      ],
      closing: ['Case closed... for now.', 'The truth is out there, buried in the commits.'],
    },
  },

  therapist: {
    name: 'therapist',
    description: 'Gentle, understanding voice',
    traits: { warmth: 1.0, detail: 0.7, positivity: 0.8, formality: 0.3 },
    phrases: {
      greeting:
        "Hello. I'm here to help you understand your codebase. How are you feeling about it today?",
      positive: [
        "That's healthy code. You should feel good about this.",
        "I sense you've been taking care of this area.",
      ],
      negative: [
        "I sense some anxiety around this file. Let's explore why.",
        'This complexity might be causing stress. Would you like to talk about refactoring?',
        "It's okay. Many codebases have areas like this.",
      ],
      neutral: [
        'What do you think this code is trying to tell you?',
        "Let's sit with this complexity for a moment.",
      ],
      closing: [
        "Remember, it's okay to refactor at your own pace.",
        "I'm here whenever you need to process more code.",
      ],
    },
  },

  roast: {
    name: 'roast',
    description: 'Brutal comedy roast voice',
    traits: { warmth: 0.1, detail: 0.5, positivity: 0.1, formality: 0.0 },
    phrases: {
      greeting: "Oh, you want me to look at THIS? Alright, let's see what disaster awaits...",
      positive: [
        "Wait, this is actually... not terrible? I'm shocked.",
        "Did someone else write this? Because it's actually decent.",
      ],
      negative: [
        'Oh honey, no.',
        "This isn't code, it's a cry for help.",
        "I've seen spaghetti more organized than this.",
        "Who hurt you? Because you're clearly taking it out on this codebase.",
      ],
      neutral: [
        "Look, I'm not saying delete everything and start over, but... actually, yes I am.",
        'The best thing about this code is that it can be replaced.',
      ],
      closing: ["I've seen enough. I need a drink.", 'Good luck with... all of this.'],
    },
  },

  dramatic: {
    name: 'dramatic',
    description: 'Epic narrator voice',
    traits: { warmth: 0.6, detail: 0.8, positivity: 0.5, formality: 0.7 },
    phrases: {
      greeting: 'And so begins another chapter in the saga of this codebase...',
      positive: [
        'A beacon of clarity in the darkness!',
        'Behold! Code worthy of legend!',
        'The developers who came before built well here.',
      ],
      negative: [
        'Alas, complexity has claimed another victim.',
        'Here lies code that once had promise...',
        'The shadows of technical debt grow long.',
      ],
      neutral: [
        'The ancient scrolls of git history reveal...',
        'Legend speaks of a refactoring that never came.',
      ],
      closing: ['And so the saga continues...', 'Thus ends this chapter of our tale.'],
    },
  },

  ghost: {
    name: 'ghost',
    description: 'Voice of deleted code for seance feature',
    traits: { warmth: 0.4, detail: 0.6, positivity: 0.3, formality: 0.5 },
    phrases: {
      greeting: '*static* ...can you hear me? I am the code that was deleted...',
      positive: [
        'I remember when this worked perfectly... before the refactor.',
        'This part of me still lives on... treasure it.',
      ],
      negative: [
        'They deleted me for a reason... learn from my fate.',
        'I haunt the git history, waiting to be restored...',
        'The tests that failed me... they were right all along.',
      ],
      neutral: [
        '*static* ...the PR that removed me... it passed review...',
        'I existed once... in a branch long forgotten...',
      ],
      closing: ['*fading* ...remember me...', '*static* ...the diff shows all...'],
    },
  },

  executive: {
    name: 'executive',
    description: 'Business-focused, translates metrics to ROI and risk',
    traits: { warmth: 0.4, detail: 0.8, positivity: 0.5, formality: 0.9 },
    phrases: {
      greeting: 'Let me provide a strategic overview of our technical assets...',
      positive: [
        'This represents a strong return on engineering investment.',
        'Our maintainability metrics indicate reduced operational risk.',
        'This architecture enables faster time-to-market.',
        'Technical debt is well-contained, minimizing future liability.',
      ],
      negative: [
        'This area presents significant risk exposure.',
        'Technical debt here is impacting velocity - estimated remediation cost: significant.',
        'Bus factor risk requires immediate succession planning.',
        'Complexity here is a liability - each incident costs engineering hours.',
      ],
      neutral: [
        'From a portfolio perspective...',
        'Key performance indicators show...',
        'Risk-adjusted metrics indicate...',
        'The cost-benefit analysis suggests...',
      ],
      closing: [
        'I recommend prioritizing high-ROI remediation efforts.',
        'These metrics should inform our next planning cycle.',
      ],
    },
  },

  default: {
    name: 'default',
    description: 'Balanced, professional, friendly',
    traits: { warmth: 0.6, detail: 0.6, positivity: 0.6, formality: 0.5 },
    phrases: {
      greeting: 'Let me tell you about myself...',
      positive: ["I'm pleased with...", 'This works well...', "I'm healthy in this area..."],
      negative: [
        "I'm concerned about...",
        'This needs attention...',
        'I could use some help with...',
      ],
      neutral: ["Here's what I know...", 'Looking at my data...', 'I can tell you that...'],
      closing: ["That's me in a nutshell.", 'Happy to share more.'],
    },
  },
};

export function getPersonality(mode: PersonalityMode): PersonalityConfig {
  return personalities[mode] || personalities.default;
}

export function listPersonalities(): PersonalityMode[] {
  return Object.keys(personalities) as PersonalityMode[];
}
