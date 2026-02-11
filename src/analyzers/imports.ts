/**
 * Import Analyzer
 *
 * Analyzes import/export relationships between files to build
 * dependency edges in the knowledge graph.
 */

import path from 'node:path';
import type { SourceFile } from 'ts-morph';
import type { FileRelationship, GraphEdge } from '../graph/types.js';

export interface ImportInfo {
  sourcePath: string;
  targetPath: string;
  symbols: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  isReExport: boolean;
  originalSource?: string;
}

/**
 * Resolve an import specifier to a file path
 */
function resolveImportPath(importPath: string, sourceDir: string, rootDir: string): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  // Resolve relative path
  const resolved = path.resolve(sourceDir, importPath);

  // Try common extensions if not specified
  const extensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '/index.ts',
    '/index.tsx',
    '/index.js',
    '/index.jsx',
  ];

  if (!path.extname(resolved)) {
    for (const ext of extensions) {
      const withExt = resolved + ext;
      // Return relative path from root
      return path.relative(rootDir, withExt);
    }
  }

  return path.relative(rootDir, resolved);
}

/**
 * Analyze imports from a source file
 */
export function analyzeImports(sourceFile: SourceFile, rootDir: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const sourceFilePath = path.relative(rootDir, sourceFile.getFilePath());
  const sourceDir = path.dirname(sourceFile.getFilePath());

  const importDeclarations = sourceFile.getImportDeclarations();

  for (const importDecl of importDeclarations) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const targetPath = resolveImportPath(moduleSpecifier, sourceDir, rootDir);

    if (!targetPath) continue; // Skip external packages

    const namedImports = importDecl.getNamedImports();
    const defaultImport = importDecl.getDefaultImport();
    const namespaceImport = importDecl.getNamespaceImport();
    const isTypeOnly = importDecl.isTypeOnly();

    const symbols: string[] = [];

    if (defaultImport) {
      symbols.push(defaultImport.getText());
    }

    if (namespaceImport) {
      symbols.push(`* as ${namespaceImport.getText()}`);
    }

    for (const named of namedImports) {
      const name = named.getName();
      const alias = named.getAliasNode()?.getText();
      symbols.push(alias ? `${name} as ${alias}` : name);
    }

    imports.push({
      sourcePath: sourceFilePath,
      targetPath,
      symbols,
      isDefault: !!defaultImport,
      isNamespace: !!namespaceImport,
      isTypeOnly,
    });
  }

  return imports;
}

/**
 * Analyze exports from a source file
 */
export function analyzeExports(sourceFile: SourceFile, _rootDir: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Named exports
  const exportDeclarations = sourceFile.getExportDeclarations();
  for (const exportDecl of exportDeclarations) {
    const namedExports = exportDecl.getNamedExports();
    const moduleSpecifier = exportDecl.getModuleSpecifierValue();

    for (const named of namedExports) {
      exports.push({
        name: named.getName(),
        isDefault: false,
        isReExport: !!moduleSpecifier,
        originalSource: moduleSpecifier || undefined,
      });
    }
  }

  // Export assignments (export default)
  const exportAssignments = sourceFile.getExportAssignments();
  for (const _assignment of exportAssignments) {
    exports.push({
      name: 'default',
      isDefault: true,
      isReExport: false,
    });
  }

  // Exported declarations
  const exportedDeclarations = sourceFile.getExportedDeclarations();
  for (const [name, _declarations] of exportedDeclarations) {
    if (name !== 'default') {
      exports.push({
        name,
        isDefault: false,
        isReExport: false,
      });
    }
  }

  return exports;
}

/**
 * Create edges from import relationships
 */
export function createImportEdges(imports: ImportInfo[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let edgeId = 0;

  for (const imp of imports) {
    edges.push({
      id: `import-${edgeId++}`,
      source: imp.sourcePath,
      target: imp.targetPath,
      type: 'imports',
      metadata: {
        symbols: imp.symbols,
        isDefault: imp.isDefault,
        isNamespace: imp.isNamespace,
        isTypeOnly: imp.isTypeOnly,
      },
    });
  }

  return edges;
}

/**
 * Build a dependency map from imports
 */
export function buildDependencyMap(imports: ImportInfo[]): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>();

  for (const imp of imports) {
    if (!dependencies.has(imp.sourcePath)) {
      dependencies.set(imp.sourcePath, new Set());
    }
    dependencies.get(imp.sourcePath)!.add(imp.targetPath);
  }

  return dependencies;
}

/**
 * Build a reverse dependency map (who imports this file)
 */
export function buildReverseDependencyMap(imports: ImportInfo[]): Map<string, Set<string>> {
  const reverseDeps = new Map<string, Set<string>>();

  for (const imp of imports) {
    if (!reverseDeps.has(imp.targetPath)) {
      reverseDeps.set(imp.targetPath, new Set());
    }
    reverseDeps.get(imp.targetPath)!.add(imp.sourcePath);
  }

  return reverseDeps;
}

/**
 * Calculate coupling score between two files
 * Based on bidirectional dependencies and shared dependencies
 */
export function calculateCouplingScore(
  fileA: string,
  fileB: string,
  dependencies: Map<string, Set<string>>,
  reverseDeps: Map<string, Set<string>>
): number {
  let score = 0;

  // Direct dependency A -> B
  if (dependencies.get(fileA)?.has(fileB)) {
    score += 0.3;
  }

  // Direct dependency B -> A
  if (dependencies.get(fileB)?.has(fileA)) {
    score += 0.3;
  }

  // Shared dependencies (both import same files)
  const depsA = dependencies.get(fileA) || new Set();
  const depsB = dependencies.get(fileB) || new Set();
  const sharedDeps = [...depsA].filter((d) => depsB.has(d));
  score += Math.min(0.2, sharedDeps.length * 0.05);

  // Shared importers (both imported by same files)
  const importersA = reverseDeps.get(fileA) || new Set();
  const importersB = reverseDeps.get(fileB) || new Set();
  const sharedImporters = [...importersA].filter((i) => importersB.has(i));
  score += Math.min(0.2, sharedImporters.length * 0.05);

  return Math.min(1, score);
}

/**
 * Get complete file relationships
 */
export function getFileRelationships(
  filePath: string,
  imports: ImportInfo[],
  exports: ExportInfo[],
  reverseDeps: Map<string, Set<string>>
): FileRelationship {
  // Get imports for this file
  const fileImports = imports
    .filter((i) => i.sourcePath === filePath)
    .map((i) => ({
      source: i.targetPath,
      symbols: i.symbols,
      isDefault: i.isDefault,
    }));

  // Get who imports this file
  const importedBy = [...(reverseDeps.get(filePath) || [])].map((importer) => {
    const relevantImports = imports.filter(
      (i) => i.sourcePath === importer && i.targetPath === filePath
    );
    return {
      filePath: importer,
      symbols: relevantImports.flatMap((i) => i.symbols),
    };
  });

  return {
    filePath,
    imports: fileImports,
    importedBy,
    exports: exports.map((e) => ({
      name: e.name,
      type: 'variable' as const, // Will be refined with AST data
      isDefault: e.isDefault,
    })),
  };
}
