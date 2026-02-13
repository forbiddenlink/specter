/**
 * Interactive Mode - REPL-style command exploration
 *
 * Launches an interactive shell where users can run multiple commands
 * without restarting the CLI. Perfect for exploration and learning.
 */

import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import type { Command } from 'commander';
import { suggestCommand } from '../../cli-utils.js';

interface CommandRegistry {
  name: string;
  description: string;
  category: string;
}

const COMMANDS_REGISTRY: CommandRegistry[] = [
  { name: 'health', category: 'analysis', description: 'Codebase health metrics' },
  { name: 'scan', category: 'analysis', description: 'Scan and build knowledge graph' },
  { name: 'hotspots', category: 'analysis', description: 'Find complexity hotspots' },
  { name: 'coupling', category: 'analysis', description: 'Discover hidden dependencies' },
  { name: 'bus-factor', category: 'risk', description: 'Analyze knowledge distribution' },
  { name: 'cycles', category: 'analysis', description: 'Find circular dependencies' },
  { name: 'ask', category: 'ai', description: 'Ask your code questions' },
  { name: 'fix', category: 'suggestions', description: 'Get refactoring suggestions' },
  { name: 'who', category: 'team', description: 'Find file expertise' },
  { name: 'dashboard', category: 'visualization', description: 'Web dashboard' },
  { name: 'wrapped', category: 'stats', description: 'Year in review' },
  { name: 'roast', category: 'fun', description: 'Roast your code' },
  { name: 'help', category: 'meta', description: 'Show help' },
  { name: 'clear', category: 'meta', description: 'Clear screen' },
  { name: 'exit', category: 'meta', description: 'Exit interactive mode' },
];

const CATEGORY_EMOJIS: Record<string, string> = {
  analysis: '📊',
  risk: '⚠️',
  ai: '🤖',
  suggestions: '💡',
  team: '👥',
  visualization: '📈',
  stats: '📉',
  fun: '🎮',
  meta: '⚙️',
};

export function register(program: Command): void {
  program
    .command('interactive')
    .alias('i')
    .alias('repl')
    .description('Launch interactive mode for exploring your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--no-welcome', 'Skip welcome message')
    .addHelpText(
      'after',
      `
Examples:
  $ specter interactive
  $ specter interactive --dir ./backend
  
Commands available in interactive mode:
  health              Show codebase health
  hotspots            Find complexity hotspots
  ask <question>      Ask your code questions
  fix                 Get refactoring suggestions
  wrapped             Year in review
  roast               Roast your code
  help                Show available commands
  clear               Clear screen
  exit, quit          Exit interactive mode

💡 Tip: Use "help" to see all available commands and their descriptions.
`
    )
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      await startInteractiveMode(rootDir, !options.welcome);
    });
}

async function startInteractiveMode(rootDir: string, showWelcome: boolean = true): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (showWelcome) {
    printWelcome();
  }

  const prompt = (): void => {
    rl.question(chalk.cyan('👻 > '), async (input) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        prompt();
        return;
      }

      await handleCommand(trimmedInput, rootDir, rl);

      prompt();
    });
  };

  prompt();
}

async function handleCommand(
  input: string,
  _rootDir: string,
  rl: readline.Interface
): Promise<void> {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case 'exit':
    case 'quit':
    case 'q':
      console.log(chalk.dim('👋 Goodbye!'));
      rl.close();
      process.exit(0);
      break;

    case 'clear':
    case 'cls':
      console.clear();
      break;

    case 'help':
    case 'h':
      showHelp(args[0]);
      break;

    case 'health':
      console.log(chalk.dim('  → Would run: specter health'));
      console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      break;

    case 'hotspots':
    case 'hot':
      {
        const limit = args[0] || '10';
        console.log(chalk.dim(`  → Would run: specter hotspots --limit ${limit}`));
        console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      }
      break;

    case 'ask':
      {
        const question = args.join(' ') || 'what should I focus on?';
        console.log(chalk.dim(`  → Would run: specter ask "${question}"`));
        console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      }
      break;

    case 'fix':
      {
        const file = args[0] || 'all';
        console.log(chalk.dim(`  → Would run: specter fix ${file}`));
        console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      }
      break;

    case 'roast':
      {
        const personality = args[0] || 'default';
        console.log(chalk.dim(`  → Would run: specter roast --personality ${personality}`));
        console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      }
      break;

    case 'wrapped':
      console.log(chalk.dim('  → Would run: specter wrapped'));
      console.log(chalk.gray('  (in real implementation, this would execute the command)'));
      break;

    case 'ls':
    case 'commands':
      showAvailableCommands();
      break;

    default: {
      const suggestion = suggestCommand(
        cmd,
        COMMANDS_REGISTRY.map((c) => c.name)
      );
      console.error(chalk.red(`❌ Unknown command: ${cmd}`));
      if (suggestion) {
        console.error(chalk.yellow(`💡 Did you mean: ${suggestion}?`));
        console.error(chalk.dim('   Type "help" for all commands'));
      } else {
        console.error(chalk.yellow(`💡 Type "help" to see available commands`));
      }
    }
  }
}

function printWelcome(): void {
  console.log();
  console.log(chalk.bold.magenta('  👻 Welcome to Specter Interactive Mode'));
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();
  console.log(chalk.cyan('  Type "help" to see available commands'));
  console.log(chalk.cyan('  Type "exit" to quit'));
  console.log();
}

function showHelp(commandFilter?: string): void {
  if (commandFilter) {
    const cmd = COMMANDS_REGISTRY.find((c) => c.name.toLowerCase() === commandFilter.toLowerCase());
    if (cmd) {
      console.log();
      console.log(chalk.bold(`  ${cmd.name}`));
      console.log(chalk.gray(`  ${cmd.description}`));
      console.log();
      return;
    }
  }

  showAvailableCommands();
}

function showAvailableCommands(): void {
  console.log();
  console.log(chalk.bold('  📚 Available Commands'));
  console.log(chalk.dim('  ─────────────────────'));
  console.log();

  // Group by category
  const grouped: Record<string, CommandRegistry[]> = {};
  for (const cmd of COMMANDS_REGISTRY) {
    if (!grouped[cmd.category]) {
      grouped[cmd.category] = [];
    }
    grouped[cmd.category].push(cmd);
  }

  // Display by category
  for (const [category, cmds] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJIS[category] || '•';
    console.log(chalk.bold(`  ${emoji} ${category.toUpperCase()}`));

    for (const cmd of cmds) {
      console.log(chalk.cyan(`    ${cmd.name.padEnd(15)}`), chalk.gray(cmd.description));
    }

    console.log();
  }

  console.log(chalk.dim('  💡 Example: health | hotspots 5 | ask "why is X complex?"'));
  console.log();
}
