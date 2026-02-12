/**
 * Confess command - have a file confess its sins
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import { outputJson, outputJsonError } from '../../json-output.js';

export function register(program: Command): void {
  program
    .command('confess <file>')
    .description('Have a file confess its sins')
    .option('-d, --dir <path>', 'Directory to analyze', '.')
    .option('--json', 'Output as JSON for CI/CD integration')
    .action(async (file: string, options) => {
      const rootDir = path.resolve(options.dir);

      const graph = await loadGraph(rootDir);

      if (!graph) {
        if (options.json) {
          outputJsonError('confess', 'No graph found. Run `specter scan` first.');
        }
        console.log(chalk.yellow('No graph found. Run `specter scan` first.'));
        return;
      }

      // Normalize the file path
      let filePath = file;
      if (!filePath.startsWith(rootDir)) {
        filePath = path.resolve(rootDir, file);
      }

      // Try to find the file in the graph - check various path formats
      let fileNode = graph.nodes[filePath];
      if (!fileNode) {
        // Try relative path from root
        const relativePath = path.relative(rootDir, filePath);
        fileNode = graph.nodes[relativePath];
      }
      if (!fileNode) {
        // Try the original input
        fileNode = graph.nodes[file];
      }
      if (!fileNode) {
        // Search for partial match
        const matchingKey = Object.keys(graph.nodes).find(
          (k) => k.endsWith(file) || k.endsWith(`/${file}`)
        );
        if (matchingKey) {
          fileNode = graph.nodes[matchingKey];
          filePath = matchingKey;
        }
      }

      if (!fileNode || fileNode.type !== 'file') {
        console.log(chalk.red(`File "${file}" not found in the knowledge graph.`));
        console.log(chalk.dim('  Make sure the file is part of the scanned codebase.'));
        console.log(chalk.dim('  Run `specter scan` to update the graph.'));
        return;
      }

      // Get file data
      const { execute: getFileRelationships } = await import(
        '../../tools/get-file-relationships.js'
      );
      const relationships = getFileRelationships(graph, { filePath });

      // Get symbols in this file
      const fileSymbols = Object.values(graph.nodes).filter(
        (n) => n.filePath === filePath && n.type !== 'file'
      );

      // Calculate sins
      const complexity = fileNode.complexity || 0;
      const functionCount = fileSymbols.filter((n) => n.type === 'function').length;
      const exportCount = relationships.exports.length;
      const importedByCount = relationships.importedBy.length;

      // Find unused exports (dead code within this file)
      const importedSymbols = new Set<string>();
      for (const edge of graph.edges) {
        if (edge.type === 'imports' && edge.metadata?.symbols) {
          for (const symbol of edge.metadata.symbols as string[]) {
            const originalName = symbol.split(' as ')[0].trim();
            importedSymbols.add(originalName);
          }
        }
      }
      const unusedExports = relationships.exports.filter((e) => !importedSymbols.has(e.name));

      // Calculate days since last change
      let daysSinceChange = 0;
      if (fileNode.lastModified) {
        const lastMod = new Date(fileNode.lastModified).getTime();
        daysSinceChange = Math.floor((Date.now() - lastMod) / (1000 * 60 * 60 * 24));
      }

      // Commit count (approximation from modification count)
      const commitCount = fileNode.modificationCount || 0;

      // Check for tests
      const hasTests = Object.keys(graph.nodes).some(
        (k) =>
          (k.includes('.test.') || k.includes('.spec.') || k.includes('__tests__')) &&
          k.includes(fileNode.name.replace(/\.[^.]+$/, ''))
      );

      // JSON output for CI/CD
      if (options.json) {
        outputJson('confess', {
          file: filePath,
          complexity,
          functionCount,
          exportCount,
          importedByCount,
          unusedExports: unusedExports.map((e) => e.name),
          daysSinceChange,
          commitCount,
          hasTests,
        });
        return;
      }

      // Display the confession
      const fileName = filePath.split('/').pop() || filePath;

      console.log();
      console.log(chalk.bold.magenta(`  CONFESSION: ${fileName}`));
      console.log();
      console.log(chalk.italic.cyan('  Forgive me, developer, for I have sinned.'));
      console.log();

      if (commitCount > 0) {
        console.log(chalk.white(`  It has been ${commitCount} commits since my last refactor.`));
      } else if (daysSinceChange > 0) {
        console.log(
          chalk.white(`  It has been ${daysSinceChange} days since my last modification.`)
        );
      }
      console.log();

      console.log(chalk.bold.yellow('  I confess:'));

      // Function count sin
      if (functionCount > 10) {
        console.log(
          chalk.white(
            `  - I harbor ${functionCount} functions that probably don't all belong together.`
          )
        );
      } else if (functionCount > 0) {
        console.log(
          chalk.white(`  - I contain ${functionCount} function${functionCount > 1 ? 's' : ''}.`)
        );
      }

      // Import sin
      if (importedByCount > 10) {
        console.log(
          chalk.white(
            `  - I am imported by ${importedByCount} files who don't know what they want from me.`
          )
        );
      } else if (importedByCount > 5) {
        console.log(
          chalk.white(`  - I am imported by ${importedByCount} files. I carry their burdens.`)
        );
      } else if (importedByCount === 0 && exportCount > 0) {
        console.log(
          chalk.white(`  - I export ${exportCount} things, but nobody imports them. I am alone.`)
        );
      } else if (importedByCount > 0) {
        console.log(
          chalk.white(
            `  - ${importedByCount} file${importedByCount > 1 ? 's' : ''} depend${importedByCount === 1 ? 's' : ''} on me.`
          )
        );
      }

      // Dead code sin
      if (unusedExports.length > 0) {
        console.log(
          chalk.white(
            `  - I have ${unusedExports.length} export${unusedExports.length > 1 ? 's' : ''} that ${unusedExports.length > 1 ? 'are' : 'is'} never used by anyone.`
          )
        );
      }

      // Complexity sin
      if (complexity > 20) {
        console.log(
          chalk.white(`  - My complexity has reached ${complexity}. I am deeply ashamed.`)
        );
      } else if (complexity > 10) {
        console.log(chalk.white(`  - My complexity is ${complexity}. I could be simpler.`));
      } else if (complexity > 0) {
        console.log(
          chalk.white(`  - My complexity is ${complexity}. At least I have that going for me.`)
        );
      }

      // Test sin
      if (!hasTests) {
        console.log(chalk.white(`  - I have no tests. Not one.`));
      }

      // Staleness sin
      if (daysSinceChange > 365) {
        console.log(
          chalk.white(
            `  - I have not been touched in ${Math.floor(daysSinceChange / 365)} year${Math.floor(daysSinceChange / 365) > 1 ? 's' : ''}. I am forgotten.`
          )
        );
      } else if (daysSinceChange > 180) {
        console.log(
          chalk.white(
            `  - I have not been touched in ${Math.floor(daysSinceChange / 30)} months. The dust gathers.`
          )
        );
      }

      console.log();

      // Penance
      const penances: string[] = [];
      if (complexity > 15) penances.push('breaking into smaller, focused functions');
      if (functionCount > 10) penances.push('a refactoring into smaller, focused modules');
      if (unusedExports.length > 0) penances.push('removing my dead code');
      if (!hasTests) penances.push('writing at least one test');
      if (importedByCount > 10) penances.push('reducing my surface area');

      if (penances.length > 0) {
        console.log(chalk.italic.green(`  For my penance, I accept: ${penances.join(', ')}.`));
      } else {
        console.log(chalk.italic.green(`  My sins are few. I am at peace.`));
      }

      console.log();
      console.log(chalk.bold.magenta('  Amen.'));
      console.log();
    });
}
