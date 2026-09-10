import type { UndirectedGraph } from 'graphology';
import { compare } from '../schema-graph/types.js';
import { connections, induced } from './graph.js';
import { detectCommunities } from './communities.js';

export function greedySplit(graph: UndirectedGraph, maxTables: number): string[][] {
  const remaining = new Set(graph.nodes().sort(compare));
  const groups: string[][] = [];
  while (remaining.size) {
    const seed = [...remaining].sort((a, b) => graph.degree(b) - graph.degree(a) || compare(a, b))[0];
    const group = new Set([seed]);
    remaining.delete(seed);
    while (group.size < maxTables) {
      const candidates = [...remaining].filter(n => graph.neighbors(n).some(v => group.has(v)));
      if (!candidates.length) break;
      candidates.sort((a, b) => connections(graph, b, group) - connections(graph, a, group) ||
        graph.degree(b) - graph.degree(a) || compare(a, b));
      group.add(candidates[0]);
      remaining.delete(candidates[0]);
    }
    groups.push([...group].sort(compare));
  }
  return groups;
}

export function partition(graph: UndirectedGraph, maxTables: number): { groups: string[][]; warnings: string[] } {
  if (!Number.isSafeInteger(maxTables) || maxTables < 1) throw new Error('maxTables must be a positive integer');
  const warnings: string[] = [];
  const refine = (g: UndirectedGraph): string[][] => {
    if (g.order <= maxTables) return [g.nodes().sort(compare)];
    const groups = detectCommunities(g);
    if (groups.length <= 1) {
      warnings.push(`Used greedy fallback to split a community of ${g.order} tables.`);
      return greedySplit(g, maxTables);
    }
    return groups.flatMap(nodes => refine(induced(g, nodes)));
  };
  const isolated = graph.nodes().filter(n => graph.degree(n) === 0).sort(compare);
  const connected = graph.nodes().filter(n => graph.degree(n) > 0);
  const groups = connected.length ? detectCommunities(induced(graph, connected))
    .flatMap(nodes => refine(induced(graph, nodes))) : [];
  for (let i = 0; i < isolated.length; i += maxTables) groups.push(isolated.slice(i, i + maxTables));
  if (isolated.length) warnings.push(`${isolated.length} tables have no relationships to other selected tables; grouped separately.`);
  groups.sort((a, b) => compare(a[0], b[0]));
  return { groups, warnings };
}
