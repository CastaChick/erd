import { createRequire } from 'node:module';
import type { UndirectedGraph } from 'graphology';
import { compare } from '../schema-graph/types.js';

// The package is CommonJS, while its declarations use an ES default export.
const louvain: typeof import('graphology-communities-louvain').default =
  createRequire(import.meta.url)('graphology-communities-louvain');

export function detectCommunities(graph: UndirectedGraph): string[][] {
  if (!graph.size) return graph.nodes().sort(compare).map(n => [n]);
  const assignment = louvain(graph, { getEdgeWeight: 'weight', randomWalk: false });
  const groups = new Map<number, string[]>();
  for (const node of graph.nodes().sort(compare)) {
    const id = assignment[node];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(node);
  }
  return [...groups.values()].sort((a, b) => compare(a[0], b[0]));
}
