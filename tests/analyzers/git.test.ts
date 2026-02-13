/**
 * Git Analyzer Tests
 *
 * Tests for git history analysis, error handling, and timeout configuration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitFileHistory } from '../../src/graph/types.js';

// Mock simple-git before importing the module
const mockGit = {
  status: vi.fn(),
  log: vi.fn(),
  raw: vi.fn(),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

import { simpleGit } from 'simple-git';
import {
  analyzeChangeCoupling,
  analyzeFileHistory,
  analyzeGitHistory,
  calculateChurnScore,
  createGitClient,
  getRepoStats,
  identifyHotFiles,
  isGitRepository,
} from '../../src/analyzers/git.js';

describe('Git Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGit.status.mockReset();
    mockGit.log.mockReset();
    mockGit.raw.mockReset();
  });

  describe('createGitClient', () => {
    it('should create git client with timeout configuration', () => {
      createGitClient('/test/project');

      expect(simpleGit).toHaveBeenCalledWith('/test/project', {
        timeout: {
          block: 30000,
        },
        maxConcurrentProcesses: 6,
      });
    });

    it('should create different clients for different directories', () => {
      createGitClient('/project1');
      createGitClient('/project2');

      expect(simpleGit).toHaveBeenCalledTimes(2);
      expect(simpleGit).toHaveBeenNthCalledWith(1, '/project1', expect.any(Object));
      expect(simpleGit).toHaveBeenNthCalledWith(2, '/project2', expect.any(Object));
    });
  });

  describe('isGitRepository', () => {
    it('should return true for valid git repository', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });

      const result = await isGitRepository(mockGit as never);

      expect(result).toBe(true);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should return false when git status fails', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repository'));

      const result = await isGitRepository(mockGit as never);

      expect(result).toBe(false);
    });

    it('should handle timeout errors gracefully', async () => {
      mockGit.status.mockRejectedValue(new Error('Timeout'));

      const result = await isGitRepository(mockGit as never);

      expect(result).toBe(false);
    });
  });

  describe('analyzeFileHistory', () => {
    it('should return file history with contributors', async () => {
      mockGit.log.mockResolvedValue({
        total: 5,
        latest: { date: '2024-01-15T10:00:00Z' },
        all: [
          {
            hash: 'abc1234567890',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
            message: 'Latest commit message',
          },
          {
            hash: 'def2345678901',
            author_name: 'Bob',
            author_email: 'bob@example.com',
            date: '2024-01-14T10:00:00Z',
            message: 'Previous commit',
          },
          {
            hash: 'ghi3456789012',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-13T10:00:00Z',
            message: 'Another commit',
          },
        ],
      });

      const result = await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project');

      expect(result).not.toBeNull();
      expect(result!.commitCount).toBe(5);
      expect(result!.contributorCount).toBe(2);
      expect(result!.contributors[0].name).toBe('Alice');
      expect(result!.contributors[0].commits).toBe(2);
      expect(result!.recentCommits).toHaveLength(3);
    });

    it('should return null when file has no git history', async () => {
      mockGit.log.mockResolvedValue({ total: 0, all: [] });

      const result = await analyzeFileHistory(mockGit as never, 'new-file.ts', '/project');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockGit.log.mockRejectedValue(new Error('Git error'));

      const result = await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project');

      expect(result).toBeNull();
    });

    it('should truncate long commit messages', async () => {
      const longMessage = 'A'.repeat(100);
      mockGit.log.mockResolvedValue({
        total: 1,
        latest: { date: '2024-01-15T10:00:00Z' },
        all: [
          {
            hash: 'abc1234567890',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
            message: longMessage,
          },
        ],
      });

      const result = await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project');

      expect(result!.recentCommits[0].message.length).toBeLessThanOrEqual(80);
    });

    it('should handle multi-line commit messages', async () => {
      mockGit.log.mockResolvedValue({
        total: 1,
        latest: { date: '2024-01-15T10:00:00Z' },
        all: [
          {
            hash: 'abc1234567890',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
            message: 'First line\nSecond line\nThird line',
          },
        ],
      });

      const result = await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project');

      expect(result!.recentCommits[0].message).toBe('First line');
    });

    it('should shorten commit hash to 7 characters', async () => {
      mockGit.log.mockResolvedValue({
        total: 1,
        latest: { date: '2024-01-15T10:00:00Z' },
        all: [
          {
            hash: 'abc123456789012345678901234567890',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
            message: 'Commit',
          },
        ],
      });

      const result = await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project');

      expect(result!.recentCommits[0].hash).toBe('abc1234');
    });

    it('should respect maxCommits parameter', async () => {
      mockGit.log.mockResolvedValue({ total: 0, all: [] });

      await analyzeFileHistory(mockGit as never, 'src/test.ts', '/project', 25);

      expect(mockGit.log).toHaveBeenCalledWith({
        file: 'src/test.ts',
        maxCount: 25,
      });
    });
  });

  describe('getRepoStats', () => {
    it('should return repository statistics', async () => {
      mockGit.log.mockResolvedValue({
        latest: { date: '2024-01-15T10:00:00Z' },
      });
      mockGit.raw
        .mockResolvedValueOnce('  100\tAlice\n   50\tBob\n   25\tCharlie\n') // shortlog
        .mockResolvedValueOnce('500\n') // rev-list count
        .mockResolvedValueOnce('2020-01-01T00:00:00Z\n'); // oldest commit

      const result = await getRepoStats(mockGit as never);

      expect(result.totalCommits).toBe(500);
      expect(result.totalContributors).toBe(3);
      expect(result.oldestCommit).toBe('2020-01-01T00:00:00Z');
      expect(result.newestCommit).toBe('2024-01-15T10:00:00Z');
    });

    it('should return empty stats on error', async () => {
      mockGit.log.mockRejectedValue(new Error('Git error'));

      const result = await getRepoStats(mockGit as never);

      expect(result.totalCommits).toBe(0);
      expect(result.totalContributors).toBe(0);
      expect(result.oldestCommit).toBeUndefined();
      expect(result.newestCommit).toBeUndefined();
    });

    it('should handle empty repository', async () => {
      mockGit.log.mockResolvedValue({ latest: null });
      mockGit.raw
        .mockResolvedValueOnce('') // no contributors
        .mockResolvedValueOnce('0\n') // no commits
        .mockResolvedValueOnce(''); // no oldest

      const result = await getRepoStats(mockGit as never);

      expect(result.totalCommits).toBe(0);
      expect(result.totalContributors).toBe(0);
    });
  });

  describe('analyzeGitHistory', () => {
    it('should return non-git-repo result for non-repositories', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repo'));

      const result = await analyzeGitHistory('/non-git-dir', ['file.ts']);

      expect(result.isGitRepo).toBe(false);
      expect(result.fileHistories.size).toBe(0);
      expect(result.repoStats.totalCommits).toBe(0);
    });

    it('should analyze multiple files', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({
        latest: { date: '2024-01-15T10:00:00Z' },
        total: 10,
        all: [
          {
            hash: 'abc1234',
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
            message: 'Commit',
          },
        ],
      });
      mockGit.raw
        .mockResolvedValueOnce('  10\tAlice\n')
        .mockResolvedValueOnce('100\n')
        .mockResolvedValueOnce('2020-01-01T00:00:00Z\n');

      const result = await analyzeGitHistory('/project', ['file1.ts', 'file2.ts']);

      expect(result.isGitRepo).toBe(true);
      expect(result.fileHistories.size).toBe(2);
    });

    it('should call progress callback', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({ total: 0, all: [] });
      mockGit.raw.mockResolvedValue('');

      const progress = vi.fn();
      const files = Array(15)
        .fill(null)
        .map((_, i) => `file${i}.ts`);

      await analyzeGitHistory('/project', files, progress);

      expect(progress).toHaveBeenCalled();
    });

    it('should process files in batches', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({ total: 0, all: [] });
      mockGit.raw.mockResolvedValue('');

      const files = Array(25)
        .fill(null)
        .map((_, i) => `file${i}.ts`);

      await analyzeGitHistory('/project', files);

      // With 25 files and batch size of 10, log should be called at least 25 times
      // (once per file for history analysis)
      expect(mockGit.log.mock.calls.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('identifyHotFiles', () => {
    it('should identify files above threshold', () => {
      const histories = new Map<string, GitFileHistory>([
        [
          'hot-file.ts',
          {
            filePath: 'hot-file.ts',
            lastModified: '2024-01-15',
            commitCount: 50,
            contributorCount: 3,
            contributors: [],
            recentCommits: [],
          },
        ],
        [
          'cold-file.ts',
          {
            filePath: 'cold-file.ts',
            lastModified: '2024-01-10',
            commitCount: 5,
            contributorCount: 1,
            contributors: [],
            recentCommits: [],
          },
        ],
        [
          'warm-file.ts',
          {
            filePath: 'warm-file.ts',
            lastModified: '2024-01-12',
            commitCount: 15,
            contributorCount: 2,
            contributors: [],
            recentCommits: [],
          },
        ],
      ]);

      const hotFiles = identifyHotFiles(histories, 10);

      expect(hotFiles).toHaveLength(2);
      expect(hotFiles[0]).toBe('hot-file.ts');
      expect(hotFiles[1]).toBe('warm-file.ts');
      expect(hotFiles).not.toContain('cold-file.ts');
    });

    it('should sort by commit count descending', () => {
      const histories = new Map<string, GitFileHistory>([
        [
          'a.ts',
          {
            filePath: 'a.ts',
            lastModified: '2024-01-15',
            commitCount: 20,
            contributorCount: 1,
            contributors: [],
            recentCommits: [],
          },
        ],
        [
          'b.ts',
          {
            filePath: 'b.ts',
            lastModified: '2024-01-15',
            commitCount: 50,
            contributorCount: 1,
            contributors: [],
            recentCommits: [],
          },
        ],
        [
          'c.ts',
          {
            filePath: 'c.ts',
            lastModified: '2024-01-15',
            commitCount: 30,
            contributorCount: 1,
            contributors: [],
            recentCommits: [],
          },
        ],
      ]);

      const hotFiles = identifyHotFiles(histories, 10);

      expect(hotFiles[0]).toBe('b.ts');
      expect(hotFiles[1]).toBe('c.ts');
      expect(hotFiles[2]).toBe('a.ts');
    });

    it('should use default threshold of 10', () => {
      const histories = new Map<string, GitFileHistory>([
        [
          'file.ts',
          {
            filePath: 'file.ts',
            lastModified: '2024-01-15',
            commitCount: 9,
            contributorCount: 1,
            contributors: [],
            recentCommits: [],
          },
        ],
      ]);

      const hotFiles = identifyHotFiles(histories);

      expect(hotFiles).toHaveLength(0);
    });

    it('should handle empty map', () => {
      const hotFiles = identifyHotFiles(new Map());

      expect(hotFiles).toHaveLength(0);
    });
  });

  describe('calculateChurnScore', () => {
    it('should calculate higher score for more commits', () => {
      const lowChurn: GitFileHistory = {
        filePath: 'stable.ts',
        lastModified: new Date().toISOString(),
        commitCount: 5,
        contributorCount: 1,
        contributors: [],
        recentCommits: [],
      };

      const highChurn: GitFileHistory = {
        filePath: 'volatile.ts',
        lastModified: new Date().toISOString(),
        commitCount: 100,
        contributorCount: 1,
        contributors: [],
        recentCommits: [],
      };

      const lowScore = calculateChurnScore(lowChurn);
      const highScore = calculateChurnScore(highChurn);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should calculate higher score for more contributors', () => {
      const soloFile: GitFileHistory = {
        filePath: 'solo.ts',
        lastModified: new Date().toISOString(),
        commitCount: 20,
        contributorCount: 1,
        contributors: [],
        recentCommits: [],
      };

      const teamFile: GitFileHistory = {
        filePath: 'team.ts',
        lastModified: new Date().toISOString(),
        commitCount: 20,
        contributorCount: 10,
        contributors: [],
        recentCommits: [],
      };

      const soloScore = calculateChurnScore(soloFile);
      const teamScore = calculateChurnScore(teamFile);

      expect(teamScore).toBeGreaterThan(soloScore);
    });

    it('should calculate higher score for recently modified files', () => {
      const recent: GitFileHistory = {
        filePath: 'recent.ts',
        lastModified: new Date().toISOString(),
        commitCount: 20,
        contributorCount: 2,
        contributors: [],
        recentCommits: [],
      };

      const old: GitFileHistory = {
        filePath: 'old.ts',
        lastModified: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        commitCount: 20,
        contributorCount: 2,
        contributors: [],
        recentCommits: [],
      };

      const recentScore = calculateChurnScore(recent);
      const oldScore = calculateChurnScore(old);

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('should return score between 0 and 1', () => {
      const extremeHigh: GitFileHistory = {
        filePath: 'extreme.ts',
        lastModified: new Date().toISOString(),
        commitCount: 1000,
        contributorCount: 100,
        contributors: [],
        recentCommits: [],
      };

      const extremeLow: GitFileHistory = {
        filePath: 'minimal.ts',
        lastModified: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        commitCount: 1,
        contributorCount: 1,
        contributors: [],
        recentCommits: [],
      };

      const highScore = calculateChurnScore(extremeHigh);
      const lowScore = calculateChurnScore(extremeLow);

      expect(highScore).toBeGreaterThanOrEqual(0);
      expect(highScore).toBeLessThanOrEqual(1);
      expect(lowScore).toBeGreaterThanOrEqual(0);
      expect(lowScore).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeChangeCoupling', () => {
    it('should return empty result for non-git repo', async () => {
      mockGit.status.mockRejectedValue(new Error('Not a git repo'));

      const result = await analyzeChangeCoupling('/non-git', 'file.ts');

      expect(result.coupledFiles).toHaveLength(0);
      expect(result.insights).toContain('Not a git repository');
    });

    it('should return empty result for untracked file', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({ total: 0, all: [] });

      const result = await analyzeChangeCoupling('/project', 'new-file.ts');

      expect(result.coupledFiles).toHaveLength(0);
      expect(result.insights[0]).toContain('No git history');
    });

    it('should identify files that change together', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log
        .mockResolvedValueOnce({
          total: 10,
          all: Array(10)
            .fill(null)
            .map((_, i) => ({
              hash: `abc123${i}`.padEnd(40, '0'),
              author_name: 'Alice',
              author_email: 'alice@example.com',
              date: '2024-01-15T10:00:00Z',
              message: `Commit ${i}`,
            })),
        })
        .mockResolvedValue({ total: 10 }); // For other file commit count lookups

      // All calls to raw return the same files to simulate coupling
      mockGit.raw.mockResolvedValue('coupled.ts\n');

      const result = await analyzeChangeCoupling('/project', 'target.ts');

      expect(result.coupledFiles.length).toBeGreaterThan(0);
      expect(result.coupledFiles[0].file2).toBe('coupled.ts');
      expect(result.coupledFiles[0].couplingStrength).toBe(1.0); // 10/10 = 100%
    });

    it('should detect import relationship when provided', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({
        total: 10,
        all: Array(10)
          .fill(null)
          .map((_, i) => ({
            hash: `commit${i}`.padEnd(40, '0'),
            message: `Commit ${i}`,
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
          })),
      });

      mockGit.raw.mockImplementation((args: string[]) => {
        if (args[0] === 'diff-tree') {
          return Promise.resolve('target.ts\nimported.ts\n');
        }
        return Promise.resolve('');
      });

      const importEdges = new Set(['target.ts->imported.ts']);
      const result = await analyzeChangeCoupling('/project', 'target.ts', { importEdges });

      const coupledFile = result.coupledFiles.find((c) => c.file2 === 'imported.ts');
      expect(coupledFile?.hasImportRelationship).toBe(true);
    });

    it('should filter out non-source files', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockResolvedValue({
        total: 5,
        all: Array(5)
          .fill(null)
          .map((_, i) => ({
            hash: `commit${i}`.padEnd(40, '0'),
            message: `Commit ${i}`,
            author_name: 'Alice',
            author_email: 'alice@example.com',
            date: '2024-01-15T10:00:00Z',
          })),
      });

      mockGit.raw.mockImplementation((args: string[]) => {
        if (args[0] === 'diff-tree') {
          return Promise.resolve('target.ts\nREADME.md\npackage.json\ncoupled.ts\n');
        }
        return Promise.resolve('');
      });

      const result = await analyzeChangeCoupling('/project', 'target.ts');

      // Should only include .ts files, not .md or .json
      const files = result.coupledFiles.map((c) => c.file2);
      expect(files).not.toContain('README.md');
      expect(files).not.toContain('package.json');
    });

    it('should respect minCouplingStrength option', async () => {
      // Test the filtering behavior - files with coupling below threshold are excluded
      mockGit.status.mockResolvedValue({ current: 'main' });

      // Simulate a file that appears in 3 out of 10 commits (30% coupling)
      mockGit.log
        .mockResolvedValueOnce({
          total: 10,
          all: Array(10)
            .fill(null)
            .map((_, i) => ({
              hash: `abc123${i}`.padEnd(40, '0'),
              message: `Commit ${i}`,
              author_name: 'Alice',
              author_email: 'alice@example.com',
              date: '2024-01-15T10:00:00Z',
            })),
        })
        .mockResolvedValue({ total: 10 });

      // Return coupled file only 3 times, empty for rest
      let callCount = 0;
      mockGit.raw.mockImplementation(() => {
        callCount++;
        // First 3 diff-tree calls return the coupled file
        if (callCount <= 3) {
          return Promise.resolve('weak-coupled.ts\n');
        }
        return Promise.resolve('\n');
      });

      // With 50% threshold, 30% coupling should be filtered out
      const resultHigh = await analyzeChangeCoupling('/project', 'target.ts', {
        minCouplingStrength: 0.5,
      });
      expect(resultHigh.coupledFiles).toHaveLength(0);

      // Reset for second call
      callCount = 0;
      mockGit.log
        .mockResolvedValueOnce({
          total: 10,
          all: Array(10)
            .fill(null)
            .map((_, i) => ({
              hash: `def456${i}`.padEnd(40, '0'),
              message: `Commit ${i}`,
              author_name: 'Alice',
              author_email: 'alice@example.com',
              date: '2024-01-15T10:00:00Z',
            })),
        })
        .mockResolvedValue({ total: 10 });

      // With 20% threshold, 30% coupling should be included
      const resultLow = await analyzeChangeCoupling('/project', 'target.ts', {
        minCouplingStrength: 0.2,
      });
      expect(resultLow.coupledFiles.length).toBeGreaterThan(0);
    });

    it('should handle git errors gracefully', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log.mockRejectedValue(new Error('Git error'));

      const result = await analyzeChangeCoupling('/project', 'target.ts');

      expect(result.coupledFiles).toHaveLength(0);
      expect(result.insights[0]).toContain('Error analyzing coupling');
    });

    it('should generate insights for hidden dependencies', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.log
        .mockResolvedValueOnce({
          total: 10,
          all: Array(10)
            .fill(null)
            .map((_, i) => ({
              hash: `xyz789${i}`.padEnd(40, '0'),
              message: `Commit ${i}`,
              author_name: 'Alice',
              author_email: 'alice@example.com',
              date: '2024-01-15T10:00:00Z',
            })),
        })
        .mockResolvedValue({ total: 10 });

      // Return coupled file for ALL commits = 100% coupling
      mockGit.raw.mockResolvedValue('hidden-dep.ts\n');

      const result = await analyzeChangeCoupling('/project', 'target.ts', {
        importEdges: new Set(), // No import edges = hidden dependency
      });

      // Should find the coupled file with high coupling strength
      expect(result.coupledFiles.length).toBeGreaterThan(0);
      expect(result.coupledFiles[0].couplingStrength).toBeGreaterThanOrEqual(0.5);
      expect(result.coupledFiles[0].hasImportRelationship).toBe(false);

      // With >=50% coupling and no import, should mention "hidden"
      expect(result.insights.some((i) => i.toLowerCase().includes('hidden'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout gracefully in file analysis', async () => {
      mockGit.log.mockRejectedValue(new Error('Timeout'));

      const result = await analyzeFileHistory(mockGit as never, 'slow-file.ts', '/project');

      expect(result).toBeNull();
    });

    it('should continue processing other files when one fails', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      mockGit.raw.mockResolvedValue('');

      let callCount = 0;
      mockGit.log.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Git error'));
        }
        return Promise.resolve({
          total: 1,
          latest: { date: '2024-01-15T10:00:00Z' },
          all: [
            {
              hash: 'abc1234',
              author_name: 'Alice',
              author_email: 'alice@example.com',
              date: '2024-01-15T10:00:00Z',
              message: 'Commit',
            },
          ],
        });
      });

      const result = await analyzeGitHistory('/project', ['file1.ts', 'file2.ts', 'file3.ts']);

      // Should have 2 histories (file1 and file3), file2 failed
      expect(result.fileHistories.size).toBe(2);
    });
  });
});
