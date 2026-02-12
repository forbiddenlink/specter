/**
 * Vitals command - real-time vital signs dashboard
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { generateComplexityReport } from '../../analyzers/complexity.js';
import { getGraphStats } from '../../graph/builder.js';
import { loadGraph } from '../../graph/persistence.js';
import { loadSnapshots } from '../../history/storage.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { coloredSparkline } from '../../ui/index.js';

export function register(program: Command): void {
  program
    .command('vitals')
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
      const healthColor =
        healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
      const pulseStatus =
        healthScore >= 80 ? 'STABLE' : healthScore >= 60 ? 'ELEVATED' : 'CRITICAL';

      // Calculate metrics for display
      const avgComplexity = report.averageComplexity;
      const busFactorValue = busFactor.overallBusFactor || 0;

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

      // JSON output for CI/CD
      if (options.json) {
        outputJson('vitals', {
          healthScore: Math.round(healthScore),
          pulseStatus,
          avgComplexity,
          busFactor: busFactorValue,
          deadExports,
          coverageEstimate: Math.round(coverageEstimate),
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

      // Helper to create progress bar
      const makeBar = (value: number, max: number, width: number = 10): string => {
        const filled = Math.round((value / max) * width);
        const empty = width - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
      };

      const W = 51;
      const B = chalk.bold.magenta;

      console.log();
      console.log(B(`╔${'═'.repeat(W)}╗`));

      // Header with pulse
      const pulseColor =
        healthScore >= 80 ? chalk.green : healthScore >= 60 ? chalk.yellow : chalk.red;
      console.log(
        B('║') +
          chalk.bold.white('  SPECTER VITAL SIGNS') +
          '              ' +
          '❤️  ' +
          pulseColor(`PULSE: ${pulseStatus}`) +
          B('║')
      );

      console.log(B(`╠${'═'.repeat(W)}╣`));
      console.log(B('║') + ' '.repeat(W) + B('║'));

      // Health
      const healthIndicatorVal =
        snapshots.length >= 2
          ? snapshots[0].metrics.healthScore - snapshots[1].metrics.healthScore
          : 0;
      const healthIndicator =
        healthIndicatorVal > 0
          ? chalk.green(`📈 +${healthIndicatorVal}`)
          : healthIndicatorVal < 0
            ? chalk.red(`${healthIndicatorVal}`)
            : chalk.dim('--');

      console.log(
        B('║') +
          `  HEALTH      [` +
          healthColor(makeBar(healthScore, 100, 10)) +
          `] ` +
          String(Math.round(healthScore)).padStart(2) +
          `/100   ` +
          healthIndicator +
          ' '.repeat(8) +
          B('║')
      );

      // Complexity
      const complexityColor =
        avgComplexity <= 5 ? chalk.green : avgComplexity <= 10 ? chalk.yellow : chalk.red;
      const complexityStatus =
        avgComplexity <= 5 ? 'healthy' : avgComplexity <= 10 ? '⚠️  warning' : 'critical';
      console.log(
        B('║') +
          `  COMPLEXITY  [` +
          complexityColor(makeBar(avgComplexity, 30, 10)) +
          `] ` +
          avgComplexity.toFixed(0).padStart(2) +
          ` avg   ` +
          complexityColor(complexityStatus) +
          ' '.repeat(4) +
          B('║')
      );

      // Bus factor
      const busColor =
        busFactorValue >= 3 ? chalk.green : busFactorValue >= 2 ? chalk.yellow : chalk.red;
      const busStatus =
        busFactorValue >= 3 ? 'healthy' : busFactorValue >= 2 ? '😰 at risk' : 'critical';
      console.log(
        B('║') +
          `  BUS FACTOR  [` +
          busColor(makeBar(busFactorValue, 5, 10)) +
          `] ` +
          busFactorValue.toFixed(1).padStart(3) +
          `      ` +
          busColor(busStatus) +
          ' '.repeat(4) +
          B('║')
      );

      // Dead code
      const deadColor =
        deadExports === 0 ? chalk.green : deadExports <= 5 ? chalk.yellow : chalk.red;
      const deadStatus = deadExports === 0 ? 'clean' : deadExports <= 5 ? '👻 haunted' : 'infested';
      const deadBarVal = deadExports === 0 ? 0 : Math.min(deadExports, 20);
      console.log(
        B('║') +
          `  DEAD CODE   [` +
          deadColor(makeBar(deadBarVal, 20, 10)) +
          `] ` +
          String(deadExports).padStart(3) +
          ` exp  ` +
          deadColor(deadStatus) +
          ' '.repeat(4) +
          B('║')
      );

      // Coverage estimate
      const covColor =
        coverageEstimate >= 80 ? chalk.green : coverageEstimate >= 50 ? chalk.yellow : chalk.red;
      const covStatus =
        coverageEstimate >= 80 ? '🛡️  solid' : coverageEstimate >= 50 ? '🛡️  decent' : 'sparse';
      console.log(
        B('║') +
          `  COVERAGE    [` +
          covColor(makeBar(coverageEstimate, 100, 10)) +
          `] ` +
          Math.round(coverageEstimate).toString().padStart(2) +
          `%      ` +
          covColor(covStatus) +
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
          B('║') + `  ${sparkline}` + ' '.repeat(Math.max(0, W - sparklineVisibleLen - 2)) + B('║')
        );
      } else {
        console.log(
          B('║') + chalk.dim('  (need more scans for heartbeat data)') + ' '.repeat(11) + B('║')
        );
      }

      console.log(B(`╠${'═'.repeat(W)}╣`));

      // Diagnosis
      let diagnosis = 'Stable with minor concerns';
      let prescription = 'Consider refactoring top hotspots';

      if (healthScore >= 90) {
        diagnosis = 'Excellent health - keep it up!';
        prescription = 'Maintain current practices';
      } else if (healthScore >= 80) {
        diagnosis = 'Good health with room to improve';
        prescription = 'Address any complexity warnings';
      } else if (healthScore >= 60) {
        diagnosis = 'Moderate health - attention needed';
        prescription = 'Prioritize refactoring hotspots';
      } else {
        diagnosis = 'Critical - immediate action needed';
        prescription = 'Emergency complexity reduction';
      }

      const diagPadding = Math.max(0, W - 14 - diagnosis.length);
      console.log(`${B('║')}  DIAGNOSIS: ${diagnosis}${' '.repeat(diagPadding)}${B('║')}`);

      const rxPadding = Math.max(0, W - 6 - prescription.length);
      console.log(B('║') + chalk.dim(`  Rx: ${prescription}`) + ' '.repeat(rxPadding) + B('║'));

      console.log(B(`╚${'═'.repeat(W)}╝`));
      console.log();
    });
}
