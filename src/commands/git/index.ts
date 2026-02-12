/**
 * Git commands - changelog, breaking-changes, leaderboard
 */

import type { Command } from 'commander';
import { register as registerBreakingChanges } from './breaking-changes.js';
import { register as registerChangelog } from './changelog.js';
import { register as registerLeaderboard } from './leaderboard.js';

export function registerGitCommands(program: Command): void {
  registerChangelog(program);
  registerBreakingChanges(program);
  registerLeaderboard(program);
}
