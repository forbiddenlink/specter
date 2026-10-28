/**
 * Brief command - the change-risk brief for one file, as an agent would see it
 */

import path from 'node:path'
import chalk from 'chalk'
import type { Command } from 'commander'
import { loadGraph } from '../../graph/persistence.js'
import { outputJson } from '../../json-output.js'
import { buildFileBrief, renderAgentBrief } from '../../risk/brief.js'

export function register(program: Command): void {
  program
    .command('brief <file>')
    .description('What to know before editing a file: co-changes, dependents, hotspot, tests')
    .option('-d, --dir <path>', 'Project root', '.')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
The "agent sees" section is exactly what the Claude Code hook injects before an
edit. It stays empty for unremarkable files on purpose.

Examples:
  $ specter brief src/lib/api.ts
  $ specter brief src/lib/api.ts --json`
    )
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir)
      const graph = await loadGraph(rootDir)
      if (!graph) {
        console.error(chalk.yellow('No graph found. Run `specter scan` first.'))
        process.exitCode = 1
        return
      }

      const relative = path.relative(rootDir, path.resolve(file))
      const brief = buildFileBrief(graph, rootDir, relative)
      const agentText = renderAgentBrief(brief)

      if (options.json) {
        outputJson('brief', { ...brief, agentBrief: agentText })
        return
      }

      if (!brief.inGraph) {
        console.log(chalk.yellow(`${relative} is not in the graph (new, excluded, or not source).`))
        return
      }

      const pct = (n: number) => `${Math.round(n * 100)}%`
      console.log()
      console.log(chalk.bold(relative))
      console.log(chalk.dim(`graph from ${brief.scannedAt}`))
      console.log()
      console.log(
        `  Complexity  ${brief.maxComplexity}${brief.complexSymbol ? chalk.dim(` (${brief.complexSymbol})`) : ''}`
      )
      console.log(`  Commits     ${brief.churn}`)
      if (brief.hotspotPercentile !== null) {
        console.log(`  Hotspot     higher than ${pct(brief.hotspotPercentile)} of files`)
      }
      console.log(
        `  Imported by ${brief.dependents.length} file${brief.dependents.length === 1 ? '' : 's'}`
      )
      for (const dep of brief.dependents.slice(0, 5)) console.log(chalk.dim(`              ${dep}`))
      if (brief.owners.length > 0)
        console.log(`  Owners      ${brief.owners.slice(0, 3).join(', ')}`)

      console.log()
      console.log(chalk.bold('  Changes together with'))
      if (brief.coChange.length === 0)
        console.log(chalk.dim('    nothing above the mining threshold'))
      for (const p of brief.coChange) {
        console.log(
          `    ${p.file}  ${chalk.cyan(pct(p.confidence))} ${chalk.dim(`(${p.shared} commits)`)}${p.linked ? '' : chalk.yellow('  no import link')}`
        )
      }

      console.log()
      console.log(chalk.bold('  Tests'))
      console.log(
        brief.tests.length > 0 ? `    ${brief.tests.join('\n    ')}` : chalk.dim('    none found')
      )

      console.log()
      console.log(chalk.bold('  Agent sees before editing'))
      console.log(
        agentText
          ? agentText
              .split('\n')
              .map((l) => `    ${l}`)
              .join('\n')
          : chalk.dim('    nothing (below thresholds, so the hook stays silent)')
      )
      console.log()
    })
}
