/**
 * AST Analyzer Tests
 *
 * Tests for the AST analysis functionality including file parsing,
 * function extraction, class analysis, and complexity calculation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project, type SourceFile } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzeSourceFile, createProject, getSourceFiles } from '../../src/analyzers/ast.js';

describe('AST Analyzer', () => {
  let tempDir: string;
  let project: Project;

  beforeAll(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-test-'));
    project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        strict: true,
      },
    });
  });

  afterAll(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test file and add it to the project
   */
  function createTestFile(filename: string, content: string): SourceFile {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return project.addSourceFileAtPath(filePath);
  }

  describe('analyzeSourceFile', () => {
    it('should create a file node with correct metadata', () => {
      const sourceFile = createTestFile(
        'simple.ts',
        `
export const greeting = 'Hello';
export function sayHello(name: string): string {
  return greeting + ' ' + name;
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      expect(result.fileNode).toBeDefined();
      expect(result.fileNode.type).toBe('file');
      expect(result.fileNode.name).toBe('simple.ts');
      expect(result.fileNode.language).toBe('typescript');
      expect(result.fileNode.importCount).toBe(0);
      expect(result.fileNode.exportCount).toBe(2);
    });

    it('should extract function declarations', () => {
      const sourceFile = createTestFile(
        'functions.ts',
        `
export function greet(name: string): string {
  return 'Hello ' + name;
}

export async function fetchData(url: string): Promise<string> {
  return 'data';
}

function privateHelper(): void {
  console.log('private');
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const functions = result.symbolNodes.filter((n) => n.type === 'function');
      expect(functions).toHaveLength(3);

      const greet = functions.find((f) => f.name === 'greet');
      expect(greet).toBeDefined();
      expect(greet!.exported).toBe(true);
      expect((greet as any).isAsync).toBe(false);
      expect((greet as any).parameters).toEqual(['name']);

      const fetchData = functions.find((f) => f.name === 'fetchData');
      expect(fetchData).toBeDefined();
      expect((fetchData as any).isAsync).toBe(true);

      const privateHelper = functions.find((f) => f.name === 'privateHelper');
      expect(privateHelper).toBeDefined();
      expect(privateHelper!.exported).toBe(false);
    });

    it('should extract class declarations', () => {
      const sourceFile = createTestFile(
        'classes.ts',
        `
export class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  speak(): string {
    return this.name + ' makes a sound';
  }
}

export abstract class Shape {
  abstract getArea(): number;
}

class Dog extends Animal {
  bark(): string {
    return 'Woof!';
  }
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const classes = result.symbolNodes.filter((n) => n.type === 'class');
      expect(classes).toHaveLength(3);

      const animal = classes.find((c) => c.name === 'Animal');
      expect(animal).toBeDefined();
      expect(animal!.exported).toBe(true);
      expect((animal as any).isAbstract).toBe(false);

      const shape = classes.find((c) => c.name === 'Shape');
      expect(shape).toBeDefined();
      expect((shape as any).isAbstract).toBe(true);

      const dog = classes.find((c) => c.name === 'Dog');
      expect(dog).toBeDefined();
      expect((dog as any).extends).toBe('Animal');
    });

    it('should extract class methods as function nodes', () => {
      const sourceFile = createTestFile(
        'methods.ts',
        `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  async multiply(a: number, b: number): Promise<number> {
    return a * b;
  }
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const methods = result.symbolNodes.filter(
        (n) => n.type === 'function' && n.name.includes('.')
      );
      expect(methods).toHaveLength(2);

      const add = methods.find((m) => m.name === 'Calculator.add');
      expect(add).toBeDefined();
      expect((add as any).parameters).toEqual(['a', 'b']);

      const multiply = methods.find((m) => m.name === 'Calculator.multiply');
      expect(multiply).toBeDefined();
      expect((multiply as any).isAsync).toBe(true);
    });

    it('should extract interfaces', () => {
      const sourceFile = createTestFile(
        'interfaces.ts',
        `
export interface User {
  id: string;
  name: string;
  email: string;
}

interface InternalConfig {
  debug: boolean;
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const interfaces = result.symbolNodes.filter((n) => n.type === 'interface');
      expect(interfaces).toHaveLength(2);

      const user = interfaces.find((i) => i.name === 'User');
      expect(user).toBeDefined();
      expect(user!.exported).toBe(true);

      const config = interfaces.find((i) => i.name === 'InternalConfig');
      expect(config).toBeDefined();
      expect(config!.exported).toBe(false);
    });

    it('should extract type aliases', () => {
      const sourceFile = createTestFile(
        'types.ts',
        `
export type ID = string | number;

export type Status = 'active' | 'inactive' | 'pending';

type InternalType = {
  value: number;
};
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const types = result.symbolNodes.filter((n) => n.type === 'type');
      expect(types).toHaveLength(3);

      const id = types.find((t) => t.name === 'ID');
      expect(id).toBeDefined();
      expect(id!.exported).toBe(true);
    });

    it('should extract enums', () => {
      const sourceFile = createTestFile(
        'enums.ts',
        `
export enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

enum Direction {
  Up,
  Down,
  Left,
  Right,
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const enums = result.symbolNodes.filter((n) => n.type === 'enum');
      expect(enums).toHaveLength(2);

      const color = enums.find((e) => e.name === 'Color');
      expect(color).toBeDefined();
      expect(color!.exported).toBe(true);

      const direction = enums.find((e) => e.name === 'Direction');
      expect(direction).toBeDefined();
      expect(direction!.exported).toBe(false);
    });

    it('should extract exported variables', () => {
      const sourceFile = createTestFile(
        'variables.ts',
        `
export const API_URL = 'https://api.example.com';
export const MAX_RETRIES = 3;
const privateVar = 'secret';
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const variables = result.symbolNodes.filter((n) => n.type === 'variable');
      expect(variables).toHaveLength(2);
      expect(variables.every((v) => v.exported)).toBe(true);
    });

    it('should calculate complexity for functions', () => {
      const sourceFile = createTestFile(
        'complex.ts',
        `
export function simpleFunction(): number {
  return 42;
}

export function moderateComplexity(x: number): string {
  if (x > 10) {
    return 'large';
  } else if (x > 5) {
    return 'medium';
  } else {
    return 'small';
  }
}

export function highComplexity(items: string[]): number {
  let count = 0;
  for (const item of items) {
    if (item.startsWith('a')) {
      count++;
    } else if (item.startsWith('b')) {
      count += 2;
    }
    for (let i = 0; i < item.length; i++) {
      if (item[i] === 'x') {
        count++;
      }
    }
  }
  return count;
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const functions = result.symbolNodes.filter((n) => n.type === 'function');

      const simple = functions.find((f) => f.name === 'simpleFunction');
      expect(simple!.complexity).toBe(1);

      const moderate = functions.find((f) => f.name === 'moderateComplexity');
      expect(moderate!.complexity).toBeGreaterThan(1);

      const high = functions.find((f) => f.name === 'highComplexity');
      expect(high!.complexity).toBeGreaterThan(moderate!.complexity!);
    });

    it('should aggregate file complexity', () => {
      const sourceFile = createTestFile(
        'aggregate.ts',
        `
export function func1(x: number): number {
  if (x > 0) return x;
  return -x;
}

export function func2(a: boolean, b: boolean): boolean {
  if (a && b) return true;
  if (a || b) return false;
  return true;
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      // File complexity should be the sum of function complexities
      expect(result.fileNode.complexity).toBeGreaterThan(0);

      const funcs = result.symbolNodes.filter((n) => n.type === 'function');
      const totalFuncComplexity = funcs.reduce((sum, f) => sum + (f.complexity || 0), 0);
      expect(result.fileNode.complexity).toBe(totalFuncComplexity);
    });

    it('should handle JSDoc comments', () => {
      const sourceFile = createTestFile(
        'jsdoc.ts',
        `
/**
 * Adds two numbers together
 * @param a First number
 * @param b Second number
 * @returns The sum
 */
export function add(a: number, b: number): number {
  return a + b;
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const add = result.symbolNodes.find((n) => n.name === 'add');
      expect(add).toBeDefined();
      expect(add!.documentation).toContain('Adds two numbers together');
    });

    it('should detect generator functions', () => {
      const sourceFile = createTestFile(
        'generator.ts',
        `
export function* countUp(max: number): Generator<number> {
  for (let i = 0; i <= max; i++) {
    yield i;
  }
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const generator = result.symbolNodes.find((n) => n.name === 'countUp');
      expect(generator).toBeDefined();
      expect((generator as any).isGenerator).toBe(true);
    });

    it('should handle class inheritance and implements', () => {
      const sourceFile = createTestFile(
        'inheritance.ts',
        `
interface Printable {
  print(): void;
}

interface Serializable {
  serialize(): string;
}

export class Document implements Printable, Serializable {
  print(): void {
    console.log('printing');
  }
  serialize(): string {
    return '{}';
  }
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);

      const doc = result.symbolNodes.find((n) => n.name === 'Document');
      expect(doc).toBeDefined();
      expect((doc as any).implements).toEqual(['Printable', 'Serializable']);
    });
  });

  describe('createProject', () => {
    it('should create a project without tsconfig', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-empty-'));

      try {
        const proj = createProject(emptyDir);
        expect(proj).toBeDefined();
        expect(proj.getSourceFiles()).toHaveLength(0);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('should create a project with tsconfig', () => {
      const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-config-'));
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          strict: true,
        },
      };
      fs.writeFileSync(path.join(configDir, 'tsconfig.json'), JSON.stringify(tsconfig));

      try {
        const proj = createProject(configDir);
        expect(proj).toBeDefined();
      } finally {
        fs.rmSync(configDir, { recursive: true, force: true });
      }
    });
  });

  describe('getSourceFiles', () => {
    it('should find TypeScript files', () => {
      const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-src-'));
      fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'util.ts'), 'export const y = 2;');

      try {
        const proj = new Project();
        const files = getSourceFiles(proj, srcDir, ['**/*.ts']);
        expect(files.length).toBeGreaterThanOrEqual(2);
      } finally {
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    });

    it('should exclude node_modules', () => {
      const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-nm-'));
      fs.mkdirSync(path.join(srcDir, 'node_modules'));
      fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'node_modules', 'lib.ts'), 'export const y = 2;');

      try {
        const proj = new Project();
        const files = getSourceFiles(proj, srcDir, ['**/*.ts']);
        const filePaths = files.map((f) => f.getFilePath());
        expect(filePaths.some((p) => p.includes('node_modules'))).toBe(false);
      } finally {
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    });

    it('should exclude test files', () => {
      const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specter-test-'));
      fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'main.test.ts'), 'test("x", () => {});');
      fs.writeFileSync(path.join(srcDir, 'main.spec.ts'), 'describe("x", () => {});');

      try {
        const proj = new Project();
        const files = getSourceFiles(proj, srcDir, ['**/*.ts']);
        const filePaths = files.map((f) => f.getFilePath());
        expect(filePaths.some((p) => p.includes('.test.ts'))).toBe(false);
        expect(filePaths.some((p) => p.includes('.spec.ts'))).toBe(false);
      } finally {
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    });
  });

  describe('Language detection', () => {
    it('should detect TypeScript files', () => {
      const sourceFile = createTestFile('app.ts', 'export const x: number = 1;');
      const result = analyzeSourceFile(sourceFile, tempDir);
      expect(result.fileNode.language).toBe('typescript');
    });

    it('should detect TSX files', () => {
      const sourceFile = createTestFile(
        'component.tsx',
        'export const App = () => <div>Hello</div>;'
      );
      const result = analyzeSourceFile(sourceFile, tempDir);
      expect(result.fileNode.language).toBe('tsx');
    });

    it('should detect JavaScript files', () => {
      const sourceFile = createTestFile('script.js', 'export const x = 1;');
      const result = analyzeSourceFile(sourceFile, tempDir);
      expect(result.fileNode.language).toBe('javascript');
    });

    it('should detect JSX files', () => {
      const sourceFile = createTestFile(
        'component.jsx',
        'export const App = () => <div>Hello</div>;'
      );
      const result = analyzeSourceFile(sourceFile, tempDir);
      expect(result.fileNode.language).toBe('jsx');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', () => {
      const sourceFile = createTestFile('empty.ts', '');
      const result = analyzeSourceFile(sourceFile, tempDir);
      expect(result.fileNode).toBeDefined();
      expect(result.symbolNodes).toHaveLength(0);
    });

    it('should handle anonymous functions', () => {
      const sourceFile = createTestFile(
        'anon.ts',
        `
export default function(): void {
  console.log('anonymous');
}
      `.trim()
      );

      const result = analyzeSourceFile(sourceFile, tempDir);
      const funcs = result.symbolNodes.filter((n) => n.type === 'function');
      expect(funcs).toHaveLength(1);
      expect(funcs[0].name).toBe('<anonymous>');
    });

    it('should handle files with syntax errors gracefully', () => {
      // ts-morph should still parse partial content
      const sourceFile = createTestFile(
        'partial.ts',
        `
export function valid(): void {}
// Missing closing brace below intentionally
export function broken(): void {
      `.trim()
      );

      // Should not throw
      expect(() => analyzeSourceFile(sourceFile, tempDir)).not.toThrow();
    });
  });
});
