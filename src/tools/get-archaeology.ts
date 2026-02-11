/**
 * get_archaeology Tool
 *
 * Tells the story of how a file or function evolved over time.
 * "Code archaeology" reveals rewrites, growth patterns, and what
 * approaches were tried (and sometimes failed).
 *
 * This is storytelling, not just data - making history accessible.
 */

import { z } from 'zod';
import { simpleGit } from 'simple-git';
import type { KnowledgeGraph } from '../graph/types.js';

export const schema = {
  filePath: z.string().describe('Path to the file to analyze (relative to project root)'),
  functionName: z.string().optional().describe('Specific function to analyze (searches commit messages)'),
};

export type Input = z.infer<z.ZodObject<typeof schema>>;

interface EvolutionPhase {
  version: number;
  period: string;
  description: string;
  keyChanges: string[];
  author: string;
  linesAtEnd?: number;
  complexityChange?: string;
}

interface ArchaeologyResult {
  filePath: string;
  found: boolean;
  age: string;
  totalRewrites: number;
  evolutionPhases: EvolutionPhase[];
  growthPattern: string;
  volatilityScore: number;
  notablePatterns: string[];
  lessonsLearned: string[];
  summary: string;
}

export async function execute(
  graph: KnowledgeGraph,
  input: Input
): Promise<ArchaeologyResult> {
  const { filePath, functionName } = input;

  // Check if file exists
  const fileNode = graph.nodes[filePath];
  if (!fileNode) {
    return {
      filePath,
      found: false,
      age: '',
      totalRewrites: 0,
      evolutionPhases: [],
      growthPattern: '',
      volatilityScore: 0,
      notablePatterns: [],
      lessonsLearned: [],
      summary: `I don't have a file at "${filePath}" in my knowledge graph.`,
    };
  }

  const git = simpleGit(graph.metadata.rootDir);

  try {
    // Get full commit history for this file
    const log = await git.log({
      file: filePath,
      maxCount: 100,
      '--stat': null,
    });

    if (log.total === 0) {
      return {
        filePath,
        found: true,
        age: 'unknown',
        totalRewrites: 0,
        evolutionPhases: [],
        growthPattern: 'No git history',
        volatilityScore: 0,
        notablePatterns: [],
        lessonsLearned: [],
        summary: `No git history for "${filePath}".`,
      };
    }

    // Analyze commit patterns
    const commits = [...log.all].reverse(); // Oldest first
    const firstCommit = commits[0];
    const lastCommit = commits[commits.length - 1];

    // Calculate age
    const ageMs = Date.now() - new Date(firstCommit.date).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const age = formatAge(ageDays);

    // Detect "rewrites" - large changes that touch most of the file
    const rewriteCommits = await detectRewrites(git, filePath, commits);
    const totalRewrites = rewriteCommits.length;

    // Build evolution phases
    const evolutionPhases = buildEvolutionPhases(commits, rewriteCommits);

    // Analyze growth pattern
    const growthPattern = analyzeGrowthPattern(commits);

    // Calculate volatility (changes per month of existence)
    const monthsOld = Math.max(1, ageDays / 30);
    const volatilityScore = Math.round((commits.length / monthsOld) * 10) / 10;

    // Detect notable patterns
    const notablePatterns = detectPatterns(commits, functionName);

    // Extract lessons from commit messages
    const lessonsLearned = extractLessons(commits);

    // Generate narrative summary
    const summary = generateSummary({
      filePath,
      age,
      totalRewrites,
      evolutionPhases,
      growthPattern,
      volatilityScore,
      notablePatterns,
      lessonsLearned,
      commits,
    });

    return {
      filePath,
      found: true,
      age,
      totalRewrites,
      evolutionPhases,
      growthPattern,
      volatilityScore,
      notablePatterns,
      lessonsLearned,
      summary,
    };
  } catch (error) {
    return {
      filePath,
      found: true,
      age: 'unknown',
      totalRewrites: 0,
      evolutionPhases: [],
      growthPattern: 'Error analyzing',
      volatilityScore: 0,
      notablePatterns: [],
      lessonsLearned: [],
      summary: `Error analyzing history: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

function formatAge(days: number): string {
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years} years, ${months} months` : `${years} years`;
}

async function detectRewrites(
  git: ReturnType<typeof simpleGit>,
  filePath: string,
  commits: Array<{ hash: string; message: string; date: string; author_name: string }>
): Promise<string[]> {
  const rewrites: string[] = [];

  for (const commit of commits.slice(1)) { // Skip first commit (creation)
    try {
      // Get diff stats for this commit
      const diffStat = await git.raw([
        'diff',
        '--stat',
        `${commit.hash}^`,
        commit.hash,
        '--',
        filePath,
      ]);

      // Parse lines changed
      const match = diffStat.match(/(\d+) insertions.*?(\d+) deletions/);
      if (match) {
        const insertions = parseInt(match[1], 10);
        const deletions = parseInt(match[2], 10);

        // A "rewrite" is when >50% of lines are changed
        const totalChanges = insertions + deletions;
        if (totalChanges > 50 && deletions > insertions * 0.5) {
          rewrites.push(commit.hash);
        }
      }
    } catch {
      continue;
    }
  }

  return rewrites;
}

function buildEvolutionPhases(
  commits: Array<{ hash: string; message: string; date: string; author_name: string }>,
  rewrites: string[]
): EvolutionPhase[] {
  const phases: EvolutionPhase[] = [];

  // Phase 1: Creation
  const first = commits[0];
  phases.push({
    version: 1,
    period: new Date(first.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    description: 'Initial creation',
    keyChanges: [first.message.split('\n')[0].substring(0, 60)],
    author: first.author_name,
  });

  // Find significant phases based on rewrites and time gaps
  let currentVersion = 2;
  let lastPhaseDate = new Date(first.date);

  for (let i = 1; i < commits.length; i++) {
    const commit = commits[i];
    const commitDate = new Date(commit.date);

    const isRewrite = rewrites.includes(commit.hash);
    const monthsGap = (commitDate.getTime() - lastPhaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    // New phase if rewrite or 6+ month gap
    if (isRewrite || monthsGap > 6) {
      phases.push({
        version: currentVersion,
        period: commitDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        description: isRewrite ? 'Major rewrite' : 'Revival after dormancy',
        keyChanges: [commit.message.split('\n')[0].substring(0, 60)],
        author: commit.author_name,
      });
      currentVersion++;
      lastPhaseDate = commitDate;
    }
  }

  return phases;
}

function analyzeGrowthPattern(
  commits: Array<{ hash: string; message: string }>
): string {
  const patterns: string[] = [];

  // Check for common commit message patterns
  const fixes = commits.filter(c => /fix|bug|issue|error/i.test(c.message)).length;
  const features = commits.filter(c => /add|feat|new|implement/i.test(c.message)).length;
  const refactors = commits.filter(c => /refactor|clean|improve|simplify/i.test(c.message)).length;

  const total = commits.length;

  if (fixes > total * 0.4) {
    patterns.push('bug-fix heavy');
  }
  if (features > total * 0.4) {
    patterns.push('feature-driven growth');
  }
  if (refactors > total * 0.2) {
    patterns.push('regular refactoring');
  }

  if (patterns.length === 0) {
    return 'steady incremental changes';
  }

  return patterns.join(', ');
}

function detectPatterns(
  commits: Array<{ hash: string; message: string; date: string; author_name: string }>,
  functionName?: string
): string[] {
  const patterns: string[] = [];

  // Check for repeated fix attempts
  const messages = commits.map(c => c.message.toLowerCase());

  const fixAttempts = messages.filter(m => /fix|bug|issue/.test(m));
  if (fixAttempts.length > 5) {
    patterns.push(`This file has had ${fixAttempts.length} bug fixes. It may be fragile.`);
  }

  // Check for reverts
  const reverts = messages.filter(m => /revert/.test(m));
  if (reverts.length > 0) {
    patterns.push(`${reverts.length} changes were reverted. Some approaches didn't work.`);
  }

  // Check for TODO/HACK mentions
  const hacks = messages.filter(m => /hack|workaround|temporary|todo/.test(m));
  if (hacks.length > 0) {
    patterns.push(`${hacks.length} commits mention workarounds or TODOs.`);
  }

  // Check for performance work
  const perf = messages.filter(m => /perf|optim|speed|slow|fast/.test(m));
  if (perf.length > 2) {
    patterns.push('Performance has been actively tuned here.');
  }

  // Check for security mentions
  const security = messages.filter(m => /security|vuln|xss|inject|auth/.test(m));
  if (security.length > 0) {
    patterns.push(`Security-related changes detected (${security.length} commits).`);
  }

  // If searching for a specific function
  if (functionName) {
    const mentions = commits.filter(c =>
      c.message.toLowerCase().includes(functionName.toLowerCase())
    );
    if (mentions.length > 0) {
      patterns.push(`"${functionName}" mentioned in ${mentions.length} commits.`);
    }
  }

  return patterns;
}

function extractLessons(
  commits: Array<{ hash: string; message: string }>
): string[] {
  const lessons: string[] = [];

  // Look for commits that explain "why" not just "what"
  for (const commit of commits) {
    const msg = commit.message.toLowerCase();

    // Commits that explain problems
    if (/because|since|due to|caused by|problem was/.test(msg)) {
      const snippet = commit.message.split('\n')[0].substring(0, 80);
      lessons.push(snippet);
    }

    // Commits that document decisions
    if (/decided|chose|instead of|rather than|better to/.test(msg)) {
      const snippet = commit.message.split('\n')[0].substring(0, 80);
      lessons.push(snippet);
    }
  }

  return lessons.slice(0, 5);
}

function generateSummary(data: {
  filePath: string;
  age: string;
  totalRewrites: number;
  evolutionPhases: EvolutionPhase[];
  growthPattern: string;
  volatilityScore: number;
  notablePatterns: string[];
  lessonsLearned: string[];
  commits: Array<{ hash: string; message: string; author_name: string }>;
}): string {
  const parts: string[] = [];

  parts.push(`## Code Archaeology: ${data.filePath}`);
  parts.push('');

  // Origin story
  parts.push(`### Origin Story`);
  parts.push('');
  parts.push(`I was born **${data.age} ago** and have lived through **${data.commits.length} changes**.`);

  if (data.totalRewrites > 0) {
    parts.push(`I've been significantly rewritten **${data.totalRewrites} time${data.totalRewrites > 1 ? 's' : ''}**.`);
  }
  parts.push('');

  // Evolution timeline
  if (data.evolutionPhases.length > 1) {
    parts.push(`### My Evolution`);
    parts.push('');
    for (const phase of data.evolutionPhases) {
      const emoji = phase.version === 1 ? '🌱' :
                    phase.description.includes('rewrite') ? '🔄' : '📈';
      parts.push(`${emoji} **v${phase.version}** (${phase.period}) — ${phase.description}`);
      parts.push(`   by ${phase.author}: "${phase.keyChanges[0]}"`);
    }
    parts.push('');
  }

  // Character assessment
  parts.push('### My Character');
  parts.push('');
  parts.push(`**Growth pattern:** ${data.growthPattern}`);
  parts.push(`**Volatility:** ${data.volatilityScore} changes/month`);

  if (data.volatilityScore > 2) {
    parts.push('*I change frequently — handle with care.*');
  } else if (data.volatilityScore < 0.5) {
    parts.push('*I\'m quite stable — changes here are infrequent.*');
  }
  parts.push('');

  // Notable patterns
  if (data.notablePatterns.length > 0) {
    parts.push('### What My History Reveals');
    parts.push('');
    for (const pattern of data.notablePatterns) {
      parts.push(`- ${pattern}`);
    }
    parts.push('');
  }

  // Lessons from commits
  if (data.lessonsLearned.length > 0) {
    parts.push('### Lessons Encoded in My History');
    parts.push('');
    parts.push('*These commits explain important decisions:*');
    for (const lesson of data.lessonsLearned) {
      parts.push(`- "${lesson}"`);
    }
    parts.push('');
  }

  // Key contributors
  const contributors = new Map<string, number>();
  for (const commit of data.commits) {
    contributors.set(commit.author_name, (contributors.get(commit.author_name) || 0) + 1);
  }
  const topContribs = [...contributors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  parts.push('### My Authors');
  parts.push('');
  for (const [name, count] of topContribs) {
    const pct = Math.round((count / data.commits.length) * 100);
    parts.push(`- ${name}: ${count} commits (${pct}%)`);
  }

  return parts.join('\n');
}
