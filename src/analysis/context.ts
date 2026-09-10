import type { UndirectedGraph } from 'graphology';
import { compare } from '../schema-graph/types.js';
import { connections } from './graph.js';

export function contextTables(graph: UndirectedGraph, nodes: string[], hub: string, depth: number, limit: number): string[] {
  if (depth === 0 || limit === 0) return [];
  const primary = new Set(nodes);
  const candidates = new Set(nodes.flatMap(n => graph.neighbors(n)).filter(n => !primary.has(n)));
  return [...candidates].sort((a, b) => connections(graph, b, primary) - connections(graph, a, primary) ||
    Number(graph.hasEdge(b, hub)) - Number(graph.hasEdge(a, hub)) || graph.degree(b) - graph.degree(a) || compare(a, b))
    .slice(0, limit).sort(compare);
}
