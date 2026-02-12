/**
 * JSON output utility for CI/CD integration
 *
 * Provides consistent JSON output format across all CLI commands.
 */

export interface JsonOutput<T = unknown> {
  /** Command that was run */
  command: string;
  /** ISO timestamp of when command was run */
  timestamp: string;
  /** Whether the command succeeded */
  success: boolean;
  /** Command-specific data */
  data: T;
  /** Optional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Output data as JSON and exit
 * @param command - The command name (e.g., 'health', 'risk')
 * @param data - The data to output
 * @param meta - Optional metadata (personality, thresholds, etc.)
 */
export function outputJson<T>(command: string, data: T, meta?: Record<string, unknown>): void {
  const output: JsonOutput<T> = {
    command,
    timestamp: new Date().toISOString(),
    success: true,
    data,
    ...(meta && { meta }),
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output an error as JSON and exit with code 1
 * @param command - The command name
 * @param error - The error message
 */
export function outputJsonError(command: string, error: string): never {
  const output: JsonOutput<null> = {
    command,
    timestamp: new Date().toISOString(),
    success: false,
    data: null,
    meta: { error },
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(1);
}
