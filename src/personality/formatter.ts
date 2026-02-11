/**
 * Personality Formatter
 *
 * Transforms output based on personality mode.
 */

import type { PersonalityMode } from './types.js';
import { getPersonality } from './modes.js';

// Get a random phrase from an array
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Format a health score comment
export function formatHealthComment(
  score: number,
  personality: PersonalityMode = 'default'
): string {
  const p = getPersonality(personality);

  if (score >= 80) {
    return pick(p.phrases.positive);
  } else if (score >= 50) {
    return pick(p.phrases.neutral);
  } else {
    return pick(p.phrases.negative);
  }
}

// Format a complexity comment
export function formatComplexityComment(
  complexity: number,
  personality: PersonalityMode = 'default'
): string {
  const p = getPersonality(personality);

  if (complexity <= 5) {
    return p.name === 'minimalist' ? 'Low.' : pick(p.phrases.positive);
  } else if (complexity <= 15) {
    return p.name === 'minimalist' ? 'Medium.' : pick(p.phrases.neutral);
  } else {
    return p.name === 'minimalist' ? 'High.' : pick(p.phrases.negative);
  }
}

// Format a summary with personality
export function formatSummary(
  data: {
    stats: { files: number; lines: number; functions: number; classes: number };
    healthScore: number;
    complexityIssues: number;
  },
  personality: PersonalityMode = 'default'
): string {
  const p = getPersonality(personality);

  if (p.name === 'minimalist') {
    return `Files: ${data.stats.files}. Lines: ${data.stats.lines}. Health: ${data.healthScore}/100.`;
  }

  let summary = '';
  if (p.phrases.greeting) {
    summary = p.phrases.greeting + '\n\n';
  }

  // Stats section
  summary += `I am ${data.stats.files} files, ${data.stats.lines.toLocaleString()} lines of code. `;
  summary += `I contain ${data.stats.functions} functions and ${data.stats.classes} classes.\n\n`;

  // Health comment
  summary += formatHealthComment(data.healthScore, personality) + '\n';

  // Complexity issues
  if (data.complexityIssues > 0) {
    if (p.name === 'cheerleader') {
      summary += `I have ${data.complexityIssues} areas where we can grow together!`;
    } else if (p.name === 'critic') {
      summary += `I have ${data.complexityIssues} complexity issues requiring attention.`;
    } else if (p.name === 'historian') {
      summary += `Over time, ${data.complexityIssues} areas have accumulated complexity.`;
    } else if (p.name === 'mentor') {
      summary += `I have ${data.complexityIssues} complex areas - each one has lessons to teach.`;
    } else {
      summary += `I have ${data.complexityIssues} complexity hotspots.`;
    }
  }

  // Closing
  const closing = pick(p.phrases.closing);
  if (closing) {
    summary += '\n\n' + closing;
  }

  return summary;
}

// Format a trend comment
export function formatTrendComment(
  direction: 'improving' | 'stable' | 'declining',
  changePercent: number,
  personality: PersonalityMode = 'default'
): string {
  const p = getPersonality(personality);

  if (p.name === 'minimalist') {
    return `Trend: ${direction}. Change: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
  }

  if (direction === 'improving') {
    if (p.name === 'cheerleader') return `Woohoo! I'm ${changePercent.toFixed(1)}% healthier!`;
    if (p.name === 'historian') return `My health has improved by ${changePercent.toFixed(1)}% - progress being made.`;
    if (p.name === 'critic') return `Improvement of ${changePercent.toFixed(1)}%. Acceptable.`;
    if (p.name === 'mentor') return `Notice how our health improved by ${changePercent.toFixed(1)}% - consistent effort pays off.`;
    return pick(p.phrases.positive);
  } else if (direction === 'declining') {
    if (p.name === 'cheerleader') return `We dipped ${Math.abs(changePercent).toFixed(1)}%, but we'll bounce back!`;
    if (p.name === 'critic') return `Declined by ${Math.abs(changePercent).toFixed(1)}%. This is concerning.`;
    if (p.name === 'historian') return `History shows a decline of ${Math.abs(changePercent).toFixed(1)}% - we should examine why.`;
    if (p.name === 'mentor') return `We've declined ${Math.abs(changePercent).toFixed(1)}% - let's understand what happened.`;
    return pick(p.phrases.negative);
  } else {
    if (p.name === 'cheerleader') return `Holding steady! Consistency is great!`;
    if (p.name === 'critic') return `No change. Stagnation is not progress.`;
    if (p.name === 'historian') return `My health has remained stable through this period.`;
    if (p.name === 'mentor') return `Stability can be good - it means we're maintaining quality.`;
    return pick(p.phrases.neutral);
  }
}

// Format a risk comment
export function formatRiskComment(
  level: 'low' | 'medium' | 'high' | 'critical',
  score: number,
  personality: PersonalityMode = 'default'
): string {
  const p = getPersonality(personality);

  if (p.name === 'minimalist') {
    return `Risk: ${level.toUpperCase()} (${score}/100)`;
  }

  if (level === 'low') {
    if (p.name === 'cheerleader') return `This change looks totally safe! Go for it!`;
    if (p.name === 'critic') return `Acceptable risk level. Proceed.`;
    if (p.name === 'historian') return `Based on past patterns, this change carries minimal risk.`;
    if (p.name === 'mentor') return `This is a low-risk change - a good opportunity to learn without consequences.`;
    return `This change looks safe to me. Low risk (${score}/100).`;
  } else if (level === 'medium') {
    if (p.name === 'cheerleader') return `Some things to watch, but you've got this!`;
    if (p.name === 'critic') return `Medium risk. Review before merging.`;
    if (p.name === 'historian') return `Changes of this scope have sometimes caused issues historically.`;
    if (p.name === 'mentor') return `Medium risk - a good opportunity to exercise caution and review thoroughly.`;
    return `Moderate risk (${score}/100). Worth reviewing carefully.`;
  } else if (level === 'high') {
    if (p.name === 'cheerleader') return `Big changes ahead! Let's make sure we're ready!`;
    if (p.name === 'critic') return `HIGH RISK. Multiple reviewers required.`;
    if (p.name === 'historian') return `Changes of this magnitude have historically needed extra attention.`;
    if (p.name === 'mentor') return `High risk change - let's walk through what could go wrong.`;
    return `High risk (${score}/100). Consider splitting this change.`;
  } else {
    if (p.name === 'cheerleader') return `Big changes ahead! Let's be extra careful and make this awesome!`;
    if (p.name === 'critic') return `CRITICAL: Risk score ${score}/100. Do not proceed without thorough review.`;
    if (p.name === 'historian') return `This level of change has historically been problematic. Proceed with extreme caution.`;
    if (p.name === 'mentor') return `Critical risk - let's understand all the implications before proceeding.`;
    return `CRITICAL: Very high risk (${score}/100). Please split this up or get multiple reviewers.`;
  }
}

// Apply personality to any output text
export function applyPersonality(
  text: string,
  personality: PersonalityMode = 'default'
): string {
  if (personality === 'minimalist') {
    // Strip to essentials - remove emojis, shorten
    return text
      .replace(/[^\x00-\x7F]+/g, '')  // Remove non-ASCII (emojis)
      .replace(/\.\s+/g, '. ')         // Compress whitespace
      .trim();
  }

  // For other personalities, we'd need more sophisticated NLP
  // For now, return as-is
  return text;
}
