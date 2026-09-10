import type { TableInfo, ForeignKeyInfo, SchemaGraph } from '../../src/schema-graph/types.js';
export const options = { maxTables: 15, maxContextTables: 5, contextDepth: 1,
  columns: 'keys' as const, cardinality: 'inferred' as const, includeTable: [], excludeTable: [] };
export const table = (name: string, schema = 'public'): TableInfo => ({ schema, name,
  columns: [{ name: 'id', dataType: 'uuid', nullable: false, primaryKey: true, unique: false }],
  primaryKey: ['id'], uniqueConstraints: [] });
export const fk = (source: string, target: string, column = `${target}_id`, name = `${source}_${column}_fk`): ForeignKeyInfo => ({
  name, sourceSchema: 'public', sourceTable: source, sourceColumns: [column],
  targetSchema: 'public', targetTable: target, targetColumns: ['id'],
});
export function fixture(names: string[], edges: ForeignKeyInfo[]): SchemaGraph {
  const tables = names.map(n => table(n));
  for (const edge of edges) for (const name of edge.sourceColumns) {
    const t = tables.find(t => t.name === edge.sourceTable)!;
    if (!t.columns.some(c => c.name === name)) t.columns.push({ name, dataType: 'uuid', nullable: false, primaryKey: false, unique: false });
  }
  return { tables, foreignKeys: edges };
}
