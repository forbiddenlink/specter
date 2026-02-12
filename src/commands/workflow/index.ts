/**
 * Workflow commands - precommit, morning, standup, predict, reviewers, watch, review,
 * dashboard, achievements
 */

import type { Command } from 'commander';
import { register as registerAchievements } from './achievements.js';
import { register as registerDashboard } from './dashboard.js';
import { register as registerMorning } from './morning.js';
import { register as registerPrecommit } from './precommit.js';
import { register as registerPredict } from './predict.js';
import { register as registerReview } from './review.js';
import { register as registerReviewers } from './reviewers.js';
import { register as registerStandup } from './standup.js';
import { register as registerWatch } from './watch.js';

export function registerWorkflowCommands(program: Command): void {
  registerPrecommit(program);
  registerMorning(program);
  registerStandup(program);
  registerPredict(program);
  registerReviewers(program);
  registerWatch(program);
  registerReview(program);
  registerDashboard(program);
  registerAchievements(program);
}
