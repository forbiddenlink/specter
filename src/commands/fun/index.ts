/**
 * Fun commands - roast, horoscope, fortune, seance, wrapped, origin, dna, meme,
 * tinder, confess, obituary, blame-game
 */

import type { Command } from 'commander';
import { register as registerBlameGame } from './blame-game.js';
import { register as registerConfess } from './confess.js';
import { register as registerDna } from './dna.js';
import { register as registerFortune } from './fortune.js';
import { register as registerHoroscope } from './horoscope.js';
import { register as registerMeme } from './meme.js';
import { register as registerObituary } from './obituary.js';
import { register as registerOrigin } from './origin.js';
import { register as registerRoast } from './roast.js';
import { register as registerSeance } from './seance.js';
import { register as registerTinder } from './tinder.js';
import { register as registerWrapped } from './wrapped.js';

export function registerFunCommands(program: Command): void {
  registerRoast(program);
  registerHoroscope(program);
  registerFortune(program);
  registerSeance(program);
  registerWrapped(program);
  registerOrigin(program);
  registerDna(program);
  registerMeme(program);
  registerTinder(program);
  registerConfess(program);
  registerObituary(program);
  registerBlameGame(program);
}
