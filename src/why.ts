/**
 * Why - Code Purpose Explainer
 *
 * Explains why a file or piece of code exists by analyzing
 * git history, comments, patterns, and relationships.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { type SimpleGit, simpleGit } from 'simple-git';
import type { GraphNode, KnowledgeGraph } from './graph/types.js';

export interface WhyResult {
  file: string;
  exists: boolean;
  summary: string;
  history: {
    created: { date: string; author: string; message: string } | null;
    majorChanges: Array<{ date: string; author: string; message: string }>;
  };
  comments: string[];
  patterns: string[];
  context: {
    importedBy: Array<{ file: string; reason: string }>;
    imports: Array<{ file: string; reason: string }>;
    relatedFiles: Array<{ file: string; reason: string }>;
  };
  suggestions: string[];
}

/**
 * Detect patterns in a file based on its name, path, and content
 */
function detectPatterns(
  filePath: string,
  fileNode: GraphNode | null,
  graph: KnowledgeGraph
): string[] {
  const patterns: string[] = [];
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);

  // Pattern detection based on file name
  const filePatterns: Array<[RegExp, string]> = [
    [/\.controller\.(ts|js)$/i, 'Controller pattern - handles HTTP requests and responses'],
    [/\.service\.(ts|js)$/i, 'Service pattern - business logic layer'],
    [/\.repository\.(ts|js)$/i, 'Repository pattern - data access layer'],
    [/\.model\.(ts|js)$/i, 'Model pattern - data structure definition'],
    [/\.entity\.(ts|js)$/i, 'Entity pattern - database entity representation'],
    [/\.dto\.(ts|js)$/i, 'DTO pattern - data transfer object'],
    [/\.schema\.(ts|js)$/i, 'Schema pattern - validation/structure definition'],
    [/\.middleware\.(ts|js)$/i, 'Middleware pattern - request/response interceptor'],
    [/\.guard\.(ts|js)$/i, 'Guard pattern - authorization/authentication check'],
    [/\.pipe\.(ts|js)$/i, 'Pipe pattern - data transformation'],
    [/\.decorator\.(ts|js)$/i, 'Decorator pattern - metadata/behavior modification'],
    [/\.factory\.(ts|js)$/i, 'Factory pattern - object creation'],
    [/\.provider\.(ts|js)$/i, 'Provider pattern - dependency injection provider'],
    [/\.hook\.(ts|js)$/i, 'Hook pattern - lifecycle or event hook'],
    [/\.util(s)?\.(ts|js)$/i, 'Utility module - reusable helper functions'],
    [/\.helper(s)?\.(ts|js)$/i, 'Helper module - auxiliary functions'],
    [/\.config\.(ts|js)$/i, 'Configuration module - app settings'],
    [/\.constant(s)?\.(ts|js)$/i, 'Constants module - immutable values'],
    [/\.type(s)?\.(ts|js)$/i, 'Types module - type definitions'],
    [/\.interface\.(ts|js)$/i, 'Interface definitions'],
    [/\.test\.(ts|js)$/i, 'Test file - unit/integration tests'],
    [/\.spec\.(ts|js)$/i, 'Spec file - behavior specifications'],
    [/\.e2e\.(ts|js)$/i, 'E2E test file - end-to-end tests'],
    [/index\.(ts|js)$/i, 'Barrel file - module exports aggregator'],
    [/\.context\.(ts|js)$/i, 'Context provider - React/state context'],
    [/\.reducer\.(ts|js)$/i, 'Reducer pattern - state management'],
    [/\.action(s)?\.(ts|js)$/i, 'Actions module - state action creators'],
    [/\.slice\.(ts|js)$/i, 'Redux slice - state slice definition'],
    [/\.store\.(ts|js)$/i, 'Store pattern - state management store'],
    [/\.api\.(ts|js)$/i, 'API module - external API interactions'],
    [/\.client\.(ts|js)$/i, 'Client module - API/service client'],
  ];

  for (const [regex, description] of filePatterns) {
    if (regex.test(fileName)) {
      patterns.push(description);
    }
  }

  // Pattern detection based on directory structure
  const dirPatterns: Array<[RegExp, string]> = [
    [/\/components?\//i, 'Component - reusable UI element'],
    [/\/pages?\//i, 'Page component - route-level view'],
    [/\/views?\//i, 'View component - presentation layer'],
    [/\/layouts?\//i, 'Layout component - page structure'],
    [/\/hooks?\//i, 'Custom hook - reusable stateful logic'],
    [/\/utils?\//i, 'Utility location - helper functions'],
    [/\/lib\//i, 'Library code - shared utilities'],
    [/\/api\//i, 'API layer - backend endpoints'],
    [/\/routes?\//i, 'Route definition - URL routing'],
    [/\/middleware\//i, 'Middleware location'],
    [/\/models?\//i, 'Models directory - data models'],
    [/\/services?\//i, 'Services directory - business logic'],
    [/\/controllers?\//i, 'Controllers directory - request handlers'],
    [/\/repositories?\//i, 'Repositories directory - data access'],
    [/\/__tests__\//i, 'Test directory'],
    [/\/test\//i, 'Test directory'],
    [/\/specs?\//i, 'Specification directory'],
    [/\/fixtures?\//i, 'Test fixtures - sample data'],
    [/\/mocks?\//i, 'Mock files - test doubles'],
  ];

  for (const [regex, description] of dirPatterns) {
    if (regex.test(dirName)) {
      patterns.push(description);
    }
  }

  // Check graph for additional patterns
  if (fileNode) {
    // Check if it's a heavily imported file (core module)
    const importedByCount = graph.edges.filter(
      (e) => e.type === 'imports' && e.target === fileNode.id
    ).length;

    if (importedByCount >= 10) {
      patterns.push(`Core module - imported by ${importedByCount} files`);
    } else if (importedByCount >= 5) {
      patterns.push(`Widely used - imported by ${importedByCount} files`);
    }

    // Check if it exports many things (utility/barrel file)
    const exportCount = graph.edges.filter(
      (e) => e.type === 'exports' && e.source === fileNode.id
    ).length;

    if (exportCount >= 10) {
      patterns.push(`Large export surface - ${exportCount} exports`);
    }

    // Check complexity
    if (fileNode.complexity && fileNode.complexity > 20) {
      patterns.push('High complexity - may need refactoring');
    }
  }

  return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Extract meaningful comments from a file
 */
async function extractComments(filePath: string): Promise<string[]> {
  const comments: string[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract JSDoc comments (/** ... */)
    const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
    const jsdocMatches = content.match(jsdocRegex) || [];

    for (const match of jsdocMatches) {
      // Clean up the comment
      const cleaned = match
        .replace(/\/\*\*|\*\//g, '')
        .replace(/^\s*\*\s?/gm, '')
        .trim()
        .split('\n')
        .filter((line) => !line.startsWith('@')) // Remove JSDoc tags for summary
        .join(' ')
        .trim();

      if (cleaned.length > 10 && cleaned.length < 500) {
        comments.push(cleaned);
      }
    }

    // Extract file-level comments at the top of the file
    let inTopComment = false;
    const topComments: string[] = [];

    for (const line of lines.slice(0, 30)) {
      const trimmed = line.trim();

      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        inTopComment = true;
      } else if (trimmed.startsWith('*/')) {
        inTopComment = false;
      } else if (trimmed.startsWith('//') && !inTopComment) {
        const comment = trimmed.replace(/^\/\/\s*/, '').trim();
        if (comment.length > 5 && !comment.startsWith('eslint') && !comment.startsWith('@ts-')) {
          topComments.push(comment);
        }
      } else if (inTopComment && trimmed.startsWith('*')) {
        const comment = trimmed.replace(/^\*\s*/, '').trim();
        if (comment.length > 5 && !comment.startsWith('@')) {
          topComments.push(comment);
        }
      } else if (
        !trimmed.startsWith('import') &&
        !trimmed.startsWith('export') &&
        trimmed.length > 0 &&
        !inTopComment
      ) {
        break; // Stop at first non-comment, non-import line
      }
    }

    if (topComments.length > 0) {
      comments.unshift(topComments.join(' '));
    }

    // Look for TODO/FIXME/NOTE comments that explain intent
    for (const line of lines) {
      const todoMatch = line.match(/\/\/\s*(TODO|FIXME|NOTE|HACK|XXX):\s*(.+)/i);
      if (todoMatch) {
        comments.push(`${todoMatch[1]}: ${todoMatch[2].trim()}`);
      }
    }

    // Deduplicate and limit
    return [...new Set(comments)].slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Get git history for a file (creation and major changes)
 */
async function getGitHistory(git: SimpleGit, relativePath: string): Promise<WhyResult['history']> {
  const history: WhyResult['history'] = {
    created: null,
    majorChanges: [],
  };

  try {
    // Get creation info (first commit)
    try {
      const firstCommit = await git.raw([
        'log',
        '--diff-filter=A',
        '--follow',
        '--format=%aI|%an|%s',
        '--reverse',
        '-1',
        '--',
        relativePath,
      ]);

      if (firstCommit.trim()) {
        const parts = firstCommit.trim().split('|');
        if (parts.length >= 3) {
          history.created = {
            date: parts[0],
            author: parts[1],
            message: parts.slice(2).join('|'),
          };
        }
      }
    } catch {
      // File might not have git history
    }

    // Get major changes (commits with significant changes)
    try {
      const commitDetails = await git.raw([
        'log',
        '--numstat',
        '--format=%H|%aI|%an|%s',
        '-20',
        '--',
        relativePath,
      ]);

      const commitLines = commitDetails.split('\n');
      let currentCommit: { hash: string; date: string; author: string; message: string } | null =
        null;
      const majorCommits: Array<{ date: string; author: string; message: string; lines: number }> =
        [];

      for (const line of commitLines) {
        if (line.includes('|') && line.split('|').length >= 4) {
          const parts = line.split('|');
          currentCommit = {
            hash: parts[0],
            date: parts[1],
            author: parts[2],
            message: parts.slice(3).join('|'),
          };
        } else if (line.match(/^\d+\s+\d+/) && currentCommit) {
          const match = line.match(/^(\d+)\s+(\d+)/);
          if (match) {
            const added = parseInt(match[1], 10) || 0;
            const removed = parseInt(match[2], 10) || 0;
            const totalChanged = added + removed;

            // Consider it a major change if > 20 lines changed
            if (totalChanged > 20) {
              majorCommits.push({
                date: currentCommit.date,
                author: currentCommit.author,
                message: currentCommit.message,
                lines: totalChanged,
              });
            }
          }
          currentCommit = null;
        }
      }

      // Take top 5 major changes
      history.majorChanges = majorCommits
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 5)
        .map((c) => ({
          date: c.date,
          author: c.author,
          message: c.message,
        }));
    } catch {
      // Ignore git errors
    }
  } catch {
    // Not a git repository
  }

  return history;
}

/**
 * Check if two file paths match (considering .ts/.js variants)
 */
function pathMatches(edgePath: string, targetPath: string): boolean {
  if (edgePath === targetPath) return true;
  const edgeWithoutExt = edgePath.replace(/\.(js|ts|tsx|jsx)$/, '');
  const targetWithoutExt = targetPath.replace(/\.(js|ts|tsx|jsx)$/, '');
  return edgeWithoutExt === targetWithoutExt;
}

/**
 * Analyze relationships from the knowledge graph
 */
function analyzeContextRelationships(
  graph: KnowledgeGraph,
  relativePath: string,
  jsVariant: string
): WhyResult['context'] {
  const context: WhyResult['context'] = {
    importedBy: [],
    imports: [],
    relatedFiles: [],
  };

  const matchingFilePath = relativePath;

  // Find files that import this one and files this one imports
  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      // edge.target is the imported file's path
      if (pathMatches(edge.target, matchingFilePath) || pathMatches(edge.target, jsVariant)) {
        context.importedBy.push({
          file: edge.source,
          reason: 'Direct import',
        });
      }

      // Find files this one imports
      // edge.source is the importing file's path
      if (pathMatches(edge.source, matchingFilePath) || pathMatches(edge.source, jsVariant)) {
        context.imports.push({
          file: edge.target,
          reason: 'Depends on',
        });
      }
    }
  }

  // Limit to top results
  context.importedBy = context.importedBy.slice(0, 5);
  context.imports = context.imports.slice(0, 5);

  // Find related files (same directory or similar name pattern)
  const dirPath = path.dirname(relativePath);
  const baseName = path.basename(relativePath, path.extname(relativePath));

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file' && node.filePath !== relativePath) {
      const nodeDir = path.dirname(node.filePath);
      const nodeBase = path.basename(node.filePath, path.extname(node.filePath));

      // Same directory
      if (nodeDir === dirPath && context.relatedFiles.length < 5) {
        context.relatedFiles.push({
          file: node.filePath,
          reason: 'Same directory',
        });
      } else if (
        (nodeBase.includes(baseName) || baseName.includes(nodeBase)) &&
        context.relatedFiles.length < 5
      ) {
        // Similar name (e.g., user.ts and user.test.ts)
        const existingIndex = context.relatedFiles.findIndex((r) => r.file === node.filePath);
        if (existingIndex === -1) {
          context.relatedFiles.push({
            file: node.filePath,
            reason: 'Related by naming',
          });
        }
      }
    }
  }

  return context;
}

/**
 * Generate suggestions for a file analysis result
 */
function generateSuggestionsForWhy(result: WhyResult): string[] {
  const suggestions: string[] = [];

  if (
    result.context.importedBy.length === 0 &&
    !result.file.endsWith('.test.ts') &&
    !result.file.endsWith('.spec.ts')
  ) {
    suggestions.push('Not imported anywhere - might be dead code or an entry point.');
  }

  if (result.history.majorChanges.length >= 5) {
    suggestions.push('Frequently modified file - consider if it has too many responsibilities.');
  }

  if (result.patterns.length === 0) {
    suggestions.push(
      'No standard pattern detected - consider if naming could be more descriptive.'
    );
  }

  if (result.comments.length === 0) {
    suggestions.push('No documentation comments found - consider adding JSDoc.');
  }

  return suggestions;
}

/**
 * Analyze why a file exists
 */
export async function explainWhy(
  rootDir: string,
  filePath: string,
  graph: KnowledgeGraph
): Promise<WhyResult> {
  const git: SimpleGit = simpleGit(rootDir);
  const { relativePath, absolutePath } = normalizeFilePath(rootDir, filePath);
  const { fileExists, fileNode } = await validateFileAndFindNode(
    rootDir,
    relativePath,
    absolutePath,
    graph
  );

  // Initialize result with basic info
  const result = initializeResult(relativePath, fileExists);

  if (!fileExists) {
    result.summary = 'File not found in the codebase.';
    result.suggestions.push('Check if the file path is correct.');
    return result;
  }

  // Gather analysis data for this file
  await gatherFileAnalysisData(result, git, absolutePath, relativePath, fileNode, graph);

  // Generate final summary and suggestions
  result.summary = generateSummary(result);
  result.suggestions = generateSuggestionsForWhy(result);

  return result;
}

/**
 * Normalize file path to relative and absolute versions
 */
function normalizeFilePath(
  rootDir: string,
  filePath: string
): { relativePath: string; absolutePath: string } {
  const relativePath = filePath.startsWith(rootDir)
    ? path.relative(rootDir, filePath)
    : filePath.startsWith('/')
      ? path.relative(rootDir, filePath)
      : filePath;

  const absolutePath = path.join(rootDir, relativePath);
  return { relativePath, absolutePath };
}

/**
 * Validate file exists and find its node in the graph
 */
async function validateFileAndFindNode(
  rootDir: string,
  relativePath: string,
  absolutePath: string,
  graph: KnowledgeGraph
): Promise<{ fileExists: boolean; fileNode: (typeof graph.nodes)[string] | null }> {
  let fileExists = false;
  try {
    await fs.access(absolutePath);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  const fileNode =
    Object.values(graph.nodes).find(
      (n) =>
        n.type === 'file' &&
        (n.filePath === relativePath ||
          n.filePath === absolutePath ||
          n.filePath.endsWith(relativePath))
    ) || null;

  return { fileExists, fileNode };
}

/**
 * Initialize result structure with basic file info
 */
function initializeResult(relativePath: string, fileExists: boolean): WhyResult {
  return {
    file: relativePath,
    exists: fileExists,
    summary: '',
    history: {
      created: null,
      majorChanges: [],
    },
    comments: [],
    patterns: [],
    context: {
      importedBy: [],
      imports: [],
      relatedFiles: [],
    },
    suggestions: [],
  };
}

/**
 * Gather all analysis data for a file: comments, patterns, history, and relationships
 */
async function gatherFileAnalysisData(
  result: WhyResult,
  git: SimpleGit,
  absolutePath: string,
  relativePath: string,
  fileNode: (typeof graph.nodes)[string] | null,
  graph: KnowledgeGraph
): Promise<void> {
  // Extract comments from the file
  result.comments = await extractComments(absolutePath);

  // Detect patterns
  result.patterns = detectPatterns(relativePath, fileNode, graph);

  // Get git history
  try {
    await git.status(); // Check if git repo
    result.history = await getGitHistory(git, relativePath);
  } catch {
    result.suggestions.push('Not a git repository - history unavailable.');
  }

  // Analyze relationships
  const jsVariant = relativePath.replace(/\.tsx?$/, '.js');
  result.context = analyzeContextRelationships(graph, relativePath, jsVariant);
}

/**
 * Generate a human-readable summary
 */
function generateSummary(result: WhyResult): string {
  const parts: string[] = [];

  // Start with patterns
  if (result.patterns.length > 0) {
    parts.push(result.patterns[0]);
  }

  // Add purpose from comments
  if (result.comments.length > 0) {
    const firstComment = result.comments[0];
    if (firstComment.length > 100) {
      parts.push(`${firstComment.substring(0, 100)}...`);
    } else {
      parts.push(firstComment);
    }
  }

  // Add creation context
  if (result.history.created) {
    parts.push(
      `Created by ${result.history.created.author} with: "${result.history.created.message}"`
    );
  }

  // Add usage context
  if (result.context.importedBy.length > 0) {
    parts.push(`Used by ${result.context.importedBy.length} file(s).`);
  }

  return parts.join('. ') || 'Purpose could not be determined from available information.';
}

/**
 * Format the result for display
 */
export function formatWhy(result: WhyResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('');
  lines.push('                    WHY DOES THIS EXIST?                   ');
  lines.push('');
  lines.push('');

  lines.push(`File: ${result.file}`);
  lines.push('');

  if (!result.exists) {
    lines.push('FILE NOT FOUND');
    lines.push('');
    lines.push('The specified file does not exist in the codebase.');
    return lines.join('\n');
  }

  // Origin Story
  lines.push('ORIGIN STORY');
  lines.push('-'.repeat(50));
  if (result.history.created) {
    const date = new Date(result.history.created.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    lines.push(`   Created: ${date} by ${result.history.created.author}`);
    lines.push(`   "${result.history.created.message}"`);
  } else {
    lines.push('   No git history available for creation.');
  }
  lines.push('');

  // Author's Notes
  if (result.comments.length > 0) {
    lines.push("AUTHOR'S NOTES");
    lines.push('-'.repeat(50));
    for (const comment of result.comments.slice(0, 3)) {
      const wrapped = wrapText(comment, 50);
      for (const wline of wrapped) {
        lines.push(`   "${wline}"`);
      }
      lines.push('');
    }
  }

  // Connections
  lines.push('CONNECTIONS');
  lines.push('-'.repeat(50));

  if (result.context.importedBy.length > 0) {
    const count = result.context.importedBy.length;
    const suffix = count === 1 ? '' : 's';
    const desc = count >= 5 ? " (it's a core module)" : '';
    lines.push(`   * Imported by ${count} file${suffix}${desc}`);
    for (const imp of result.context.importedBy.slice(0, 3)) {
      lines.push(`     - ${imp.file}`);
    }
  } else {
    lines.push('   * Not imported by any files');
  }

  if (result.context.imports.length > 0) {
    lines.push(`   * Depends on ${result.context.imports.length} file(s)`);
    for (const dep of result.context.imports.slice(0, 3)) {
      lines.push(`     - ${dep.file}`);
    }
  }

  if (result.context.relatedFiles.length > 0) {
    lines.push(`   * Related files:`);
    for (const rel of result.context.relatedFiles.slice(0, 3)) {
      lines.push(`     - ${rel.file} (${rel.reason})`);
    }
  }
  lines.push('');

  // Patterns
  if (result.patterns.length > 0) {
    lines.push('PATTERNS');
    lines.push('-'.repeat(50));
    for (const pattern of result.patterns) {
      lines.push(`   * ${pattern}`);
    }
    lines.push('');
  }

  // Major Changes
  if (result.history.majorChanges.length > 0) {
    lines.push('MAJOR CHANGES');
    lines.push('-'.repeat(50));
    for (const change of result.history.majorChanges.slice(0, 3)) {
      const date = new Date(change.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      lines.push(`   ${date}: ${change.message.substring(0, 45)}`);
      lines.push(`   by ${change.author}`);
      lines.push('');
    }
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push('SUGGESTIONS');
    lines.push('-'.repeat(50));
    for (const suggestion of result.suggestions) {
      lines.push(`   ! ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(51));

  return lines.join('\n');
}

/**
 * Wrap text to a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
