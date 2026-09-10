import picomatch from 'picomatch';
import { compare, idOf, sourceId, targetId, type SchemaGraph } from './types.js';

export function buildSchemaGraph(input: SchemaGraph, include: string[] = [], exclude: string[] = []): {
  graph: SchemaGraph; warnings: string[];
} {
  const matches = (patterns: string[], schema: string, name: string) => patterns.some(pattern => {
    const test = picomatch(pattern, { dot: true });
    return test(name) || test(`${schema}.${name}`);
  });
  const tables = input.tables.filter(t => (!include.length || matches(include, t.schema, t.name)) &&
    !matches(exclude, t.schema, t.name)).map(t => ({ ...t,
      primaryKey: [...t.primaryKey], columns: t.columns.map(c => ({ ...c })),
      uniqueConstraints: [...t.uniqueConstraints].sort((a, b) => compare(a.name, b.name)),
    })).sort((a, b) => compare(idOf(a), idOf(b)));
  const ids = new Set(tables.map(idOf));
  // Retain outgoing FK metadata even when the target is excluded; render/analysis skip missing endpoints.
  const foreignKeys = input.foreignKeys.filter(f => ids.has(sourceId(f))).sort((a, b) =>
    compare(sourceId(a), sourceId(b)) || compare(a.name, b.name) || compare(targetId(a), targetId(b)));
  const warnings = foreignKeys.filter(f => !ids.has(targetId(f))).map(f =>
    `FK ${JSON.stringify(f.name)} on ${sourceId(f)} references excluded table ${targetId(f)}; relation omitted from diagrams.`);
  return { graph: { tables, foreignKeys }, warnings };
}
