/**
 * Analysis commands - health, hotspots, coupling, cycles, drift, velocity, cost, dora, bus-factor,
 * trends, risk, vitals, report, trajectory, who, why
 */

import type { Command } from 'commander';
import { register as registerBusFactor } from './bus-factor.js';
import { register as registerCost } from './cost.js';
import { register as registerCoupling } from './coupling.js';
import { register as registerCycles } from './cycles.js';
import { register as registerDora } from './dora.js';
import { register as registerDrift } from './drift.js';
import { register as registerHealth } from './health.js';
import { register as registerHotspots } from './hotspots.js';
import { register as registerReport } from './report.js';
import { register as registerRisk } from './risk.js';
import { register as registerTrajectory } from './trajectory.js';
import { register as registerTrends } from './trends.js';
import { register as registerVelocity } from './velocity.js';
import { register as registerVitals } from './vitals.js';
import { register as registerWho } from './who.js';
import { register as registerWhy } from './why.js';

export function registerAnalysisCommands(program: Command): void {
  registerHealth(program);
  registerHotspots(program);
  registerCoupling(program);
  registerCycles(program);
  registerDrift(program);
  registerVelocity(program);
  registerCost(program);
  registerDora(program);
  registerBusFactor(program);
  registerTrends(program);
  registerRisk(program);
  registerVitals(program);
  registerReport(program);
  registerTrajectory(program);
  registerWho(program);
  registerWhy(program);
}
