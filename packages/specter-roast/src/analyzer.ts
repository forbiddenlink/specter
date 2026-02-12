import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CodebaseStats {
  fileCount: number;
  totalLines: number;
  avgLinesPerFile: number;
  largestFiles: Array<{ path: string; lines: number }>;
  suspiciousNames: string[];
  todoCount: number;
  consoleLogCount: number;
  anyCount: number;
  gitIgnored: boolean;
  nodeModulesSize: number;
  deepestNesting: number;
  longFunctions: number;
  emptyFiles: number;
  duplicateLikelyFiles: string[];
}

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.vercel',
  '__pycache__',
  'venv',
  '.venv',
]);

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.vue',
  '.svelte',
]);

function walkDir(dir: string, files: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath, files);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore permission errors
  }
  return files;
}

function countNesting(content: string): number {
  let maxNesting = 0;
  let current = 0;
  for (const char of content) {
    if (char === '{' || char === '(') {
      current++;
      maxNesting = Math.max(maxNesting, current);
    } else if (char === '}' || char === ')') {
      current = Math.max(0, current - 1);
    }
  }
  return maxNesting;
}

function estimateLongFunctions(content: string): number {
  // Simple heuristic: count functions with >50 lines between braces
  const functionMatches = content.match(/function\s+\w+|=>\s*\{|\.then\(|async\s+\(/g);
  if (!functionMatches) return 0;

  // Count blocks with many lines
  const blocks = content.split(/function\s+|=>\s*\{/);
  let longCount = 0;
  for (const block of blocks) {
    const braceEnd = block.indexOf('}');
    if (braceEnd > 0) {
      const blockContent = block.slice(0, braceEnd);
      const lines = blockContent.split('\n').length;
      if (lines > 50) longCount++;
    }
  }
  return longCount;
}

export function analyzeCodebase(rootDir: string): CodebaseStats {
  const files = walkDir(rootDir);
  let totalLines = 0;
  let todoCount = 0;
  let consoleLogCount = 0;
  let anyCount = 0;
  let deepestNesting = 0;
  let longFunctions = 0;
  let emptyFiles = 0;

  const fileSizes: Array<{ path: string; lines: number }> = [];
  const suspiciousNames: string[] = [];
  const fileContents: Map<string, string> = new Map();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      const relativePath = path.relative(rootDir, file);

      totalLines += lines;
      fileSizes.push({ path: relativePath, lines });

      if (lines === 0 || content.trim() === '') {
        emptyFiles++;
      }

      // Check for suspicious patterns
      const _lowerContent = content.toLowerCase();
      todoCount += (content.match(/TODO|FIXME|HACK|XXX/gi) || []).length;
      consoleLogCount += (content.match(/console\.log/g) || []).length;
      anyCount += (content.match(/:\s*any\b/g) || []).length;

      // Check nesting
      const nesting = countNesting(content);
      deepestNesting = Math.max(deepestNesting, nesting);

      // Check for long functions
      longFunctions += estimateLongFunctions(content);

      // Store normalized content for duplicate detection
      fileContents.set(relativePath, content.replace(/\s+/g, '').slice(0, 500));

      // Check suspicious file names
      const fileName = path.basename(file).toLowerCase();
      if (
        fileName.includes('helper') ||
        fileName.includes('util') ||
        fileName.includes('misc') ||
        fileName.includes('stuff') ||
        fileName.includes('temp') ||
        fileName.includes('old') ||
        fileName.includes('backup') ||
        fileName.includes('copy')
      ) {
        suspiciousNames.push(relativePath);
      }
    } catch {
      // Ignore read errors
    }
  }

  // Find potential duplicates (similar content)
  const duplicateLikelyFiles: string[] = [];
  const contentArray = Array.from(fileContents.entries());
  for (let i = 0; i < contentArray.length; i++) {
    for (let j = i + 1; j < contentArray.length; j++) {
      if (contentArray[i][1] === contentArray[j][1] && contentArray[i][1].length > 100) {
        duplicateLikelyFiles.push(contentArray[i][0]);
        duplicateLikelyFiles.push(contentArray[j][0]);
      }
    }
  }

  // Check for node_modules size
  let nodeModulesSize = 0;
  const nodeModulesPath = path.join(rootDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    try {
      // Just count directories as a proxy for size
      const nmEntries = fs.readdirSync(nodeModulesPath);
      nodeModulesSize = nmEntries.length;
    } catch {
      nodeModulesSize = 0;
    }
  }

  // Check for .gitignore
  const gitIgnored = fs.existsSync(path.join(rootDir, '.gitignore'));

  // Sort by size descending
  fileSizes.sort((a, b) => b.lines - a.lines);

  return {
    fileCount: files.length,
    totalLines,
    avgLinesPerFile: files.length > 0 ? Math.round(totalLines / files.length) : 0,
    largestFiles: fileSizes.slice(0, 10),
    suspiciousNames: [...new Set(suspiciousNames)].slice(0, 10),
    todoCount,
    consoleLogCount,
    anyCount,
    gitIgnored,
    nodeModulesSize,
    deepestNesting,
    longFunctions,
    emptyFiles,
    duplicateLikelyFiles: [...new Set(duplicateLikelyFiles)].slice(0, 6),
  };
}
