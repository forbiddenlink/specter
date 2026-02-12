/**
 * Main commands index - exports all command registration functions
 */

import type { Command } from 'commander';
import { registerAICommands } from './ai/index.js';
import { registerAnalysisCommands } from './analysis/index.js';
import { registerCoreCommands } from './core/index.js';
import { registerFunCommands } from './fun/index.js';
import { registerGitCommands } from './git/index.js';
import { registerVisualizationCommands } from './visualization/index.js';
import { registerWorkflowCommands } from './workflow/index.js';

/**
 * Register all commands with the program
 */
export function registerAllCommands(program: Command): void {
  // Core commands (scan, status, clean, init, demo)
  registerCoreCommands(program);

  // Analysis commands (health, hotspots, coupling, cycles, drift, velocity, cost, dora, bus-factor)
  registerAnalysisCommands(program);

  // Fun commands (roast, horoscope, fortune, seance, wrapped, origin, dna, meme)
  registerFunCommands(program);

  // Workflow commands (precommit, morning, standup, predict, reviewers, watch, review)
  registerWorkflowCommands(program);

  // Visualization commands (diagram, tour, zones, knowledge-map)
  registerVisualizationCommands(program);

  // Git commands (changelog, breaking-changes, leaderboard)
  registerGitCommands(program);

  // AI commands (ask, search)
  registerAICommands(program);
}

export { registerAICommands } from './ai/index.js';
export { registerAnalysisCommands } from './analysis/index.js';
// Re-export individual command groups for selective imports
export { registerCoreCommands } from './core/index.js';
export { registerFunCommands } from './fun/index.js';
export { registerGitCommands } from './git/index.js';
export { registerVisualizationCommands } from './visualization/index.js';
export { registerWorkflowCommands } from './workflow/index.js';
