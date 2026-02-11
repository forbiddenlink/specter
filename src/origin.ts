/**
 * Origin Story Generator
 *
 * Creates a narrative origin story for a codebase by analyzing
 * git history, milestones, and evolution patterns.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { KnowledgeGraph } from './graph/types.js';

export interface OriginData {
  codebaseName: string;
  isGitRepo: boolean;
  birthDate?: string;
  birthAuthor?: string;
  birthMessage?: string;
  ageInDays: number;
  totalCommits: number;
  totalContributors: number;
  contributors: Array<{
    name: string;
    commits: number;
    firstCommit: string;
    isFounder: boolean;
  }>;
  epochs: Array<{
    name: string;
    startDate: string;
    description: string;
  }>;
  milestones: Array<{
    date: string;
    type: 'tag' | 'commit' | 'contributor';
    description: string;
  }>;
  currentStats: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
}

/**
 * Gather origin data from git history
 */
export async function gatherOriginData(
  graph: KnowledgeGraph,
  rootDir: string
): Promise<OriginData> {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  let isGitRepo = false;
  try {
    await git.status();
    isGitRepo = true;
  } catch {
    return {
      codebaseName,
      isGitRepo: false,
      ageInDays: 0,
      totalCommits: 0,
      totalContributors: 0,
      contributors: [],
      epochs: [],
      milestones: [],
      currentStats: {
        files: graph.metadata.fileCount,
        lines: graph.metadata.totalLines,
        languages: graph.metadata.languages,
      },
    };
  }

  // Get first commit (birth)
  let birthDate: string | undefined;
  let birthAuthor: string | undefined;
  let birthMessage: string | undefined;

  try {
    const firstCommit = await git.raw(['log', '--reverse', '--format=%aI|%an|%s', '-1']);
    const parts = firstCommit.trim().split('|');
    if (parts.length >= 3) {
      birthDate = parts[0];
      birthAuthor = parts[1];
      birthMessage = parts.slice(2).join('|');
    }
  } catch {
    // No git history
  }

  // Calculate age
  let ageInDays = 0;
  if (birthDate) {
    ageInDays = Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get total commits
  let totalCommits = 0;
  try {
    const countResult = await git.raw(['rev-list', '--count', 'HEAD']);
    totalCommits = parseInt(countResult.trim(), 10) || 0;
  } catch {
    // Ignore
  }

  // Get contributor info with first commit dates
  const contributors: OriginData['contributors'] = [];
  try {
    const shortlog = await git.raw(['shortlog', '-sn', '--all']);
    const lines = shortlog.trim().split('\n').filter(Boolean);

    for (const line of lines.slice(0, 10)) {
      const match = line.match(/^\s*(\d+)\s+(.+)$/);
      if (match) {
        const commits = parseInt(match[1], 10);
        const name = match[2];

        // Get first commit date for this contributor
        let firstCommit = '';
        try {
          const firstLog = await git.raw([
            'log',
            '--reverse',
            '--format=%aI',
            `--author=${name}`,
            '-1',
          ]);
          firstCommit = firstLog.trim();
        } catch {
          // Ignore
        }

        contributors.push({
          name,
          commits,
          firstCommit,
          isFounder: firstCommit === birthDate,
        });
      }
    }
  } catch {
    // Ignore
  }

  // Get tags as milestones
  const milestones: OriginData['milestones'] = [];
  try {
    const tags = await git.tags();
    for (const tag of tags.all.slice(0, 10)) {
      try {
        const tagDate = await git.raw(['log', '-1', '--format=%aI', tag]);
        milestones.push({
          date: tagDate.trim(),
          type: 'tag',
          description: `Released ${tag}`,
        });
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }

  // Add contributor milestones (when new contributors joined)
  for (const contributor of contributors.slice(1, 5)) {
    if (contributor.firstCommit && !contributor.isFounder) {
      milestones.push({
        date: contributor.firstCommit,
        type: 'contributor',
        description: `${contributor.name} joined the project`,
      });
    }
  }

  // Sort milestones by date
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine epochs based on age
  const epochs = determineEpochs(ageInDays, totalCommits, contributors.length);

  return {
    codebaseName,
    isGitRepo: true,
    birthDate,
    birthAuthor,
    birthMessage,
    ageInDays,
    totalCommits,
    totalContributors: contributors.length,
    contributors,
    epochs,
    milestones: milestones.slice(0, 10),
    currentStats: {
      files: graph.metadata.fileCount,
      lines: graph.metadata.totalLines,
      languages: graph.metadata.languages,
    },
  };
}

/**
 * Determine narrative epochs based on project characteristics
 */
function determineEpochs(
  ageInDays: number,
  commits: number,
  contributors: number
): OriginData['epochs'] {
  const epochs: OriginData['epochs'] = [];
  const now = new Date().toISOString();

  if (ageInDays < 30) {
    epochs.push({ name: 'The Spark', startDate: now, description: 'freshly born, full of potential' });
  } else if (ageInDays < 90) {
    epochs.push({ name: 'The Beginning', startDate: now, description: 'young and growing rapidly' });
  } else if (ageInDays < 365) {
    epochs.push({ name: 'The Formation', startDate: now, description: 'taking shape, finding its identity' });
  } else if (ageInDays < 730) {
    epochs.push({ name: 'The Adolescence', startDate: now, description: 'maturing, patterns emerging' });
  } else if (ageInDays < 1825) {
    epochs.push({ name: 'The Maturity', startDate: now, description: 'established and battle-tested' });
  } else {
    epochs.push({ name: 'The Legacy', startDate: now, description: 'ancient, carrying deep wisdom' });
  }

  if (commits > 1000) {
    epochs.push({ name: 'The Prolific Era', startDate: now, description: 'over a thousand commits of labor' });
  }

  if (contributors >= 10) {
    epochs.push({ name: 'The Community', startDate: now, description: 'many hands have shaped this code' });
  } else if (contributors === 1) {
    epochs.push({ name: 'The Solo Journey', startDate: now, description: 'a single author\'s vision' });
  }

  return epochs;
}

/**
 * Generate narrative origin story
 */
export function generateOriginStory(data: OriginData): string {
  const lines: string[] = [];

  if (!data.isGitRepo) {
    return generateNonGitStory(data);
  }

  // Title
  lines.push(`THE ORIGIN OF ${data.codebaseName.toUpperCase()}`);
  lines.push('═'.repeat(50));
  lines.push('');

  // Birth paragraph
  if (data.birthDate) {
    const birthDateFormatted = new Date(data.birthDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    lines.push('CHAPTER I: THE BEGINNING');
    lines.push('─'.repeat(30));
    lines.push('');

    const ageDesc = describeAge(data.ageInDays);

    lines.push(
      `On ${birthDateFormatted}, in the quiet hours when most developers sleep, ` +
        `${data.birthAuthor || 'an unknown creator'} typed the first characters ` +
        `that would become ${data.codebaseName}.`
    );
    lines.push('');

    if (data.birthMessage) {
      lines.push(`The first words spoken: "${data.birthMessage}"`);
      lines.push('');
    }

    lines.push(`That was ${ageDesc}. Since then, the codebase has seen ${data.totalCommits.toLocaleString()} commits.`);
    lines.push('');
  }

  // Contributors paragraph
  if (data.contributors.length > 0) {
    lines.push('CHAPTER II: THE BUILDERS');
    lines.push('─'.repeat(30));
    lines.push('');

    const founder = data.contributors.find(c => c.isFounder);
    const others = data.contributors.filter(c => !c.isFounder);

    if (founder) {
      lines.push(
        `${founder.name} laid the foundation with ${founder.commits.toLocaleString()} commits, ` +
          'setting the architectural vision that would guide all who followed.'
      );
      lines.push('');
    }

    if (others.length > 0) {
      if (others.length === 1) {
        lines.push(
          `One other developer joined the journey: ${others[0].name}, ` +
            `contributing ${others[0].commits.toLocaleString()} commits.`
        );
      } else {
        const topOthers = others.slice(0, 3).map(c => c.name);
        lines.push(
          `Over time, ${data.totalContributors} developers have contributed their craft. ` +
            `Among them: ${topOthers.join(', ')}${others.length > 3 ? ', and others' : ''}.`
        );
      }
      lines.push('');
    }
  }

  // Current state
  lines.push('CHAPTER III: THE PRESENT');
  lines.push('─'.repeat(30));
  lines.push('');

  lines.push(`Today, ${data.codebaseName} stands as a testament to ${describeEffort(data.totalCommits)}:`);
  lines.push('');
  lines.push(`  ${data.currentStats.files.toLocaleString()} files`);
  lines.push(`  ${data.currentStats.lines.toLocaleString()} lines of code`);

  const langs = Object.entries(data.currentStats.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang, count]) => `${lang} (${count})`);
  if (langs.length > 0) {
    lines.push(`  Written primarily in ${langs.join(', ')}`);
  }
  lines.push('');

  // Epochs
  if (data.epochs.length > 0) {
    lines.push('THE CURRENT EPOCH');
    lines.push('─'.repeat(30));
    lines.push('');
    for (const epoch of data.epochs) {
      lines.push(`  • ${epoch.name}: ${epoch.description}`);
    }
    lines.push('');
  }

  // Milestones
  if (data.milestones.length > 0) {
    lines.push('KEY MILESTONES');
    lines.push('─'.repeat(30));
    lines.push('');
    for (const milestone of data.milestones.slice(0, 5)) {
      const dateStr = new Date(milestone.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      const icon = milestone.type === 'tag' ? '🏷️' : '👤';
      lines.push(`  ${icon} ${dateStr}: ${milestone.description}`);
    }
    lines.push('');
  }

  // Closing
  lines.push('═'.repeat(50));
  lines.push(`The story of ${data.codebaseName} continues with every commit...`);

  return lines.join('\n');
}

/**
 * Generate story for non-git repos
 */
function generateNonGitStory(data: OriginData): string {
  const lines: string[] = [];

  lines.push(`THE MYSTERY OF ${data.codebaseName.toUpperCase()}`);
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push('This codebase exists outside the chronicles of git.');
  lines.push('Its origins are shrouded in mystery.');
  lines.push('');
  lines.push('What we know:');
  lines.push(`  ${data.currentStats.files.toLocaleString()} files exist`);
  lines.push(`  ${data.currentStats.lines.toLocaleString()} lines of code remain`);
  lines.push('');
  lines.push('The rest... is lost to time.');
  lines.push('');
  lines.push('═'.repeat(50));
  lines.push('Consider running `git init` to begin recording history.');

  return lines.join('\n');
}

/**
 * Describe age in human terms
 */
function describeAge(days: number): string {
  if (days < 7) {
    return `${days} days ago`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''} and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''} ago`;
    }
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

/**
 * Describe effort based on commit count
 */
function describeEffort(commits: number): string {
  if (commits < 50) {
    return 'early dedication';
  } else if (commits < 200) {
    return 'sustained effort';
  } else if (commits < 500) {
    return 'considerable labor';
  } else if (commits < 1000) {
    return 'remarkable persistence';
  } else {
    return 'extraordinary commitment';
  }
}
