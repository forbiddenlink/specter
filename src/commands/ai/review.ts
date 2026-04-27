/**
 * AI Review command - AI-powered PR review using Claude
 */

import { spawnSync } from 'node:child_process'
import chalk from 'chalk'
import type { Command } from 'commander'
import ora from 'ora'
import { isAIEnabled, reasonAboutCode } from '../../ai/claude-client.js'

interface ReviewOptions {
  output?: 'markdown' | 'text'
  verbose?: boolean
}

interface PRDetails {
  title: string
  body: string
}

/**
 * Check if gh CLI is installed and authenticated
 */
function checkGhCLI(): boolean {
  const result = spawnSync('gh', ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

/**
 * Get PR diff using gh CLI
 */
function getPRDiff(prNumber: string): string | null {
  const result = spawnSync('gh', ['pr', 'diff', prNumber], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })

  if (result.error || result.status !== 0) {
    return null
  }

  return result.stdout
}

/**
 * Get PR details (title, body) using gh CLI
 */
function getPRDetails(prNumber: string): PRDetails | null {
  const result = spawnSync('gh', ['pr', 'view', prNumber, '--json', 'title,body'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })

  if (result.error || result.status !== 0) {
    return null
  }

  try {
    return JSON.parse(result.stdout) as PRDetails
  } catch {
    return null
  }
}

/**
 * Truncate diff if too long to fit in context
 */
function truncateDiff(diff: string, maxLength: number = 8000): string {
  if (diff.length <= maxLength) {
    return diff
  }
  return `${diff.slice(0, maxLength)}\n\n... (diff truncated, ${diff.length - maxLength} more characters)`
}

/**
 * Build the review prompt for Claude
 */
function buildReviewPrompt(prDetails: PRDetails, _diff: string): string {
  return `You are a senior software engineer performing a code review on a pull request.

## PR Title
${prDetails.title}

## PR Description
${prDetails.body || '(No description provided)'}

## Your Task
Analyze the diff below and provide a comprehensive code review. Focus on:

1. **Risk Assessment**: Identify high-risk changes (breaking changes, security implications, performance impacts)
2. **Potential Bugs**: Look for logic errors, edge cases, null/undefined handling, race conditions
3. **Code Quality**: Check for code style, maintainability, readability, and adherence to best practices
4. **Security Considerations**: Look for security vulnerabilities (injection, auth issues, data exposure)
5. **Suggestions**: Provide actionable improvement suggestions

## Output Format
Please structure your review as follows:

### Summary
A brief 1-2 sentence summary of what this PR does.

### Risk Level
[LOW/MEDIUM/HIGH] with brief justification

### Issues Found
- List any bugs, security issues, or concerns
- Use severity markers: [CRITICAL], [WARNING], [INFO]

### Suggestions
- Actionable improvements that would enhance the code

### Approval Recommendation
[APPROVE / REQUEST_CHANGES / COMMENT] with brief reasoning

## Diff to Review`
}

/**
 * Perform AI-powered PR review
 */
export async function reviewPR(prNumber: string, options: ReviewOptions): Promise<void> {
  const spinner = ora('Starting PR review...').start()

  // Check if gh CLI is available
  if (!checkGhCLI()) {
    spinner.fail('GitHub CLI not found')
    console.log(chalk.yellow('\nGitHub CLI (gh) is required for PR reviews.'))
    console.log(chalk.white('Install it from: https://cli.github.com/'))
    console.log(chalk.white('Then authenticate with: gh auth login\n'))
    process.exit(1)
  }

  // Check if AI is enabled
  if (!isAIEnabled()) {
    spinner.fail('AI features not available')
    console.log(chalk.yellow('\nAI features require an Anthropic API key.'))
    console.log(chalk.white('Set the ANTHROPIC_API_KEY environment variable to enable.\n'))
    process.exit(1)
  }

  // Fetch PR details
  spinner.text = 'Fetching PR details...'
  const prDetails = getPRDetails(prNumber)
  if (!prDetails) {
    spinner.fail('Failed to fetch PR details')
    console.log(chalk.yellow(`\nCould not fetch PR #${prNumber}.`))
    console.log(chalk.white('Make sure the PR exists and you have access to the repository.\n'))
    process.exit(1)
  }

  // Fetch PR diff
  spinner.text = 'Fetching PR diff...'
  const diff = getPRDiff(prNumber)
  if (!diff) {
    spinner.fail('Failed to fetch PR diff')
    console.log(chalk.yellow(`\nCould not fetch diff for PR #${prNumber}.`))
    console.log(chalk.white('Make sure the PR exists and you have access to the repository.\n'))
    process.exit(1)
  }

  if (options.verbose) {
    spinner.info(`PR #${prNumber}: ${prDetails.title}`)
    console.log(chalk.dim(`Diff size: ${diff.length} characters\n`))
    spinner.start('Analyzing changes with AI...')
  } else {
    spinner.text = 'Analyzing changes with AI...'
  }

  // Build prompt and analyze with AI
  const prompt = buildReviewPrompt(prDetails, '')
  const truncatedDiff = truncateDiff(diff)

  try {
    const analysis = await reasonAboutCode(prompt, truncatedDiff)

    spinner.succeed('Review complete')

    // Output the review
    console.log(`\n${chalk.bold.cyan(`PR Review: #${prNumber}\n`)}`)

    if (options.output === 'text') {
      // Strip markdown formatting for plain text output
      console.log(analysis)
    } else {
      // Markdown output (default) - suitable for PR comments
      console.log(analysis)
    }

    console.log(
      chalk.dim(
        '\nTo post this as a PR comment, copy the output above or pipe to gh:\n' +
          `  specter review ${prNumber} | gh pr comment ${prNumber} --body-file -\n`
      )
    )
  } catch (error) {
    spinner.fail('Review failed')
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`))
    }
    process.exit(1)
  }
}

/**
 * Register the review command
 */
export function register(program: Command): void {
  program
    .command('ai-review <pr-number>')
    .description('AI-powered PR review using Claude (alternative to `review` command)')
    .option('-o, --output <format>', 'Output format: markdown (default) or text', 'markdown')
    .option('-v, --verbose', 'Show detailed progress and PR info')
    .action(async (prNumber: string, options: ReviewOptions) => {
      // Validate PR number is numeric
      if (!/^\d+$/.test(prNumber)) {
        console.error(chalk.red('Error: PR number must be a positive integer.'))
        process.exit(1)
      }
      await reviewPR(prNumber, options)
    })
}
