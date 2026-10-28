/**
 * Import Analyzer
 *
 * Analyzes import/export relationships between files to build
 * dependency edges in the knowledge graph.
 */

import fs from 'node:fs'
import path from 'node:path'
import { type SourceFile, ts } from 'ts-morph'
import type { FileRelationship, GraphEdge } from '../graph/types.js'

export interface ImportInfo {
  sourcePath: string
  targetPath: string
  symbols: string[]
  isDefault: boolean
  isNamespace: boolean
  isTypeOnly: boolean
}

export interface ExportInfo {
  name: string
  isDefault: boolean
  isReExport: boolean
  originalSource?: string
}

export type ImportResolver = (specifier: string, fromFile: string) => string | null

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

interface PathAlias {
  prefix: string
  suffix: string
  /** False for exact patterns like "@lib", which must not match "@lib/other" */
  wildcard: boolean
  targets: string[]
}

/**
 * Read `compilerOptions.paths` / `baseUrl` from tsconfig.json or jsconfig.json,
 * following `extends`. Returns no aliases if neither file parses.
 */
function loadPathAliases(root: string): { aliases: PathAlias[]; baseUrl?: string } {
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const configPath = path.join(root, name)
    if (!fs.existsSync(configPath)) continue
    try {
      const read = ts.readConfigFile(configPath, ts.sys.readFile)
      if (read.error) continue
      const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath)
      const { paths, baseUrl } = parsed.options
      const pathsBase = baseUrl ?? (parsed.options['pathsBasePath'] as string | undefined) ?? root
      const aliases: PathAlias[] = []
      for (const [pattern, targets] of Object.entries(paths ?? {})) {
        const star = pattern.indexOf('*')
        aliases.push({
          prefix: star === -1 ? pattern : pattern.slice(0, star),
          suffix: star === -1 ? '' : pattern.slice(star + 1),
          wildcard: star !== -1,
          targets: targets.map((t) => path.resolve(pathsBase, t)),
        })
      }
      // Longest prefix wins, as in TypeScript's own resolution
      aliases.sort((x, y) => y.prefix.length - x.prefix.length)
      return { aliases, baseUrl }
    } catch {
      // Unparseable config: resolve relative imports only
    }
  }
  return { aliases: [] }
}

/**
 * Build a resolver that maps an import specifier to a repo-relative source file,
 * or null for packages and imports that point at nothing on disk. Handles
 * relative paths, tsconfig `paths` aliases (`@/lib/x`), `baseUrl` imports,
 * ESM `.js` specifiers that point at `.ts` sources, and directory index files.
 *
 * File-existence checks are cached for the resolver's lifetime, so create one per
 * build: a long-lived resolver would keep resolving files that were deleted.
 */
export function createImportResolver(rootDir: string): ImportResolver {
  const root = path.resolve(rootDir)

  const { aliases, baseUrl } = loadPathAliases(root)
  const fileCache = new Map<string, boolean>()
  const isFile = (p: string): boolean => {
    let hit = fileCache.get(p)
    if (hit === undefined) {
      try {
        hit = fs.statSync(p).isFile()
      } catch {
        hit = false
      }
      fileCache.set(p, hit)
    }
    return hit
  }

  const probe = (base: string): string | null => {
    const ext = path.extname(base)
    if (ext && SOURCE_EXTENSIONS.includes(ext) && isFile(base)) return base
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
      const stem = base.slice(0, -ext.length)
      for (const tsExt of ['.ts', '.tsx', '.mts', '.cts']) {
        if (isFile(stem + tsExt)) return stem + tsExt
      }
    }
    for (const e of SOURCE_EXTENSIONS) {
      if (isFile(base + e)) return base + e
    }
    for (const e of SOURCE_EXTENSIONS) {
      const index = path.join(base, `index${e}`)
      if (isFile(index)) return index
    }
    return null
  }

  const toRelative = (absolute: string | null): string | null => {
    if (!absolute) return null
    const rel = path.relative(root, absolute)
    return rel.startsWith('..') ? null : rel
  }

  const resolver: ImportResolver = (specifier, fromFile) => {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      return toRelative(probe(path.resolve(path.dirname(fromFile), specifier)))
    }

    for (const alias of aliases) {
      if (!alias.wildcard && specifier !== alias.prefix) continue
      if (!specifier.startsWith(alias.prefix) || !specifier.endsWith(alias.suffix)) continue
      if (specifier.length < alias.prefix.length + alias.suffix.length) continue
      const wildcard = specifier.slice(alias.prefix.length, specifier.length - alias.suffix.length)
      for (const target of alias.targets) {
        const hit = probe(target.replaceAll('*', wildcard))
        if (hit) return toRelative(hit)
      }
    }

    if (baseUrl) return toRelative(probe(path.resolve(baseUrl, specifier)))
    return null
  }

  return resolver
}

/**
 * Analyze imports from a source file. Re-exports (`export { x } from './y'`)
 * count as imports, so files behind a barrel still show their real dependents.
 */
export function analyzeImports(
  sourceFile: SourceFile,
  rootDir: string,
  resolver: ImportResolver = createImportResolver(rootDir),
  /** Receives relative specifiers that point at no file (yet) */
  unresolved?: string[]
): ImportInfo[] {
  const imports: ImportInfo[] = []
  const absolutePath = sourceFile.getFilePath()
  const sourceFilePath = path.relative(rootDir, absolutePath)

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const specifier = importDecl.getModuleSpecifierValue()
    const targetPath = resolver(specifier, absolutePath)
    if (!targetPath && specifier.startsWith('.')) unresolved?.push(specifier)
    if (!targetPath || targetPath === sourceFilePath) continue

    const namedImports = importDecl.getNamedImports()
    const defaultImport = importDecl.getDefaultImport()
    const namespaceImport = importDecl.getNamespaceImport()
    const symbols: string[] = []

    if (defaultImport) symbols.push(defaultImport.getText())
    if (namespaceImport) symbols.push(`* as ${namespaceImport.getText()}`)
    for (const named of namedImports) {
      const name = named.getName()
      const alias = named.getAliasNode()?.getText()
      symbols.push(alias ? `${name} as ${alias}` : name)
    }

    imports.push({
      sourcePath: sourceFilePath,
      targetPath,
      symbols,
      isDefault: !!defaultImport,
      isNamespace: !!namespaceImport,
      isTypeOnly: importDecl.isTypeOnly(),
    })
  }

  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const specifier = exportDecl.getModuleSpecifierValue()
    if (!specifier) continue
    const targetPath = resolver(specifier, absolutePath)
    if (!targetPath && specifier.startsWith('.')) unresolved?.push(specifier)
    if (!targetPath || targetPath === sourceFilePath) continue

    const named = exportDecl.getNamedExports().map((e) => e.getName())
    imports.push({
      sourcePath: sourceFilePath,
      targetPath,
      symbols: named.length > 0 ? named : ['*'],
      isDefault: false,
      isNamespace: named.length === 0,
      isTypeOnly: exportDecl.isTypeOnly(),
    })
  }

  return imports
}

/**
 * Analyze exports from a source file
 */
export function analyzeExports(sourceFile: SourceFile, _rootDir: string): ExportInfo[] {
  const exports: ExportInfo[] = []

  // Named exports
  const exportDeclarations = sourceFile.getExportDeclarations()
  for (const exportDecl of exportDeclarations) {
    const namedExports = exportDecl.getNamedExports()
    const moduleSpecifier = exportDecl.getModuleSpecifierValue()

    for (const named of namedExports) {
      exports.push({
        name: named.getName(),
        isDefault: false,
        isReExport: !!moduleSpecifier,
        originalSource: moduleSpecifier || undefined,
      })
    }
  }

  // Export assignments (export default)
  const exportAssignments = sourceFile.getExportAssignments()
  for (const _assignment of exportAssignments) {
    exports.push({
      name: 'default',
      isDefault: true,
      isReExport: false,
    })
  }

  // Exported declarations
  const exportedDeclarations = sourceFile.getExportedDeclarations()
  for (const [name, _declarations] of exportedDeclarations) {
    if (name !== 'default') {
      exports.push({
        name,
        isDefault: false,
        isReExport: false,
      })
    }
  }

  return exports
}

/**
 * Create edges from import relationships
 */
export function createImportEdges(imports: ImportInfo[]): GraphEdge[] {
  const edges: GraphEdge[] = []
  let edgeId = 0

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
    })
  }

  return edges
}

/**
 * Build a dependency map from imports
 */
export function buildDependencyMap(imports: ImportInfo[]): Map<string, Set<string>> {
  const dependencies = new Map<string, Set<string>>()

  for (const imp of imports) {
    if (!dependencies.has(imp.sourcePath)) {
      dependencies.set(imp.sourcePath, new Set())
    }
    dependencies.get(imp.sourcePath)!.add(imp.targetPath)
  }

  return dependencies
}

/**
 * Build a reverse dependency map (who imports this file)
 */
export function buildReverseDependencyMap(imports: ImportInfo[]): Map<string, Set<string>> {
  const reverseDeps = new Map<string, Set<string>>()

  for (const imp of imports) {
    if (!reverseDeps.has(imp.targetPath)) {
      reverseDeps.set(imp.targetPath, new Set())
    }
    reverseDeps.get(imp.targetPath)!.add(imp.sourcePath)
  }

  return reverseDeps
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
  let score = 0

  // Direct dependency A -> B
  if (dependencies.get(fileA)?.has(fileB)) {
    score += 0.3
  }

  // Direct dependency B -> A
  if (dependencies.get(fileB)?.has(fileA)) {
    score += 0.3
  }

  // Shared dependencies (both import same files)
  const depsA = dependencies.get(fileA) || new Set()
  const depsB = dependencies.get(fileB) || new Set()
  const sharedDeps = [...depsA].filter((d) => depsB.has(d))
  score += Math.min(0.2, sharedDeps.length * 0.05)

  // Shared importers (both imported by same files)
  const importersA = reverseDeps.get(fileA) || new Set()
  const importersB = reverseDeps.get(fileB) || new Set()
  const sharedImporters = [...importersA].filter((i) => importersB.has(i))
  score += Math.min(0.2, sharedImporters.length * 0.05)

  return Math.min(1, score)
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
    }))

  // Get who imports this file
  const importedBy = [...(reverseDeps.get(filePath) || [])].map((importer) => {
    const relevantImports = imports.filter(
      (i) => i.sourcePath === importer && i.targetPath === filePath
    )
    return {
      filePath: importer,
      symbols: relevantImports.flatMap((i) => i.symbols),
    }
  })

  return {
    filePath,
    imports: fileImports,
    importedBy,
    exports: exports.map((e) => ({
      name: e.name,
      type: 'variable' as const, // Will be refined with AST data
      isDefault: e.isDefault,
    })),
  }
}
