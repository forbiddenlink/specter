/**
 * AST Analyzer
 *
 * Uses ts-morph to analyze TypeScript/JavaScript files and extract
 * structural information for the knowledge graph.
 */

import path from 'node:path';
import fg from 'fast-glob';
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';
import type { ClassNode, FileNode, FunctionNode, GraphNode, NodeType } from '../graph/types.js';

/**
 * Safely get return type with timeout to prevent hanging on complex types
 * TypeScript's type inference can hang indefinitely on complex conditional/mapped types
 */
function safeGetReturnType(
  func: { getReturnType: () => { getText: () => string } },
  timeoutMs: number = 100
): string | undefined {
  try {
    // Use a simple approach: just get the declared return type annotation if present
    // Avoid full type inference which can hang on complex types
    const funcNode = func as unknown as {
      getReturnTypeNode?: () => { getText: () => string } | undefined;
    };
    if (funcNode.getReturnTypeNode) {
      const typeNode = funcNode.getReturnTypeNode();
      if (typeNode) {
        return typeNode.getText();
      }
    }
    // If no explicit return type annotation, skip inference to avoid hanging
    return undefined;
  } catch {
    return undefined;
  }
}

export interface ASTAnalysisResult {
  fileNode: FileNode;
  symbolNodes: GraphNode[];
}

/**
 * Calculate cyclomatic complexity for a function-like node
 */
function calculateComplexity(node: Node): number {
  let complexity = 1; // Base complexity

  node.forEachDescendant((descendant) => {
    switch (descendant.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ConditionalExpression: // ternary
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CaseClause:
      case SyntaxKind.CatchClause:
      case SyntaxKind.ConditionalType:
        complexity++;
        break;
      case SyntaxKind.BinaryExpression: {
        const text = descendant.getText();
        if (text.includes('&&') || text.includes('||') || text.includes('??')) {
          complexity++;
        }
        break;
      }
    }
  });

  return complexity;
}

/**
 * Get the language type from file extension
 */
function getLanguage(filePath: string): 'typescript' | 'javascript' | 'jsx' | 'tsx' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.jsx':
      return 'jsx';
    default:
      return 'javascript';
  }
}

/**
 * Create a unique ID for a node
 */
function createNodeId(filePath: string, name: string, type: NodeType, line: number): string {
  return `${filePath}:${type}:${name}:${line}`;
}

/**
 * Analyze a single source file
 */
export function analyzeSourceFile(sourceFile: SourceFile, rootDir: string): ASTAnalysisResult {
  const filePath = path.relative(rootDir, sourceFile.getFilePath());
  const symbolNodes: GraphNode[] = [];
  const imports = sourceFile.getImportDeclarations();
  const exports = sourceFile.getExportedDeclarations();

  // Create file node
  const fileNode: FileNode = {
    id: filePath,
    type: 'file',
    name: path.basename(filePath),
    filePath,
    lineStart: 1,
    lineEnd: sourceFile.getEndLineNumber(),
    exported: false,
    language: getLanguage(filePath),
    lineCount: sourceFile.getEndLineNumber(),
    importCount: imports.length,
    exportCount: exports.size,
  };

  // Analyze functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    const name = func.getName() || '<anonymous>';
    const lineStart = func.getStartLineNumber();
    const isExported = func.isExported();

    const funcNode: FunctionNode = {
      id: createNodeId(filePath, name, 'function', lineStart),
      type: 'function',
      name,
      filePath,
      lineStart,
      lineEnd: func.getEndLineNumber(),
      exported: isExported,
      complexity: calculateComplexity(func),
      parameters: func.getParameters().map((p) => p.getName()),
      returnType: safeGetReturnType(func),
      isAsync: func.isAsync(),
      isGenerator: func.isGenerator(),
      documentation:
        func
          .getJsDocs()
          .map((d) => d.getDescription())
          .join('\n') || undefined,
    };

    symbolNodes.push(funcNode);
  }

  // Analyze classes
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    const name = cls.getName() || '<anonymous>';
    const lineStart = cls.getStartLineNumber();
    const isExported = cls.isExported();

    const classNode: ClassNode = {
      id: createNodeId(filePath, name, 'class', lineStart),
      type: 'class',
      name,
      filePath,
      lineStart,
      lineEnd: cls.getEndLineNumber(),
      exported: isExported,
      complexity: calculateComplexity(cls),
      isAbstract: cls.isAbstract(),
      extends: cls.getExtends()?.getText(),
      implements: cls.getImplements().map((i) => i.getText()),
      memberCount: cls.getMembers().length,
      documentation:
        cls
          .getJsDocs()
          .map((d) => d.getDescription())
          .join('\n') || undefined,
    };

    symbolNodes.push(classNode);

    // Analyze class methods
    const methods = cls.getMethods();
    for (const method of methods) {
      const methodName = method.getName();
      const methodLine = method.getStartLineNumber();

      const methodNode: FunctionNode = {
        id: createNodeId(filePath, `${name}.${methodName}`, 'function', methodLine),
        type: 'function',
        name: `${name}.${methodName}`,
        filePath,
        lineStart: methodLine,
        lineEnd: method.getEndLineNumber(),
        exported: isExported,
        complexity: calculateComplexity(method),
        parameters: method.getParameters().map((p) => p.getName()),
        returnType: safeGetReturnType(method),
        isAsync: method.isAsync(),
        isGenerator: method.isGenerator(),
        documentation:
          method
            .getJsDocs()
            .map((d) => d.getDescription())
            .join('\n') || undefined,
      };

      symbolNodes.push(methodNode);
    }
  }

  // Analyze interfaces
  const interfaces = sourceFile.getInterfaces();
  for (const iface of interfaces) {
    const name = iface.getName();
    const lineStart = iface.getStartLineNumber();

    const interfaceNode: GraphNode = {
      id: createNodeId(filePath, name, 'interface', lineStart),
      type: 'interface',
      name,
      filePath,
      lineStart,
      lineEnd: iface.getEndLineNumber(),
      exported: iface.isExported(),
      documentation:
        iface
          .getJsDocs()
          .map((d) => d.getDescription())
          .join('\n') || undefined,
    };

    symbolNodes.push(interfaceNode);
  }

  // Analyze type aliases
  const typeAliases = sourceFile.getTypeAliases();
  for (const typeAlias of typeAliases) {
    const name = typeAlias.getName();
    const lineStart = typeAlias.getStartLineNumber();

    const typeNode: GraphNode = {
      id: createNodeId(filePath, name, 'type', lineStart),
      type: 'type',
      name,
      filePath,
      lineStart,
      lineEnd: typeAlias.getEndLineNumber(),
      exported: typeAlias.isExported(),
      documentation:
        typeAlias
          .getJsDocs()
          .map((d) => d.getDescription())
          .join('\n') || undefined,
    };

    symbolNodes.push(typeNode);
  }

  // Analyze enums
  const enums = sourceFile.getEnums();
  for (const enumDecl of enums) {
    const name = enumDecl.getName();
    const lineStart = enumDecl.getStartLineNumber();

    const enumNode: GraphNode = {
      id: createNodeId(filePath, name, 'enum', lineStart),
      type: 'enum',
      name,
      filePath,
      lineStart,
      lineEnd: enumDecl.getEndLineNumber(),
      exported: enumDecl.isExported(),
      documentation:
        enumDecl
          .getJsDocs()
          .map((d) => d.getDescription())
          .join('\n') || undefined,
    };

    symbolNodes.push(enumNode);
  }

  // Analyze exported variables/constants
  const variables = sourceFile.getVariableDeclarations();
  for (const variable of variables) {
    const statement = variable.getVariableStatement();
    if (!statement?.isExported()) continue;

    const name = variable.getName();
    const lineStart = variable.getStartLineNumber();

    const varNode: GraphNode = {
      id: createNodeId(filePath, name, 'variable', lineStart),
      type: 'variable',
      name,
      filePath,
      lineStart,
      lineEnd: variable.getEndLineNumber(),
      exported: true,
    };

    symbolNodes.push(varNode);
  }

  // Calculate aggregate file complexity
  const totalComplexity = symbolNodes
    .filter((n) => n.complexity !== undefined)
    .reduce((sum, n) => sum + (n.complexity || 0), 0);
  fileNode.complexity = totalComplexity;

  return { fileNode, symbolNodes };
}

/**
 * Create a ts-morph project for analysis
 */
export function createProject(rootDir: string): Project {
  // Try to find tsconfig.json
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');

  try {
    return new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  } catch {
    // No tsconfig found, create a basic project
    return new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        allowJs: true,
        checkJs: false,
        strict: false,
        skipLibCheck: true,
      },
    });
  }
}

/**
 * Get all source files in a directory
 * Uses glob with exclusions BEFORE loading to prevent OOM on large node_modules
 */
export function getSourceFiles(
  project: Project,
  rootDir: string,
  patterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
): SourceFile[] {
  const excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/.pnpm-store/**',
    '**/.pnpm/**',
    '**/vendor/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/playwright-report/**',
    '**/.history/**', // VS Code history
    '**/out/**', // Common build output
    '**/.turbo/**', // Turborepo cache
    '**/.vercel/**', // Vercel cache
    '**/.cache/**', // Generic cache
    '**/temp/**', // Temp files
    '**/.tmp/**', // Temp files
    '**/generated/**', // Generated code often has complex types
    '**/*.generated.ts', // Generated TypeScript
    '**/*.generated.tsx', // Generated TSX
    '**/swagger/**', // Swagger/OpenAPI generated
    '**/prisma/client/**', // Prisma client (complex types)
  ];

  // Use glob with ignore to prevent loading excluded files into memory
  const filePaths: string[] = fg.sync(patterns, {
    cwd: rootDir,
    absolute: true,
    ignore: excludePatterns,
  });

  // Add only the filtered files to the project
  for (const filePath of filePaths) {
    try {
      project.addSourceFileAtPath(filePath);
    } catch {
      // Skip files that can't be parsed
    }
  }

  return project.getSourceFiles();
}
