/**
 * Obituary Generator
 *
 * Generate a humorous obituary for files about to be deleted or deprecated.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { FileNode, KnowledgeGraph } from './graph/types.js';

interface FileHistory {
  firstCommit: string;
  lastCommit: string;
  totalCommits: number;
  authors: string[];
  linesAdded: number;
  linesRemoved: number;
  ageInDays: number;
}

/**
 * Execute git command safely using spawnSync with argument array
 * Avoids shell injection by not interpolating user input into shell strings
 */
function gitCommand(args: string[], rootDir: string): string {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result.stdout?.toString() || '';
}

function getFileHistory(filePath: string, rootDir: string): FileHistory | null {
  try {
    const relativePath = path.relative(rootDir, filePath);

    // Get all commit dates (first and last)
    const allDates = gitCommand(
      ['log', '--follow', '--format=%ad', '--date=short', '--', relativePath],
      rootDir
    ).trim();
    const dates = allDates.split('\n').filter(Boolean);
    const firstCommit = dates[dates.length - 1] || '';
    const lastCommit = dates[0] || '';

    // Get total commits (count lines from oneline output)
    const commitsOutput = gitCommand(
      ['log', '--follow', '--oneline', '--', relativePath],
      rootDir
    ).trim();
    const totalCommits = commitsOutput ? commitsOutput.split('\n').length : 0;

    // Get authors (deduplicate in JS instead of shell sort -u)
    const authorsRaw = gitCommand(
      ['log', '--follow', '--format=%aN', '--', relativePath],
      rootDir
    ).trim();
    const authors = [...new Set(authorsRaw.split('\n').filter(Boolean))];

    // Get lines added/removed (parse numstat in JS instead of shell awk)
    const numstatOutput = gitCommand(
      ['log', '--follow', '--numstat', '--format=', '--', relativePath],
      rootDir
    ).trim();
    let linesAdded = 0;
    let linesRemoved = 0;
    for (const line of numstatOutput.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const add = parseInt(parts[0], 10);
        const del = parseInt(parts[1], 10);
        if (!Number.isNaN(add)) linesAdded += add;
        if (!Number.isNaN(del)) linesRemoved += del;
      }
    }

    // Calculate age
    const firstDate = new Date(firstCommit);
    const ageInDays = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      firstCommit,
      lastCommit,
      totalCommits,
      authors,
      linesAdded,
      linesRemoved,
      ageInDays,
    };
  } catch {
    return null;
  }
}

function getDeathCauses(): string[] {
  return [
    'refactoring complications',
    'chronic technical debt',
    'acute over-engineering',
    'terminal scope creep',
    'fatal code review',
    'dependency hell',
    'merge conflict trauma',
    'abandoned by its creators',
    'replaced by a younger, shinier module',
    'succumbed to the rewrite',
  ];
}

function getEulogies(): string[] {
  return [
    'It did what it was supposed to do. Mostly.',
    'It will be remembered for its... unique approach to problem-solving.',
    'Gone but not forgotten. Actually, probably forgotten.',
    'It served faithfully, even when no one understood why it existed.',
    'Rest in peace. Your TODO comments will never be addressed.',
    'It lived fast and died young. The good ones always do.',
    'Finally free from the burden of maintenance.',
    'It leaves behind 47 dependents and 0 tests.',
  ];
}

function getMemorials(): string[] {
  return [
    'In lieu of flowers, please write unit tests.',
    'Donations can be made to the "Refactor Fund".',
    'A moment of silence for all the bugs that died with it.',
    'May its memory live on in git history.',
    'Its spirit will haunt the codebase forever.',
  ];
}

export function generateObituary(filePath: string, graph: KnowledgeGraph, rootDir: string): string {
  const fileName = path.basename(filePath);
  const history = getFileHistory(filePath, rootDir);
  const nodes = Object.values(graph.nodes);
  const fileNode = nodes.find((n) => n.filePath === filePath || n.filePath?.endsWith(fileName));

  const deathCauses = getDeathCauses();
  const eulogies = getEulogies();
  const memorials = getMemorials();

  const causeOfDeath = deathCauses[Math.floor(Math.random() * deathCauses.length)];
  const eulogy = eulogies[Math.floor(Math.random() * eulogies.length)];
  const memorial = memorials[Math.floor(Math.random() * memorials.length)];

  const lines: string[] = [];

  lines.push('');
  lines.push('  ╔════════════════════════════════════════════════════╗');
  lines.push('  ║              ⚰️  IN LOVING MEMORY  ⚰️               ║');
  lines.push('  ╚════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`                      ${fileName}`);
  lines.push('');

  if (history) {
    lines.push(`                 ${history.firstCommit} - ${history.lastCommit || 'Present'}`);
    lines.push(`                    (${history.ageInDays} days)`);
  }

  lines.push('');
  lines.push('  ────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`  Cause of death: ${causeOfDeath}`);
  lines.push('');

  if (history) {
    lines.push('  LIFE STATISTICS');
    lines.push('  ────────────────────────────────────────────────────');
    lines.push(`    📝 Commits:      ${history.totalCommits}`);
    lines.push(`    ➕ Lines added:  ${history.linesAdded.toLocaleString()}`);
    lines.push(`    ➖ Lines removed: ${history.linesRemoved.toLocaleString()}`);
    lines.push(`    👥 Maintainers:  ${history.authors.join(', ')}`);
    lines.push('');
  }

  if (fileNode && 'complexity' in fileNode) {
    lines.push('  FINAL CONDITION');
    lines.push('  ────────────────────────────────────────────────────');
    lines.push(`    Complexity: ${fileNode.complexity || 'Unknown'}`);
    lines.push(
      `    Lines: ${'lineCount' in fileNode ? (fileNode as FileNode).lineCount : 'Unknown'}`
    );
    lines.push('');
  }

  lines.push('  EULOGY');
  lines.push('  ────────────────────────────────────────────────────');
  lines.push(`    "${eulogy}"`);
  lines.push('');

  // Survivors (files that import this one)
  const dependents = graph.edges.filter((e) => e.target === fileNode?.id);
  if (dependents.length > 0) {
    lines.push('  SURVIVED BY');
    lines.push('  ────────────────────────────────────────────────────');
    const survivorNames = dependents.slice(0, 5).map((d) => {
      const node = graph.nodes[d.source];
      return node?.name || 'Unknown';
    });
    survivorNames.forEach((name) => {
      lines.push(`    • ${name}`);
    });
    if (dependents.length > 5) {
      lines.push(`    • ...and ${dependents.length - 5} others`);
    }
    lines.push('');
  }

  lines.push('  ────────────────────────────────────────────────────');
  lines.push(`    ${memorial}`);
  lines.push('  ────────────────────────────────────────────────────');
  lines.push('');
  lines.push('                     🕯️  REST IN PEACE  🕯️');
  lines.push('');

  return lines.join('\n');
}
