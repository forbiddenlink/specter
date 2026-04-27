/**
 * Contribution Helpers
 *
 * Shared utilities for calculating contributor scores across
 * the knowledge map and bus factor analysis modules.
 */

/**
 * Calculate a contribution score based on commits and lines changed.
 *
 * The formula weights commits as the primary factor, with lines changed
 * (both added and removed) as a secondary factor at 1/10th weight.
 * This balances frequency of contribution with volume of changes.
 *
 * @param commits - Number of commits made
 * @param linesAdded - Number of lines added
 * @param linesRemoved - Number of lines removed
 * @returns A weighted contribution score
 */
export function calculateContributionScore(
  commits: number,
  linesAdded: number,
  linesRemoved: number
): number {
  return commits + (linesAdded + linesRemoved) / 10
}
