/**
 * Vitals command - real-time vital signs dashboard
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { generateComplexityReport } from '../../analyzers/complexity.js';
import { showNextSteps } from '../../cli-utils.js';
import { getGraphStats } from '../../graph/builder.js';
import { loadGraph } from '../../graph/persistence.js';
import { loadSnapshots } from '../../history/storage.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { coloredSparkline } from '../../ui/index.js';
import {
  formatHealthIndicator,
  getBusFactorStatus,
  getComplexityStatus,
  getCoverageStatus,
  getDeadExportsStatus,
  getHealthStatus,
  makeBar,
  type VitalsMetrics,
} from './vitals-helpers.js';

export function register(program: Command): void {
  program
    .command('vitals')
    .alias('vit')
    .description('Show codebase vital signs')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--live', 'Live updating mode')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('vitals', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const report = generateComplexityReport(graph);
      const stats = getGraphStats(graph);

      // Get file paths for bus factor analysis
      const filePaths = Object.values(graph.nodes)
        .filter((n) => n.type === 'file')
        .map((n) => n.filePath);

      // Analyze bus factor
      const { analyzeKnowledgeDistribution } = await import('../../analyzers/knowledge.js');
      const busFactor = await analyzeKnowledgeDistribution(rootDir, filePaths, {
        maxCommits: 200,
      });

      // Calculate health score
      const healthScore = Math.max(0, 100 - report.averageComplexity * 5);

      // Count dead/unused exports
      const exportedNodes = Object.values(graph.nodes).filter(
        (n) => n.exported && n.type !== 'file'
      );
      const importEdges = graph.edges.filter((e) => e.type === 'imports');
      const importedIds = new Set(importEdges.map((e) => e.target));
      const deadExports = exportedNodes.filter((n) => !importedIds.has(n.id)).length;

      // Calculate coverage estimate (files with complexity data / total files)
      const filesWithComplexity = Object.values(graph.nodes).filter(
        (n) => n.type === 'file' && n.complexity !== undefined
      ).length;
      const coverageEstimate =
        stats.fileCount > 0 ? (filesWithComplexity / stats.fileCount) * 100 : 0;

      // Load snapshots for heartbeat sparkline
      const snapshots = await loadSnapshots(rootDir);

      // Get node health, bus factor, and compute metrics
      const metrics: VitalsMetrics = {
        healthScore,
        avgComplexity: report.averageComplexity,
        busFactorValue: busFactor.overallBusFactor || 0,
        deadExports,
        coverageEstimate,
        healthTrend:
          snapshots.length >= 2 && snapshots[0] && snapshots[1]
            ? snapshots[0].metrics.healthScore - snapshots[1].metrics.healthScore
            : undefined,
        fileCount: stats.fileCount,
      };

      // JSON output for CI/CD
      if (options.json) {
        outputJson('vitals', {
          healthScore: Math.round(metrics.healthScore),
          pulseStatus: getHealthStatus(metrics.healthScore).status,
          avgComplexity: metrics.avgComplexity,
          busFactor: metrics.busFactorValue,
          deadExports: metrics.deadExports,
          coverageEstimate: Math.round(metrics.coverageEstimate),
          stats: {
            fileCount: stats.fileCount,
            totalLines: stats.totalLines,
            nodeCount: stats.nodeCount,
            edgeCount: stats.edgeCount,
          },
          recentSnapshots: snapshots.slice(0, 5).map((s) => ({
            timestamp: s.timestamp,
            healthScore: s.metrics.healthScore,
          })),
        });
        return;
      }

      const heartbeatData = snapshots
        .slice(0, 30)
        .reverse()
        .map((s) => s.metrics.healthScore);

      const W = 51;
      const B = chalk.bold.magenta;

      // Get all status information
      const healthStatus = getHealthStatus(metrics.healthScore);
      const complexityStatus = getComplexityStatus(metrics.avgComplexity);
      const busFactorStatus = getBusFactorStatus(metrics.busFactorValue);
      const deadExportsStatus = getDeadExportsStatus(metrics.deadExports);
      const coverageStatus = getCoverageStatus(metrics.coverageEstimate);
      const healthIndicator = formatHealthIndicator(metrics.healthTrend);

      console.log();
      console.log(B(`╔${'═'.repeat(W)}╗`));

      // Header with pulse
      console.log(
        B('║') +
          chalk.bold.white('  SPECTER VITAL SIGNS') +
          '              ' +
          '❤️  ' +
          healthStatus.color(`PULSE: ${healthStatus.status}`) +
          B('║')
      );

      console.log(B(`╠${'═'.repeat(W)}╣`));
      console.log(B('║') + ' '.repeat(W) + B('║'));

      // Health
      console.log(
        B('║') +
          `  HEALTH      [` +
          healthStatus.color(makeBar(metrics.healthScore, 100, 10)) +
          `] ` +
          String(Math.round(metrics.healthScore)).padStart(2) +
          `/100   ` +
          healthIndicator +
          ' '.repeat(8) +
          B('║')
      );

      // Complexity
      console.log(
        B('║') +
          `  COMPLEXITY  [` +
          complexityStatus.color(makeBar(metrics.avgComplexity, 30, 10)) +
          `] ` +
          complexityStatus.status.padStart(2) +
          ` avg   ` +
          complexityStatus.color(complexityStatus.statusText) +
          ' '.repeat(4) +
          B('║')
      );

      // Bus factor
      console.log(
        B('║') +
          `  BUS FACTOR  [` +
          busFactorStatus.color(makeBar(metrics.busFactorValue, 5, 10)) +
          `] ` +
          busFactorStatus.status.padStart(3) +
          `      ` +
          busFactorStatus.color(busFactorStatus.statusText) +
          ' '.repeat(4) +
          B('║')
      );

      // Dead code
      console.log(
        B('║') +
          `  DEAD CODE   [` +
          deadExportsStatus.color(makeBar(deadExportsStatus.barValue, 20, 10)) +
          `] ` +
          deadExportsStatus.status.padStart(3) +
          ` exp  ` +
          deadExportsStatus.color(deadExportsStatus.statusText) +
          ' '.repeat(4) +
          B('║')
      );

      // Coverage estimate
      console.log(
        B('║') +
          `  COVERAGE    [` +
          coverageStatus.color(makeBar(metrics.coverageEstimate, 100, 10)) +
          `] ` +
          coverageStatus.percent.padStart(2) +
          `%      ` +
          coverageStatus.color(coverageStatus.statusText) +
          ' '.repeat(4) +
          B('║')
      );

      console.log(B('║') + ' '.repeat(W) + B('║'));
      console.log(B(`╠${'═'.repeat(W)}╣`));

      // Heartbeat sparkline
      console.log(`${B('║')}  💓 HEARTBEAT (last 30 scans)${' '.repeat(23)}${B('║')}`);

      if (heartbeatData.length >= 2) {
        const sparkline = coloredSparkline(heartbeatData, true);
        const sparklineVisibleLen = sparkline.replace(/\x1b\[[0-9;]*m/g, '').length;
        console.log(
          `${B('║')}  ${sparkline}${' '.repeat(Math.max(0, W - sparklineVisibleLen - 2))}${B('║')}`
        );
      } else {
        console.log(
          B('║') + chalk.dim('  (need more scans for heartbeat data)') + ' '.repeat(11) + B('║')
        );
      }

      console.log(B(`╠${'═'.repeat(W)}╣`));

      console.log(B(`╚${'═'.repeat(W)}╝`));
      console.log();

      // Show next steps suggestions
      if (!options.json) {
        const suggestions = [
          {
            description: 'Get detailed health metrics',
            command: 'specter health',
          },
          {
            description: 'Track trends over time',
            command: 'specter trajectory',
          },
          {
            description: "See yesterday's summary",
            command: 'specter morning',
          },
        ];

        // Add context-specific suggestion based on health
        if (metrics.healthScore < 60) {
          suggestions.unshift({
            description: 'Find critical hotspots to refactor',
            command: 'specter hotspots',
          });
        }

        showNextSteps(suggestions);
      }
    });
}
