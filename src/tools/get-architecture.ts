/**
 * get_architecture Tool
 *
 * Generates a visual ASCII diagram of the codebase architecture.
 * Shows directory structure, file counts, and key metrics.
 */

import type { KnowledgeGraph } from '../graph/types.js';

export interface Input {
  style?: 'tree' | 'boxes' | 'compact';
  maxDepth?: number;
}

export interface ArchitectureResult {
  diagram: string;
  summary: string;
}

interface DirStats {
  path: string;
  files: number;
  lines: number;
  symbols: number;
  maxComplexity: number;
  children: Map<string, DirStats>;
}

export function execute(graph: KnowledgeGraph, input: Input): ArchitectureResult {
  const { style = 'boxes', maxDepth = 3 } = input;

  // Build directory tree with stats
  const root = buildDirTree(graph);

  let diagram: string;
  switch (style) {
    case 'tree':
      diagram = generateTreeDiagram(root, graph, maxDepth);
      break;
    case 'compact':
      diagram = generateCompactDiagram(root, graph);
      break;
    default:
      diagram = generateBoxDiagram(root, graph, maxDepth);
  }

  const summary = generateSummary(graph, root);

  return { diagram, summary };
}

function buildDirTree(graph: KnowledgeGraph): DirStats {
  const root: DirStats = {
    path: '.',
    files: 0,
    lines: 0,
    symbols: 0,
    maxComplexity: 0,
    children: new Map(),
  };

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') {
      const parts = node.filePath.split('/').filter((p) => p && p !== '.');
      let current = root;

      // Navigate/create path
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.children.has(part)) {
          current.children.set(part, {
            path: parts.slice(0, i + 1).join('/'),
            files: 0,
            lines: 0,
            symbols: 0,
            maxComplexity: 0,
            children: new Map(),
          });
        }
        current = current.children.get(part)!;
      }

      // Update stats
      current.files++;
      current.lines += node.lineEnd || 0;
      if (node.complexity && node.complexity > current.maxComplexity) {
        current.maxComplexity = node.complexity;
      }
    } else {
      // Count symbols
      const parts = node.filePath.split('/').filter((p) => p && p !== '.');
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current.children.has(part)) {
          current = current.children.get(part)!;
        }
      }
      current.symbols++;
      if (node.complexity && node.complexity > current.maxComplexity) {
        current.maxComplexity = node.complexity;
      }
    }
  }

  // Aggregate stats up the tree
  aggregateStats(root);

  return root;
}

function aggregateStats(dir: DirStats): void {
  for (const child of dir.children.values()) {
    aggregateStats(child);
    dir.files += child.files;
    dir.lines += child.lines;
    dir.symbols += child.symbols;
    if (child.maxComplexity > dir.maxComplexity) {
      dir.maxComplexity = child.maxComplexity;
    }
  }
}

function generateBoxDiagram(root: DirStats, graph: KnowledgeGraph, _maxDepth: number): string {
  const lines: string[] = [];
  const name = graph.metadata.rootDir.split('/').pop() || 'project';

  // Header box
  lines.push('');
  lines.push(`┌${'─'.repeat(50)}┐`);
  lines.push(`│${centerText(`👻 ${name.toUpperCase()}`, 50)}│`);
  lines.push(
    '│' +
      centerText(
        `${graph.metadata.fileCount} files | ${graph.metadata.totalLines.toLocaleString()} lines`,
        50
      ) +
      '│'
  );
  lines.push(`└${'─'.repeat(50)}┘`);
  lines.push(centerText('│', 52));

  // Get top-level directories
  const topDirs = Array.from(root.children.entries())
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 6);

  if (topDirs.length === 0) {
    lines.push(centerText('(no subdirectories)', 52));
    return lines.join('\n');
  }

  // Draw connections
  const connectorLine = topDirs
    .map((_, i) => {
      if (i === 0) return '┌';
      if (i === topDirs.length - 1) return '┐';
      return '┬';
    })
    .join('────────');

  lines.push(centerText(connectorLine, 52));

  // Draw vertical lines
  const verticals = topDirs.map(() => '│').join('        ');
  lines.push(centerText(verticals, 52));

  // Draw directory boxes
  const boxes = topDirs.map(([name, stats]) => {
    const emoji = getDirectoryEmoji(name);
    const complexity = stats.maxComplexity > 15 ? '🔥' : stats.maxComplexity > 10 ? '⚠️' : '✓';
    return [
      `┌${'─'.repeat(8)}┐`,
      `│${centerText(emoji + name.slice(0, 4), 8)}│`,
      `│${centerText(`${stats.files}f`, 8)}│`,
      `│${centerText(complexity, 8)}│`,
      `└${'─'.repeat(8)}┘`,
    ];
  });

  // Transpose and join boxes horizontally
  for (let row = 0; row < 5; row++) {
    const line = boxes.map((box) => box[row]).join('  ');
    lines.push(centerText(line, 52));
  }

  // Legend
  lines.push('');
  lines.push('Legend: f=files  ✓=healthy  ⚠️=moderate  🔥=complex');

  return lines.join('\n');
}

function generateTreeDiagram(root: DirStats, graph: KnowledgeGraph, maxDepth: number): string {
  const lines: string[] = [];
  const name = graph.metadata.rootDir.split('/').pop() || 'project';

  lines.push(`${name}/`);
  lines.push(
    `├── ${graph.metadata.fileCount} files, ${graph.metadata.totalLines.toLocaleString()} lines`
  );
  lines.push('│');

  const dirs = Array.from(root.children.entries()).sort((a, b) => b[1].files - a[1].files);

  dirs.forEach(([dirName, stats], index) => {
    const isLast = index === dirs.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    const emoji = getDirectoryEmoji(dirName);
    const complexity = stats.maxComplexity > 15 ? ' 🔥' : stats.maxComplexity > 10 ? ' ⚠️' : '';

    lines.push(
      `${prefix}${emoji} ${dirName}/ (${stats.files} files, ${stats.lines} lines)${complexity}`
    );

    // Show children up to maxDepth
    if (maxDepth > 1) {
      const children = Array.from(stats.children.entries())
        .sort((a, b) => b[1].files - a[1].files)
        .slice(0, 4);

      children.forEach(([childName, childStats], childIndex) => {
        const childIsLast = childIndex === children.length - 1;
        const childBranch = childIsLast ? '└── ' : '├── ';
        lines.push(`${childPrefix}${childBranch}${childName}/ (${childStats.files}f)`);
      });

      if (stats.children.size > 4) {
        lines.push(`${childPrefix}    ... and ${stats.children.size - 4} more`);
      }
    }
  });

  return lines.join('\n');
}

function generateCompactDiagram(root: DirStats, graph: KnowledgeGraph): string {
  const lines: string[] = [];
  const name = graph.metadata.rootDir.split('/').pop() || 'project';

  lines.push(
    `📁 ${name}: ${graph.metadata.fileCount} files, ${graph.metadata.totalLines.toLocaleString()} LOC`
  );
  lines.push('');

  const dirs = Array.from(root.children.entries())
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 8);

  const maxNameLen = Math.max(...dirs.map(([n]) => n.length));

  for (const [dirName, stats] of dirs) {
    const bar = '█'.repeat(Math.ceil(stats.files / 2));
    const emoji = getDirectoryEmoji(dirName);
    const complexity = stats.maxComplexity > 15 ? '🔥' : stats.maxComplexity > 10 ? '⚠️' : '  ';
    lines.push(
      `${emoji} ${dirName.padEnd(maxNameLen)} ${bar.padEnd(20)} ${String(stats.files).padStart(3)}f ${complexity}`
    );
  }

  return lines.join('\n');
}

function generateSummary(graph: KnowledgeGraph, root: DirStats): string {
  const parts: string[] = [];
  const name = graph.metadata.rootDir.split('/').pop() || 'This codebase';

  parts.push(`# ${name} Architecture\n`);
  parts.push(`I am a **${Object.keys(graph.metadata.languages || {}).join('/')}** project with:\n`);
  parts.push(`- **${graph.metadata.fileCount}** source files`);
  parts.push(`- **${graph.metadata.totalLines.toLocaleString()}** lines of code`);
  parts.push(`- **${root.children.size}** top-level directories\n`);

  // Describe key directories
  const topDirs = Array.from(root.children.entries())
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 5);

  if (topDirs.length > 0) {
    parts.push('## Key Areas\n');
    for (const [dirName, stats] of topDirs) {
      const role = guessDirectoryRole(dirName);
      const health =
        stats.maxComplexity > 15
          ? '(needs attention)'
          : stats.maxComplexity > 10
            ? '(moderate complexity)'
            : '(healthy)';
      parts.push(`- **${dirName}/** - ${role} (${stats.files} files) ${health}`);
    }
  }

  return parts.join('\n');
}

function centerText(text: string, width: number): string {
  const visibleLength = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '  ').length;
  const padding = Math.max(0, width - visibleLength);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

function getDirectoryEmoji(name: string): string {
  const emojiMap: Record<string, string> = {
    src: '📦',
    lib: '📚',
    test: '🧪',
    tests: '🧪',
    spec: '🧪',
    docs: '📖',
    config: '⚙️',
    scripts: '📜',
    bin: '🔧',
    dist: '📤',
    build: '🏗️',
    public: '🌐',
    static: '🖼️',
    assets: '🎨',
    components: '🧩',
    utils: '🔨',
    helpers: '🔨',
    api: '🔌',
    routes: '🛤️',
    models: '📊',
    services: '⚡',
    hooks: '🪝',
    store: '🗄️',
    types: '📝',
    graph: '🕸️',
    analyzers: '🔬',
    tools: '🛠️',
    plugin: '🔌',
    skills: '✨',
    agents: '🤖',
  };
  return emojiMap[name.toLowerCase()] || '📁';
}

function guessDirectoryRole(name: string): string {
  const roles: Record<string, string> = {
    src: 'Main source code',
    lib: 'Library code',
    test: 'Test files',
    tests: 'Test files',
    spec: 'Test specifications',
    docs: 'Documentation',
    config: 'Configuration',
    scripts: 'Build/utility scripts',
    dist: 'Built output',
    build: 'Build artifacts',
    public: 'Public assets',
    static: 'Static files',
    assets: 'Media assets',
    components: 'UI components',
    utils: 'Utility functions',
    helpers: 'Helper functions',
    api: 'API layer',
    routes: 'Route definitions',
    models: 'Data models',
    services: 'Business logic',
    hooks: 'Lifecycle hooks',
    store: 'State management',
    types: 'Type definitions',
    graph: 'Graph operations',
    analyzers: 'Code analysis',
    tools: 'Tool implementations',
    plugin: 'Plugin structure',
    skills: 'Agent skills',
    agents: 'AI agents',
  };
  return roles[name.toLowerCase()] || 'Project files';
}
