/**
 * Neo4j Visualization Integration
 *
 * Export graph data to visualization formats and import from visualization tools.
 */

import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { executeRead, executeWrite } from './client.js';
import type {
  CytoscapeData,
  D3ForceData,
  GraphNode,
  Relationship,
  VisualizationData,
  VisualizationEdge,
  VisualizationFormat,
  VisualizationNode,
} from './types.js';

/**
 * Export graph data to a visualization format
 */
export async function exportToVisualization(
  driver: Driver,
  format: VisualizationFormat,
  options: { labels?: string[]; relationshipTypes?: string[]; limit?: number } = {},
  database?: string
): Promise<VisualizationData | CytoscapeData | D3ForceData | string> {
  const data = await getGraphData(driver, options, database);

  switch (format) {
    case 'cytoscape':
      return exportToCytoscape(data);
    case 'd3':
      return exportToD3(data);
    case 'graphviz':
      return exportToGraphviz(data);
    case 'vis':
      return exportToVis(data);
    case 'sigma':
      return exportToSigma(data);
    default:
      return data;
  }
}

/**
 * Import visualization data into Neo4j
 */
export async function importFromVisualization(
  driver: Driver,
  data: VisualizationData | CytoscapeData | D3ForceData,
  format: VisualizationFormat,
  options: { merge?: boolean; clearExisting?: boolean } = {},
  database?: string
): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
  const { merge = true, clearExisting = false } = options;

  // Convert to unified format
  let unified: VisualizationData;
  switch (format) {
    case 'cytoscape':
      unified = importFromCytoscape(data as CytoscapeData);
      break;
    case 'd3':
      unified = importFromD3(data as D3ForceData);
      break;
    default:
      unified = data as VisualizationData;
  }

  return executeWrite(
    driver,
    async (tx: ManagedTransaction) => {
      if (clearExisting) {
        await tx.run('MATCH (n) DETACH DELETE n');
      }

      let nodesCreated = 0;
      let relationshipsCreated = 0;

      // Create nodes
      for (const node of unified.nodes) {
        const labels = node.type ? `:${node.type}` : ':Node';
        const clause = merge ? 'MERGE' : 'CREATE';
        const props = {
          id: node.id,
          name: node.label || node.id,
          ...node.properties,
        };

        if (merge) {
          await tx.run(`${clause} (n${labels} {id: $id}) SET n += $props`, {
            id: node.id,
            props,
          });
        } else {
          await tx.run(`${clause} (n${labels} $props)`, { props });
        }
        nodesCreated++;
      }

      // Create relationships
      for (const edge of unified.edges) {
        const relType = edge.type || 'RELATES_TO';
        const clause = merge ? 'MERGE' : 'CREATE';

        await tx.run(
          `
          MATCH (a {id: $sourceId})
          MATCH (b {id: $targetId})
          ${clause} (a)-[r:${relType}]->(b)
          SET r += $props
          `,
          {
            sourceId: edge.source,
            targetId: edge.target,
            props: edge.properties || {},
          }
        );
        relationshipsCreated++;
      }

      return { nodesCreated, relationshipsCreated };
    },
    database
  );
}

/**
 * Get raw graph data from Neo4j
 */
async function getGraphData(
  driver: Driver,
  options: { labels?: string[]; relationshipTypes?: string[]; limit?: number } = {},
  database?: string
): Promise<VisualizationData> {
  const { labels, relationshipTypes, limit = 1000 } = options;

  return executeRead(
    driver,
    async (tx: ManagedTransaction) => {
      // Build node query
      let nodeQuery = 'MATCH (n)';
      if (labels?.length) {
        nodeQuery = `MATCH (n) WHERE any(label IN labels(n) WHERE label IN $labels)`;
      }
      nodeQuery += ` RETURN n, elementId(n) as id, labels(n) as nodeLabels LIMIT ${limit}`;

      const nodesResult = await tx.run(nodeQuery, { labels: labels || [] });
      const nodes: VisualizationNode[] = nodesResult.records.map((record) => {
        const node = record.get('n');
        const nodeLabels = record.get('nodeLabels') as string[];
        return {
          id: record.get('id') as string,
          label: (node.properties.name as string) || (node.properties.id as string) || record.get('id') as string,
          type: nodeLabels[0] || 'Node',
          group: nodeLabels[0],
          properties: node.properties as Record<string, unknown>,
        };
      });

      const nodeIds = nodes.map((n) => n.id);

      // Build relationship query
      let relQuery = `
        MATCH (a)-[r]->(b)
        WHERE elementId(a) IN $nodeIds AND elementId(b) IN $nodeIds
      `;
      if (relationshipTypes?.length) {
        relQuery += ` AND type(r) IN $relTypes`;
      }
      relQuery += ` RETURN r, elementId(r) as id, elementId(a) as source, elementId(b) as target, type(r) as relType LIMIT ${limit}`;

      const relsResult = await tx.run(relQuery, {
        nodeIds,
        relTypes: relationshipTypes || [],
      });

      const edges: VisualizationEdge[] = relsResult.records.map((record) => {
        const rel = record.get('r');
        return {
          id: record.get('id') as string,
          source: record.get('source') as string,
          target: record.get('target') as string,
          type: record.get('relType') as string,
          label: record.get('relType') as string,
          properties: rel.properties as Record<string, unknown>,
        };
      });

      return { nodes, edges };
    },
    database
  );
}

/**
 * Export to Cytoscape.js format
 */
export function exportToCytoscape(data: VisualizationData): CytoscapeData {
  return {
    elements: {
      nodes: data.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          group: node.group,
          ...node.properties,
        },
        position: node.x !== undefined && node.y !== undefined
          ? { x: node.x, y: node.y }
          : undefined,
      })),
      edges: data.edges.map((edge) => ({
        data: {
          id: edge.id || `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          label: edge.label,
          weight: edge.weight,
          ...edge.properties,
        },
      })),
    },
  };
}

/**
 * Export to D3.js force graph format
 */
export function exportToD3(data: VisualizationData): D3ForceData {
  // Map group strings to numbers for D3
  const groupMap = new Map<string, number>();
  let groupCounter = 0;

  return {
    nodes: data.nodes.map((node) => {
      let groupNum = 0;
      if (node.group !== undefined) {
        if (typeof node.group === 'number') {
          groupNum = node.group;
        } else {
          if (!groupMap.has(node.group)) {
            groupMap.set(node.group, groupCounter++);
          }
          groupNum = groupMap.get(node.group)!;
        }
      }

      return {
        id: node.id,
        label: node.label,
        group: groupNum,
        type: node.type,
        ...node.properties,
      };
    }),
    links: data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: edge.weight || 1,
      type: edge.type,
      label: edge.label,
      ...edge.properties,
    })),
  };
}

/**
 * Export to GraphViz DOT format
 */
export function exportToGraphviz(data: VisualizationData): string {
  const lines: string[] = ['digraph G {'];
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box];');
  lines.push('');

  // Add nodes
  for (const node of data.nodes) {
    const label = (node.label || node.id).replace(/"/g, '\\"');
    const attrs = [`label="${label}"`];
    if (node.type) {
      attrs.push(`xlabel="${node.type}"`);
    }
    if (node.color) {
      attrs.push(`color="${node.color}"`);
    }
    lines.push(`  "${node.id}" [${attrs.join(', ')}];`);
  }

  lines.push('');

  // Add edges
  for (const edge of data.edges) {
    const attrs: string[] = [];
    if (edge.label) {
      attrs.push(`label="${edge.label}"`);
    }
    if (edge.weight) {
      attrs.push(`weight=${edge.weight}`);
    }
    const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  "${edge.source}" -> "${edge.target}"${attrStr};`);
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Export to vis.js format (similar to D3)
 */
function exportToVis(data: VisualizationData): VisualizationData {
  // vis.js uses similar format to our unified format
  return {
    nodes: data.nodes.map((node) => ({
      ...node,
      label: node.label || node.id,
    })),
    edges: data.edges.map((edge) => ({
      ...edge,
      from: edge.source,
      to: edge.target,
    } as VisualizationEdge)),
  };
}

/**
 * Export to Sigma.js format
 */
function exportToSigma(data: VisualizationData): VisualizationData {
  // Sigma uses similar format with x, y coordinates
  return {
    nodes: data.nodes.map((node, index) => ({
      ...node,
      x: node.x ?? Math.cos((2 * Math.PI * index) / data.nodes.length) * 100,
      y: node.y ?? Math.sin((2 * Math.PI * index) / data.nodes.length) * 100,
      size: node.size ?? 10,
    })),
    edges: data.edges,
  };
}

/**
 * Import from Cytoscape.js format
 */
export function importFromCytoscape(data: CytoscapeData): VisualizationData {
  return {
    nodes: data.elements.nodes.map((n) => ({
      id: n.data['id'] as string,
      label: (n.data['label'] as string) || (n.data['id'] as string),
      type: n.data['type'] as string,
      group: n.data['group'] as string | number,
      properties: n.data,
      x: n.position?.x,
      y: n.position?.y,
    })),
    edges: data.elements.edges.map((e) => ({
      id: e.data['id'] as string,
      source: e.data['source'] as string,
      target: e.data['target'] as string,
      type: e.data['type'] as string,
      label: e.data['label'] as string,
      weight: e.data['weight'] as number,
      properties: e.data,
    })),
  };
}

/**
 * Import from D3.js format
 */
export function importFromD3(data: D3ForceData): VisualizationData {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      label: (n['label'] as string) || n.id,
      type: n['type'] as string,
      group: n.group,
      properties: n,
    })),
    edges: data.links.map((l, index) => ({
      id: `edge-${index}`,
      source: l.source,
      target: l.target,
      type: l['type'] as string,
      label: l['label'] as string,
      weight: l.value,
      properties: l,
    })),
  };
}

/**
 * Convert specter KnowledgeGraph to visualization format
 */
export function toVisualizationFormat(
  nodes: Record<string, GraphNode>,
  relationships: Relationship[]
): VisualizationData {
  const visNodes: VisualizationNode[] = Object.values(nodes).map((node) => ({
    id: node.id,
    label: (node.properties['name'] as string) || node.id,
    type: node.labels[0],
    group: node.labels[0],
    properties: node.properties,
  }));

  const visEdges: VisualizationEdge[] = relationships.map((rel) => ({
    id: rel.id,
    source: rel.startNode,
    target: rel.endNode,
    type: rel.type,
    label: rel.type,
    properties: rel.properties,
  }));

  return { nodes: visNodes, edges: visEdges };
}

/**
 * Convert visualization format to specter KnowledgeGraph structures
 */
export function fromVisualizationFormat(
  data: VisualizationData
): { nodes: Record<string, GraphNode>; relationships: Relationship[] } {
  const nodes: Record<string, GraphNode> = {};

  for (const visNode of data.nodes) {
    nodes[visNode.id] = {
      id: visNode.id,
      labels: visNode.type ? [visNode.type] : ['Node'],
      properties: {
        name: visNode.label,
        ...visNode.properties,
      },
    };
  }

  const relationships: Relationship[] = data.edges.map((edge, index) => ({
    id: edge.id || `rel-${index}`,
    type: edge.type || 'RELATES_TO',
    startNode: edge.source,
    endNode: edge.target,
    properties: edge.properties || {},
  }));

  return { nodes, relationships };
}
