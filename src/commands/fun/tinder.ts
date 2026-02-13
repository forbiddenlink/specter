/**
 * Tinder command - dating profile for your codebase
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { generateComplexityReport } from '../../analyzers/complexity.js';
import { exportToPng, getRepoUrl, isPngExportAvailable } from '../../export-png.js';
import { getGraphStats } from '../../graph/builder.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner, showShareLinks } from '../types.js';
import {
  generateBioLines,
  generateConversationStarters,
  generateGreenFlags,
  generateRedFlags,
  type TinderData,
} from './tinder-helpers.js';

export function register(program: Command): void {
  program
    .command('tinder')
    .description('Generate a dating profile for your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--png <file>', 'Export as PNG image for sharing')
    .option('--social', 'Optimize PNG for Twitter/LinkedIn (1200x630)')
    .option('--qr', 'Add QR code linking to repo (with --png)')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const projectName = path.basename(rootDir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('tinder', 'No graph found. Run `specter scan` first.');
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

      // Calculate various stats
      const healthScore = Math.max(0, 100 - report.averageComplexity * 5);
      const busFactorValue = busFactor.overallBusFactor || 0;
      const hotspotCount = report.hotspots.length;

      // Determine primary language
      const languages = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
      const primaryLang = languages[0]?.[0] || 'Unknown';
      const langPercent = languages[0] ? Math.round((languages[0][1] / stats.fileCount) * 100) : 0;

      // Calculate age from first file modification (approximation using scan time)
      const scannedAt = new Date(graph.metadata.scannedAt);
      const ageMonths = Math.max(
        1,
        Math.floor((Date.now() - scannedAt.getTime()) / (30 * 24 * 60 * 60 * 1000))
      );

      // Check for common "red flag" files
      const hasHelpers = Object.values(graph.nodes).some(
        (n) => n.type === 'file' && n.name.toLowerCase().includes('helper')
      );
      const hasUtils = Object.values(graph.nodes).some(
        (n) => n.type === 'file' && n.name.toLowerCase().includes('util')
      );

      // Count circular dependencies (simplified: files that import each other)
      const importEdges = graph.edges.filter((e) => e.type === 'imports');
      const importPairs = new Set<string>();
      let circularCount = 0;
      for (const edge of importEdges) {
        const reverseKey = `${edge.target}->${edge.source}`;
        if (importPairs.has(reverseKey)) {
          circularCount++;
        }
        importPairs.add(`${edge.source}->${edge.target}`);
      }

      // Count tools/functions
      const functionCount = Object.values(graph.nodes).filter((n) => n.type === 'function').length;

      // Check for git history
      const hasGitHistory = Object.values(graph.nodes).some((n) => n.lastModified);

      // Prepare data for helper functions
      const tinderData: TinderData = {
        healthScore,
        functionCount,
        hotspotCount,
        langPercent,
        primaryLang,
        busFactorValue,
        hasGitHistory,
        hasHelpers,
        hasUtils,
        circularCount,
        edgeCount: stats.edgeCount,
      };

      // Generate bio, flags, and starters using helpers
      const bio = generateBioLines(tinderData);
      const greenFlags = generateGreenFlags(tinderData);
      const redFlags = generateRedFlags(tinderData);
      const starters = generateConversationStarters(tinderData);

      // JSON output for CI/CD
      if (options.json) {
        outputJson('tinder', {
          projectName,
          healthScore: Math.round(healthScore),
          primaryLanguage: primaryLang,
          languagePercent: langPercent,
          fileCount: stats.fileCount,
          functionCount,
          hotspotCount,
          busFactor: busFactorValue,
          circularDependencies: circularCount,
          greenFlags,
          redFlags,
          bio,
          conversationStarters: starters,
        });
        return;
      }

      // Build the display
      const W = 45;

      // Build output as array of lines
      const lines: string[] = [];
      lines.push('');
      lines.push(chalk.magenta('CODEBASE DATING PROFILE'));
      lines.push('');
      lines.push(chalk.dim(`+${'-'.repeat(W)}+`));
      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Name and basic info
      const nameLine = `  ${projectName}/`;
      lines.push(
        chalk.dim('|') +
          chalk.bold.cyan(nameLine) +
          ' '.repeat(W - nameLine.length + 2) +
          chalk.dim('|')
      );

      const infoLine = `  ${stats.fileCount} files - ${primaryLang} - Looking for devs`;
      lines.push(chalk.dim('|') + infoLine + ' '.repeat(W - infoLine.length + 2) + chalk.dim('|'));

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));
      lines.push(chalk.dim('|') + chalk.dim(`-`.repeat(W)) + chalk.dim('|'));
      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Basic stats
      const ageLine = `  Age: ${ageMonths} month${ageMonths !== 1 ? 's' : ''} (estimated)`;
      lines.push(chalk.dim('|') + ageLine + ' '.repeat(W - ageLine.length + 2) + chalk.dim('|'));

      const locLine = `  Location: ${rootDir.slice(0, 30)}${rootDir.length > 30 ? '...' : ''}`;
      lines.push(
        chalk.dim('|') + locLine + ' '.repeat(Math.max(0, W - locLine.length + 2)) + chalk.dim('|')
      );

      const jobLine = `  Occupation: ${primaryLang} Codebase`;
      lines.push(chalk.dim('|') + jobLine + ' '.repeat(W - jobLine.length + 2) + chalk.dim('|'));

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));
      lines.push(chalk.dim('|') + chalk.dim(`-`.repeat(W)) + chalk.dim('|'));
      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Bio
      lines.push(chalk.dim('|') + chalk.bold('  Bio:') + ' '.repeat(W - 6) + chalk.dim('|'));
      for (const bioContent of bio) {
        const bioLine = `  ${bioContent}`;
        lines.push(
          chalk.dim('|') +
            bioLine +
            ' '.repeat(Math.max(0, W - bioLine.length + 2)) +
            chalk.dim('|')
        );
      }

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));
      lines.push(chalk.dim('|') + chalk.dim(`-`.repeat(W)) + chalk.dim('|'));
      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Green flags
      lines.push(
        chalk.dim('|') + chalk.bold.green('  Green Flags:') + ' '.repeat(W - 14) + chalk.dim('|')
      );
      for (const flag of greenFlags.slice(0, 4)) {
        const flagLine = `  - ${flag}`;
        lines.push(
          chalk.dim('|') +
            chalk.green(flagLine) +
            ' '.repeat(Math.max(0, W - flagLine.length + 2)) +
            chalk.dim('|')
        );
      }

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Red flags
      lines.push(
        chalk.dim('|') + chalk.bold.red('  Red Flags:') + ' '.repeat(W - 12) + chalk.dim('|')
      );
      for (const flag of redFlags.slice(0, 4)) {
        const flagLine = `  - ${flag}`;
        lines.push(
          chalk.dim('|') +
            chalk.red(flagLine) +
            ' '.repeat(Math.max(0, W - flagLine.length + 2)) +
            chalk.dim('|')
        );
      }

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));
      lines.push(chalk.dim('|') + chalk.dim(`-`.repeat(W)) + chalk.dim('|'));
      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));

      // Conversation starters
      lines.push(
        chalk.dim('|') +
          chalk.bold('  Conversation starters:') +
          ' '.repeat(W - 24) +
          chalk.dim('|')
      );
      for (const starter of starters) {
        const starterLine = `  ${starter}`;
        lines.push(
          chalk.dim('|') +
            chalk.italic(starterLine) +
            ' '.repeat(Math.max(0, W - starterLine.length + 2)) +
            chalk.dim('|')
        );
      }

      lines.push(chalk.dim('|') + ' '.repeat(W) + chalk.dim('|'));
      lines.push(chalk.dim(`+${'-'.repeat(W)}+`));

      // Swipe buttons
      lines.push('');
      const passBtn = chalk.red.bold('[PASS]');
      const mergeBtn = chalk.green.bold('[MERGE]');
      lines.push(`        ${passBtn}     ${mergeBtn}`);
      lines.push('');

      const output = lines.join('\n');

      // PNG export
      if (options.png) {
        const pngAvailable = await isPngExportAvailable();
        if (!pngAvailable) {
          console.log(
            chalk.red('PNG export requires the canvas package. Install with: npm install canvas')
          );
          return;
        }

        const spinner = createSpinner('Generating shareable dating profile image...');
        spinner.start();

        const qrUrl = options.qr ? await getRepoUrl(rootDir) : undefined;
        const outputPath = await exportToPng(output, options.png, {
          qrUrl: qrUrl || undefined,
          socialFormat: options.social,
        });

        spinner.succeed(`Image saved to ${outputPath}`);
        showShareLinks('tinder', qrUrl);
        return;
      }

      console.log(output);
    });
}
