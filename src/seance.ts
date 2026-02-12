/**
 * Seance - Commune with Deleted Files
 *
 * Uses git history to find and display information about
 * files that have been deleted from the codebase.
 */

import { type SimpleGit, simpleGit } from 'simple-git';

export interface DeletedFile {
  path: string;
  deletedAt: string;
  deletedBy: string;
  deletedInCommit: string;
  commitMessage: string;
  createdAt?: string;
  createdBy?: string;
  lastContents?: string;
  linesOfCode: number;
  lifespan: number; // days between creation and deletion
}

export interface SeanceResult {
  query: string;
  found: boolean;
  spirits: DeletedFile[];
  message: string;
}

/**
 * Search for deleted files matching a pattern
 */
export async function summonSpirits(
  rootDir: string,
  query: string,
  options: { limit?: number; showContents?: boolean } = {}
): Promise<SeanceResult> {
  const { limit = 10, showContents = false } = options;
  const git: SimpleGit = simpleGit(rootDir);

  // Check if git repo
  try {
    await git.status();
  } catch {
    return {
      query,
      found: false,
      spirits: [],
      message: 'This realm has no git history. The spirits cannot be reached.',
    };
  }

  try {
    // Find deleted files using git log
    // This finds commits where files were deleted (D status)
    const deletedFilesRaw = await git.raw([
      'log',
      '--all',
      '--diff-filter=D',
      '--summary',
      '--format=%H|%aI|%an|%s',
      '--',
      query.includes('*') ? query : `*${query}*`,
    ]);

    if (!deletedFilesRaw.trim()) {
      // Try exact match
      const exactMatch = await git.raw([
        'log',
        '--all',
        '--diff-filter=D',
        '--summary',
        '--format=%H|%aI|%an|%s',
        '--',
        query,
      ]);

      if (!exactMatch.trim()) {
        return {
          query,
          found: false,
          spirits: [],
          message: `No spirits matching "${query}" found in the void. They may have never existed, or passed beyond our reach.`,
        };
      }
    }

    // Parse the output
    const spirits: DeletedFile[] = [];
    const lines = (deletedFilesRaw || '').split('\n');
    let currentCommit: { hash: string; date: string; author: string; message: string } | null =
      null;

    for (const line of lines) {
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          currentCommit = {
            hash: parts[0],
            date: parts[1],
            author: parts[2],
            message: parts.slice(3).join('|'),
          };
        }
      } else if (line.includes('delete mode') && currentCommit) {
        // Extract file path from "delete mode 100644 path/to/file"
        const match = line.match(/delete mode \d+ (.+)/);
        if (match) {
          const filePath = match[1].trim();

          // Check if this file matches our query
          if (filePath.toLowerCase().includes(query.toLowerCase()) || query.includes('*')) {
            // Get creation info
            let createdAt: string | undefined;
            let createdBy: string | undefined;
            try {
              const creationLog = await git.raw([
                'log',
                '--diff-filter=A',
                '--format=%aI|%an',
                '--follow',
                '-1',
                '--',
                filePath,
              ]);
              if (creationLog.trim()) {
                const [date, author] = creationLog.trim().split('|');
                createdAt = date;
                createdBy = author;
              }
            } catch {
              // Ignore - file might have been renamed
            }

            // Get last contents if requested
            let lastContents: string | undefined;
            let linesOfCode = 0;
            if (showContents) {
              try {
                // Get the file content from the commit before deletion
                lastContents = await git.raw(['show', `${currentCommit.hash}^:${filePath}`]);
                linesOfCode = lastContents.split('\n').length;
              } catch {
                // File might not exist in parent commit (edge case)
              }
            } else {
              // Just get line count
              try {
                const content = await git.raw(['show', `${currentCommit.hash}^:${filePath}`]);
                linesOfCode = content.split('\n').length;
              } catch {
                // Ignore
              }
            }

            // Calculate lifespan
            let lifespan = 0;
            if (createdAt) {
              const created = new Date(createdAt);
              const deleted = new Date(currentCommit.date);
              lifespan = Math.floor(
                (deleted.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
              );
            }

            spirits.push({
              path: filePath,
              deletedAt: currentCommit.date,
              deletedBy: currentCommit.author,
              deletedInCommit: currentCommit.hash.substring(0, 7),
              commitMessage: currentCommit.message,
              createdAt,
              createdBy,
              lastContents,
              linesOfCode,
              lifespan,
            });

            if (spirits.length >= limit) break;
          }
        }
      }
    }

    if (spirits.length === 0) {
      return {
        query,
        found: false,
        spirits: [],
        message: `No spirits matching "${query}" could be summoned. Perhaps they are at peace.`,
      };
    }

    return {
      query,
      found: true,
      spirits: spirits.slice(0, limit),
      message: `${spirits.length} spirit${spirits.length > 1 ? 's' : ''} answered the call.`,
    };
  } catch (error) {
    return {
      query,
      found: false,
      spirits: [],
      message: `The séance failed: ${error instanceof Error ? error.message : 'Unknown disturbance'}`,
    };
  }
}

/**
 * Format seance results for display
 */
export function formatSeance(result: SeanceResult): string {
  const lines: string[] = [];

  lines.push('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
  lines.push('           S É A N C E');
  lines.push('     Communing with the Deleted');
  lines.push('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
  lines.push('');

  if (!result.found) {
    lines.push(`Searching for: "${result.query}"`);
    lines.push('');
    lines.push(`  👻 ${result.message}`);
    lines.push('');
    lines.push('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
    return lines.join('\n');
  }

  lines.push(`Summoning spirits matching: "${result.query}"`);
  lines.push('');
  lines.push(result.message);
  lines.push('');

  for (let i = 0; i < result.spirits.length; i++) {
    const spirit = result.spirits[i];

    lines.push(`┌${'─'.repeat(48)}┐`);
    lines.push(`│ 👻 ${spirit.path.padEnd(44)} │`);
    lines.push(`├${'─'.repeat(48)}┤`);

    // Death info
    const deletedDate = new Date(spirit.deletedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    lines.push(`│  Passed on: ${deletedDate.padEnd(35)} │`);
    lines.push(`│  Deleted by: ${spirit.deletedBy.substring(0, 34).padEnd(34)} │`);
    lines.push(`│  Commit: ${spirit.deletedInCommit.padEnd(38)} │`);

    // Truncate message to fit
    const msgTrunc = spirit.commitMessage.substring(0, 36);
    lines.push(
      `│  Last words: "${msgTrunc}"${msgTrunc.length < spirit.commitMessage.length ? '...' : '   '} │`
    );

    // Life info
    if (spirit.createdAt && spirit.createdBy) {
      const createdDate = new Date(spirit.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      lines.push(`│${' '.repeat(48)}│`);
      lines.push(`│  Born: ${createdDate.padEnd(40)} │`);
      lines.push(`│  Created by: ${spirit.createdBy.substring(0, 34).padEnd(34)} │`);
      lines.push(
        `${`│  Lived: ${spirit.lifespan} days, ${spirit.linesOfCode} lines of code`.padEnd(48)} │`
      );
    } else {
      lines.push(`${`│  Lines of code: ${spirit.linesOfCode}`.padEnd(49)}│`);
    }

    // Last contents preview
    if (spirit.lastContents) {
      lines.push(`│${' '.repeat(48)}│`);
      lines.push(`${'│  Final words from beyond:'.padEnd(49)}│`);
      const contentLines = spirit.lastContents.split('\n').slice(0, 5);
      for (const contentLine of contentLines) {
        const truncated = `  ${contentLine.substring(0, 44)}`;
        lines.push(`│${truncated.padEnd(48)}│`);
      }
      if (spirit.lastContents.split('\n').length > 5) {
        lines.push(`${'│  ...'.padEnd(49)}│`);
      }
    }

    lines.push(`└${'─'.repeat(48)}┘`);

    if (i < result.spirits.length - 1) {
      lines.push('');
    }
  }

  lines.push('');
  lines.push('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
  lines.push('  May these files rest in version control.');
  lines.push('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');

  return lines.join('\n');
}

/**
 * List all recently deleted files (for discovery)
 */
export async function listRecentlyDeleted(
  rootDir: string,
  limit: number = 20
): Promise<DeletedFile[]> {
  const git: SimpleGit = simpleGit(rootDir);

  try {
    await git.status();
  } catch {
    return [];
  }

  const spirits: DeletedFile[] = [];

  try {
    const deletedFilesRaw = await git.raw([
      'log',
      '--all',
      '--diff-filter=D',
      '--summary',
      '--format=%H|%aI|%an|%s',
      `-n${limit * 2}`, // Get more commits since each might have multiple files
    ]);

    const lines = deletedFilesRaw.split('\n');
    let currentCommit: { hash: string; date: string; author: string; message: string } | null =
      null;

    for (const line of lines) {
      if (spirits.length >= limit) break;

      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          currentCommit = {
            hash: parts[0],
            date: parts[1],
            author: parts[2],
            message: parts.slice(3).join('|'),
          };
        }
      } else if (line.includes('delete mode') && currentCommit) {
        const match = line.match(/delete mode \d+ (.+)/);
        if (match) {
          const filePath = match[1].trim();

          // Only include source files
          if (filePath.match(/\.(ts|tsx|js|jsx|py|rb|go|rs|java|c|cpp|h|hpp)$/)) {
            spirits.push({
              path: filePath,
              deletedAt: currentCommit.date,
              deletedBy: currentCommit.author,
              deletedInCommit: currentCommit.hash.substring(0, 7),
              commitMessage: currentCommit.message,
              linesOfCode: 0,
              lifespan: 0,
            });
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return spirits;
}
