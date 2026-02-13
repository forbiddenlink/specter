/**
 * Anthem command - generates a custom theme song/anthem for a codebase
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import gradient from 'gradient-string';
import { getGraphStats } from '../../graph/builder.js';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { createSpinner } from '../types.js';

type Genre =
  | 'Epic Metal'
  | 'Classical'
  | 'Orchestra'
  | 'Acoustic Solo'
  | 'Blues'
  | 'Pop Hit'
  | 'Punk Rock'
  | 'Lo-Fi Chill';

interface GenreInfo {
  name: Genre;
  emoji: string;
  description: string;
}

const GENRES: Record<Genre, GenreInfo> = {
  'Epic Metal': { name: 'Epic Metal', emoji: '\uD83C\uDFB8', description: 'Complex and massive' },
  Classical: { name: 'Classical', emoji: '\uD83C\uDFBB', description: 'Clean and elegant' },
  Orchestra: { name: 'Orchestra', emoji: '\uD83C\uDFBC', description: 'Many voices in harmony' },
  'Acoustic Solo': {
    name: 'Acoustic Solo',
    emoji: '\uD83C\uDFB5',
    description: 'One dev, one vision',
  },
  Blues: { name: 'Blues', emoji: '\uD83C\uDFBA', description: 'The dead code is singing' },
  'Pop Hit': {
    name: 'Pop Hit',
    emoji: '\uD83C\uDFA4',
    description: 'Clean, catchy, crowd-pleaser',
  },
  'Punk Rock': { name: 'Punk Rock', emoji: '\uD83E\uDD18', description: 'Raw energy, no rules' },
  'Lo-Fi Chill': {
    name: 'Lo-Fi Chill',
    emoji: '\uD83C\uDFA7',
    description: 'Small, cozy, and relaxed',
  },
};

const VERSE_TEMPLATES: Record<Genre, string[][]> = {
  'Epic Metal': [
    [
      'In the halls of {fileCount} files, we code through the night,',
      '{totalLines} lines of fury, our functions burn bright,',
      'Complexity at {complexity}, we fear no refactor,',
      'We are {projectName}, the eternal code crafter! \uD83C\uDFB8',
    ],
    [
      'Forged in the fires of {languages}, we rise,',
      '{nodeCount} nodes of power beneath darkened skies,',
      'Through {edgeCount} edges our data shall flow,',
      '{projectName} stands immortal, no bug lays us low! \uD83C\uDFB8',
    ],
  ],
  Classical: [
    [
      'A symphony of {fileCount} movements, composed with care,',
      '{totalLines} notes of logic, elegant and fair,',
      'Complexity a gentle {complexity}, each function pure,',
      '{projectName}: a masterpiece that will endure. \uD83C\uDFBB',
    ],
    [
      'In measured time and ordered space we write,',
      '{fileCount} files like stanzas, structured and polite,',
      'With {languages} as our instrument of choice,',
      '{projectName} sings with a refined and graceful voice. \uD83C\uDFBB',
    ],
  ],
  Orchestra: [
    [
      '{contributorCount} musicians play the {projectName} score,',
      '{fileCount} instruments, each richer than before,',
      '{totalLines} notes in harmony they weave,',
      'A codebase orchestra no listener would leave! \uD83C\uDFBC',
    ],
    [
      'The chorus swells with {contributorCount} voices strong,',
      'Across {fileCount} files they carry on the song,',
      '{languages} sections blending into one,',
      '{projectName}: where great collaboration is done! \uD83C\uDFBC',
    ],
  ],
  'Acoustic Solo': [
    [
      'One dev, one dream, one {projectName} to build,',
      '{fileCount} files of passion, every promise fulfilled,',
      '{totalLines} lines strummed softly through the night,',
      'A solo act that gets the code just right. \uD83C\uDFB5',
    ],
    [
      'No team, no fuss, just {fileCount} files and me,',
      '{totalLines} lines of honest artistry,',
      'Complexity at {complexity}? I keep it lean,',
      "{projectName}: the cleanest solo code you've seen. \uD83C\uDFB5",
    ],
  ],
  Blues: [
    [
      'Woke up this morning, {deadExports} exports nobody calls,',
      '{totalLines} lines of sorrow echo through these halls,',
      'Complexity at {complexity}, my heart is heavy too,',
      '{projectName} got the dead-code blues, boo-hoo-hoo. \uD83C\uDFBA',
    ],
    [
      'Got {fileCount} files of heartbreak, {deadExports} that never run,',
      'The linter cries at midnight when the build is done,',
      '{totalLines} lines of regret, but we carry on,',
      '{projectName} sings the blues from dusk to dawn. \uD83C\uDFBA',
    ],
  ],
  'Pop Hit': [
    [
      'Hey! Ho! {projectName}! Top of the charts today!',
      '{fileCount} files of bangers, {totalLines} lines to play,',
      'Health score {healthScore}, we keep it fresh and clean,',
      "The hottest repo that you've ever seen! \uD83C\uDFA4",
    ],
    [
      '{projectName}, {projectName}, everybody knows the name!',
      '{fileCount} files, {totalLines} lines, and rising fame,',
      'Complexity is low, the vibes are high,',
      'This codebase was born to fly! \uD83C\uDFA4',
    ],
  ],
  'Punk Rock': [
    [
      "We don't need your standards! {projectName} breaks the mold!",
      '{fileCount} files of chaos, complexity uncontrolled!',
      "{totalLines} lines, no comments, and we don't care!",
      'Health score {healthScore}? We like to live in despair! \uD83E\uDD18',
    ],
    [
      'Three chords and the truth: {fileCount} files of rage,',
      'Complexity at {complexity}?! We set fire to the page!',
      '{totalLines} lines of anarchy, no tests in sight,',
      '{projectName}: coding fast and breaking things tonight! \uD83E\uDD18',
    ],
  ],
  'Lo-Fi Chill': [
    [
      'Soft keystrokes on a rainy afternoon,',
      '{fileCount} files of {projectName}, a gentle tune,',
      '{totalLines} lines flowing easy, nothing rushed,',
      'Complexity at {complexity}, the codebase hushed. \uD83C\uDFA7',
    ],
    [
      'Coffee steaming, {fileCount} files to tend,',
      '{totalLines} lines of {projectName}, our cozy friend,',
      'Written in {languages}, calm and slow,',
      'A lo-fi repo with a gentle glow. \uD83C\uDFA7',
    ],
  ],
};

/**
 * Determine the codebase "genre" based on its stats
 */
function determineGenre(stats: {
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  maxComplexity: number;
  healthScore: number;
  contributorCount: number;
  deadExportCount: number;
}): Genre {
  // High complexity + many files = Epic Metal
  if (stats.avgComplexity > 8 && stats.fileCount > 20) {
    return 'Epic Metal';
  }

  // Low health score = Punk Rock
  if (stats.healthScore < 40) {
    return 'Punk Rock';
  }

  // Many dead exports = Blues
  if (stats.deadExportCount > 10) {
    return 'Blues';
  }

  // Many contributors = Orchestra
  if (stats.contributorCount >= 5) {
    return 'Orchestra';
  }

  // Solo developer = Acoustic Solo
  if (stats.contributorCount <= 1) {
    return 'Acoustic Solo';
  }

  // Low complexity + clean code = Classical
  if (stats.avgComplexity < 3 && stats.healthScore > 75) {
    return 'Classical';
  }

  // High health score = Pop Hit
  if (stats.healthScore >= 70) {
    return 'Pop Hit';
  }

  // Small codebase = Lo-Fi Chill
  if (stats.fileCount < 10 && stats.totalLines < 1000) {
    return 'Lo-Fi Chill';
  }

  // Default fallback based on health
  if (stats.healthScore >= 50) {
    return 'Pop Hit';
  }

  return 'Lo-Fi Chill';
}

/**
 * Fill in template placeholders with actual stats
 */
function fillTemplate(template: string[], vars: Record<string, string | number>): string[] {
  return template.map((line) => {
    let filled = line;
    for (const [key, value] of Object.entries(vars)) {
      filled = filled.replaceAll(`{${key}}`, String(value));
    }
    return filled;
  });
}

/**
 * Count unique contributors across all nodes
 */
function countContributors(nodes: Record<string, { contributors?: string[] }>): number {
  const contributors = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.contributors) {
      for (const c of node.contributors) {
        contributors.add(c);
      }
    }
  }
  return contributors.size;
}

/**
 * Count dead exports (exported but never imported by another file)
 */
function countDeadExports(
  nodes: Record<string, { type: string; exported: boolean }>,
  edges: Array<{ type: string; target: string }>
): number {
  const importedTargets = new Set(edges.filter((e) => e.type === 'imports').map((e) => e.target));

  let deadCount = 0;
  for (const [id, node] of Object.entries(nodes)) {
    if (node.exported && node.type !== 'file' && !importedTargets.has(id)) {
      deadCount++;
    }
  }
  return deadCount;
}

/**
 * Render the anthem box with gradient borders
 */
function renderAnthemBox(genre: GenreInfo, verse: string[], projectName: string): string {
  const purpleGrad = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  const lines: string[] = [];

  const boxWidth = 52;
  const innerWidth = boxWidth - 4; // account for border chars and spaces

  function padLine(text: string): string {
    // Strip ANSI for length calculation
    const stripped = text.replace(
      // eslint-disable-next-line no-control-regex
      /\x1b\[[0-9;]*m/g,
      ''
    );
    const padding = Math.max(0, innerWidth - stripped.length);
    return text + ' '.repeat(padding);
  }

  const topBorder = `\u2554${'\u2550'.repeat(boxWidth - 2)}\u2557`;
  const midBorder = `\u2560${'\u2550'.repeat(boxWidth - 2)}\u2563`;
  const bottomBorder = `\u255A${'\u2550'.repeat(boxWidth - 2)}\u255D`;
  const emptyLine = `\u2551${' '.repeat(boxWidth - 2)}\u2551`;

  lines.push('');
  lines.push(`  ${purpleGrad(topBorder)}`);

  // Header
  const title = `\uD83C\uDFB5 CODEBASE ANTHEM`;
  lines.push(
    `  ${purpleGrad('\u2551')}  ${chalk.bold.magentaBright(padLine(title))}${purpleGrad('\u2551')}`
  );

  const genreLine = `Genre: ${genre.name} ${genre.emoji}`;
  lines.push(
    `  ${purpleGrad('\u2551')}  ${chalk.magenta(padLine(genreLine))}${purpleGrad('\u2551')}`
  );

  const descLine = `"${genre.description}"`;
  lines.push(`  ${purpleGrad('\u2551')}  ${chalk.dim(padLine(descLine))}${purpleGrad('\u2551')}`);

  lines.push(`  ${purpleGrad(midBorder)}`);
  lines.push(`  ${purpleGrad(emptyLine)}`);

  // Verse lines
  for (const verseLine of verse) {
    lines.push(
      `  ${purpleGrad('\u2551')}  ${chalk.white(padLine(verseLine))}${purpleGrad('\u2551')}`
    );
  }

  lines.push(`  ${purpleGrad(emptyLine)}`);

  // Footer
  const footer = `-- The ${projectName} Anthem`;
  lines.push(
    `  ${purpleGrad('\u2551')}  ${chalk.dim.italic(padLine(footer))}${purpleGrad('\u2551')}`
  );

  lines.push(`  ${purpleGrad(emptyLine)}`);
  lines.push(`  ${purpleGrad(bottomBorder)}`);
  lines.push('');

  return lines.join('\n');
}

export function register(program: Command): void {
  program
    .command('anthem')
    .description('Generate a custom anthem/theme song for your codebase')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('anthem', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Composing your codebase anthem...');
      spinner?.start();

      const graphStats = getGraphStats(graph);
      const projectName = path.basename(rootDir);
      const healthScore = Math.max(0, 100 - graphStats.avgComplexity * 5);
      const contributorCount = countContributors(graph.nodes);
      const deadExportCount = countDeadExports(graph.nodes, graph.edges);

      const languageNames = Object.keys(graphStats.languages).join(', ') || 'code';

      const genre = determineGenre({
        fileCount: graphStats.fileCount,
        totalLines: graphStats.totalLines,
        avgComplexity: graphStats.avgComplexity,
        maxComplexity: graphStats.maxComplexity,
        healthScore,
        contributorCount,
        deadExportCount,
      });

      const genreInfo = GENRES[genre];
      const templates = VERSE_TEMPLATES[genre];
      if (!templates) {
        console.log(chalk.red('No templates found for this genre'));
        return;
      }
      // Pick a pseudo-random variant based on file count + total lines
      const variantIndex = (graphStats.fileCount + graphStats.totalLines) % templates.length;
      const template = templates[variantIndex];
      if (!template) {
        console.log(chalk.red('No template variant found'));
        return;
      }

      const templateVars: Record<string, string | number> = {
        projectName,
        fileCount: graphStats.fileCount,
        totalLines: graphStats.totalLines.toLocaleString(),
        complexity: graphStats.avgComplexity,
        maxComplexity: graphStats.maxComplexity,
        nodeCount: graphStats.nodeCount,
        edgeCount: graphStats.edgeCount,
        healthScore: Math.round(healthScore),
        contributorCount,
        deadExports: deadExportCount,
        languages: languageNames,
      };

      const verse = fillTemplate(template, templateVars);

      spinner?.succeed('Anthem composed!');

      // JSON output
      if (options.json) {
        outputJson('anthem', {
          projectName,
          genre: genre,
          genreEmoji: genreInfo.emoji,
          genreDescription: genreInfo.description,
          verse,
          stats: {
            fileCount: graphStats.fileCount,
            totalLines: graphStats.totalLines,
            avgComplexity: graphStats.avgComplexity,
            maxComplexity: graphStats.maxComplexity,
            healthScore: Math.round(healthScore),
            contributorCount,
            deadExportCount,
            languages: graphStats.languages,
          },
        });
        return;
      }

      const output = renderAnthemBox(genreInfo, verse, projectName);
      console.log(output);
    });
}
