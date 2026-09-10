import type { UndirectedGraph } from 'graphology';
import { compare } from '../schema-graph/types.js';

export function hub(graph: UndirectedGraph, nodes: string[]): string {
  const set = new Set(nodes);
  const internal = (n: string) => graph.neighbors(n).filter(v => set.has(v)).length;
  return [...nodes].sort((a, b) => internal(b) - internal(a) || graph.degree(b) - graph.degree(a) || compare(a, b))[0];
}
