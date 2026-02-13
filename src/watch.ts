/**
 * Watch Mode - Real-time code analysis
 *
 * Watches file changes and provides live feedback with personality.
 * This makes Specter ACTIVE instead of reactive - a true development companion.
 */

import { existsSync, readdirSync, readFileSync, statSync, watch } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { loadGraph, saveGraph } from './graph/persistence.js';
import type { PersonalityMode } from './personality/types.js';

export interface WatchOptions {
  rootDir: string;
  mode?: PersonalityMode;
  debounceMs?: number;
  excludePatterns?: string[];
  showAll?: boolean; // Show all changes, not just significant ones
}

export interface FileChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  timestamp: Date;
  linesDelta?: number;
  sizeBytes?: number;
}

interface ChangeStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

// Track file sizes for comparison
const fileSizeCache = new Map<string, number>();
const lineCountCache = new Map<string, number>();

// Debounce helper
class Debouncer {
  private timeouts = new Map<string, NodeJS.Timeout>();

  debounce(key: string, fn: () => void, ms: number): void {
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      this.timeouts.delete(key);
      fn();
    }, ms);

    this.timeouts.set(key, timeout);
  }

  clear(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}

/**
 * Count lines in a file
 */
function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Analyze a changed file and return insights
 */
function analyzeChangedFile(filePath: string, rootDir: string): FileChange | null {
  try {
    const relativePath = path.relative(rootDir, filePath);

    // Check if file should be excluded
    if (shouldExcludeFile(relativePath)) {
      return null;
    }

    // Check if file exists (or was deleted)
    if (!existsSync(filePath)) {
      const change: FileChange = {
        file: relativePath,
        type: 'deleted',
        timestamp: new Date(),
      };

      // Clean up caches
      fileSizeCache.delete(relativePath);
      lineCountCache.delete(relativePath);

      return change;
    }

    // Get file stats
    const stats = statSync(filePath);
    const previousSize = fileSizeCache.get(relativePath);
    const isNew = previousSize === undefined;

    // Get line count
    const currentLines = countLines(filePath);
    const previousLines = lineCountCache.get(relativePath) ?? 0;
    const linesDelta = currentLines - previousLines;

    // Update caches
    fileSizeCache.set(relativePath, stats.size);
    lineCountCache.set(relativePath, currentLines);

    const change: FileChange = {
      file: relativePath,
      type: isNew ? 'added' : 'modified',
      timestamp: new Date(),
      linesDelta,
      sizeBytes: stats.size,
    };

    return change;
  } catch (_error) {
    // File might be temporarily unavailable
    return null;
  }
}

/**
 * Format change notification with personality
 */
function formatChangeNotification(
  change: FileChange,
  mode: PersonalityMode,
  showAll: boolean
): string | null {
  const { file, type, linesDelta } = change;
  const fileName = path.basename(file);

  // Skip insignificant changes unless showAll is true
  if (!showAll) {
    const isSignificant = Math.abs(linesDelta ?? 0) > 10 || type === 'added' || type === 'deleted';

    if (!isSignificant) {
      return null;
    }
  }

  const timestamp = chalk.dim(`[${new Date().toLocaleTimeString()}]`);
  let emoji = '📝';
  let message = '';
  let color = chalk.white;

  if (type === 'added') {
    emoji = '✨';
    message = getMessage(mode, 'added', fileName);
    color = chalk.green;
  } else if (type === 'deleted') {
    emoji = '🗑️';
    message = getMessage(mode, 'deleted', fileName);
    color = chalk.dim;
  } else if (linesDelta && Math.abs(linesDelta) > 10) {
    if (linesDelta > 50) {
      emoji = '📈';
      message = getMessage(mode, 'largeGrowth', fileName, linesDelta);
      color = chalk.yellow;
    } else if (linesDelta > 0) {
      emoji = '📊';
      message = getMessage(mode, 'growth', fileName, linesDelta);
      color = chalk.cyan;
    } else if (linesDelta < -50) {
      emoji = '🧹';
      message = getMessage(mode, 'largeShrink', fileName, Math.abs(linesDelta));
      color = chalk.green;
    } else {
      emoji = '📉';
      message = getMessage(mode, 'shrink', fileName, Math.abs(linesDelta));
      color = chalk.green;
    }
  } else {
    message = `${fileName} updated`;
    color = chalk.dim;
  }

  return `${timestamp} ${emoji} ${color(message)}`;
}

/**
 * Get personality-based message for file changes
 */
function getMessage(
  mode: PersonalityMode,
  changeType: 'added' | 'deleted' | 'growth' | 'shrink' | 'largeGrowth' | 'largeShrink',
  fileName: string,
  delta?: number
): string {
  const messages: Record<string, Record<string, string>> = {
    default: {
      added: `New file: ${fileName}`,
      deleted: `Deleted: ${fileName}`,
      growth: `${fileName} +${delta} lines`,
      shrink: `${fileName} -${delta} lines`,
      largeGrowth: `${fileName} grew by ${delta} lines`,
      largeShrink: `${fileName} cleaned up (-${delta} lines)`,
    },
    roast: {
      added: `Oh great, more code to roast: ${fileName}`,
      deleted: `Finally deleted ${fileName}. About time.`,
      growth: `${fileName} is getting messier (+${delta} lines). Classic.`,
      shrink: `Wait, you actually cleaned ${fileName}? (-${delta}) Shocked.`,
      largeGrowth: `${fileName} exploded to +${delta} lines. Planning to refactor, or...?`,
      largeShrink: `Wow, ${fileName} lost ${delta} lines. Did you accidentally delete everything?`,
    },
    noir: {
      added: `A new file appears in the shadows: ${fileName}`,
      deleted: `${fileName} vanished into the night...`,
      growth: `The story deepens in ${fileName} (+${delta})`,
      shrink: `Things are clearing up in ${fileName} (-${delta})`,
      largeGrowth: `${fileName} grows darker (+${delta} lines)`,
      largeShrink: `The fog lifts from ${fileName} (-${delta})`,
    },
    zen: {
      added: `${fileName} joins the flow 🧘`,
      deleted: `${fileName} returns to simplicity 🍃`,
      growth: `${fileName} grows naturally (+${delta}). All is balance.`,
      shrink: `${fileName} finds simplicity (-${delta}). Peace.`,
      largeGrowth: `${fileName} expands like a river (+${delta} lines)`,
      largeShrink: `${fileName} returns to essence (-${delta})`,
    },
    pirate: {
      added: `Ahoy! New treasure discovered: ${fileName} 🏴‍☠️`,
      deleted: `${fileName} walked the plank! ⚓`,
      growth: `${fileName} be growin' (+${delta} lines)`,
      shrink: `Ye trimmed ${fileName} (-${delta})! Arrr!`,
      largeGrowth: `${fileName} swelled like the seven seas! (+${delta})`,
      largeShrink: `Cleaned ${fileName} like a ship's deck! (-${delta})`,
    },
    motivational: {
      added: `🌟 Great start with ${fileName}! You've got this!`,
      deleted: `Cleaned up ${fileName}! Making space for greatness!`,
      growth: `${fileName} is growing (+${delta}). You're learning and evolving! 💪`,
      shrink: `Amazing cleanup in ${fileName} (-${delta})! You're crushing it! 🎉`,
      largeGrowth: `Big progress in ${fileName} (+${delta})! Keep that momentum!`,
      largeShrink: `Incredible refactor in ${fileName} (-${delta})! That's what I'm talking about!`,
    },
    sage: {
      added: `A new chapter begins: ${fileName}`,
      deleted: `Let go of ${fileName}. Wisdom is knowing what to remove.`,
      growth: `${fileName} grows (+${delta}). With growth comes wisdom.`,
      shrink: `${fileName} finds elegance (-${delta}). Simplicity is sophistication.`,
      largeGrowth: `${fileName} expands its horizons (+${delta})`,
      largeShrink: `${fileName} achieves clarity (-${delta} lines)`,
    },
    hacker: {
      added: `[+] Injected ${fileName} into the codebase`,
      deleted: `[-] Purged ${fileName} from the matrix`,
      growth: `[~] ${fileName} expanded by ${delta} LOC`,
      shrink: `[✓] ${fileName} optimized: -${delta} lines`,
      largeGrowth: `[!] ${fileName} payload size: +${delta} lines`,
      largeShrink: `[✓✓] ${fileName} refactored: -${delta} lines`,
    },
    poet: {
      added: `Like ink on parchment, ${fileName} is born`,
      deleted: `${fileName} fades like autumn leaves...`,
      growth: `${fileName} grows (+${delta}), a tapestry of thought`,
      shrink: `${fileName} finds grace (-${delta}), elegance in simplicity`,
      largeGrowth: `${fileName} blooms with ${delta} lines of verse`,
      largeShrink: `${fileName} distills to essence, losing ${delta} lines`,
    },
    valley: {
      added: `Shipping ${fileName}! Let's disrupt! 🚀`,
      deleted: `Pivoted away from ${fileName}. Fail fast!`,
      growth: `${fileName} scaling up (+${delta}). Growth mindset! 📈`,
      shrink: `${fileName} optimized (-${delta}). Move fast! ⚡`,
      largeGrowth: `${fileName} going viral! +${delta} lines 🚀`,
      largeShrink: `${fileName} pivoted: -${delta} lines. Ship it!`,
    },
  };

  const modeMessages = messages[mode] || messages.default;
  return modeMessages[changeType] || `${fileName} changed`;
}

/**
 * Should exclude file from watch
 */
function shouldExcludeFile(relativePath: string): boolean {
  const excludePatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    /\.next/,
    /\.nuxt/,
    /\.output/,
    /\.vercel/,
    /\.netlify/,
    /\.(log|lock)$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
  ];

  return excludePatterns.some((pattern) => pattern.test(relativePath));
}

/**
 * Start watching for file changes
 */
export async function startWatch(options: WatchOptions): Promise<void> {
  const { rootDir, mode = 'default', debounceMs = 500, showAll = false } = options;

  // Load initial graph
  const graph = await loadGraph(rootDir);
  if (!graph) {
    console.log(
      chalk.yellow(
        '\n  ⚠️  No knowledge graph found. Run `specter scan` first to build the graph.\n'
      )
    );
    return;
  }

  // Initialize caches with current file states
  const srcDir = path.join(rootDir, 'src');
  if (existsSync(srcDir)) {
    const initFiles = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!shouldExcludeFile(entry.name)) {
              initFiles(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
              const relativePath = path.relative(rootDir, fullPath);
              if (!shouldExcludeFile(relativePath)) {
                const stats = statSync(fullPath);
                fileSizeCache.set(relativePath, stats.size);
                lineCountCache.set(relativePath, countLines(fullPath));
              }
            }
          }
        }
      } catch (_error) {
        // Ignore errors during initialization
      }
    };
    initFiles(srcDir);
  }

  const debouncer = new Debouncer();
  const stats: ChangeStats = {
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
  };

  // Display header
  console.log();
  const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  console.log(g('  ╔═══════════════════════════════════════════╗'));
  console.log(g('  ║') + chalk.bold.white('          👻 SPECTER WATCHING...           ') + g('║'));
  console.log(g('  ╚═══════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.dim(`  Monitoring: ${rootDir}`));
  console.log(chalk.dim(`  Personality: ${mode}`));
  console.log(chalk.dim(`  Press Ctrl+C to stop`));
  console.log();

  // Start watching recursively
  const watcher = watch(rootDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;

    const filePath = path.join(rootDir, filename);
    const ext = path.extname(filename);

    // Only watch TypeScript/JavaScript files
    if (!['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      return;
    }

    // Debounce file changes (avoid duplicate events)
    debouncer.debounce(
      filename,
      () => {
        const change = analyzeChangedFile(filePath, rootDir);

        if (!change) return;

        // Update stats
        stats.filesChanged++;
        if (change.linesDelta) {
          if (change.linesDelta > 0) {
            stats.linesAdded += change.linesDelta;
          } else {
            stats.linesRemoved += Math.abs(change.linesDelta);
          }
        }

        // Display notification
        const notification = formatChangeNotification(change, mode, showAll);
        if (notification) {
          console.log(`  ${notification}`);
        }

        // Periodically save updated graph (every 10 changes)
        if (stats.filesChanged % 10 === 0) {
          saveGraph(graph, rootDir).catch(() => {
            // Silently fail - don't interrupt watch mode
          });
        }
      },
      debounceMs
    );
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n');
    const g2 = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
    console.log(g2('  ╔═══════════════════════════════════════════╗'));
    console.log(
      g2('  ║') + chalk.bold.white('        👻 SPECTER SESSION SUMMARY         ') + g2('║')
    );
    console.log(g2('  ╚═══════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.cyan(`  Files changed: ${stats.filesChanged}`));
    console.log(chalk.dim(`  Lines added: +${stats.linesAdded}`));
    console.log(chalk.dim(`  Lines removed: -${stats.linesRemoved}`));

    const netLines = stats.linesAdded - stats.linesRemoved;
    if (netLines > 100) {
      console.log();
      console.log(chalk.yellow(`  📈 Your codebase grew by ${netLines} lines this session`));
      console.log(chalk.dim(`     Remember: less is often more!`));
    } else if (netLines < -50) {
      console.log();
      console.log(
        chalk.green(`  🎉 You removed ${Math.abs(netLines)} lines! Clean code is happy code!`)
      );
    }

    console.log();
    console.log(chalk.dim('  See you next time! 👻\n'));

    debouncer.clear();
    watcher.close();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {
    // Runs indefinitely
  });
}

/**
 * Format watch output for display
 */
export function formatWatch(changes: FileChange[], mode: PersonalityMode): string {
  const output: string[] = [];

  for (const change of changes) {
    const notification = formatChangeNotification(change, mode, true);
    if (notification) {
      output.push(notification);
    }
  }

  return output.join('\n');
}
