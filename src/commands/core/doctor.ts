/**
 * Doctor command - environment diagnostics and health checks
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import gradient from 'gradient-string';
import { simpleGit } from 'simple-git';
import { graphExists, isGraphStale } from '../../graph/persistence.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
}

/**
 * Check Node.js version (>= 18 required)
 */
function checkNodeVersion(): CheckResult {
  const version = process.version; // e.g. "v20.10.0"
  const major = Number.parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 18) {
    return {
      name: 'Node.js',
      status: 'pass',
      message: `${version} detected`,
    };
  }

  return {
    name: 'Node.js',
    status: 'fail',
    message: `${version} detected (requires >= 18)`,
    suggestion: 'Upgrade Node.js: https://nodejs.org/',
  };
}

/**
 * Check Git availability using simple-git
 */
async function checkGit(): Promise<CheckResult> {
  try {
    const git = simpleGit();
    const version = await git.version();
    return {
      name: 'Git',
      status: 'pass',
      message: `git version ${version.major}.${version.minor}.${version.patch}${version.agent ? ` (${version.agent})` : ''}`,
    };
  } catch {
    return {
      name: 'Git',
      status: 'fail',
      message: 'Git not found',
      suggestion: 'Install Git: https://git-scm.com/downloads',
    };
  }
}

/**
 * Check whether specter scan has been run (graph.json exists)
 */
async function checkGraphExists(rootDir: string): Promise<CheckResult> {
  const exists = await graphExists(rootDir);

  if (exists) {
    return {
      name: 'Knowledge graph',
      status: 'pass',
      message: 'graph.json found in .specter/',
    };
  }

  return {
    name: 'Knowledge graph',
    status: 'warn',
    message: 'No graph found - specter scan has not been run',
    suggestion: 'Run: specter scan',
  };
}

/**
 * Check if graph is stale (modified files since last scan)
 */
async function checkGraphFreshness(rootDir: string): Promise<CheckResult> {
  const exists = await graphExists(rootDir);

  if (!exists) {
    return {
      name: 'Graph freshness',
      status: 'warn',
      message: 'No graph to check (run specter scan first)',
      suggestion: 'Run: specter scan',
    };
  }

  const stale = await isGraphStale(rootDir);

  if (!stale) {
    return {
      name: 'Graph freshness',
      status: 'pass',
      message: 'Graph is up to date',
    };
  }

  return {
    name: 'Graph freshness',
    status: 'warn',
    message: 'Graph is stale - files have changed since last scan',
    suggestion: 'Run: specter scan --force',
  };
}

/**
 * Check key package dependencies
 */
function checkDependencies(): CheckResult {
  const deps = ['ts-morph', 'chalk', 'commander', 'gradient-string', 'ora'];
  const missing: string[] = [];

  for (const dep of deps) {
    try {
      // Attempt to resolve the module entry point
      import.meta.resolve(dep);
    } catch {
      missing.push(dep);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'Dependencies',
      status: 'pass',
      message: `All key packages installed (${deps.length} checked)`,
    };
  }

  return {
    name: 'Dependencies',
    status: 'fail',
    message: `Missing packages: ${missing.join(', ')}`,
    suggestion: 'Run: npm install',
  };
}

/**
 * Check terminal capabilities (TTY, color, Unicode)
 */
function checkTerminal(): CheckResult {
  const isTTY = !!process.stdout.isTTY;
  const colorLevel = chalk.level; // 0=none, 1=basic, 2=256, 3=truecolor
  const supportsUnicode = process.platform !== 'win32' || !!process.env.WT_SESSION;

  const details: string[] = [];
  let status: CheckResult['status'] = 'pass';

  if (isTTY) {
    details.push('TTY');
  } else {
    details.push('no TTY');
    status = 'warn';
  }

  if (colorLevel >= 3) {
    details.push('truecolor');
  } else if (colorLevel >= 2) {
    details.push('256-color');
  } else if (colorLevel >= 1) {
    details.push('basic color');
  } else {
    details.push('no color');
    status = 'warn';
  }

  if (supportsUnicode) {
    details.push('Unicode');
  } else {
    details.push('no Unicode');
    status = 'warn';
  }

  const result: CheckResult = {
    name: 'Terminal',
    status,
    message: details.join(', '),
  };

  if (status === 'warn') {
    const suggestions: string[] = [];
    if (!isTTY) suggestions.push('Run in an interactive terminal for best experience');
    if (colorLevel === 0) suggestions.push('Use a terminal that supports ANSI colors');
    if (!supportsUnicode) suggestions.push('Use Windows Terminal or a Unicode-capable emulator');
    result.suggestion = suggestions.join('. ');
  }

  return result;
}

/**
 * Format a single check result as a display line
 */
function formatCheck(result: CheckResult): string {
  const icon =
    result.status === 'pass'
      ? chalk.green('\u2714') // checkmark
      : result.status === 'warn'
        ? chalk.yellow('\u26A0') // warning
        : chalk.red('\u2718'); // X

  const nameColor =
    result.status === 'pass' ? chalk.green : result.status === 'warn' ? chalk.yellow : chalk.red;

  return `  ${icon} ${nameColor(result.name)}: ${chalk.white(result.message)}`;
}

export function register(program: Command): void {
  program
    .command('doctor')
    .description('Run environment diagnostics and check system health')
    .option('-d, --dir <path>', 'Project directory to check', '.')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
      console.log();
      console.log(
        g(
          '  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'
        )
      );
      console.log(
        g('  \u2551') +
          chalk.bold.white('        \uD83E\uDE7A SPECTER DOCTOR                ') +
          g('\u2551')
      );
      console.log(
        g(
          '  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D'
        )
      );
      console.log();

      console.log(chalk.dim('  Running diagnostics...\n'));

      // Collect all check results
      const results: CheckResult[] = [];

      // Synchronous checks
      results.push(checkNodeVersion());
      results.push(checkDependencies());
      results.push(checkTerminal());

      // Async checks
      results.push(await checkGit());
      results.push(await checkGraphExists(rootDir));
      results.push(await checkGraphFreshness(rootDir));

      // Display results
      const sg = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
      console.log(
        sg(
          '  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510'
        )
      );
      console.log(
        sg('  \u2502') +
          chalk.bold.white('  Diagnostics Results                        ') +
          sg('\u2502')
      );
      console.log(
        sg(
          '  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524'
        )
      );

      for (const result of results) {
        console.log(formatCheck(result));
      }

      console.log(
        sg(
          '  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518'
        )
      );

      // Show suggestions for non-passing checks
      const issues = results.filter((r) => r.status !== 'pass' && r.suggestion);
      if (issues.length > 0) {
        console.log();
        console.log(chalk.bold.yellow('  Suggestions:'));
        for (const issue of issues) {
          const icon = issue.status === 'fail' ? chalk.red('\u2718') : chalk.yellow('\u26A0');
          console.log(`    ${icon} ${chalk.dim(issue.suggestion)}`);
        }
      }

      // Summary
      const passCount = results.filter((r) => r.status === 'pass').length;
      const warnCount = results.filter((r) => r.status === 'warn').length;
      const failCount = results.filter((r) => r.status === 'fail').length;

      console.log();
      if (failCount > 0) {
        console.log(
          chalk.bold.red(
            `  \u2718 ${failCount} issue(s) need fixing, ${warnCount} warning(s), ${passCount} passed`
          )
        );
        process.exitCode = 1;
      } else if (warnCount > 0) {
        console.log(chalk.bold.yellow(`  \u26A0 All checks passed with ${warnCount} warning(s)`));
      } else {
        console.log(chalk.bold.green('  \u2714 All checks passed! Specter is ready.'));
      }
      console.log();
    });
}
