/**
 * Copilot command - Generate Copilot-friendly actionable suggestions
 * Outputs structured recommendations that GitHub Copilot can easily parse and act on
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { analyzeBusFactor, type BusFactorRisk } from '../../bus-factor.js';
import { analyzeCoupling } from '../../coupling.js';
import { loadGraph } from '../../graph/persistence.js';
import { analyzeHotspots } from '../../hotspots.js';
import { outputJson } from '../../json-output.js';

interface CopilotSuggestion {
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'refactor' | 'test' | 'document' | 'security' | 'performance';
  file: string;
  issue: string;
  suggestion: string;
  command?: string; // Specter command to run for more details
  aiPrompt?: string; // Suggested prompt for Copilot
}

export function register(program: Command): void {
  program
    .command('copilot')
    .description('Generate Copilot-friendly actionable suggestions for your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON')
    .option('--focus <area>', 'Focus area: refactoring, testing, security, performance', 'all')
    .addHelpText(
      'after',
      `
Examples:
  $ specter copilot
  $ specter copilot --focus refactoring
  $ specter copilot --json | jq '.suggestions[] | select(.priority=="critical")'
  
This command generates structured suggestions that GitHub Copilot can easily parse and act on.
Use the output to guide your refactoring, testing, and documentation efforts.
`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const suggestions: CopilotSuggestion[] = [];

      // Analyze hotspots
      const hotspots = await analyzeHotspots(rootDir, graph, {
        since: '3 months ago',
        top: 10,
      });

      for (const hotspot of hotspots.hotspots.slice(0, 5)) {
        if (hotspot.priority === 'critical' || hotspot.priority === 'high') {
          suggestions.push({
            priority: hotspot.priority,
            type: 'refactor',
            file: hotspot.file,
            issue: `High complexity (${Math.round(hotspot.complexity)}) with frequent changes (${hotspot.churn} commits)`,
            suggestion: `Extract complex logic into smaller functions. Consider splitting into multiple modules.`,
            command: `specter fix ${hotspot.file}`,
            aiPrompt: `Review ${hotspot.file} and suggest how to reduce complexity from ${Math.round(hotspot.complexity)} to under 10. Focus on extracting reusable functions.`,
          });
        }
      }

      // Analyze bus factor
      const busFactor = await analyzeBusFactor(graph);
      const criticalAreas = busFactor.risks
        .filter((a: BusFactorRisk) => a.busFactor === 1)
        .slice(0, 3);

      for (const area of criticalAreas) {
        suggestions.push({
          priority: 'high',
          type: 'document',
          file: area.area,
          issue: `Single owner: ${area.soleOwner} (${area.linesOfCode} lines at risk)`,
          suggestion: `Add comprehensive documentation and pair with other developers. Consider recording video walkthrough.`,
          command: `specter who ${area.area}`,
          aiPrompt: `Generate comprehensive documentation for ${area.area} including architecture overview, key functions, and common gotchas.`,
        });
      }

      // Analyze coupling
      const coupling = await analyzeCoupling(rootDir, graph, {
        hiddenOnly: true,
        minStrength: 40,
      });

      for (const pair of coupling.pairs.slice(0, 3)) {
        suggestions.push({
          priority: 'medium',
          type: 'refactor',
          file: pair.file1,
          issue: `Hidden coupling with ${pair.file2} (${pair.couplingStrength}% correlation, no direct import)`,
          suggestion: `Extract shared logic into a common module with explicit dependencies.`,
          command: `specter coupling --hidden-only`,
          aiPrompt: `Analyze ${pair.file1} and ${pair.file2} to identify common patterns that should be extracted into a shared utility.`,
        });
      }

      // Missing tests (based on dead exports)
      const fileNodes = Object.values(graph.nodes).filter((n) => n.type === 'file');
      const filesWithoutTests = fileNodes
        .filter((f) => {
          const isTestFile = f.filePath.includes('.test.') || f.filePath.includes('.spec.');
          const hasTest = fileNodes.some(
            (test) =>
              (test.filePath.includes('.test.') || test.filePath.includes('.spec.')) &&
              test.filePath.includes(path.basename(f.filePath, path.extname(f.filePath)))
          );
          return !isTestFile && !hasTest && f.filePath.endsWith('.ts');
        })
        .slice(0, 3);

      for (const file of filesWithoutTests) {
        suggestions.push({
          priority: 'medium',
          type: 'test',
          file: file.filePath,
          issue: 'No test file found',
          suggestion: `Create ${file.filePath.replace('.ts', '.test.ts')} with unit tests for key functions.`,
          aiPrompt: `Generate comprehensive unit tests for ${file.filePath} covering all exported functions and edge cases.`,
        });
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Filter by focus
      const filtered =
        options.focus === 'all' ? suggestions : suggestions.filter((s) => s.type === options.focus);

      // JSON output
      if (options.json) {
        outputJson('copilot', {
          totalSuggestions: filtered.length,
          suggestions: filtered,
          summary: {
            critical: filtered.filter((s) => s.priority === 'critical').length,
            high: filtered.filter((s) => s.priority === 'high').length,
            medium: filtered.filter((s) => s.priority === 'medium').length,
            low: filtered.filter((s) => s.priority === 'low').length,
          },
        });
        return;
      }

      // Pretty output
      console.log();
      console.log(chalk.bold.cyan('🤖 COPILOT-READY SUGGESTIONS'));
      console.log(chalk.dim('='.repeat(80)));
      console.log();

      if (filtered.length === 0) {
        console.log(chalk.green('  ✨ No critical suggestions! Your codebase looks healthy.'));
        console.log();
        return;
      }

      console.log(
        chalk.dim(
          `  Found ${filtered.length} actionable ${options.focus === 'all' ? '' : options.focus} suggestions`
        )
      );
      console.log();

      for (const s of filtered) {
        // Priority badge
        const priorityColors = {
          critical: chalk.red.bold,
          high: chalk.yellow.bold,
          medium: chalk.cyan,
          low: chalk.dim,
        };
        const priorityBadge = priorityColors[s.priority](`[${s.priority.toUpperCase()}]`);

        // Type emoji
        const typeEmoji = {
          refactor: '🔧',
          test: '🧪',
          document: '📝',
          security: '🔒',
          performance: '⚡',
        };

        console.log(`${priorityBadge} ${typeEmoji[s.type]} ${chalk.bold(s.file)}`);
        console.log(chalk.dim(`   Issue: ${s.issue}`));
        console.log(chalk.green(`   ✓ ${s.suggestion}`));

        if (s.command) {
          console.log(chalk.cyan(`   $ ${s.command}`));
        }

        if (s.aiPrompt) {
          console.log();
          console.log(chalk.dim('   💬 Suggested Copilot Prompt:'));
          console.log(chalk.italic(`   "${s.aiPrompt}"`));
        }

        console.log();
      }

      console.log(chalk.dim('='.repeat(80)));
      console.log();
      console.log(chalk.bold('📋 QUICK ACTIONS:'));
      console.log();
      console.log(chalk.cyan('  • Copy a prompt above and paste it into GitHub Copilot'));
      console.log(chalk.cyan('  • Run the suggested Specter commands for more details'));
      console.log(chalk.cyan('  • Use --json flag to integrate with your toolchain'));
      console.log();
      console.log(
        chalk.dim('  💡 Pro tip: Use --focus to filter by type (refactoring, testing, etc.)')
      );
      console.log();
    });
}
