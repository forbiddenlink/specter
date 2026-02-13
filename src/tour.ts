/**
 * Tour - Interactive Codebase Walkthrough
 *
 * Guides new developers through the codebase structure,
 * highlighting key files, patterns, and entry points.
 */

import type { GraphNode, KnowledgeGraph } from './graph/types.js';

export interface TourStop {
  name: string;
  path: string;
  description: string;
  importance: 'critical' | 'important' | 'helpful';
  tips: string[];
}

export interface TourSection {
  title: string;
  description: string;
  stops: TourStop[];
}

export interface CodebaseTour {
  codebaseName: string;
  overview: string;
  stats: {
    files: number;
    lines: number;
    functions: number;
    classes: number;
  };
  architecture: string[];
  sections: TourSection[];
  quickStart: string[];
}

/**
 * Identify entry points in the codebase
 */
function findEntryPoints(graph: KnowledgeGraph): TourStop[] {
  const stops: TourStop[] = [];
  const nodes = Object.values(graph.nodes);

  // Common entry point patterns
  const entryPatterns = [
    { pattern: /index\.(ts|js|tsx|jsx)$/, name: 'Index', desc: 'Module entry point' },
    { pattern: /main\.(ts|js)$/, name: 'Main', desc: 'Application entry point' },
    { pattern: /app\.(ts|js|tsx|jsx)$/, name: 'App', desc: 'Application root' },
    { pattern: /cli\.(ts|js)$/, name: 'CLI', desc: 'Command-line interface' },
    { pattern: /server\.(ts|js)$/, name: 'Server', desc: 'Server entry point' },
  ];

  for (const node of nodes) {
    if (node.type !== 'file') continue;

    for (const { pattern, name, desc } of entryPatterns) {
      if (pattern.test(node.filePath)) {
        stops.push({
          name: `${name}: ${node.name}`,
          path: node.filePath,
          description: desc,
          importance: 'critical',
          tips: ['Start here to understand the application flow'],
        });
        break;
      }
    }
  }

  return stops.slice(0, 5);
}

/**
 * Find configuration files
 */
function findConfigFiles(graph: KnowledgeGraph): TourStop[] {
  const stops: TourStop[] = [];
  const nodes = Object.values(graph.nodes);

  const configPatterns = [
    { pattern: /package\.json$/, name: 'package.json', desc: 'Dependencies and scripts' },
    { pattern: /tsconfig\.json$/, name: 'tsconfig.json', desc: 'TypeScript configuration' },
    { pattern: /\.env/, name: 'Environment', desc: 'Environment variables' },
    { pattern: /config\.(ts|js|json)$/, name: 'Config', desc: 'Application configuration' },
  ];

  for (const node of nodes) {
    if (node.type !== 'file') continue;

    for (const { pattern, name, desc } of configPatterns) {
      if (pattern.test(node.filePath)) {
        stops.push({
          name,
          path: node.filePath,
          description: desc,
          importance: 'important',
          tips: ['Check this before making environment-specific changes'],
        });
        break;
      }
    }
  }

  return stops.slice(0, 4);
}

/**
 * Find high-complexity hotspots (files to be careful with)
 */
function findHotspots(graph: KnowledgeGraph): TourStop[] {
  const stops: TourStop[] = [];
  const nodes = Object.values(graph.nodes);

  // Find files with high complexity
  const complexFiles = nodes
    .filter((n) => n.type === 'file' && n.complexity && n.complexity > 15)
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
    .slice(0, 3);

  for (const node of complexFiles) {
    stops.push({
      name: `Hotspot: ${node.name}`,
      path: node.filePath,
      description: `High complexity (${node.complexity}) - handle with care`,
      importance: 'important',
      tips: [
        'Read thoroughly before modifying',
        'Consider adding tests before changes',
        'May benefit from refactoring',
      ],
    });
  }

  return stops;
}

/**
 * Find core modules (most imported files)
 */
function findCoreModules(graph: KnowledgeGraph): TourStop[] {
  const stops: TourStop[] = [];

  // Count how many times each file is imported
  const importCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const target = graph.nodes[edge.target];
      if (target && target.type === 'file') {
        importCounts.set(target.filePath, (importCounts.get(target.filePath) || 0) + 1);
      }
    }
  }

  // Sort by import count
  const coreFiles = [...importCounts.entries()]
    .filter((entry): entry is [string, number] => entry[0] !== undefined && entry[1] !== undefined)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  for (const [filePath, count] of coreFiles) {
    const node = Object.values(graph.nodes).find((n) => n.filePath === filePath);
    if (node) {
      stops.push({
        name: `Core: ${node.name}`,
        path: filePath,
        description: `Imported by ${count} files - central to the codebase`,
        importance: 'critical',
        tips: ['Changes here affect many files', 'Understand this before major refactoring'],
      });
    }
  }

  return stops;
}

/**
 * Detect directory structure and purpose
 */
function analyzeDirectories(graph: KnowledgeGraph): TourSection[] {
  const sections: TourSection[] = [];
  const dirMap = new Map<string, GraphNode[]>();

  // Group files by top-level directory
  for (const node of Object.values(graph.nodes)) {
    if (node.type !== 'file') continue;

    const parts = node.filePath.split('/');
    const firstPart = parts[0];
    const topDir = parts.length > 1 && firstPart ? firstPart : '.';

    const existing = dirMap.get(topDir);
    if (existing) {
      existing.push(node);
    } else {
      dirMap.set(topDir, [node]);
    }
  }

  // Common directory purposes
  const dirPurposes: Record<string, string> = {
    src: 'Source code',
    lib: 'Library code',
    app: 'Application code',
    components: 'UI components',
    pages: 'Page components',
    api: 'API routes',
    services: 'Business logic',
    utils: 'Utility functions',
    helpers: 'Helper functions',
    hooks: 'React hooks',
    types: 'Type definitions',
    models: 'Data models',
    tests: 'Test files',
    __tests__: 'Test files',
    config: 'Configuration',
    public: 'Static assets',
    assets: 'Static assets',
    styles: 'Stylesheets',
    docs: 'Documentation',
  };

  for (const [dir, files] of dirMap.entries()) {
    if (dir === '.' || files.length < 2) continue;

    const purpose = dirPurposes[dir] || 'Project files';
    const stops: TourStop[] = [];

    // Pick representative files from each directory
    const sorted = files.sort((a, b) => {
      // Prioritize index files, then by name
      const aIsIndex = a.name.startsWith('index');
      const bIsIndex = b.name.startsWith('index');
      if (aIsIndex && !bIsIndex) return -1;
      if (!aIsIndex && bIsIndex) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const file of sorted.slice(0, 3)) {
      stops.push({
        name: file.name,
        path: file.filePath,
        description: file.documentation || `Part of ${purpose.toLowerCase()}`,
        importance: 'helpful',
        tips: [],
      });
    }

    if (stops.length > 0) {
      sections.push({
        title: `/${dir}`,
        description: purpose,
        stops,
      });
    }
  }

  return sections.slice(0, 6);
}

/**
 * Generate quick start suggestions
 */
function generateQuickStart(graph: KnowledgeGraph): string[] {
  const suggestions: string[] = [];

  // Check for common patterns
  const hasTests = Object.values(graph.nodes).some(
    (n) => n.filePath.includes('test') || n.filePath.includes('spec')
  );
  const hasCli = Object.values(graph.nodes).some((n) => n.filePath.includes('cli'));
  const hasApi = Object.values(graph.nodes).some(
    (n) => n.filePath.includes('api') || n.filePath.includes('route')
  );

  suggestions.push('1. Read the README.md for project overview');
  suggestions.push('2. Check package.json for available scripts');

  if (hasCli) {
    suggestions.push('3. Try the CLI: run the main command with --help');
  }
  if (hasApi) {
    suggestions.push('3. Start the dev server and explore the API');
  }
  if (hasTests) {
    suggestions.push('4. Run the test suite to verify your setup');
  }

  suggestions.push('5. Start with entry points, then follow imports');

  return suggestions.slice(0, 5);
}

/**
 * Generate overview description
 */
function generateOverview(graph: KnowledgeGraph): string {
  const { fileCount, totalLines } = graph.metadata;
  const langs = Object.entries(graph.metadata.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([lang]) => lang);

  const size =
    fileCount < 20
      ? 'small'
      : fileCount < 100
        ? 'medium-sized'
        : fileCount < 500
          ? 'large'
          : 'very large';

  return `This is a ${size} ${langs.join('/')} codebase with ${fileCount} files and ${totalLines.toLocaleString()} lines of code.`;
}

/**
 * Detect architecture patterns
 */
function detectArchitecture(graph: KnowledgeGraph): string[] {
  const patterns: string[] = [];
  const paths = Object.values(graph.nodes).map((n) => n.filePath);

  // Detect common patterns
  if (paths.some((p) => p.includes('component'))) {
    patterns.push('Component-based architecture');
  }
  if (paths.some((p) => p.includes('service')) && paths.some((p) => p.includes('controller'))) {
    patterns.push('Service-Controller pattern');
  }
  if (paths.some((p) => p.includes('model')) && paths.some((p) => p.includes('view'))) {
    patterns.push('MVC-style separation');
  }
  if (paths.some((p) => p.includes('hook'))) {
    patterns.push('Custom hooks pattern');
  }
  if (paths.some((p) => p.includes('middleware'))) {
    patterns.push('Middleware pipeline');
  }
  if (paths.some((p) => p.includes('store') || p.includes('redux'))) {
    patterns.push('Centralized state management');
  }
  if (paths.some((p) => p.includes('api/') || p.includes('routes/'))) {
    patterns.push('API-first design');
  }

  if (patterns.length === 0) {
    patterns.push('Custom project structure');
  }

  return patterns.slice(0, 4);
}

/**
 * Generate a complete codebase tour
 */
export function generateTour(graph: KnowledgeGraph): CodebaseTour {
  const codebaseName = graph.metadata.rootDir.split('/').pop() || 'unknown';

  // Count entities
  const nodes = Object.values(graph.nodes);
  const stats = {
    files: nodes.filter((n) => n.type === 'file').length,
    lines: graph.metadata.totalLines,
    functions: nodes.filter((n) => n.type === 'function').length,
    classes: nodes.filter((n) => n.type === 'class').length,
  };

  const sections: TourSection[] = [];

  // Entry points section
  const entryPoints = findEntryPoints(graph);
  if (entryPoints.length > 0) {
    sections.push({
      title: 'Entry Points',
      description: 'Where the application starts',
      stops: entryPoints,
    });
  }

  // Core modules section
  const coreModules = findCoreModules(graph);
  if (coreModules.length > 0) {
    sections.push({
      title: 'Core Modules',
      description: 'Central files that everything depends on',
      stops: coreModules,
    });
  }

  // Hotspots section
  const hotspots = findHotspots(graph);
  if (hotspots.length > 0) {
    sections.push({
      title: 'Complexity Hotspots',
      description: 'High-complexity areas requiring careful attention',
      stops: hotspots,
    });
  }

  // Configuration section
  const configFiles = findConfigFiles(graph);
  if (configFiles.length > 0) {
    sections.push({
      title: 'Configuration',
      description: 'Project settings and environment',
      stops: configFiles,
    });
  }

  // Directory-based sections
  const dirSections = analyzeDirectories(graph);
  sections.push(...dirSections);

  return {
    codebaseName,
    overview: generateOverview(graph),
    stats,
    architecture: detectArchitecture(graph),
    sections,
    quickStart: generateQuickStart(graph),
  };
}

/**
 * Format tour for display
 */
export function formatTour(tour: CodebaseTour): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════╗');
  lines.push(`║  🗺️  CODEBASE TOUR: ${tour.codebaseName.toUpperCase().padEnd(32)} ║`);
  lines.push('╚══════════════════════════════════════════════════════╝');
  lines.push('');

  // Overview
  lines.push('OVERVIEW');
  lines.push('─'.repeat(50));
  lines.push(tour.overview);
  lines.push('');
  lines.push(`  📁 ${tour.stats.files} files`);
  lines.push(`  📝 ${tour.stats.lines.toLocaleString()} lines`);
  lines.push(`  ⚡ ${tour.stats.functions} functions`);
  lines.push(`  🏛️  ${tour.stats.classes} classes`);
  lines.push('');

  // Architecture
  if (tour.architecture.length > 0) {
    lines.push('ARCHITECTURE PATTERNS');
    lines.push('─'.repeat(50));
    for (const pattern of tour.architecture) {
      lines.push(`  • ${pattern}`);
    }
    lines.push('');
  }

  // Tour sections
  for (const section of tour.sections) {
    lines.push(`📍 ${section.title.toUpperCase()}`);
    lines.push(`   ${section.description}`);
    lines.push('─'.repeat(50));

    for (const stop of section.stops) {
      const icon =
        stop.importance === 'critical' ? '🔴' : stop.importance === 'important' ? '🟡' : '🟢';

      lines.push(`${icon} ${stop.name}`);
      lines.push(`   ${stop.path}`);
      lines.push(`   ${stop.description}`);

      if (stop.tips.length > 0) {
        for (const tip of stop.tips) {
          lines.push(`   💡 ${tip}`);
        }
      }
      lines.push('');
    }
  }

  // Quick start
  lines.push('🚀 QUICK START');
  lines.push('─'.repeat(50));
  for (const step of tour.quickStart) {
    lines.push(`  ${step}`);
  }
  lines.push('');

  lines.push('═'.repeat(54));
  lines.push('Legend: 🔴 Critical  🟡 Important  🟢 Helpful');
  lines.push('═'.repeat(54));

  return lines.join('\n');
}
