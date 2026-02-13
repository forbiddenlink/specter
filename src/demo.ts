/**
 * Demo - Guided Feature Showcase
 *
 * A 60-second demo that showcases Specter's best features
 * with dramatic pauses and personality. Perfect for recordings
 * and live demos.
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import { getGraphStats } from './graph/builder.js';
import type { KnowledgeGraph } from './graph/types.js';
import { generateHoroscope } from './horoscope.js';
import { analyzeHotspots } from './hotspots.js';
import { applyPersonality } from './personality/formatter.js';
import type { PersonalityMode } from './personality/types.js';

export interface DemoOptions {
  personality: PersonalityMode;
  speed: 'slow' | 'normal' | 'fast';
  steps: string[];
  rootDir: string;
}

interface DemoContext {
  graph: KnowledgeGraph;
  personality: PersonalityMode;
  rootDir: string;
}

interface DemoStep {
  name: string;
  title: string;
  emoji: string;
  run: (ctx: DemoContext) => Promise<string>;
  delay: number;
}

/**
 * Calculate health score from graph stats
 */
function calculateHealthScore(graph: KnowledgeGraph): number {
  const stats = getGraphStats(graph);
  return Math.max(0, Math.min(100, Math.round(100 - stats.avgComplexity * 5)));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Type text character by character for dramatic effect
 */
async function typeText(text: string, speed: number = 30): Promise<void> {
  const cursor = '\u2588';
  for (let i = 0; i < text.length; i++) {
    process.stdout.write(`\r${text.slice(0, i + 1)}${chalk.dim(cursor)}`);
    await sleep(speed);
  }
  process.stdout.write(`\r${text} \n`);
}

/**
 * Display a section header with animation
 */
async function showHeader(emoji: string, title: string): Promise<void> {
  const specterGradient = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  console.log();
  console.log(specterGradient('\u2501'.repeat(50)));
  await typeText(`${emoji}  ${chalk.bold.cyan(title)}`, 20);
  console.log(specterGradient('\u2501'.repeat(50)));
  console.log();
}

/**
 * Demo step: Health check
 */
async function demoHealth(ctx: DemoContext): Promise<string> {
  const { graph, personality } = ctx;
  const stats = getGraphStats(graph);
  const healthScore = calculateHealthScore(graph);

  const lines: string[] = [];

  // Health score with visual bar
  const barWidth = 30;
  const filled = Math.round((healthScore / 100) * barWidth);
  const healthGradient = gradient(['#ff6b6b', '#ffd93d', '#6bcb77']);
  const bar =
    healthGradient('\u2588'.repeat(filled)) + chalk.dim('\u2591'.repeat(barWidth - filled));

  lines.push(`  Health Score: ${chalk.bold(healthScore.toString())}/100`);
  lines.push(`  ${bar}`);
  lines.push('');
  lines.push(
    `  ${chalk.dim('Files:')} ${stats.fileCount}  ${chalk.dim('Symbols:')} ${stats.nodeCount}  ${chalk.dim('Avg Complexity:')} ${stats.avgComplexity.toFixed(1)}`
  );

  // Personality commentary
  const baseComment =
    healthScore >= 70
      ? "I'm feeling pretty good about myself!"
      : healthScore >= 40
        ? 'Could be better, could be worse...'
        : 'Help. Please.';
  const commentary = applyPersonality(baseComment, personality);
  lines.push('');
  lines.push(`  ${chalk.italic(commentary)}`);

  return lines.join('\n');
}

/**
 * Demo step: Roast
 */
async function demoRoast(ctx: DemoContext): Promise<string> {
  const { graph } = ctx;
  const stats = getGraphStats(graph);
  const healthScore = calculateHealthScore(graph);

  const roasts = [
    `Your codebase has ${stats.fileCount} files. That's not a project, that's a cry for help.`,
    `Average complexity of ${stats.avgComplexity.toFixed(1)}? I've seen spaghetti with more structure.`,
    `Health score of ${healthScore}? My grandma's COBOL has better metrics.`,
    `${stats.nodeCount} symbols and I'm betting half are TODO comments.`,
    "You call this architecture? I call it 'throw it at the wall and see what compiles.'",
  ];

  const selectedRoasts = roasts.slice(0, 3);
  const lines: string[] = [];

  for (const roast of selectedRoasts) {
    lines.push(`  ${chalk.red('\u{1F525}')} ${chalk.yellow(roast)}`);
    lines.push('');
  }

  lines.push(`  ${chalk.dim("(Don't worry, we roast because we care)")}`);

  return lines.join('\n');
}

/**
 * Demo step: Horoscope
 */
async function demoHoroscope(ctx: DemoContext): Promise<string> {
  const { graph } = ctx;
  const horoscope = generateHoroscope(graph);

  const lines: string[] = [];
  lines.push(
    `  ${chalk.magenta(`${horoscope.zodiac.emoji} ${horoscope.zodiac.sign}`)} ${chalk.dim(`(${horoscope.zodiac.trait})`)}`
  );
  lines.push('');
  lines.push(`  ${chalk.italic(horoscope.starSuggests)}`);
  lines.push('');
  lines.push(`  ${chalk.dim('Lucky file:')} ${horoscope.luckyFile}`);
  lines.push(`  ${chalk.dim('Avoid:')} ${horoscope.avoid}`);

  return lines.join('\n');
}

/**
 * Demo step: Quick hotspots preview
 */
async function demoHotspots(ctx: DemoContext): Promise<string> {
  const { graph, rootDir } = ctx;

  try {
    const result = await analyzeHotspots(rootDir, graph, { top: 5 });
    const top3 = result.hotspots.slice(0, 3);

    if (top3.length === 0) {
      return '  No hotspots detected - your code is surprisingly clean!';
    }

    const lines: string[] = [];
    lines.push(`  ${chalk.red('Top Risk Files')} ${chalk.dim('(Complexity \u00d7 Churn)')}`);
    lines.push('');

    for (let i = 0; i < top3.length; i++) {
      const hotspot = top3[i];
      if (!hotspot) continue;
      const riskBar = chalk.red(
        '\u2588'.repeat(Math.min(10, Math.ceil(hotspot.hotspotScore / 10)))
      );
      lines.push(`  ${i + 1}. ${chalk.yellow(hotspot.file)}`);
      lines.push(`     ${riskBar} ${chalk.dim(`Risk: ${hotspot.hotspotScore.toFixed(0)}`)}`);
    }

    return lines.join('\n');
  } catch {
    return '  Hotspot analysis requires git history - skipping...';
  }
}

/**
 * Demo step: Teaser for more commands
 */
async function demoTeaser(_ctx: DemoContext): Promise<string> {
  const commands = [
    { cmd: 'specter tinder', desc: 'Dating profile for your code' },
    { cmd: 'specter seance', desc: 'Commune with deleted files' },
    { cmd: 'specter wrapped', desc: 'Your year in code' },
    { cmd: 'specter achievements', desc: 'Unlock coding badges' },
    { cmd: 'specter dora', desc: 'Industry-standard metrics' },
    { cmd: 'specter bus-factor', desc: 'Who can you NOT lose?' },
  ];

  const lines: string[] = [];
  lines.push(`  ${chalk.bold("But wait, there's more...")}`);
  lines.push('');

  for (const { cmd, desc } of commands) {
    lines.push(`  ${chalk.cyan(cmd.padEnd(25))} ${chalk.dim(desc)}`);
  }

  lines.push('');
  lines.push(
    `  ${chalk.bold.green('52 commands total')} ${chalk.dim('- Run')} ${chalk.cyan('specter --help')} ${chalk.dim('to see them all')}`
  );

  return lines.join('\n');
}

/**
 * All available demo steps
 */
const DEMO_STEPS: Record<string, DemoStep> = {
  health: {
    name: 'health',
    title: 'Health Check',
    emoji: '\u{1F3E5}',
    run: demoHealth,
    delay: 2000,
  },
  roast: {
    name: 'roast',
    title: 'Roast Mode',
    emoji: '\u{1F525}',
    run: demoRoast,
    delay: 3000,
  },
  horoscope: {
    name: 'horoscope',
    title: 'Code Horoscope',
    emoji: '\u{1F52E}',
    run: demoHoroscope,
    delay: 2500,
  },
  hotspots: {
    name: 'hotspots',
    title: 'Risk Hotspots',
    emoji: '\u{1F6A8}',
    run: demoHotspots,
    delay: 2000,
  },
  teaser: {
    name: 'teaser',
    title: 'And More...',
    emoji: '\u{2728}',
    run: demoTeaser,
    delay: 1000,
  },
};

/**
 * Default demo sequence
 */
const DEFAULT_STEPS = ['health', 'roast', 'horoscope', 'hotspots', 'teaser'];

/**
 * Speed multipliers
 */
const SPEED_MULTIPLIERS: Record<string, number> = {
  slow: 1.5,
  normal: 1.0,
  fast: 0.5,
};

/**
 * Run the demo showcase
 */
export async function runDemo(
  graph: KnowledgeGraph,
  rootDir: string,
  options: Partial<DemoOptions> = {}
): Promise<void> {
  const personality = options.personality || 'default';
  const speed = options.speed || 'normal';
  const steps = options.steps || DEFAULT_STEPS;
  const speedMultiplier = SPEED_MULTIPLIERS[speed] ?? 1;

  const ctx: DemoContext = { graph, personality, rootDir };

  // Opening banner
  const specterGradient = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  console.log();
  console.log(specterGradient('  \u{1F47B} SPECTER DEMO'));
  console.log(chalk.dim('  The ghost in your git history'));
  console.log();

  await typeText('  Initializing haunting sequence...', 40 * speedMultiplier);
  await sleep(1000 * speedMultiplier);

  // Run each step
  for (const stepName of steps) {
    const step = DEMO_STEPS[stepName];
    if (!step) continue;

    await showHeader(step.emoji, step.title);

    const output = await step.run(ctx);
    console.log(output);

    await sleep(step.delay * speedMultiplier);
  }

  // Closing
  console.log();
  console.log(specterGradient('\u2501'.repeat(50)));
  console.log();
  await typeText(
    `  ${chalk.bold.green('Demo complete!')} Your codebase has been thoroughly haunted.`,
    25
  );
  console.log();
  console.log(`  ${chalk.dim('Install:')} ${chalk.cyan('npm install -g @purplegumdropz/specter')}`);
  console.log(`  ${chalk.dim('Or try:')} ${chalk.cyan('npx @purplegumdropz/specter-roast')}`);
  console.log();
}

/**
 * Format available demo steps for CLI help
 */
export function formatDemoSteps(): string {
  return Object.keys(DEMO_STEPS).join(', ');
}
