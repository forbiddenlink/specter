#!/usr/bin/env npx tsx
/**
 * Specter File Risk Warning Hook
 *
 * Triggers on PreToolUse:Edit and PreToolUse:Write to warn about risky files.
 * Speaks as the codebase, providing context about what the developer is touching.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
  };
}

interface GraphNode {
  type: string;
  filePath: string;
  complexity?: number;
  modificationCount?: number;
  contributors?: string[];
  lastModified?: string;
}

interface KnowledgeGraph {
  nodes: Record<string, GraphNode>;
  edges: Array<{ source: string; target: string; type: string }>;
}

interface HookOutput {
  result: 'continue' | 'block';
  message?: string;
}

async function main() {
  // Read input from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input: HookInput = JSON.parse(Buffer.concat(chunks).toString());

  // Only process Edit and Write tools
  if (!['Edit', 'Write'].includes(input.tool_name)) {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  const filePath = input.tool_input.file_path;
  if (!filePath) {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  // Load graph if available
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const graphPath = join(projectDir, '.specter', 'graph.json');

  if (!existsSync(graphPath)) {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  try {
    const graph: KnowledgeGraph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    const warnings = analyzeFileRisk(graph, filePath, projectDir);

    if (warnings.length > 0) {
      const output: HookOutput = {
        result: 'continue',
        message: `👻 **Specter Warning**\n\n${warnings.join('\n\n')}`,
      };
      console.log(JSON.stringify(output));
    } else {
      console.log(JSON.stringify({ result: 'continue' }));
    }
  } catch {
    console.log(JSON.stringify({ result: 'continue' }));
  }
}

function analyzeFileRisk(graph: KnowledgeGraph, filePath: string, projectDir: string): string[] {
  const warnings: string[] = [];

  // Normalize path (remove project dir prefix if present)
  const relativePath = filePath.replace(`${projectDir}/`, '').replace(projectDir, '');

  // Find the file node
  const fileNode = graph.nodes[relativePath];
  if (!fileNode) {
    return warnings;
  }

  // Check complexity
  const maxComplexity = getMaxComplexity(graph, relativePath);
  if (maxComplexity >= 15) {
    warnings.push(
      `⚠️ **High complexity file** (max: ${maxComplexity})\n` +
        `This is one of my more tangled areas. Consider breaking changes into smaller pieces.`
    );
  }

  // Check dependency count
  const dependentCount = countDependents(graph, relativePath);
  if (dependentCount >= 5) {
    warnings.push(
      `🔗 **${dependentCount} files depend on this**\n` +
        `Changes here will ripple. Be careful with exports and interfaces.`
    );
  }

  // Check contributor concentration
  if (fileNode.contributors && fileNode.contributors.length === 1) {
    const owner = fileNode.contributors[0];
    warnings.push(
      `👤 **Single owner: ${owner}**\n` +
        `Only one person has touched this file. They may have context you don't.`
    );
  }

  // Check staleness
  if (fileNode.lastModified) {
    const daysSince = Math.floor(
      (Date.now() - new Date(fileNode.lastModified).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince > 180) {
      warnings.push(
        `💤 **Stale file** (${Math.floor(daysSince / 30)} months untouched)\n` +
          `This code hasn't been modified in a while. The original context may be lost.`
      );
    }
  }

  // Check high churn
  if (fileNode.modificationCount && fileNode.modificationCount > 30) {
    warnings.push(
      `🔥 **High churn file** (${fileNode.modificationCount} modifications)\n` +
        `This file changes frequently. It may be fragile or poorly abstracted.`
    );
  }

  return warnings;
}

function getMaxComplexity(graph: KnowledgeGraph, filePath: string): number {
  let max = 0;
  for (const node of Object.values(graph.nodes)) {
    if (node.filePath === filePath && node.complexity) {
      max = Math.max(max, node.complexity);
    }
  }
  return max;
}

function countDependents(graph: KnowledgeGraph, filePath: string): number {
  const dependents = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.type === 'imports') {
      const targetNode = graph.nodes[edge.target];
      if (targetNode?.filePath === filePath) {
        const sourceNode = graph.nodes[edge.source];
        if (sourceNode?.filePath && sourceNode.filePath !== filePath) {
          dependents.add(sourceNode.filePath);
        }
      }
    }
  }

  return dependents.size;
}

main().catch(() => {
  console.log(JSON.stringify({ result: 'continue' }));
});
