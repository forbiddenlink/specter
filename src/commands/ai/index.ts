/**
 * AI commands - ask, search, ai-ask, explain-hotspot, ai-commit, suggest-refactor, index, fix
 */

import type { Command } from 'commander';
import { register as registerAiAsk } from './ai-ask.js';
import { register as registerAiCommit } from './ai-commit.js';
import { register as registerAsk } from './ask.js';
import { register as registerExplainHotspot } from './explain-hotspot.js';
import { register as registerFix } from './fix.js';
import { register as registerIndex } from './index-cmd.js';
import { register as registerSearch } from './search.js';
import { register as registerSuggestRefactor } from './suggest-refactor.js';

export function registerAICommands(program: Command): void {
  // Natural language Q&A
  registerAsk(program);

  // Semantic search
  registerSearch(program);

  // AI-powered GitHub Copilot CLI commands
  registerAiAsk(program);
  registerExplainHotspot(program);
  registerAiCommit(program);
  registerSuggestRefactor(program);

  // Embedding index and fix suggestions
  registerIndex(program);
  registerFix(program);
}
