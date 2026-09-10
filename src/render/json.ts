import type { Community, SchemaGraph } from '../schema-graph/types.js';
export function renderJson(graph: SchemaGraph, communities: Community[]): string {
  return `${JSON.stringify({ ...graph, communities }, null, 2)}\n`;
}
