/**
 * Knowledge Graph Types
 *
 * Defines the structure of the codebase knowledge graph.
 */

export type NodeType = 'file' | 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';

export type EdgeType = 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'uses' | 'contains';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  complexity?: number;
  lastModified?: string;
  modificationCount?: number;
  contributors?: string[];
  documentation?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface FileNode extends GraphNode {
  type: 'file';
  language: 'typescript' | 'javascript' | 'jsx' | 'tsx';
  lineCount: number;
  importCount: number;
  exportCount: number;
}

export interface FunctionNode extends GraphNode {
  type: 'function';
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
}

export interface ClassNode extends GraphNode {
  type: 'class';
  isAbstract: boolean;
  extends?: string;
  implements?: string[];
  memberCount: number;
}

export interface GraphMetadata {
  scannedAt: string;
  scanDurationMs: number;
  rootDir: string;
  fileCount: number;
  totalLines: number;
  languages: Record<string, number>;
  nodeCount: number;
  edgeCount: number;
}

export interface KnowledgeGraph {
  version: string;
  metadata: GraphMetadata;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

export interface ComplexityHotspot {
  filePath: string;
  name: string;
  type: NodeType;
  complexity: number;
  lineStart: number;
  lineEnd: number;
}

export interface FileRelationship {
  filePath: string;
  imports: Array<{
    source: string;
    symbols: string[];
    isDefault: boolean;
  }>;
  importedBy: Array<{
    filePath: string;
    symbols: string[];
  }>;
  exports: Array<{
    name: string;
    type: NodeType;
    isDefault: boolean;
  }>;
}

export interface CodebaseStats {
  files: number;
  lines: number;
  functions: number;
  classes: number;
  interfaces: number;
  types: number;
  enums: number;
  avgComplexity: number;
  maxComplexity: number;
  hotspotCount: number;
  deadCodeCount: number;
}

export interface GitFileHistory {
  filePath: string;
  lastModified: string;
  commitCount: number;
  contributorCount: number;
  contributors: Array<{
    name: string;
    email: string;
    commits: number;
    lastCommit: string;
  }>;
  recentCommits: Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>;
}

export interface ChangeCoupling {
  file1: string;
  file2: string;
  couplingStrength: number; // 0-1, percentage of times they change together
  sharedCommits: number;
  totalCommitsFile1: number;
  totalCommitsFile2: number;
  hasImportRelationship: boolean;
  recentExamples: Array<{
    hash: string;
    message: string;
    date: string;
  }>;
}

export interface ChangeCouplingResult {
  targetFile: string;
  coupledFiles: ChangeCoupling[];
  insights: string[];
}

export interface KnowledgeRisk {
  path: string;
  type: 'file' | 'directory';
  busFactor: number; // Number of people who understand this (1 = critical)
  primaryOwner: string;
  ownershipPercentage: number;
  totalContributors: number;
  lastTouchedBy: string;
  daysSinceLastChange: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface BusFactorAnalysis {
  overallBusFactor: number;
  criticalAreas: KnowledgeRisk[];
  ownershipDistribution: Array<{
    contributor: string;
    filesOwned: number;
    percentage: number;
  }>;
  insights: string[];
}
