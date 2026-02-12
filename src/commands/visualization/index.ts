/**
 * Visualization commands - diagram, tour, zones, knowledge-map
 */

import type { Command } from 'commander';
import { register as registerDiagram } from './diagram.js';
import { register as registerKnowledgeMap } from './knowledge-map.js';
import { register as registerTour } from './tour.js';
import { register as registerZones } from './zones.js';

export function registerVisualizationCommands(program: Command): void {
  registerDiagram(program);
  registerTour(program);
  registerZones(program);
  registerKnowledgeMap(program);
}
