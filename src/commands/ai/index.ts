/**
 * AI commands - ask, search
 */

import type { Command } from 'commander';
import { register as registerAsk } from './ask.js';
import { register as registerSearch } from './search.js';

export function registerAICommands(program: Command): void {
  registerAsk(program);
  registerSearch(program);
}
