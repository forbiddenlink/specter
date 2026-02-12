#!/usr/bin/env node
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import type { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import ora from 'ora';
import { relative, resolve } from 'path';
import { findComplexityHotspots, generateComplexityReport } from './analyzers/complexity.js';
import { loadGraph } from './graph/persistence.js';
import { analyzeHotspots, type HotspotsResult } from './hotspots.js';

interface RefactorOptions {
  focus?: string;
  priority?: 'complexity' | 'coupling' | 'testability' | 'all';
  format?: 'steps' | 'diff' | 'explanation';
}

/**
 * Check if GitHub Copilot CLI is installed
 */
function checkCopilotCLI(): boolean {
  const result = spawnSync('copilot', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

/**
 * Analyze code issues for refactoring
 */
async function analyzeRefactoringNeeds(
  filePath: string,
  rootDir: string,
  priority: string
): Promise<string> {
  const relativePath = relative(rootDir, filePath);
  const issues: string[] = [];

  try {
    // Load knowledge graph
    const graph = await loadGraph(rootDir);
    if (!graph) {
      return '\nNo analysis data available. Run `specter scan` first.';
    }

    // Complexity analysis
    if (priority === 'complexity' || priority === 'all') {
      const complexityReport = generateComplexityReport(graph);
      const complexFiles = findComplexityHotspots(graph, { limit: 20 });
      const file = complexFiles.find((c: any) => c.file === relativePath);

      if (file) {
        issues.push(`\n## Complexity Issues:`);
        issues.push(`- Cyclomatic complexity: ${file.complexity}`);

        if (file.complexity > 20) {
          issues.push(`- ⚠️  Very high complexity (should be < 10)`);
          issues.push(`- Recommendation: Split into smaller functions`);
        } else if (file.complexity > 10) {
          issues.push(`- ⚠️  High complexity (should be < 10)`);
          issues.push(`- Recommendation: Simplify conditional logic`);
        }
      }
    }

    // Hotspot analysis
    if (priority === 'coupling' || priority === 'all') {
      const hotspotsResult = await analyzeHotspots(rootDir, graph, { top: 20 });
      if (hotspotsResult && hotspotsResult.hotspots) {
        const file = hotspotsResult.hotspots.find((h: any) => h.file === relativePath);

        if (file && file.churn > 50) {
          issues.push(`\n## Change Frequency:`);
          issues.push(`- Changes: ${file.churn}`);
          issues.push(`- High churn indicates stability issues`);
          issues.push(`- Recommendation: Add tests and stabilize interface`);
        }
      }
    }

    // Mention coupling analysis requires deeper analysis
    if (priority === 'coupling' || priority === 'all') {
      issues.push(`\n## Coupling:`);
      issues.push(`- Run 'specter coupling' for detailed dependency analysis`);
    }

    return issues.length > 0
      ? issues.join('\n')
      : '\nNo critical issues detected. Code quality looks good!';
  } catch (error) {
    return '\nCould not analyze code. Run `specter scan` first.';
  }
}

/**
 * Suggest refactoring using AI
 */
export async function suggestRefactoring(
  filePath: string,
  rootDir: string,
  options: RefactorOptions
): Promise<void> {
  const spinner = ora('Analyzing code...').start();

  try {
    // Resolve file path
    const fullPath = resolve(rootDir, filePath);

    if (!existsSync(fullPath)) {
      spinner.fail('File not found');
      console.error(chalk.red(`Error: ${filePath} does not exist`));
      process.exit(1);
    }

    // Check if Copilot CLI is available
    if (!checkCopilotCLI()) {
      spinner.fail('GitHub Copilot CLI not found');
      console.log(
        chalk.yellow('\n⚠️  GitHub Copilot CLI is required for AI refactoring suggestions.')
      );
      console.log(chalk.white('Install it with:'));
      console.log(chalk.cyan('  npm install -g @github/copilot\n'));
      process.exit(1);
    }

    // Analyze code issues
    spinner.text = 'Detecting issues...';
    const priority = options.priority || 'all';
    const codeIssues = await analyzeRefactoringNeeds(fullPath, rootDir, priority);

    // Read file content
    spinner.text = 'Reading code...';
    const fileContent = readFileSync(fullPath, 'utf-8');

    // Limit content size
    const contentPreview =
      fileContent.length > 2000
        ? fileContent.slice(0, 2000) + '\n... (truncated for analysis)'
        : fileContent;

    // Build prompt based on format
    let prompt = '';
    const focusArea = options.focus || 'general refactoring';
    const formatInstruction =
      options.format === 'steps'
        ? 'Provide step-by-step refactoring instructions.'
        : options.format === 'diff'
          ? 'Show before/after code examples.'
          : 'Explain the refactoring strategy and benefits.';

    prompt = `Analyze this code and suggest refactoring improvements.

File: ${filePath}
Focus: ${focusArea}
Priority: ${priority}

${codeIssues}

Code:
${contentPreview}

${formatInstruction}

Include:
1. Specific problems identified
2. Recommended refactoring patterns
3. Expected benefits (readability, testability, maintainability)
4. Potential risks or tradeoffs`;

    spinner.text = 'Generating refactoring suggestions...';

    try {
      // Use spawnSync with argument array to avoid shell injection
      const spawnResult = spawnSync('copilot', ['-p', prompt, '--allow-all-tools'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: rootDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
        timeout: 120000, // 2 minute timeout for complex refactoring
      });

      if (spawnResult.error) throw spawnResult.error;
      if (spawnResult.status !== 0) throw new Error(spawnResult.stderr || 'Copilot failed');

      spinner.succeed('Refactoring suggestions ready');

      console.log('\n' + chalk.bold.cyan('📊 Current Code Analysis:\n'));
      console.log(codeIssues);

      console.log('\n' + chalk.bold.cyan('🤖 AI Refactoring Suggestions:\n'));
      console.log(spawnResult.stdout);

      console.log('\n' + chalk.bold.green('💡 Next Steps:'));
      console.log(chalk.white('1. Review the suggestions carefully'));
      console.log(
        chalk.white('2. Create a feature branch: ') +
          chalk.cyan('git checkout -b refactor/filename')
      );
      console.log(chalk.white('3. Apply changes incrementally'));
      console.log(chalk.white('4. Run tests after each change'));
      console.log(
        chalk.white('5. Use ') +
          chalk.cyan('specter fix --interactive') +
          chalk.white(' to apply fixes\n')
      );
    } catch (copilotError) {
      spinner.fail('Failed to generate suggestions');
      console.log(chalk.yellow('\n⚠️  GitHub Copilot is unavailable.'));
      console.log(chalk.white('\nCode analysis results:'));
      console.log(codeIssues);
    }
  } catch (error) {
    spinner.fail('Failed to analyze code');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

/**
 * Register the suggest-refactor command
 */
export function registerSuggestRefactorCommand(program: Command): void {
  program
    .command('suggest-refactor <file>')
    .description('Get AI-powered refactoring suggestions (powered by GitHub Copilot CLI)')
    .option('-f, --focus <area>', 'Focus on specific area (e.g., "error handling", "performance")')
    .option('-p, --priority <type>', 'Priority: complexity, coupling, testability, or all', 'all')
    .option('--format <type>', 'Output format: steps, diff, or explanation', 'steps')
    .action(async (file: string, options: RefactorOptions) => {
      const rootDir = resolve(process.cwd());
      await suggestRefactoring(file, rootDir, options);
    });
}

/**
 * Example usage:
 * - specter suggest-refactor src/api/users.ts
 * - specter suggest-refactor src/auth.ts --priority complexity
 * - specter suggest-refactor src/utils.ts --focus "error handling"
 * - specter suggest-refactor src/complex.ts --format diff
 */
