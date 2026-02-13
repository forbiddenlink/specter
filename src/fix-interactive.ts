/**
 * Interactive Fix Mode
 *
 * Provides an interactive CLI experience for applying fixes suggested
 * by Specter. Walks through suggestions one-by-one and applies fixes
 * where possible.
 */

import { stdin as input, stdout as output } from 'node:process';
import * as readline from 'node:readline/promises';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { Project, SyntaxKind } from 'ts-morph';
import type { FixResult, FixSuggestion } from './fix.js';

export interface InteractiveOptions {
  autoApply?: boolean; // Auto-apply safe fixes
  skipInfo?: boolean; // Skip info-level suggestions
}

/**
 * Run interactive fix session
 */
export async function runInteractiveFix(
  result: FixResult,
  options: InteractiveOptions = {}
): Promise<InteractiveFixSession> {
  const session: InteractiveFixSession = {
    file: result.filePath,
    total: result.suggestions.length,
    applied: 0,
    skipped: 0,
    failed: 0,
    fixes: [],
  };

  const rl = readline.createInterface({ input, output });

  console.log();
  const g = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  console.log(g('  ╔═══════════════════════════════════════════╗'));
  console.log(g('  ║') + chalk.bold.white('        🔧 INTERACTIVE FIX SESSION         ') + g('║'));
  console.log(g('  ╚═══════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.dim(`  File: ${result.filePath}`));
  console.log(chalk.dim(`  Suggestions: ${result.suggestions.length}`));
  console.log();

  // Group by severity
  const critical = result.suggestions.filter((s) => s.severity === 'critical');
  const warnings = result.suggestions.filter((s) => s.severity === 'warning');
  const info = result.suggestions.filter((s) => s.severity === 'info');

  // Process critical first, then warnings, then info
  const ordered = [...critical, ...warnings, ...(options.skipInfo ? [] : info)];

  for (let i = 0; i < ordered.length; i++) {
    const suggestion = ordered[i];
    const isLast = i === ordered.length - 1;

    console.log(
      chalk.bold(
        `  [${i + 1}/${ordered.length}] ${getSeverityEmoji(suggestion.severity)} ${suggestion.title}`
      )
    );
    console.log();

    for (const detail of suggestion.details) {
      console.log(chalk.dim(`     ${detail}`));
    }

    if (suggestion.expectedOutcome) {
      console.log();
      console.log(chalk.green(`     ✓ Expected result: ${suggestion.expectedOutcome}`));
    }

    console.log();

    // Check if we can auto-fix this
    const canAutoFix = isAutoFixable(suggestion);

    if (canAutoFix && options.autoApply) {
      console.log(chalk.cyan('     🤖 Auto-applying safe fix...'));
      const applied = await applyFix(result.absolutePath, suggestion);
      if (applied) {
        session.applied++;
        session.fixes.push({ suggestion: suggestion.title, applied: true });
        console.log(chalk.green('     ✅ Applied!'));
      } else {
        session.failed++;
        session.fixes.push({
          suggestion: suggestion.title,
          applied: false,
          error: 'Auto-fix failed',
        });
        console.log(chalk.red('     ❌ Auto-fix failed'));
      }
    } else {
      const actions = ['Yes', 'No', 'Skip remaining'];
      if (canAutoFix) {
        actions.unshift('Apply automatically');
      }

      const prompt = chalk.cyan(
        `     Action? ${actions.map((a, idx) => `[${idx + 1}] ${a}`).join(' ')}: `
      );
      const answer = await rl.question(prompt);
      const choice = parseInt(answer, 10);

      if (canAutoFix && choice === 1) {
        // Apply automatically
        console.log(chalk.cyan('     🤖 Applying fix...'));
        const applied = await applyFix(result.absolutePath, suggestion);
        if (applied) {
          session.applied++;
          session.fixes.push({ suggestion: suggestion.title, applied: true });
          console.log(chalk.green('     ✅ Applied!'));
        } else {
          session.failed++;
          session.fixes.push({
            suggestion: suggestion.title,
            applied: false,
            error: 'Apply failed',
          });
          console.log(chalk.red('     ❌ Apply failed'));
        }
      } else if ((canAutoFix && choice === 2) || (!canAutoFix && choice === 1)) {
        // Yes - show instructions
        showFixInstructions(suggestion);
        session.skipped++;
        session.fixes.push({ suggestion: suggestion.title, applied: false, manual: true });
      } else if ((canAutoFix && choice === 3) || (!canAutoFix && choice === 2)) {
        // No - skip
        console.log(chalk.dim('     ⏭️  Skipped'));
        session.skipped++;
        session.fixes.push({ suggestion: suggestion.title, applied: false });
      } else {
        // Skip remaining
        console.log(chalk.dim(`     ⏭️  Skipping remaining ${ordered.length - i - 1} suggestions`));
        session.skipped += ordered.length - i;
        break;
      }
    }

    if (!isLast) {
      console.log();
      console.log(chalk.dim(`  ${'─'.repeat(60)}`));
      console.log();
    }
  }

  rl.close();

  // Show session summary
  console.log();
  const g2 = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  console.log(g2('  ╔═══════════════════════════════════════════╗'));
  console.log(g2('  ║') + chalk.bold.white('          SESSION COMPLETE                ') + g2('║'));
  console.log(g2('  ╚═══════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.green(`  ✅ Applied: ${session.applied}`));
  console.log(chalk.yellow(`  ⏭️  Skipped: ${session.skipped}`));
  if (session.failed > 0) {
    console.log(chalk.red(`  ❌ Failed: ${session.failed}`));
  }
  console.log();

  if (session.applied > 0) {
    console.log(chalk.cyan('  💡 Remember to:'));
    console.log(chalk.dim('     1. Review the changes'));
    console.log(chalk.dim('     2. Run tests'));
    console.log(chalk.dim('     3. Re-scan: specter scan'));
    console.log();
  }

  return session;
}

/**
 * Check if a suggestion can be auto-fixed
 */
function isAutoFixable(suggestion: FixSuggestion): boolean {
  // Safe auto-fixes:
  // - Remove unused exports
  // - Remove unused imports
  // - Add missing returns
  // - Remove dead code

  const autoFixPatterns = [
    /remove unused export/i,
    /remove unused import/i,
    /unused export.*can be removed/i,
    /dead code.*can be deleted/i,
  ];

  return autoFixPatterns.some(
    (pattern) => pattern.test(suggestion.title) || suggestion.details.some((d) => pattern.test(d))
  );
}

/**
 * Apply a fix to a file
 */
async function applyFix(filePath: string, suggestion: FixSuggestion): Promise<boolean> {
  try {
    // Use ts-morph for safe AST-based transformations
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);

    let modified = false;

    // Handle unused export removal
    if (/remove unused export/i.test(suggestion.title) || /unused export/i.test(suggestion.title)) {
      // Extract export name from details
      const exportMatch = suggestion.details.join(' ').match(/export[:\s]+['"]?(\w+)['"]?/i);
      if (exportMatch) {
        const exportName = exportMatch[1];

        // Find and remove the export
        const exportDeclarations = sourceFile.getExportDeclarations();
        for (const exp of exportDeclarations) {
          const namedExports = exp.getNamedExports();
          for (const named of namedExports) {
            if (named.getName() === exportName) {
              if (namedExports.length === 1) {
                exp.remove();
              } else {
                named.remove();
              }
              modified = true;
              break;
            }
          }
        }

        // Also check for exported declarations
        const declarations = sourceFile.getStatements();
        for (const decl of declarations) {
          if (
            decl.getKind() === SyntaxKind.FunctionDeclaration ||
            decl.getKind() === SyntaxKind.ClassDeclaration ||
            decl.getKind() === SyntaxKind.InterfaceDeclaration ||
            decl.getKind() === SyntaxKind.TypeAliasDeclaration
          ) {
            const name = 'getName' in decl ? (decl as { getName(): string }).getName() : undefined;
            if (name === exportName) {
              // Remove export keyword but keep declaration
              if ('setIsExported' in decl)
                (decl as { setIsExported(value: boolean): void }).setIsExported(false);
              modified = true;
              break;
            }
          }
        }
      }
    }

    // Handle unused import removal
    if (/remove unused import/i.test(suggestion.title) || /unused import/i.test(suggestion.title)) {
      const importMatch = suggestion.details.join(' ').match(/import[:\s]+['"]?(\w+)['"]?/i);
      if (importMatch) {
        const importName = importMatch[1];

        const importDeclarations = sourceFile.getImportDeclarations();
        for (const imp of importDeclarations) {
          const namedImports = imp.getNamedImports();
          for (const named of namedImports) {
            if (named.getName() === importName) {
              if (namedImports.length === 1) {
                imp.remove();
              } else {
                named.remove();
              }
              modified = true;
              break;
            }
          }
        }
      }
    }

    if (modified) {
      await sourceFile.save();
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      chalk.dim(
        `     Error applying fix: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    return false;
  }
}

/**
 * Show manual fix instructions
 */
function showFixInstructions(suggestion: FixSuggestion): void {
  console.log();
  console.log(chalk.cyan('     📋 Manual fix instructions:'));

  if (suggestion.codeBlocks && suggestion.codeBlocks.length > 0) {
    for (const block of suggestion.codeBlocks) {
      console.log(
        chalk.dim(`        Lines ${block.startLine}-${block.endLine}: ${block.description}`)
      );
      console.log(chalk.dim(`        Suggested: Extract to function '${block.suggestedName}'`));
    }
  } else {
    // Provide generic instructions based on suggestion type
    if (/complexity/i.test(suggestion.title)) {
      console.log(chalk.dim('        1. Extract complex logic into separate functions'));
      console.log(chalk.dim('        2. Use early returns to reduce nesting'));
      console.log(chalk.dim('        3. Break down large conditional blocks'));
    } else if (/large file/i.test(suggestion.title)) {
      console.log(chalk.dim('        1. Split into multiple modules by responsibility'));
      console.log(chalk.dim('        2. Move related functions into classes'));
      console.log(chalk.dim('        3. Extract utilities to separate files'));
    } else if (/circular/i.test(suggestion.title)) {
      console.log(chalk.dim('        1. Create a shared types file'));
      console.log(chalk.dim('        2. Use dependency injection'));
      console.log(chalk.dim('        3. Refactor to break the cycle'));
    } else {
      for (const detail of suggestion.details) {
        console.log(chalk.dim(`        • ${detail}`));
      }
    }
  }

  console.log();
}

/**
 * Get emoji for severity
 */
function getSeverityEmoji(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '💡';
  }
}

/**
 * Interactive fix session result
 */
export interface InteractiveFixSession {
  file: string;
  total: number;
  applied: number;
  skipped: number;
  failed: number;
  fixes: Array<{
    suggestion: string;
    applied: boolean;
    manual?: boolean;
    error?: string;
  }>;
}
