/**
 * Confess command - have a file confess its sins
 */

import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { loadGraph } from '../../graph/persistence.js';
import type { GraphNode, KnowledgeGraph, NodeType } from '../../graph/types.js';
import { outputJson, outputJsonError } from '../../json-output.js';

interface FileRelationships {
  imports: Array<{ source: string; symbols: string[] }>;
  exports: Array<{ name: string; type: NodeType; lineStart: number }>;
  importedBy: Array<{ filePath: string; symbols: string[] }>;
}

interface SinsData {
  complexity: number;
  functionCount: number;
  exportCount: number;
  importedByCount: number;
  unusedExports: Array<{ name: string; type: string }>;
  daysSinceChange: number;
  commitCount: number;
  hasTests: boolean;
}

interface ResolvedFile {
  node: GraphNode;
  path: string;
}

/**
 * Attempts to resolve a file path in the graph using various path formats.
 * Returns the node and resolved path, or null if not found.
 */
function resolveFilePath(
  graph: KnowledgeGraph,
  file: string,
  rootDir: string
): ResolvedFile | null {
  // Normalize the file path
  let filePath = file;
  if (!filePath.startsWith(rootDir)) {
    filePath = path.resolve(rootDir, file);
  }

  // Try absolute path
  let fileNode = graph.nodes[filePath];
  if (fileNode) {
    return { node: fileNode, path: filePath };
  }

  // Try relative path from root
  const relativePath = path.relative(rootDir, filePath);
  fileNode = graph.nodes[relativePath];
  if (fileNode) {
    return { node: fileNode, path: relativePath };
  }

  // Try the original input
  fileNode = graph.nodes[file];
  if (fileNode) {
    return { node: fileNode, path: file };
  }

  // Search for partial match
  const matchingKey = Object.keys(graph.nodes).find(
    (k) => k.endsWith(file) || k.endsWith(`/${file}`)
  );
  if (matchingKey) {
    return { node: graph.nodes[matchingKey], path: matchingKey };
  }

  return null;
}

/**
 * Calculates all sin metrics for a file.
 */
function calculateSins(
  fileNode: GraphNode,
  relationships: FileRelationships,
  graph: KnowledgeGraph,
  filePath: string
): SinsData {
  const complexity = fileNode.complexity || 0;

  // Get symbols in this file
  const fileSymbols = Object.values(graph.nodes).filter(
    (n) => n.filePath === filePath && n.type !== 'file'
  );
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

  return {
    complexity,
    functionCount,
    exportCount,
    importedByCount,
    unusedExports,
    daysSinceChange,
    commitCount,
    hasTests,
  };
}

/**
 * Calculates appropriate penances based on sins.
 */
function calculatePenances(sins: SinsData): string[] {
  const penances: string[] = [];

  if (sins.complexity > 15) {
    penances.push('breaking into smaller, focused functions');
  }
  if (sins.functionCount > 10) {
    penances.push('a refactoring into smaller, focused modules');
  }
  if (sins.unusedExports.length > 0) {
    penances.push('removing my dead code');
  }
  if (!sins.hasTests) {
    penances.push('writing at least one test');
  }
  if (sins.importedByCount > 10) {
    penances.push('reducing my surface area');
  }

  return penances;
}

/**
 * Displays the confession output to the console.
 */
function displayConfession(sins: SinsData, filePath: string): void {
  const fileName = filePath.split('/').pop() || filePath;

  console.log();
  console.log(chalk.bold.magenta(`  CONFESSION: ${fileName}`));
  console.log();
  console.log(chalk.italic.cyan('  Forgive me, developer, for I have sinned.'));
  console.log();

  displayTimeSinceConfession(sins);
  console.log();

  console.log(chalk.bold.yellow('  I confess:'));
  displayFunctionCountSin(sins.functionCount);
  displayImportSin(sins.importedByCount, sins.exportCount);
  displayDeadCodeSin(sins.unusedExports.length);
  displayComplexitySin(sins.complexity);
  displayTestSin(sins.hasTests);
  displayStalenessSin(sins.daysSinceChange);

  console.log();

  const penances = calculatePenances(sins);
  displayPenance(penances);

  console.log();
  console.log(chalk.bold.magenta('  Amen.'));
  console.log();
}

function displayTimeSinceConfession(sins: SinsData): void {
  if (sins.commitCount > 0) {
    console.log(chalk.white(`  It has been ${sins.commitCount} commits since my last refactor.`));
  } else if (sins.daysSinceChange > 0) {
    console.log(
      chalk.white(`  It has been ${sins.daysSinceChange} days since my last modification.`)
    );
  }
}

function displayFunctionCountSin(functionCount: number): void {
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
}

function displayImportSin(importedByCount: number, exportCount: number): void {
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
    const plural = importedByCount > 1;
    console.log(
      chalk.white(
        `  - ${importedByCount} file${plural ? 's' : ''} depend${plural ? '' : 's'} on me.`
      )
    );
  }
}

function displayDeadCodeSin(unusedExportCount: number): void {
  if (unusedExportCount > 0) {
    const plural = unusedExportCount > 1;
    console.log(
      chalk.white(
        `  - I have ${unusedExportCount} export${plural ? 's' : ''} that ${plural ? 'are' : 'is'} never used by anyone.`
      )
    );
  }
}

function displayComplexitySin(complexity: number): void {
  if (complexity > 20) {
    console.log(chalk.white(`  - My complexity has reached ${complexity}. I am deeply ashamed.`));
  } else if (complexity > 10) {
    console.log(chalk.white(`  - My complexity is ${complexity}. I could be simpler.`));
  } else if (complexity > 0) {
    console.log(
      chalk.white(`  - My complexity is ${complexity}. At least I have that going for me.`)
    );
  }
}

function displayTestSin(hasTests: boolean): void {
  if (!hasTests) {
    console.log(chalk.white(`  - I have no tests. Not one.`));
  }
}

function displayStalenessSin(daysSinceChange: number): void {
  if (daysSinceChange > 365) {
    const years = Math.floor(daysSinceChange / 365);
    console.log(
      chalk.white(
        `  - I have not been touched in ${years} year${years > 1 ? 's' : ''}. I am forgotten.`
      )
    );
  } else if (daysSinceChange > 180) {
    const months = Math.floor(daysSinceChange / 30);
    console.log(chalk.white(`  - I have not been touched in ${months} months. The dust gathers.`));
  }
}

function displayPenance(penances: string[]): void {
  if (penances.length > 0) {
    console.log(chalk.italic.green(`  For my penance, I accept: ${penances.join(', ')}.`));
  } else {
    console.log(chalk.italic.green(`  My sins are few. I am at peace.`));
  }
}

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

      const resolved = resolveFilePath(graph, file, rootDir);

      if (!resolved || resolved.node.type !== 'file') {
        console.log(chalk.red(`File "${file}" not found in the knowledge graph.`));
        console.log(chalk.dim('  Make sure the file is part of the scanned codebase.'));
        console.log(chalk.dim('  Run `specter scan` to update the graph.'));
        return;
      }

      const { node: fileNode, path: filePath } = resolved;

      // Get file data
      const { execute: getFileRelationships } = await import(
        '../../tools/get-file-relationships.js'
      );
      const relationships = getFileRelationships(graph, { filePath }) as FileRelationships;

      const sins = calculateSins(fileNode, relationships, graph, filePath);

      // JSON output for CI/CD
      if (options.json) {
        outputJson('confess', {
          file: filePath,
          complexity: sins.complexity,
          functionCount: sins.functionCount,
          exportCount: sins.exportCount,
          importedByCount: sins.importedByCount,
          unusedExports: sins.unusedExports.map((e) => e.name),
          daysSinceChange: sins.daysSinceChange,
          commitCount: sins.commitCount,
          hasTests: sins.hasTests,
        });
        return;
      }

      displayConfession(sins, filePath);
    });
}
