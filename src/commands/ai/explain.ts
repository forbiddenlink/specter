/**
 * Explain command - AI-powered file explanations
 *
 * Provides deep analysis of a file including:
 * - Purpose and functionality
 * - Git history context (why the code exists)
 * - Import/export connections
 * - Complexity breakdown
 * - Refactoring suggestions
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';
import { isAIEnabled, reasonAboutCode } from '../../ai/claude-client.js';

interface ExplainOptions {
  dir: string;
  verbose?: boolean;
}

/**
 * Get git log for a file to understand its history
 */
function getGitHistory(filePath: string, rootDir: string): string {
  try {
    const result = spawnSync(
      'git',
      ['log', '--oneline', '--follow', '-n', '20', '--format=%h %s (%cr)', '--', filePath],
      {
        encoding: 'utf-8',
        cwd: rootDir,
        timeout: 10000,
      }
    );

    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }

    return 'No git history available';
  } catch {
    return 'Unable to retrieve git history';
  }
}

/**
 * Get git blame summary to understand who contributed and when
 */
function getGitBlameSummary(filePath: string, rootDir: string): string {
  try {
    // Get blame with author and date info
    const result = spawnSync('git', ['blame', '--line-porcelain', filePath], {
      encoding: 'utf-8',
      cwd: rootDir,
      timeout: 10000,
    });

    if (result.status !== 0 || !result.stdout.trim()) {
      return 'No blame data available';
    }

    // Parse porcelain output to extract unique authors and their line counts
    const lines = result.stdout.split('\n');
    const authorCounts: Record<string, number> = {};
    let currentAuthor = '';

    for (const line of lines) {
      if (line.startsWith('author ')) {
        currentAuthor = line.slice(7);
      } else if (line.startsWith('\t') && currentAuthor) {
        authorCounts[currentAuthor] = (authorCounts[currentAuthor] || 0) + 1;
      }
    }

    // Format author contributions
    const sorted = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, count]) => `  ${author}: ${count} lines`)
      .join('\n');

    return sorted || 'No contributor data available';
  } catch {
    return 'Unable to retrieve blame data';
  }
}

/**
 * Extract imports and exports from the file
 */
function extractImportsExports(content: string): { imports: string[]; exports: string[] } {
  const imports: string[] = [];
  const exports: string[] = [];

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match import statements
    if (trimmed.startsWith('import ')) {
      imports.push(trimmed);
    }

    // Match export statements
    if (trimmed.startsWith('export ')) {
      exports.push(trimmed);
    }
  }

  return { imports, exports };
}

/**
 * Build the AI prompt for file explanation
 */
function buildExplainPrompt(
  filePath: string,
  content: string,
  gitHistory: string,
  blameSummary: string,
  imports: string[],
  exports: string[]
): string {
  return `You are a senior software engineer explaining code to a teammate. Analyze this file comprehensively.

## File: ${filePath}

## Code Content:
\`\`\`
${content}
\`\`\`

## Git History (recent commits):
${gitHistory}

## Contributors:
${blameSummary}

## Imports:
${imports.length > 0 ? imports.join('\n') : 'None'}

## Exports:
${exports.length > 0 ? exports.join('\n') : 'None'}

---

Please provide a comprehensive explanation covering:

1. **Purpose & Overview**: What does this file do? What problem does it solve?

2. **Why This Code Exists**: Based on the git history, what was the evolution of this file? What drove its creation and changes?

3. **Architecture & Connections**: How does this file connect to the rest of the codebase? What are its key dependencies and what depends on it?

4. **Complexity Breakdown**:
   - What are the most complex parts?
   - Are there any code smells or anti-patterns?
   - What's the cyclomatic complexity like?

5. **Refactoring Suggestions**:
   - What improvements would you recommend?
   - Are there any quick wins?
   - What would make this code more maintainable?

Be specific and reference actual code from the file.`;
}

/**
 * Generate a basic fallback explanation when AI is not available
 */
function generateFallbackExplanation(
  filePath: string,
  content: string,
  gitHistory: string,
  blameSummary: string,
  imports: string[],
  exports: string[]
): string {
  const lines = content.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const ext = path.extname(filePath);

  let output = '';

  output += chalk.bold.cyan('\n=== File Overview ===\n');
  output += `File: ${filePath}\n`;
  output += `Extension: ${ext}\n`;
  output += `Total lines: ${lines.length}\n`;
  output += `Non-empty lines: ${nonEmptyLines.length}\n`;

  output += chalk.bold.cyan('\n=== Git History ===\n');
  output += `${gitHistory}\n`;

  output += chalk.bold.cyan('\n=== Contributors ===\n');
  output += `${blameSummary}\n`;

  output += chalk.bold.cyan('\n=== Dependencies ===\n');
  if (imports.length > 0) {
    output += `Imports (${imports.length}):\n`;
    imports.slice(0, 10).forEach((imp) => {
      output += `  ${imp}\n`;
    });
    if (imports.length > 10) {
      output += `  ... and ${imports.length - 10} more\n`;
    }
  } else {
    output += 'No imports found\n';
  }

  output += chalk.bold.cyan('\n=== Exports ===\n');
  if (exports.length > 0) {
    output += `Exports (${exports.length}):\n`;
    exports.slice(0, 10).forEach((exp) => {
      output += `  ${exp}\n`;
    });
    if (exports.length > 10) {
      output += `  ... and ${exports.length - 10} more\n`;
    }
  } else {
    output += 'No exports found\n';
  }

  output += chalk.yellow(
    '\nNote: Enable AI features by setting ANTHROPIC_API_KEY for deeper analysis.\n'
  );

  return output;
}

/**
 * Explain a file using AI
 */
export async function explainFile(
  filePath: string,
  rootDir: string,
  options: ExplainOptions
): Promise<void> {
  const spinner = ora('Analyzing file...').start();

  try {
    // Resolve file path
    const fullPath = path.resolve(rootDir, filePath);
    const relativePath = path.relative(rootDir, fullPath);

    if (!existsSync(fullPath)) {
      spinner.fail('File not found');
      console.error(chalk.red(`Error: ${filePath} does not exist`));
      process.exit(1);
    }

    // Read file content
    spinner.text = 'Reading file content...';
    const content = readFileSync(fullPath, 'utf-8');

    // Get git history
    spinner.text = 'Gathering git history...';
    const gitHistory = getGitHistory(relativePath, rootDir);

    // Get blame summary
    spinner.text = 'Analyzing contributors...';
    const blameSummary = getGitBlameSummary(relativePath, rootDir);

    // Extract imports/exports
    const { imports, exports } = extractImportsExports(content);

    // Check if AI is enabled
    if (!isAIEnabled()) {
      spinner.warn('AI features not enabled');
      const fallback = generateFallbackExplanation(
        relativePath,
        content,
        gitHistory,
        blameSummary,
        imports,
        exports
      );
      console.log(fallback);
      return;
    }

    // Build prompt and get AI explanation
    spinner.text = 'Generating AI explanation...';
    const prompt = buildExplainPrompt(
      relativePath,
      content,
      gitHistory,
      blameSummary,
      imports,
      exports
    );

    if (options.verbose) {
      console.log(chalk.dim('\n--- Context sent to AI ---'));
      console.log(chalk.dim(prompt));
      console.log(chalk.dim('--- End context ---\n'));
    }

    const explanation = await reasonAboutCode(
      'Provide a comprehensive explanation of this file.',
      prompt
    );

    spinner.succeed('Analysis complete');

    console.log(chalk.bold.cyan(`\n=== Explanation: ${relativePath} ===\n`));
    console.log(explanation);

    // Add tip for related commands
    console.log(
      '\n' +
        chalk.bold.green('Related commands:') +
        '\n' +
        chalk.white(`  specter explain-hotspot ${relativePath}`) +
        chalk.dim(' - Check hotspot metrics\n') +
        chalk.white(`  specter suggest-refactor ${relativePath}`) +
        chalk.dim(' - Get detailed refactoring steps\n') +
        chalk.white(`  specter graph show ${relativePath}`) +
        chalk.dim(' - View dependency graph')
    );
  } catch (error) {
    spinner.fail('Failed to explain file');
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    process.exit(1);
  }
}

/**
 * Register the explain command
 */
export function register(program: Command): void {
  program
    .command('explain <file>')
    .description('AI-powered file explanation with git history and architecture analysis')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('-v, --verbose', 'Show the context sent to AI')
    .action(async (file: string, options: ExplainOptions) => {
      const rootDir = path.resolve(options.dir);
      await explainFile(file, rootDir, options);
    });
}
