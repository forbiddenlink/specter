/**
 * Risk command - analyze commit/PR risk
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';
import { formatRiskComment } from '../../personality/formatter.js';
import type { PersonalityMode } from '../../personality/types.js';
import { createSpinner } from '../types.js';

export function register(program: Command): void {
  program
    .command('risk')
    .description('Analyze risk of staged changes or commits')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--staged', 'Analyze staged changes (default)', true)
    .option('-b, --branch <branch>', 'Compare against branch')
    .option('-c, --commit <hash>', 'Analyze specific commit')
    .option(
      '-p, --personality <mode>',
      'Output personality: mentor, critic, historian, cheerleader, minimalist',
      'default'
    )
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (options) => {
      const rootDir = path.resolve(options.dir);
      const personality = options.personality as PersonalityMode;

      const graph = await loadGraph(rootDir);
      if (!graph) {
        if (options.json) {
          outputJsonError('risk', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      const spinner = options.json ? null : createSpinner('Analyzing risk...');
      spinner?.start();

      try {
        // Dynamic import to avoid loading risk code unless needed
        const { calculateRiskScore } = await import('../../risk/scorer.js');

        const risk = await calculateRiskScore(rootDir, graph, {
          staged: options.staged,
          branch: options.branch,
          commit: options.commit,
        });

        spinner?.stop();

        // JSON output for CI/CD
        if (options.json) {
          outputJson(
            'risk',
            {
              overall: risk.overall,
              level: risk.level,
              factors: risk.factors,
              recommendations: risk.recommendations,
              summary: risk.summary,
            },
            { personality }
          );
          return;
        }

        // Display risk score with visual
        const levelColor =
          risk.level === 'low'
            ? chalk.green
            : risk.level === 'medium'
              ? chalk.yellow
              : risk.level === 'high'
                ? chalk.hex('#FFA500')
                : chalk.red;

        const levelEmoji =
          risk.level === 'low'
            ? '🟢'
            : risk.level === 'medium'
              ? '🟡'
              : risk.level === 'high'
                ? '🟠'
                : '🔴';

        const W = 55; // inner width

        console.log();
        console.log(chalk.bold(`╔${'═'.repeat(W)}╗`));
        console.log(
          chalk.bold('║') +
            '  👻 ' +
            chalk.bold.white('SPECTER RISK ANALYSIS') +
            ' '.repeat(W - 27) +
            chalk.bold('║')
        );
        console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

        // Overall score with big display
        const riskLabel = `  ${levelEmoji} Risk: ${levelColor(risk.level.toUpperCase())} ${risk.overall}/100`;
        console.log(
          chalk.bold('║') + riskLabel + ' '.repeat(W - riskLabel.length + 13) + chalk.bold('║')
        );

        // Progress bar for risk
        const barWidth = 40;
        const filled = Math.round((risk.overall / 100) * barWidth);
        const empty = barWidth - filled;
        const bar = levelColor('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
        console.log(`${chalk.bold('║')}  ${bar}${' '.repeat(W - barWidth - 4)}${chalk.bold('║')}`);

        console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

        // Factor breakdown
        const factorTitle = '  Risk Factors:';
        console.log(
          chalk.bold('║') +
            chalk.cyan(factorTitle) +
            ' '.repeat(W - factorTitle.length + 2) +
            chalk.bold('║')
        );
        console.log(chalk.bold('║') + chalk.dim(`  ${'─'.repeat(W - 4)}`) + chalk.bold('║'));

        for (const [, factor] of Object.entries(risk.factors)) {
          const factorBar = (() => {
            const fWidth = 12;
            const fFilled = Math.round((factor.score / 100) * fWidth);
            const fEmpty = fWidth - fFilled;
            const fColor =
              factor.score <= 25
                ? chalk.green
                : factor.score <= 50
                  ? chalk.yellow
                  : factor.score <= 75
                    ? chalk.hex('#FFA500')
                    : chalk.red;
            return fColor('█'.repeat(fFilled)) + chalk.dim('░'.repeat(fEmpty));
          })();
          const scorePad = factor.score.toString().padStart(3);
          const factorLine = `  ${factor.name.padEnd(18)} ${factorBar} ${scorePad}`;
          console.log(
            chalk.bold('║') + factorLine + ' '.repeat(W - factorLine.length + 2) + chalk.bold('║')
          );
        }

        console.log(chalk.bold(`╠${'═'.repeat(W)}╣`));

        // Recommendations
        if (risk.recommendations.length > 0) {
          const recTitle = '  Recommendations:';
          console.log(
            chalk.bold('║') +
              chalk.yellow(recTitle) +
              ' '.repeat(W - recTitle.length + 2) +
              chalk.bold('║')
          );
          for (const rec of risk.recommendations) {
            const recLine = `  • ${rec.slice(0, W - 6)}`;
            console.log(
              chalk.bold('║') +
                recLine +
                ' '.repeat(Math.max(0, W - recLine.length + 2)) +
                chalk.bold('║')
            );
          }
        }

        console.log(chalk.bold(`╚${'═'.repeat(W)}╝`));

        // Summary with personality
        console.log();
        if (personality !== 'default') {
          const personalitySummary = formatRiskComment(risk.level, risk.overall, personality);
          console.log(chalk.italic(personalitySummary));
        } else {
          console.log(chalk.italic(risk.summary));
        }
        console.log();
      } catch (error) {
        spinner?.fail('Risk analysis failed');
        if (options.json) {
          outputJsonError('risk', error instanceof Error ? error.message : String(error));
        }
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    });
}
