/**
 * Next - Suggest the highest-impact refactoring target
 */

import chalk from 'chalk'
import type { KnowledgeGraph } from './graph/types.js'

export interface NextSuggestion {
  file: string
  complexity: number
  churn: number
  dependents: number
  busFactor: number
  impactScore: number
  estimatedCostSavings: number
}

export function analyzeNext(
  graph: KnowledgeGraph,
  options: { top?: number } = {}
): NextSuggestion[] {
  const top = options.top || 1
  const nodes = Object.values(graph.nodes)
  const edges = graph.edges

  // Build file-level metrics
  const fileMetrics: Map<
    string,
    { complexity: number; churn: number; dependents: number; busFactor: number }
  > = new Map()

  for (const node of nodes) {
    if (node.type !== 'file') continue

    // Get max complexity of symbols in this file
    const fileSymbols = nodes.filter((n) => n.type !== 'file' && n.filePath === node.filePath)
    const maxComplexity = fileSymbols.reduce((max, s) => Math.max(max, s.complexity || 0), 0)

    if (maxComplexity < 5) continue // Skip simple files

    // Count dependents (files that import from this file)
    const dependentCount = edges.filter(
      (e) => e.target === node.id && (e.type === 'imports' || e.type === 'uses')
    ).length

    // Get churn from git data (modificationCount on GraphNode)
    const churn = node.modificationCount || 0

    // Get contributor count as bus factor proxy
    const contributors = node.contributors?.length || 1
    const busFactor = contributors

    fileMetrics.set(node.filePath, {
      complexity: maxComplexity,
      churn,
      dependents: dependentCount,
      busFactor,
    })
  }

  // Score and rank
  const suggestions: NextSuggestion[] = []

  for (const [file, metrics] of fileMetrics) {
    // Normalize each factor to 0-1 range relative to max in codebase
    const maxComplexity = Math.max(...[...fileMetrics.values()].map((m) => m.complexity), 1)
    const maxChurn = Math.max(...[...fileMetrics.values()].map((m) => m.churn), 1)
    const maxDeps = Math.max(...[...fileMetrics.values()].map((m) => m.dependents), 1)

    const normComplexity = metrics.complexity / maxComplexity
    const normChurn = metrics.churn / maxChurn
    const normDeps = metrics.dependents / maxDeps
    const busFrisk = metrics.busFactor <= 1 ? 1.0 : metrics.busFactor <= 2 ? 0.5 : 0.2

    const impactScore = normComplexity * 0.3 + normChurn * 0.25 + normDeps * 0.25 + busFrisk * 0.2

    // Rough cost estimate: complexity * churn * $50/hr developer rate * 2hrs/fix
    const estimatedCostSavings = Math.round(metrics.complexity * Math.max(metrics.churn, 1) * 100)

    suggestions.push({
      file,
      complexity: metrics.complexity,
      churn: metrics.churn,
      dependents: metrics.dependents,
      busFactor: metrics.busFactor,
      impactScore,
      estimatedCostSavings,
    })
  }

  return suggestions.sort((a, b) => b.impactScore - a.impactScore).slice(0, top)
}

export function formatNext(suggestions: NextSuggestion[]): string {
  if (suggestions.length === 0) {
    return (
      chalk.green('  No urgent refactoring targets. Your codebase is in good shape!\n') +
      chalk.dim('  Run `specter health` for the full picture.')
    )
  }

  const lines: string[] = []

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i]
    if (!s) continue

    if (i === 0) {
      lines.push('')
      lines.push(`  ${chalk.bold('Highest-impact fix:')} ${chalk.cyan(s.file)}`)
      lines.push('')
      lines.push(`  ${chalk.bold('Why this file:')}`)
      lines.push(
        `    Complexity:  ${chalk.yellow(String(s.complexity))} ${s.complexity > 20 ? chalk.red('(critical)') : s.complexity > 10 ? chalk.yellow('(high)') : ''}`
      )
      lines.push(`    Churn:       ${chalk.yellow(String(s.churn))} changes`)
      lines.push(
        `    Bus factor:  ${chalk.yellow(String(s.busFactor))} ${s.busFactor <= 1 ? chalk.red('(sole owner)') : ''}`
      )
      lines.push(`    Dependents:  ${chalk.yellow(String(s.dependents))} files import this`)
      lines.push('')
      lines.push(
        `  ${chalk.bold('Impact:')} Fixing this saves ~${chalk.green(`$${s.estimatedCostSavings.toLocaleString()}`)}/year in maintenance`
      )
      lines.push('')
      lines.push(chalk.bold('  Get started:'))
      lines.push(chalk.dim(`    -> ${chalk.cyan(`specter fix ${s.file}`)}     AI fix suggestions`))
      lines.push(
        chalk.dim(`    -> ${chalk.cyan('specter explain-hotspot')}     Deep dive on complexity`)
      )
      lines.push(
        chalk.dim(`    -> ${chalk.cyan(`specter why ${s.file}`)}     Understand why it exists`)
      )
    } else {
      lines.push('')
      lines.push(
        `  ${chalk.dim(`#${i + 1}`)} ${chalk.cyan(s.file)} — complexity ${s.complexity}, ${s.dependents} dependents, ~$${s.estimatedCostSavings.toLocaleString()}/yr`
      )
    }
  }

  lines.push('')
  return lines.join('\n')
}
