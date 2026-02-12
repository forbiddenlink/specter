/**
 * Import Analyzer Tests
 *
 * Tests for import graph building, dependency mapping, and coupling calculations.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildDependencyMap,
  buildReverseDependencyMap,
  calculateCouplingScore,
  createImportEdges,
  getFileRelationships,
  type ImportInfo,
  type ExportInfo,
} from '../../src/analyzers/imports.js';

/**
 * Helper to create import info objects
 */
function createImport(overrides: Partial<ImportInfo>): ImportInfo {
  return {
    sourcePath: overrides.sourcePath || 'src/consumer.ts',
    targetPath: overrides.targetPath || 'src/provider.ts',
    symbols: overrides.symbols || ['default'],
    isDefault: overrides.isDefault ?? true,
    isNamespace: overrides.isNamespace ?? false,
    isTypeOnly: overrides.isTypeOnly ?? false,
    ...overrides,
  };
}

describe('Import Analyzer', () => {
  describe('createImportEdges', () => {
    it('should create edges from imports', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/utils.ts',
          symbols: ['helper', 'format'],
        }),
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/config.ts',
          symbols: ['config'],
          isDefault: true,
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges).toHaveLength(2);
      expect(edges[0].type).toBe('imports');
      expect(edges[0].source).toBe('src/app.ts');
      expect(edges[0].target).toBe('src/utils.ts');
    });

    it('should generate unique edge IDs', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'a.ts', targetPath: 'b.ts' }),
        createImport({ sourcePath: 'b.ts', targetPath: 'c.ts' }),
        createImport({ sourcePath: 'c.ts', targetPath: 'a.ts' }),
      ];

      const edges = createImportEdges(imports);
      const ids = edges.map((e) => e.id);

      expect(new Set(ids).size).toBe(3);
    });

    it('should include import metadata', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/types.ts',
          symbols: ['User', 'Config'],
          isDefault: false,
          isNamespace: false,
          isTypeOnly: true,
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges[0].metadata).toEqual({
        symbols: ['User', 'Config'],
        isDefault: false,
        isNamespace: false,
        isTypeOnly: true,
      });
    });

    it('should handle namespace imports', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/utils.ts',
          symbols: ['* as utils'],
          isDefault: false,
          isNamespace: true,
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges[0].metadata?.isNamespace).toBe(true);
      expect(edges[0].metadata?.symbols).toContain('* as utils');
    });

    it('should handle empty imports array', () => {
      const edges = createImportEdges([]);

      expect(edges).toHaveLength(0);
    });
  });

  describe('buildDependencyMap', () => {
    it('should build map of file dependencies', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts' }),
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/config.ts' }),
        createImport({ sourcePath: 'src/utils.ts', targetPath: 'src/helpers.ts' }),
      ];

      const deps = buildDependencyMap(imports);

      expect(deps.get('src/app.ts')?.has('src/utils.ts')).toBe(true);
      expect(deps.get('src/app.ts')?.has('src/config.ts')).toBe(true);
      expect(deps.get('src/utils.ts')?.has('src/helpers.ts')).toBe(true);
      expect(deps.get('src/app.ts')?.size).toBe(2);
    });

    it('should not duplicate dependencies', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts', symbols: ['a'] }),
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts', symbols: ['b'] }),
      ];

      const deps = buildDependencyMap(imports);

      expect(deps.get('src/app.ts')?.size).toBe(1);
    });

    it('should handle files with no dependencies', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/leaf.ts' }),
      ];

      const deps = buildDependencyMap(imports);

      expect(deps.has('src/leaf.ts')).toBe(false);
    });

    it('should handle empty imports', () => {
      const deps = buildDependencyMap([]);

      expect(deps.size).toBe(0);
    });
  });

  describe('buildReverseDependencyMap', () => {
    it('should build map of reverse dependencies (importers)', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts' }),
        createImport({ sourcePath: 'src/main.ts', targetPath: 'src/utils.ts' }),
        createImport({ sourcePath: 'src/test.ts', targetPath: 'src/utils.ts' }),
      ];

      const reverseDeps = buildReverseDependencyMap(imports);

      expect(reverseDeps.get('src/utils.ts')?.has('src/app.ts')).toBe(true);
      expect(reverseDeps.get('src/utils.ts')?.has('src/main.ts')).toBe(true);
      expect(reverseDeps.get('src/utils.ts')?.has('src/test.ts')).toBe(true);
      expect(reverseDeps.get('src/utils.ts')?.size).toBe(3);
    });

    it('should not include files with no importers', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts' }),
      ];

      const reverseDeps = buildReverseDependencyMap(imports);

      expect(reverseDeps.has('src/app.ts')).toBe(false);
    });

    it('should handle empty imports', () => {
      const reverseDeps = buildReverseDependencyMap([]);

      expect(reverseDeps.size).toBe(0);
    });
  });

  describe('calculateCouplingScore', () => {
    it('should return 0 for unrelated files', () => {
      const deps = new Map<string, Set<string>>();
      deps.set('a.ts', new Set(['c.ts']));
      deps.set('b.ts', new Set(['d.ts']));

      const reverseDeps = new Map<string, Set<string>>();
      reverseDeps.set('c.ts', new Set(['a.ts']));
      reverseDeps.set('d.ts', new Set(['b.ts']));

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      expect(score).toBe(0);
    });

    it('should return 0.3 for one-way dependency', () => {
      const deps = new Map<string, Set<string>>();
      deps.set('a.ts', new Set(['b.ts']));

      const reverseDeps = new Map<string, Set<string>>();
      reverseDeps.set('b.ts', new Set(['a.ts']));

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      expect(score).toBe(0.3);
    });

    it('should return 0.6 for bidirectional dependency', () => {
      const deps = new Map<string, Set<string>>();
      deps.set('a.ts', new Set(['b.ts']));
      deps.set('b.ts', new Set(['a.ts']));

      const reverseDeps = new Map<string, Set<string>>();
      reverseDeps.set('a.ts', new Set(['b.ts']));
      reverseDeps.set('b.ts', new Set(['a.ts']));

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      expect(score).toBe(0.6);
    });

    it('should add score for shared dependencies', () => {
      const deps = new Map<string, Set<string>>();
      deps.set('a.ts', new Set(['shared.ts', 'common.ts']));
      deps.set('b.ts', new Set(['shared.ts', 'common.ts']));

      const reverseDeps = new Map<string, Set<string>>();

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      // 2 shared deps * 0.05 = 0.1
      expect(score).toBe(0.1);
    });

    it('should cap shared dependencies contribution at 0.2', () => {
      const deps = new Map<string, Set<string>>();
      deps.set('a.ts', new Set(['s1.ts', 's2.ts', 's3.ts', 's4.ts', 's5.ts', 's6.ts']));
      deps.set('b.ts', new Set(['s1.ts', 's2.ts', 's3.ts', 's4.ts', 's5.ts', 's6.ts']));

      const reverseDeps = new Map<string, Set<string>>();

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      // 6 shared deps would be 0.3, but capped at 0.2
      expect(score).toBe(0.2);
    });

    it('should add score for shared importers', () => {
      const deps = new Map<string, Set<string>>();

      const reverseDeps = new Map<string, Set<string>>();
      reverseDeps.set('a.ts', new Set(['consumer1.ts', 'consumer2.ts']));
      reverseDeps.set('b.ts', new Set(['consumer1.ts', 'consumer2.ts']));

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      // 2 shared importers * 0.05 = 0.1
      expect(score).toBe(0.1);
    });

    it('should cap total score at 1.0', () => {
      const deps = new Map<string, Set<string>>();
      // Bidirectional = 0.6
      deps.set('a.ts', new Set(['b.ts', 's1.ts', 's2.ts', 's3.ts', 's4.ts', 's5.ts']));
      deps.set('b.ts', new Set(['a.ts', 's1.ts', 's2.ts', 's3.ts', 's4.ts', 's5.ts']));

      const reverseDeps = new Map<string, Set<string>>();
      reverseDeps.set('a.ts', new Set(['b.ts', 'c1.ts', 'c2.ts', 'c3.ts', 'c4.ts', 'c5.ts']));
      reverseDeps.set('b.ts', new Set(['a.ts', 'c1.ts', 'c2.ts', 'c3.ts', 'c4.ts', 'c5.ts']));

      const score = calculateCouplingScore('a.ts', 'b.ts', deps, reverseDeps);

      // 0.6 + 0.2 + 0.2 = 1.0
      expect(score).toBe(1.0);
    });

    it('should handle missing files in maps', () => {
      const deps = new Map<string, Set<string>>();
      const reverseDeps = new Map<string, Set<string>>();

      const score = calculateCouplingScore('nonexistent1.ts', 'nonexistent2.ts', deps, reverseDeps);

      expect(score).toBe(0);
    });
  });

  describe('getFileRelationships', () => {
    it('should return complete file relationships', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/utils.ts',
          symbols: ['helper'],
          isDefault: false,
        }),
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/config.ts',
          symbols: ['config'],
          isDefault: true,
        }),
        createImport({
          sourcePath: 'src/main.ts',
          targetPath: 'src/app.ts',
          symbols: ['App'],
          isDefault: true,
        }),
      ];

      const exports: ExportInfo[] = [
        { name: 'App', isDefault: true, isReExport: false },
        { name: 'runApp', isDefault: false, isReExport: false },
      ];

      const reverseDeps = buildReverseDependencyMap(imports);

      const relationships = getFileRelationships('src/app.ts', imports, exports, reverseDeps);

      expect(relationships.filePath).toBe('src/app.ts');
      expect(relationships.imports).toHaveLength(2);
      expect(relationships.imports[0].source).toBe('src/utils.ts');
      expect(relationships.importedBy).toHaveLength(1);
      expect(relationships.importedBy[0].filePath).toBe('src/main.ts');
      expect(relationships.exports).toHaveLength(2);
    });

    it('should handle file with no imports', () => {
      const imports: ImportInfo[] = [];
      const exports: ExportInfo[] = [{ name: 'utility', isDefault: false, isReExport: false }];
      const reverseDeps = new Map<string, Set<string>>();

      const relationships = getFileRelationships('src/utils.ts', imports, exports, reverseDeps);

      expect(relationships.imports).toHaveLength(0);
      expect(relationships.importedBy).toHaveLength(0);
    });

    it('should handle file with no exporters', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils.ts' }),
      ];
      const exports: ExportInfo[] = [];
      const reverseDeps = buildReverseDependencyMap(imports);

      const relationships = getFileRelationships('src/app.ts', imports, exports, reverseDeps);

      expect(relationships.exports).toHaveLength(0);
    });

    it('should aggregate symbols from multiple importers', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/a.ts',
          targetPath: 'src/shared.ts',
          symbols: ['foo', 'bar'],
        }),
        createImport({
          sourcePath: 'src/a.ts',
          targetPath: 'src/shared.ts',
          symbols: ['baz'],
        }),
      ];

      const exports: ExportInfo[] = [];
      const reverseDeps = buildReverseDependencyMap(imports);

      const relationships = getFileRelationships('src/shared.ts', imports, exports, reverseDeps);

      expect(relationships.importedBy[0].symbols).toContain('foo');
      expect(relationships.importedBy[0].symbols).toContain('bar');
      expect(relationships.importedBy[0].symbols).toContain('baz');
    });
  });

  describe('Graph Correctness', () => {
    it('should handle circular dependencies', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'a.ts', targetPath: 'b.ts' }),
        createImport({ sourcePath: 'b.ts', targetPath: 'c.ts' }),
        createImport({ sourcePath: 'c.ts', targetPath: 'a.ts' }),
      ];

      const deps = buildDependencyMap(imports);
      const reverseDeps = buildReverseDependencyMap(imports);
      const edges = createImportEdges(imports);

      // All files should be in both maps
      expect(deps.get('a.ts')?.has('b.ts')).toBe(true);
      expect(deps.get('b.ts')?.has('c.ts')).toBe(true);
      expect(deps.get('c.ts')?.has('a.ts')).toBe(true);

      expect(reverseDeps.get('b.ts')?.has('a.ts')).toBe(true);
      expect(reverseDeps.get('c.ts')?.has('b.ts')).toBe(true);
      expect(reverseDeps.get('a.ts')?.has('c.ts')).toBe(true);

      expect(edges).toHaveLength(3);
    });

    it('should handle self-imports', () => {
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'src/recursive.ts', targetPath: 'src/recursive.ts' }),
      ];

      const deps = buildDependencyMap(imports);
      const reverseDeps = buildReverseDependencyMap(imports);

      expect(deps.get('src/recursive.ts')?.has('src/recursive.ts')).toBe(true);
      expect(reverseDeps.get('src/recursive.ts')?.has('src/recursive.ts')).toBe(true);
    });

    it('should handle diamond dependencies', () => {
      // A -> B, A -> C, B -> D, C -> D (diamond pattern)
      const imports: ImportInfo[] = [
        createImport({ sourcePath: 'a.ts', targetPath: 'b.ts' }),
        createImport({ sourcePath: 'a.ts', targetPath: 'c.ts' }),
        createImport({ sourcePath: 'b.ts', targetPath: 'd.ts' }),
        createImport({ sourcePath: 'c.ts', targetPath: 'd.ts' }),
      ];

      const deps = buildDependencyMap(imports);
      const reverseDeps = buildReverseDependencyMap(imports);

      // D should have 2 importers
      expect(reverseDeps.get('d.ts')?.size).toBe(2);
      expect(reverseDeps.get('d.ts')?.has('b.ts')).toBe(true);
      expect(reverseDeps.get('d.ts')?.has('c.ts')).toBe(true);

      // A should have 2 dependencies
      expect(deps.get('a.ts')?.size).toBe(2);

      // B and C should be coupled via shared dependency and shared importer
      const couplingBC = calculateCouplingScore('b.ts', 'c.ts', deps, reverseDeps);
      expect(couplingBC).toBeGreaterThan(0);
    });

    it('should handle complex real-world graph', () => {
      // Simulate a typical project structure
      const imports: ImportInfo[] = [
        // Entry point imports
        createImport({ sourcePath: 'src/index.ts', targetPath: 'src/app.ts' }),
        createImport({ sourcePath: 'src/index.ts', targetPath: 'src/config.ts' }),

        // App imports
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/services/api.ts' }),
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/utils/logger.ts' }),
        createImport({ sourcePath: 'src/app.ts', targetPath: 'src/types.ts' }),

        // Service imports
        createImport({ sourcePath: 'src/services/api.ts', targetPath: 'src/utils/http.ts' }),
        createImport({ sourcePath: 'src/services/api.ts', targetPath: 'src/types.ts' }),
        createImport({ sourcePath: 'src/services/api.ts', targetPath: 'src/config.ts' }),

        // Utils imports
        createImport({ sourcePath: 'src/utils/http.ts', targetPath: 'src/utils/logger.ts' }),
        createImport({ sourcePath: 'src/utils/http.ts', targetPath: 'src/types.ts' }),
      ];

      const deps = buildDependencyMap(imports);
      const reverseDeps = buildReverseDependencyMap(imports);
      const edges = createImportEdges(imports);

      // types.ts should be widely imported (3 importers)
      expect(reverseDeps.get('src/types.ts')?.size).toBe(3);

      // index.ts should have no importers
      expect(reverseDeps.has('src/index.ts')).toBe(false);

      // All edges should be valid
      expect(edges).toHaveLength(10);
      for (const edge of edges) {
        expect(edge.type).toBe('imports');
        expect(edge.source).toBeTruthy();
        expect(edge.target).toBeTruthy();
      }

      // api.ts and app.ts should have moderate coupling (shared deps)
      const couplingApiApp = calculateCouplingScore(
        'src/services/api.ts',
        'src/app.ts',
        deps,
        reverseDeps
      );
      expect(couplingApiApp).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle type-only imports correctly', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/types.ts',
          symbols: ['User', 'Config'],
          isDefault: false,
          isTypeOnly: true,
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges[0].metadata?.isTypeOnly).toBe(true);
    });

    it('should handle mixed default and named imports', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/lib.ts',
          symbols: ['default', 'helper', 'util'],
          isDefault: true,
          isNamespace: false,
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges[0].metadata?.symbols).toContain('default');
      expect(edges[0].metadata?.symbols).toContain('helper');
    });

    it('should handle aliased imports', () => {
      const imports: ImportInfo[] = [
        createImport({
          sourcePath: 'src/app.ts',
          targetPath: 'src/utils.ts',
          symbols: ['original as aliased', 'another'],
        }),
      ];

      const edges = createImportEdges(imports);

      expect(edges[0].metadata?.symbols).toContain('original as aliased');
    });

    it('should handle re-exports', () => {
      const exports: ExportInfo[] = [
        { name: 'reExported', isDefault: false, isReExport: true, originalSource: './other.ts' },
      ];

      const relationships = getFileRelationships('src/barrel.ts', [], exports, new Map());

      expect(relationships.exports[0].name).toBe('reExported');
    });
  });
});
