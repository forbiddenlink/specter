/**
 * Git Diff Analyzer
 *
 * Parse git diff and extract change information.
 */

import { simpleGit } from 'simple-git';
import type { DiffFile, DiffSizeAnalysis, DiffStatus } from './types.js';

/**
 * Parse numstat output into DiffFile objects
 * Format: added\tdeleted\tfilename (or - - for binary)
 */
function parseNumstat(numstatOutput: string): DiffFile[] {
  const files: DiffFile[] = [];

  const lines = numstatOutput
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const additions = parts[0];
    const deletions = parts[1];
    const filePathParts = parts.slice(2);
    if (!additions || !deletions) continue;
    const filePath = filePathParts.join('\t'); // Handle filenames with tabs

    // Binary files show "-" for additions/deletions
    const isBinary = additions === '-' || deletions === '-';

    files.push({
      filePath,
      status: 'modified', // Default, will be refined if we have more info
      additions: isBinary ? 0 : parseInt(additions, 10) || 0,
      deletions: isBinary ? 0 : parseInt(deletions, 10) || 0,
      isBinary,
    });
  }

  return files;
}

/**
 * Parse name-status output to get file status (A/M/D/R)
 * Format: status\tfilename (or status\told\tnew for renames)
 */
function parseNameStatus(nameStatusOutput: string): Map<string, DiffStatus> {
  const statusMap = new Map<string, DiffStatus>();

  const lines = nameStatusOutput
    .trim()
    .split('\n')
    .filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.split('\t');
    const firstPart = parts[0];
    const secondPart = parts[1];
    if (parts.length < 2 || !firstPart || !secondPart) continue;

    const statusChar = firstPart.charAt(0).toUpperCase();
    let filePath: string;

    // Handle renames which have format R100\told\tnew
    const thirdPart = parts[2];
    if (statusChar === 'R' && parts.length >= 3 && thirdPart) {
      filePath = thirdPart; // Use the new name
    } else {
      filePath = secondPart;
    }

    let status: DiffStatus;
    switch (statusChar) {
      case 'A':
        status = 'added';
        break;
      case 'D':
        status = 'deleted';
        break;
      case 'R':
        status = 'renamed';
        break;
      default:
        status = 'modified';
    }

    statusMap.set(filePath, status);
  }

  return statusMap;
}

/**
 * Combine numstat and name-status data
 */
function combineData(numstatFiles: DiffFile[], statusMap: Map<string, DiffStatus>): DiffFile[] {
  return numstatFiles.map((file) => ({
    ...file,
    status: statusMap.get(file.filePath) || file.status,
  }));
}

/**
 * Get staged changes (files added to git staging area)
 */
export async function getStagedChanges(rootDir: string): Promise<DiffFile[]> {
  const git = simpleGit(rootDir);

  try {
    // Get numstat for additions/deletions
    const numstatOutput = await git.diff(['--staged', '--numstat']);
    if (!numstatOutput.trim()) {
      return [];
    }

    const numstatFiles = parseNumstat(numstatOutput);

    // Get name-status for file status (A/M/D/R)
    const nameStatusOutput = await git.diff(['--staged', '--name-status']);
    const statusMap = parseNameStatus(nameStatusOutput);

    return combineData(numstatFiles, statusMap);
  } catch (error) {
    console.error('Error getting staged changes:', error);
    return [];
  }
}

/**
 * Get changes between branches
 */
export async function getBranchChanges(
  rootDir: string,
  baseBranch: string,
  compareBranch?: string
): Promise<DiffFile[]> {
  const git = simpleGit(rootDir);

  try {
    const compare = compareBranch || 'HEAD';
    const diffRange = `${baseBranch}...${compare}`;

    // Get numstat
    const numstatOutput = await git.diff([diffRange, '--numstat']);
    if (!numstatOutput.trim()) {
      return [];
    }

    const numstatFiles = parseNumstat(numstatOutput);

    // Get name-status
    const nameStatusOutput = await git.diff([diffRange, '--name-status']);
    const statusMap = parseNameStatus(nameStatusOutput);

    return combineData(numstatFiles, statusMap);
  } catch (error) {
    console.error(`Error getting branch changes for ${baseBranch}:`, error);
    return [];
  }
}

/**
 * Get changes for a specific commit
 */
export async function getCommitChanges(rootDir: string, commitHash: string): Promise<DiffFile[]> {
  const git = simpleGit(rootDir);

  try {
    // For a single commit, diff against its parent
    const numstatOutput = await git.diff([`${commitHash}^`, commitHash, '--numstat']);
    if (!numstatOutput.trim()) {
      return [];
    }

    const numstatFiles = parseNumstat(numstatOutput);

    const nameStatusOutput = await git.diff([`${commitHash}^`, commitHash, '--name-status']);
    const statusMap = parseNameStatus(nameStatusOutput);

    return combineData(numstatFiles, statusMap);
  } catch (error) {
    // Handle case where commit has no parent (initial commit)
    try {
      const git2 = simpleGit(rootDir);
      const numstatOutput = await git2.raw(['diff-tree', '--numstat', '--root', commitHash]);
      if (!numstatOutput.trim()) {
        return [];
      }

      const numstatFiles = parseNumstat(numstatOutput);

      const nameStatusOutput = await git2.raw(['diff-tree', '--name-status', '--root', commitHash]);
      const statusMap = parseNameStatus(nameStatusOutput);

      return combineData(numstatFiles, statusMap);
    } catch {
      console.error(`Error getting commit changes for ${commitHash}:`, error);
      return [];
    }
  }
}

/**
 * Get unstaged changes (working directory changes not yet staged)
 */
export async function getUnstagedChanges(rootDir: string): Promise<DiffFile[]> {
  const git = simpleGit(rootDir);

  try {
    const numstatOutput = await git.diff(['--numstat']);
    if (!numstatOutput.trim()) {
      return [];
    }

    const numstatFiles = parseNumstat(numstatOutput);

    const nameStatusOutput = await git.diff(['--name-status']);
    const statusMap = parseNameStatus(nameStatusOutput);

    return combineData(numstatFiles, statusMap);
  } catch (error) {
    console.error('Error getting unstaged changes:', error);
    return [];
  }
}

/**
 * Analyze diff size and return summary statistics
 */
export function analyzeDiffSize(files: DiffFile[]): DiffSizeAnalysis {
  let totalAdditions = 0;
  let totalDeletions = 0;
  let largestFile: DiffFile | null = null;
  let largestFileSize = 0;

  for (const file of files) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;

    const fileSize = file.additions + file.deletions;
    if (fileSize > largestFileSize) {
      largestFileSize = fileSize;
      largestFile = file;
    }
  }

  return {
    totalFiles: files.length,
    totalAdditions,
    totalDeletions,
    largestFile,
  };
}
