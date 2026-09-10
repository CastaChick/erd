import { UndirectedGraph } from 'graphology';
import { compare, idOf, sourceId, targetId, type SchemaGraph } from '../schema-graph/types.js';

export function analysisGraph(schema: SchemaGraph): UndirectedGraph {
  const graph = new UndirectedGraph({ allowSelfLoops: false });
  schema.tables.map(idOf).sort(compare).forEach(id => graph.addNode(id));
  const pairs = schema.foreignKeys.map(f => [sourceId(f), targetId(f)].sort(compare))
    .sort((a, b) => compare(a[0], b[0]) || compare(a[1], b[1]));
  for (const [a, b] of pairs) {
    if (a === b || !graph.hasNode(a) || !graph.hasNode(b)) continue;
    if (graph.hasEdge(a, b)) graph.updateEdgeAttribute(a, b, 'weight', w => w + 1);
    else graph.addEdge(a, b, { weight: 1 });
  }
  return graph;
}
export function induced(graph: UndirectedGraph, nodes: string[]): UndirectedGraph {
  const result = new UndirectedGraph({ allowSelfLoops: false });
  nodes.slice().sort(compare).forEach(n => result.addNode(n));
  graph.forEachEdge((_edge, attrs, a, b) => {
    if (result.hasNode(a) && result.hasNode(b)) result.addEdge(a, b, { ...attrs });
  });
  return result;
}
export const connections = (graph: UndirectedGraph, node: string, group: Set<string>): number =>
  graph.neighbors(node).reduce((sum, n) => sum + (group.has(n) ? graph.getEdgeAttribute(node, n, 'weight') as number : 0), 0);
