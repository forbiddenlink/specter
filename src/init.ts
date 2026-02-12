/**
 * Init - Project Initialization
 *
 * Interactive setup for Specter in a new project.
 * Creates config file, optionally sets up hooks, and runs initial scan.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { buildKnowledgeGraph, getGraphStats } from './graph/builder.js';
import { graphExists, saveGraph } from './graph/persistence.js';
import type { PersonalityMode } from './personality/types.js';

export interface InitOptions {
  hooks: boolean;
  scan: boolean;
  config: boolean;
  personality: PersonalityMode;
}

export interface InitResult {
  configCreated: boolean;
  hooksInstalled: boolean;
  scanCompleted: boolean;
  graphPath: string;
  fileCount?: number;
  nodeCount?: number;
  healthScore?: number;
}

export interface SpecterProjectConfig {
  personality: PersonalityMode;
  thresholds: {
    health: { warning: number; critical: number };
    complexity: { warning: number; critical: number };
  };
  ignore: string[];
  hooks: {
    preCommit: boolean;
    prePush: boolean;
  };
}

/**
 * Default project configuration
 */
const DEFAULT_PROJECT_CONFIG: SpecterProjectConfig = {
  personality: 'default',
  thresholds: {
    health: { warning: 70, critical: 50 },
    complexity: { warning: 15, critical: 25 },
  },
  ignore: ['node_modules', 'dist', '.git'],
  hooks: {
    preCommit: true,
    prePush: false,
  },
};

/**
 * Personalities available for interactive selection
 */
export const INIT_PERSONALITIES: Array<{
  mode: PersonalityMode;
  emoji: string;
  description: string;
}> = [
  { mode: 'default', emoji: '', description: 'Professional and helpful' },
  { mode: 'noir', emoji: '', description: 'Detective narrative style' },
  { mode: 'therapist', emoji: '', description: 'Supportive and understanding' },
  { mode: 'roast', emoji: '', description: 'Brutally honest comedy' },
  { mode: 'mentor', emoji: '', description: 'Educational and explanatory' },
  { mode: 'cheerleader', emoji: '', description: 'Positive and encouraging' },
  { mode: 'dramatic', emoji: '', description: 'Epic narrator voice' },
];

/**
 * Create readline interface for interactive prompts
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Format the welcome banner
 */
export function formatInitWelcome(): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('  .--.         .--.        ');
  lines.push(' /    \\  👻  /    \\       ');
  lines.push('|      |     |      |      ');
  lines.push(' \\    /       \\    /      ');
  lines.push("  '--'         '--'        ");
  lines.push('');
  lines.push('  Welcome to Specter!');
  lines.push('');
  lines.push("  Let's set up your codebase for haunting...");
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the completion message
 */
export function formatInitComplete(result: InitResult, rootDir: string): string {
  const lines: string[] = [];
  const projectName = path.basename(rootDir);

  lines.push('');
  lines.push('  .--.         .--.        ');
  lines.push(' /    \\  ✨  /    \\       ');
  lines.push('|      |     |      |      ');
  lines.push(' \\    /       \\    /      ');
  lines.push("  '--'         '--'        ");
  lines.push('');
  lines.push('  Specter initialized!');
  lines.push('');
  lines.push('  Created:');

  if (result.configCreated) {
    lines.push('    [check] specter.config.json');
  }
  if (result.hooksInstalled) {
    lines.push('    [check] .husky/pre-commit');
  }
  if (result.scanCompleted) {
    lines.push('    [check] .specter/ (knowledge graph)');
    if (result.fileCount && result.nodeCount) {
      lines.push('');
      lines.push(`  I am ${projectName}!`);
      lines.push(`    Files: ${result.fileCount}`);
      lines.push(`    Symbols: ${result.nodeCount}`);
      if (result.healthScore !== undefined) {
        const healthEmoji =
          result.healthScore >= 70
            ? '(healthy)'
            : result.healthScore >= 40
              ? '(moderate)'
              : '(needs attention)';
        lines.push(`    Health: ${result.healthScore}/100 ${healthEmoji}`);
      }
    }
  }

  lines.push('');
  lines.push('  Your codebase is now haunted.');
  lines.push('');
  lines.push('  Next steps:');
  lines.push('    specter roast     # Get roasted (if you dare)');
  lines.push('    specter health    # Check codebase health');
  lines.push('    specter demo      # Watch the magic unfold');
  lines.push('');
  lines.push('  Or try: npx @purplegumdropz/specter-roast');
  lines.push('');

  return lines.join('\n');
}

/**
 * Check if config file already exists
 */
async function configExists(rootDir: string): Promise<boolean> {
  const configPath = path.join(rootDir, 'specter.config.json');
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create the specter.config.json file
 */
async function createConfig(rootDir: string, config: SpecterProjectConfig): Promise<void> {
  const configPath = path.join(rootDir, 'specter.config.json');
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

/**
 * Check if husky is available
 */
async function huskyAvailable(rootDir: string): Promise<boolean> {
  const huskyPath = path.join(rootDir, 'node_modules', '.bin', 'husky');
  try {
    await fs.access(huskyPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if .husky directory exists
 */
async function huskyDirExists(rootDir: string): Promise<boolean> {
  const huskyDir = path.join(rootDir, '.husky');
  try {
    const stat = await fs.stat(huskyDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Install pre-commit hook
 */
async function installPreCommitHook(rootDir: string): Promise<boolean> {
  const huskyDir = path.join(rootDir, '.husky');

  try {
    // Create .husky directory if it doesn't exist
    await fs.mkdir(huskyDir, { recursive: true });

    const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run Specter pre-commit check
npx specter precommit
`;

    const hookPath = path.join(huskyDir, 'pre-commit');
    await fs.writeFile(hookPath, hookContent, { mode: 0o755 });

    return true;
  } catch {
    return false;
  }
}

/**
 * Run initial scan
 */
async function runInitialScan(
  rootDir: string,
  onProgress?: (phase: string, completed: number, total: number) => void
): Promise<{ fileCount: number; nodeCount: number; healthScore: number }> {
  const result = await buildKnowledgeGraph({
    rootDir,
    includeGitHistory: true,
    onProgress,
  });

  await saveGraph(result.graph, rootDir);

  const stats = getGraphStats(result.graph);
  const healthScore = Math.max(0, 100 - stats.avgComplexity * 5);

  return {
    fileCount: stats.fileCount,
    nodeCount: stats.nodeCount - stats.fileCount,
    healthScore: Math.round(healthScore),
  };
}

/**
 * Interactive initialization flow
 */
export async function initializeProjectInteractive(rootDir: string): Promise<InitResult> {
  const rl = createReadline();

  const result: InitResult = {
    configCreated: false,
    hooksInstalled: false,
    scanCompleted: false,
    graphPath: path.join(rootDir, '.specter'),
  };

  try {
    // Check if already initialized
    const hasConfig = await configExists(rootDir);
    const hasGraph = await graphExists(rootDir);

    if (hasConfig && hasGraph) {
      console.log('');
      console.log('  Specter is already initialized in this project!');
      console.log('');
      console.log('  To reinitialize, delete specter.config.json and .specter/');
      console.log('');
      rl.close();
      return result;
    }

    const config: SpecterProjectConfig = { ...DEFAULT_PROJECT_CONFIG };

    // 1. Choose personality
    console.log('');
    console.log('  Choose a personality mode:');
    console.log('');
    for (let i = 0; i < INIT_PERSONALITIES.length; i++) {
      const p = INIT_PERSONALITIES[i];
      const marker = p.mode === 'default' ? '> ' : '  ';
      console.log(`  ${marker}${i + 1}. ${p.mode} - ${p.description}`);
    }
    console.log('');

    const personalityAnswer = await prompt(rl, '  Enter number (1-7) or press Enter for default: ');
    const personalityIndex = parseInt(personalityAnswer, 10) - 1;

    if (personalityIndex >= 0 && personalityIndex < INIT_PERSONALITIES.length) {
      config.personality = INIT_PERSONALITIES[personalityIndex].mode;
    }

    console.log(`  Selected: ${config.personality}`);
    console.log('');

    // 2. Set up hooks?
    console.log('  Set up pre-commit hooks?');
    console.log('    y - Run checks before each commit (recommended)');
    console.log("    n - I'll run manually");
    console.log('');

    const hooksAnswer = await prompt(rl, '  Set up hooks? (Y/n): ');
    const setupHooks = hooksAnswer !== 'n';

    if (setupHooks) {
      config.hooks.preCommit = true;
    } else {
      config.hooks.preCommit = false;
    }

    console.log(`  Hooks: ${setupHooks ? 'Yes' : 'No'}`);
    console.log('');

    // 3. Run initial scan?
    console.log('  Run initial scan now?');
    console.log('    y - Scan and build knowledge graph (recommended)');
    console.log("    n - I'll run 'specter scan' later");
    console.log('');

    const scanAnswer = await prompt(rl, '  Run scan? (Y/n): ');
    const runScan = scanAnswer !== 'n';

    console.log(`  Scan: ${runScan ? 'Yes' : 'No'}`);
    console.log('');

    rl.close();

    // Execute the initialization
    console.log('  Setting up Specter...');
    console.log('');

    // Create config file
    await createConfig(rootDir, config);
    result.configCreated = true;
    console.log('  [check] Created specter.config.json');

    // Install hooks if requested
    if (setupHooks) {
      const hasHusky = await huskyAvailable(rootDir);
      const hasHuskyDir = await huskyDirExists(rootDir);

      if (hasHusky || hasHuskyDir) {
        const installed = await installPreCommitHook(rootDir);
        if (installed) {
          result.hooksInstalled = true;
          console.log('  [check] Installed pre-commit hook');
        } else {
          console.log('  [warn] Could not install hook - create manually');
        }
      } else {
        console.log('  [info] Husky not found - to set up hooks:');
        console.log('         npm install husky --save-dev');
        console.log('         npx husky init');
        console.log('         Then add: npx specter precommit');
      }
    }

    // Run scan if requested
    if (runScan) {
      console.log('');
      console.log('  Scanning codebase...');

      let lastPhase = '';
      const scanResult = await runInitialScan(rootDir, (phase, completed, total) => {
        if (phase !== lastPhase) {
          process.stdout.write(`\r  ${phase}...`);
          lastPhase = phase;
        }
        if (total > 1) {
          const progress = Math.round((completed / total) * 100);
          process.stdout.write(`\r  ${phase}... ${progress}%`);
        }
      });

      process.stdout.write(`\r${' '.repeat(60)}\r`);
      console.log('  [check] Built knowledge graph');

      result.scanCompleted = true;
      result.fileCount = scanResult.fileCount;
      result.nodeCount = scanResult.nodeCount;
      result.healthScore = scanResult.healthScore;
    }

    return result;
  } catch (error) {
    rl.close();
    throw error;
  }
}

/**
 * Non-interactive initialization (--yes flag)
 */
export async function initializeProject(
  rootDir: string,
  options: InitOptions
): Promise<InitResult> {
  const result: InitResult = {
    configCreated: false,
    hooksInstalled: false,
    scanCompleted: false,
    graphPath: path.join(rootDir, '.specter'),
  };

  // Check if already initialized
  const hasConfig = await configExists(rootDir);
  const hasGraph = await graphExists(rootDir);

  if (hasConfig && hasGraph) {
    return result;
  }

  const config: SpecterProjectConfig = {
    ...DEFAULT_PROJECT_CONFIG,
    personality: options.personality,
    hooks: {
      preCommit: options.hooks,
      prePush: false,
    },
  };

  // Create config
  if (options.config) {
    await createConfig(rootDir, config);
    result.configCreated = true;
  }

  // Install hooks
  if (options.hooks) {
    const hasHusky = await huskyAvailable(rootDir);
    const hasHuskyDir = await huskyDirExists(rootDir);

    if (hasHusky || hasHuskyDir) {
      const installed = await installPreCommitHook(rootDir);
      result.hooksInstalled = installed;
    }
  }

  // Run scan
  if (options.scan) {
    const scanResult = await runInitialScan(rootDir);
    result.scanCompleted = true;
    result.fileCount = scanResult.fileCount;
    result.nodeCount = scanResult.nodeCount;
    result.healthScore = scanResult.healthScore;
  }

  return result;
}

/**
 * List available personality modes for CLI help
 */
export function listAvailablePersonalities(): string {
  return INIT_PERSONALITIES.map((p) => p.mode).join(', ');
}
