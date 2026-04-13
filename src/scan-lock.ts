/**
 * Scan Lock — prevents concurrent scans from corrupting graph.json
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCK_FILE = 'scan.lock'
const STALE_LOCK_MS = 10 * 60 * 1000 // 10 minutes — assume stale if older

interface LockInfo {
  pid: number
  startedAt: string
}

/**
 * Acquire a scan lock. Returns true if acquired, false if another scan is running.
 */
export async function acquireScanLock(rootDir: string): Promise<boolean> {
  const lockPath = path.join(rootDir, '.specter', LOCK_FILE)

  // Check for existing lock
  try {
    const content = await fs.readFile(lockPath, 'utf-8')
    const lock: LockInfo = JSON.parse(content)

    // Check if lock is stale (process crashed without cleanup)
    const age = Date.now() - new Date(lock.startedAt).getTime()
    if (age > STALE_LOCK_MS) {
      // Stale lock — remove and proceed
      await fs.unlink(lockPath)
    } else {
      // Check if the PID is still running
      try {
        process.kill(lock.pid, 0) // signal 0 = just check if process exists
        return false // Process is alive, lock is valid
      } catch {
        // Process is dead, lock is orphaned
        await fs.unlink(lockPath)
      }
    }
  } catch {
    // No lock file exists — good
  }

  // Create lock
  const lockInfo: LockInfo = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }

  // Ensure .specter/ exists
  await fs.mkdir(path.join(rootDir, '.specter'), { recursive: true })
  await fs.writeFile(lockPath, JSON.stringify(lockInfo), 'utf-8')
  return true
}

/**
 * Release the scan lock.
 */
export async function releaseScanLock(rootDir: string): Promise<void> {
  const lockPath = path.join(rootDir, '.specter', LOCK_FILE)
  try {
    await fs.unlink(lockPath)
  } catch {
    // Already gone
  }
}
