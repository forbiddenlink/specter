/**
 * Snapshot Storage
 *
 * Persists snapshots to .specter/history/ directory.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config/index.js';
import { getSpecterDir } from '../graph/persistence.js';
import type { HealthSnapshot } from './types.js';

const HISTORY_DIR = 'history';

/**
 * Get history directory path
 */
export function getHistoryDir(rootDir: string): string {
  return path.join(getSpecterDir(rootDir), HISTORY_DIR);
}

/**
 * Ensure history directory exists
 */
async function ensureHistoryDir(rootDir: string): Promise<string> {
  const historyDir = getHistoryDir(rootDir);

  try {
    await fs.access(historyDir);
  } catch {
    await fs.mkdir(historyDir, { recursive: true });
  }

  return historyDir;
}

/**
 * Generate filename for a snapshot
 */
function snapshotFilename(snapshot: HealthSnapshot): string {
  // Convert ISO timestamp to safe filename
  // 2024-01-15T10:30:00.000Z -> 2024-01-15T10-30-00.json
  const safeTimestamp = snapshot.timestamp.replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
  return `${safeTimestamp}.json`;
}

/**
 * Parse timestamp from filename
 */
function parseFilenameTimestamp(filename: string): Date | null {
  // 2024-01-15T10-30-00.json -> 2024-01-15T10:30:00.000Z
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json$/);
  if (!match) return null;

  const [, date, hour, minute, second] = match;
  return new Date(`${date}T${hour}:${minute}:${second}.000Z`);
}

/**
 * Save a snapshot
 */
export async function saveSnapshot(rootDir: string, snapshot: HealthSnapshot): Promise<void> {
  const historyDir = await ensureHistoryDir(rootDir);
  const filename = snapshotFilename(snapshot);
  const filePath = path.join(historyDir, filename);

  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Prune old snapshots if over limit
  await pruneOldSnapshots(rootDir);
}

/**
 * Load all snapshots
 */
export async function loadSnapshots(rootDir: string): Promise<HealthSnapshot[]> {
  const historyDir = getHistoryDir(rootDir);

  try {
    const files = await fs.readdir(historyDir);
    const snapshots: HealthSnapshot[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(historyDir, file), 'utf-8');
        const snapshot = JSON.parse(content) as HealthSnapshot;
        snapshots.push(snapshot);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp, newest first
    return snapshots.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    // History directory doesn't exist
    return [];
  }
}

/**
 * Load snapshots within a date range
 */
export async function loadSnapshotsInRange(
  rootDir: string,
  startDate: Date,
  endDate: Date
): Promise<HealthSnapshot[]> {
  const snapshots = await loadSnapshots(rootDir);

  return snapshots.filter((s) => {
    const time = new Date(s.timestamp).getTime();
    return time >= startDate.getTime() && time <= endDate.getTime();
  });
}

/**
 * Get the most recent snapshot
 */
export async function getLatestSnapshot(rootDir: string): Promise<HealthSnapshot | null> {
  const snapshots = await loadSnapshots(rootDir);
  return snapshots[0] || null;
}

/**
 * Get snapshot by ID (timestamp)
 */
export async function getSnapshotById(rootDir: string, id: string): Promise<HealthSnapshot | null> {
  const snapshots = await loadSnapshots(rootDir);
  return snapshots.find((s) => s.id === id) || null;
}

/**
 * Delete old snapshots beyond the configured max
 */
async function pruneOldSnapshots(rootDir: string): Promise<void> {
  const historyDir = getHistoryDir(rootDir);
  const config = getConfig(rootDir);
  const maxSnapshots = config.history.maxSnapshots;

  try {
    const files = await fs.readdir(historyDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length <= maxSnapshots) return;

    // Sort files by timestamp (from filename)
    const fileTimestamps = jsonFiles
      .map((f) => ({ file: f, timestamp: parseFilenameTimestamp(f) }))
      .filter((f) => f.timestamp !== null)
      .sort((a, b) => b.timestamp!.getTime() - a.timestamp!.getTime());

    // Delete files beyond max
    const toDelete = fileTimestamps.slice(maxSnapshots);

    for (const { file } of toDelete) {
      try {
        await fs.unlink(path.join(historyDir, file));
      } catch {
        // Ignore deletion errors
      }
    }
  } catch {
    // History directory doesn't exist, nothing to prune
  }
}

/**
 * Get count of stored snapshots
 */
export async function getSnapshotCount(rootDir: string): Promise<number> {
  const snapshots = await loadSnapshots(rootDir);
  return snapshots.length;
}

/**
 * Clear all history
 */
export async function clearHistory(rootDir: string): Promise<void> {
  const historyDir = getHistoryDir(rootDir);

  try {
    await fs.rm(historyDir, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
}
