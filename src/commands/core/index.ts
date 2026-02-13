/**
 * Core commands - scan, status, clean, init, demo
 */

import type { Command } from 'commander';
import { register as registerClean } from './clean.js';
import { register as registerDemo } from './demo.js';
import { register as registerDoctor } from './doctor.js';
import { register as registerInit } from './init.js';
import { register as registerInitHooks } from './init-hooks.js';
import { register as registerScan } from './scan.js';
import { register as registerStatus } from './status.js';

export function registerCoreCommands(program: Command): void {
  registerScan(program);
  registerStatus(program);
  registerClean(program);
  registerInit(program);
  registerDemo(program);
  registerInitHooks(program);
  registerDoctor(program);
}
