#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import { analyzeCodebase, type CodebaseStats } from './analyzer.js';

const program = new Command();

program
  .name('specter-roast')
  .description('Get a brutally honest roast of your codebase')
  .version('1.0.0')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('--json', 'Output as JSON')
  .option('--mild', 'Be a little gentler')
  .option('--savage', 'Maximum brutality')
  .action(
    async (directory: string, options: { json?: boolean; mild?: boolean; savage?: boolean }) => {
      const rootDir = directory;

      console.log(chalk.dim('\nScanning codebase...'));
      const stats = analyzeCodebase(rootDir);

      if (options.json) {
        console.log(
          JSON.stringify({ command: 'roast', stats, timestamp: new Date().toISOString() }, null, 2)
        );
        return;
      }

      const roast = generateRoast(stats, { mild: options.mild, savage: options.savage });
      console.log(roast);
    }
  );

interface RoastOptions {
  mild?: boolean;
  savage?: boolean;
}

function generateRoast(stats: CodebaseStats, options: RoastOptions = {}): string {
  const lines: string[] = [];
  const { mild, savage } = options;

  lines.push('');
  lines.push(chalk.bold.red('  \u{1F525} CODEBASE ROAST \u{1F525}'));
  lines.push('');
  lines.push(
    chalk.italic(
      savage
        ? "  Oh, you want honesty? Let's see what horrors await..."
        : mild
          ? '  Let me take a gentle look at your code...'
          : "  Oh, you want feedback? Alright, let's see what we're working with..."
    )
  );
  lines.push('');

  // Stats roast
  lines.push(chalk.bold.cyan('  \u{1F4CA} The Stats:'));
  if (stats.fileCount === 0) {
    lines.push(chalk.white("  No code files found. Can't roast what doesn't exist."));
    lines.push(chalk.dim("  Either this directory is empty or you're in the wrong folder."));
    return `${lines.join('\n')}\n`;
  }

  if (savage) {
    lines.push(
      chalk.white(`  ${stats.fileCount} files. That's ${stats.fileCount} opportunities for bugs.`)
    );
    lines.push(
      chalk.white(
        `  ${stats.totalLines.toLocaleString()} lines of code. That's ${stats.totalLines.toLocaleString()} lines of technical debt.`
      )
    );
  } else if (mild) {
    lines.push(
      chalk.white(
        `  ${stats.fileCount} files with ${stats.totalLines.toLocaleString()} lines of code.`
      )
    );
    lines.push(chalk.dim("  That's... a lot to maintain. You're doing your best."));
  } else {
    lines.push(
      chalk.white(
        `  You have ${stats.fileCount} files. That's ${stats.fileCount} opportunities for bugs. Congratulations.`
      )
    );
    lines.push(
      chalk.white(
        `  ${stats.totalLines.toLocaleString()} lines of code. That's a lot of places to hide mistakes.`
      )
    );
  }
  lines.push('');

  // Largest files roast
  if (stats.largestFiles.length > 0) {
    const _biggest = stats.largestFiles[0];
    lines.push(chalk.bold.red('  \u{1F4A3} Biggest Offenders:'));

    for (const file of stats.largestFiles.slice(0, 5)) {
      const _fileName = file.path.split('/').pop() || file.path;
      let comment = '';

      if (file.lines > 1000) {
        comment = savage
          ? "A thousand lines of pure chaos. This isn't a file, it's a crime scene."
          : mild
            ? "That's quite large. Consider breaking it up when you have time."
            : "That's not a file, that's a novel.";
      } else if (file.lines > 500) {
        comment = savage
          ? "500+ lines and still growing. Someone has commitment issues with the 'extract function' command."
          : mild
            ? 'Getting a bit long. Some refactoring might help.'
            : "Someone really didn't believe in small files.";
      } else if (file.lines > 300) {
        comment = savage
          ? "300 lines of 'I'll split this up later'."
          : mild
            ? 'A bit chunky, but manageable.'
            : "It's seen better days.";
      } else {
        comment = mild ? 'Not too bad actually.' : 'Could be worse.';
      }

      lines.push(chalk.yellow(`  \u{2022} ${file.path} (${file.lines} lines)`));
      lines.push(chalk.dim(`    ${comment}`));
    }
    lines.push('');
  }

  // TODO/FIXME roast
  if (stats.todoCount > 0) {
    lines.push(chalk.bold.yellow('  \u{1F4DD} The Procrastination Index:'));
    if (savage) {
      lines.push(
        chalk.white(
          `  ${stats.todoCount} TODOs and FIXMEs. That's ${stats.todoCount} promises you made to yourself and broke.`
        )
      );
      lines.push(chalk.dim('  Future you is going to hate past you.'));
    } else if (mild) {
      lines.push(chalk.white(`  ${stats.todoCount} TODOs found. We've all been there.`));
      lines.push(chalk.dim("  They'll get done eventually... right?"));
    } else {
      lines.push(
        chalk.white(
          `  ${stats.todoCount} TODOs and FIXMEs. They're not reminders, they're monuments to procrastination.`
        )
      );
      lines.push(chalk.dim("  They'll keep waiting."));
    }
    lines.push('');
  }

  // console.log roast
  if (stats.consoleLogCount > 0) {
    lines.push(chalk.bold.blue('  \u{1F41B} Debug Remnants:'));
    if (savage) {
      lines.push(
        chalk.white(`  ${stats.consoleLogCount} console.logs. Production is going to love those.`)
      );
      lines.push(chalk.dim("  Nothing says 'professional' like logging 'here' and 'why???'."));
    } else if (mild) {
      lines.push(chalk.white(`  ${stats.consoleLogCount} console.logs still hanging around.`));
      lines.push(chalk.dim('  Debugging artifacts. Happens to everyone.'));
    } else {
      lines.push(
        chalk.white(
          `  ${stats.consoleLogCount} console.logs. Were these for debugging? Because they're debugging your reputation.`
        )
      );
      lines.push(chalk.dim('  At least comment them out. Have some dignity.'));
    }
    lines.push('');
  }

  // TypeScript 'any' roast
  if (stats.anyCount > 0) {
    lines.push(chalk.bold.magenta('  \u{1F92B} Type Safety Violations:'));
    if (savage) {
      lines.push(
        chalk.white(`  ${stats.anyCount} uses of 'any'. Why even use TypeScript at this point?`)
      );
      lines.push(chalk.dim("  You're not avoiding types, you're avoiding responsibility."));
    } else if (mild) {
      lines.push(chalk.white(`  ${stats.anyCount} uses of 'any'. Sometimes it's necessary.`));
      lines.push(chalk.dim('  (But try to minimize them when possible.)'));
    } else {
      lines.push(
        chalk.white(
          `  ${stats.anyCount} uses of 'any'. That's ${stats.anyCount} times you gave up on type safety.`
        )
      );
      lines.push(chalk.dim('  TypeScript is crying somewhere.'));
    }
    lines.push('');
  }

  // Suspicious file names
  if (stats.suspiciousNames.length > 0) {
    lines.push(chalk.bold.yellow('  \u{1F914} Naming Crimes:'));
    for (const name of stats.suspiciousNames.slice(0, 3)) {
      lines.push(chalk.white(`  \u{2022} ${name}`));
      if (name.includes('helper')) {
        lines.push(
          chalk.dim('    "Helpers" - the universal sign for "I gave up on naming things"')
        );
      } else if (name.includes('util')) {
        lines.push(chalk.dim('    "Utils" - where functions go to be forgotten'));
      } else if (name.includes('misc')) {
        lines.push(chalk.dim('    "Misc" - at least you\'re honest about the chaos'));
      } else if (name.includes('temp') || name.includes('old') || name.includes('backup')) {
        lines.push(chalk.dim('    This file was meant to be temporary. That was 6 months ago.'));
      } else {
        lines.push(chalk.dim('    This name screams "I\'ll refactor later"'));
      }
    }
    lines.push('');
  }

  // Deep nesting
  if (stats.deepestNesting > 8) {
    lines.push(chalk.bold.red('  \u{1F333} Nesting Nightmares:'));
    if (savage) {
      lines.push(
        chalk.white(
          `  Maximum nesting depth: ${stats.deepestNesting}. That's not code, that's an archaeological dig.`
        )
      );
      lines.push(chalk.dim('  Each level is another layer of "I\'ll fix this tomorrow".'));
    } else if (mild) {
      lines.push(chalk.white(`  Maximum nesting depth: ${stats.deepestNesting}. A bit deep.`));
      lines.push(chalk.dim('  Consider early returns or extracting some logic.'));
    } else {
      lines.push(
        chalk.white(
          `  Maximum nesting depth: ${stats.deepestNesting}. That's Inception-level complexity.`
        )
      );
      lines.push(chalk.dim('  You need a map to understand this code.'));
    }
    lines.push('');
  }

  // Long functions
  if (stats.longFunctions > 0) {
    lines.push(chalk.bold.red('  \u{1F4DC} Function Length Violations:'));
    if (savage) {
      lines.push(
        chalk.white(
          `  ${stats.longFunctions} functions over 50 lines. These aren't functions, they're entire applications.`
        )
      );
      lines.push(chalk.dim('  Single responsibility principle left the chat.'));
    } else if (mild) {
      lines.push(chalk.white(`  ${stats.longFunctions} longer functions detected.`));
      lines.push(chalk.dim('  Consider breaking them into smaller pieces.'));
    } else {
      lines.push(
        chalk.white(
          `  ${stats.longFunctions} functions over 50 lines. That's not a function, that's job security.`
        )
      );
      lines.push(chalk.dim('  Only the author understands it. For now.'));
    }
    lines.push('');
  }

  // Empty files
  if (stats.emptyFiles > 0) {
    lines.push(chalk.bold.gray('  \u{1F47B} Ghost Files:'));
    lines.push(chalk.white(`  ${stats.emptyFiles} empty files. They exist, but why?`));
    lines.push(chalk.dim('  Placeholders that never got filled. Stories that were never told.'));
    lines.push('');
  }

  // Potential duplicates
  if (stats.duplicateLikelyFiles.length > 0) {
    lines.push(chalk.bold.yellow('  \u{1F46F} Suspicious Twins:'));
    lines.push(
      chalk.white(
        `  Found ${Math.floor(stats.duplicateLikelyFiles.length / 2)} pairs of suspiciously similar files:`
      )
    );
    for (let i = 0; i < stats.duplicateLikelyFiles.length; i += 2) {
      lines.push(
        chalk.dim(
          `    ${stats.duplicateLikelyFiles[i]} \u{2194}\u{FE0F} ${stats.duplicateLikelyFiles[i + 1]}`
        )
      );
    }
    lines.push(chalk.dim('  Copy-paste programming at its finest.'));
    lines.push('');
  }

  // node_modules roast
  if (stats.nodeModulesSize > 500) {
    lines.push(chalk.bold.gray('  \u{1F4E6} Dependency Hell:'));
    if (savage) {
      lines.push(chalk.white(`  ${stats.nodeModulesSize} packages in node_modules.`));
      lines.push(chalk.dim("  Your hard drive called. It's filing for divorce."));
    } else if (mild) {
      lines.push(
        chalk.white(`  ${stats.nodeModulesSize} packages. That's modern JavaScript for you.`)
      );
    } else {
      lines.push(chalk.white(`  ${stats.nodeModulesSize} packages in node_modules.`));
      lines.push(chalk.dim('  At this point, node_modules has its own gravitational field.'));
    }
    lines.push('');
  }

  // No .gitignore
  if (!stats.gitIgnored) {
    lines.push(chalk.bold.red('  \u{26A0}\u{FE0F} No .gitignore?'));
    lines.push(chalk.white('  Living dangerously, I see.'));
    lines.push(chalk.dim("  Let's hope you never accidentally commit node_modules."));
    lines.push('');
  }

  // Final verdict
  lines.push(chalk.bold.cyan('  \u{1F3AF} Final Verdict:'));
  const score = calculateRoastScore(stats);
  if (score >= 80) {
    if (savage) {
      lines.push(chalk.green(`  Score: ${score}/100. Not bad. I'm almost disappointed.`));
    } else {
      lines.push(chalk.green(`  Score: ${score}/100. Actually pretty decent!`));
    }
  } else if (score >= 50) {
    lines.push(chalk.yellow(`  Score: ${score}/100. Room for improvement. Lots of room.`));
  } else {
    if (savage) {
      lines.push(chalk.red(`  Score: ${score}/100. This codebase needs therapy, not a roast.`));
    } else {
      lines.push(chalk.red(`  Score: ${score}/100. There's potential here. Somewhere. Deep down.`));
    }
  }
  lines.push('');

  // Mic drop
  lines.push(chalk.bold.red('  \u{1F3A4} *drops mic*'));
  lines.push('');
  lines.push(chalk.dim('  Want the full analysis? Check out: npm install -g specter-mcp'));
  lines.push(chalk.dim('  https://github.com/forbiddenlink/specter'));
  lines.push('');

  return lines.join('\n');
}

function calculateRoastScore(stats: CodebaseStats): number {
  let score = 100;

  // Deductions
  score -= Math.min(20, stats.todoCount * 2); // Max -20 for TODOs
  score -= Math.min(15, stats.consoleLogCount); // Max -15 for console.logs
  score -= Math.min(15, stats.anyCount); // Max -15 for any types
  score -= Math.min(10, stats.suspiciousNames.length * 3); // Max -10 for bad names
  score -= Math.min(10, stats.deepestNesting > 8 ? (stats.deepestNesting - 8) * 2 : 0); // Max -10 for nesting
  score -= Math.min(10, stats.longFunctions * 2); // Max -10 for long functions
  score -= Math.min(5, stats.emptyFiles); // Max -5 for empty files
  score -= Math.min(5, stats.duplicateLikelyFiles.length); // Max -5 for duplicates
  score -= stats.gitIgnored ? 0 : 5; // -5 for no .gitignore

  // Bonus for small, focused codebases
  if (stats.avgLinesPerFile < 100 && stats.fileCount > 5) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

program.parse();
