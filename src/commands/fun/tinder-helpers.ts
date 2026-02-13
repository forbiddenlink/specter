/**
 * Helper functions for tinder command
 * Extracts complex flag and bio generation logic
 */

export interface TinderData {
  healthScore: number;
  functionCount: number;
  hotspotCount: number;
  langPercent: number;
  primaryLang: string;
  busFactorValue: number;
  hasGitHistory: boolean;
  hasHelpers: boolean;
  hasUtils: boolean;
  circularCount: number;
  edgeCount: number;
}

/**
 * Generate bio lines based on code health metrics
 */
export function generateBioLines(data: TinderData): string[] {
  const lines: string[] = [];

  // Health-based intro
  if (data.healthScore >= 80) {
    lines.push('Healthy, well-maintained, and looking for');
    lines.push('developers who appreciate clean code.');
  } else if (data.healthScore >= 60) {
    lines.push('Complex on the inside, well-documented');
    lines.push('on the outside. Looking for developers');
    lines.push('who appreciate a good type system.');
  } else {
    lines.push("I'm a work in progress, but I've got");
    lines.push('potential. Seeking patient developers');
    lines.push('who enjoy a challenge.');
  }

  lines.push('');

  // Function count description
  if (data.functionCount > 50) {
    lines.push(`I have ${data.functionCount} functions and I know how to`);
    lines.push('use them.');
  } else if (data.functionCount > 20) {
    lines.push(`Compact but capable with ${data.functionCount} functions.`);
  } else {
    lines.push(`Small but mighty with ${data.functionCount} functions.`);
  }

  // Hotspot mention
  if (data.hotspotCount > 0) {
    lines.push(`Swipe right if you can handle my`);
    lines.push(`${data.hotspotCount} complexity hotspot${data.hotspotCount !== 1 ? 's' : ''}. `);
  }

  return lines;
}

/**
 * Generate green flags based on positive attributes
 */
export function generateGreenFlags(data: TinderData): string[] {
  const flags: string[] = [];

  // Language
  if (data.langPercent >= 90) {
    flags.push(`${data.langPercent}% ${data.primaryLang} (I know my types)`);
  } else if (data.langPercent >= 70) {
    flags.push(`${data.langPercent}% ${data.primaryLang} (mostly typed)`);
  }

  // Git history
  if (data.hasGitHistory) {
    flags.push("Active git history (I'm not ghosting)");
  }

  // Health score
  if (data.healthScore >= 80) {
    flags.push(`Health score ${Math.round(data.healthScore)} (I work out)`);
  } else if (data.healthScore >= 60) {
    flags.push(`Health score ${Math.round(data.healthScore)} (room to grow)`);
  }

  // Complexity
  if (data.hotspotCount === 0) {
    flags.push('No critical complexity (drama-free)');
  }

  // Bus factor
  if (data.busFactorValue >= 3) {
    flags.push(`Bus factor ${data.busFactorValue.toFixed(1)} (team player)`);
  }

  // Default fallback
  if (flags.length === 0) {
    flags.push("Still standing (I'm resilient)");
  }

  return flags;
}

/**
 * Generate red flags based on negative attributes
 */
export function generateRedFlags(data: TinderData): string[] {
  const flags: string[] = [];

  // File organization
  if (data.hasHelpers) {
    flags.push('helpers.ts exists (I have baggage)');
  }
  if (data.hasUtils) {
    flags.push('utils/ folder (some skeletons)');
  }

  // Team knowledge
  if (data.busFactorValue < 2) {
    flags.push(`Bus factor ${data.busFactorValue.toFixed(1)} (attachment issues)`);
  }

  // Coupling
  if (data.circularCount > 0) {
    flags.push(`${data.circularCount} circular dependencies (it's complex)`);
  }

  // Complexity
  if (data.hotspotCount > 10) {
    flags.push(`${data.hotspotCount} complexity hotspots (high maintenance)`);
  }

  // Health
  if (data.healthScore < 60) {
    flags.push(`Health score ${Math.round(data.healthScore)} (needs TLC)`);
  }

  // Default fallback
  if (flags.length === 0) {
    flags.push("Too good to be true? (I'm real!)");
  }

  return flags;
}

/**
 * Generate conversation starters
 */
export function generateConversationStarters(data: TinderData): string[] {
  const starters: string[] = [];

  starters.push('"What\'s your complexity score?"');
  starters.push('"Come here often... to refactor?"');

  if (data.edgeCount > 100) {
    starters.push('"Is that a knowledge graph or are you');
    starters.push(' just happy to see me?"');
  } else {
    starters.push('"Want to see my import graph?"');
  }

  return starters;
}
