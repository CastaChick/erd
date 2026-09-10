import type { Client } from 'pg';
import { UserError } from '../errors.js';
import type { ForeignKeyInfo, SchemaGraph, TableInfo } from '../schema-graph/types.js';
import { schemasQuery, tablesQuery, columnsQuery, keysQuery, foreignKeysQuery } from './queries.js';

type ForeignKeyRow = {
  constraint_oid: string; name: string; source_schema: string; source_table: string;
  source_column: string; target_schema: string; target_table: string; target_column: string;
  column_position: number; on_delete_code: string; on_update_code: string;
};
const actions: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
export function groupForeignKeys(rows: ForeignKeyRow[]): ForeignKeyInfo[] {
  const groups = new Map<string, ForeignKeyInfo>();
  for (const row of [...rows].sort((a, b) => a.column_position - b.column_position)) {
    let fk = groups.get(row.constraint_oid);
    if (!fk) {
      fk = { name: row.name, sourceSchema: row.source_schema, sourceTable: row.source_table,
        sourceColumns: [], targetSchema: row.target_schema, targetTable: row.target_table,
        targetColumns: [], onDelete: actions[row.on_delete_code], onUpdate: actions[row.on_update_code] };
      groups.set(row.constraint_oid, fk);
    }
    fk.sourceColumns.push(row.source_column);
    fk.targetColumns.push(row.target_column);
  }
  return [...groups.values()];
}

export async function introspect(client: Pick<Client, 'query'>, schemas: string[]): Promise<SchemaGraph> {
  const found = await client.query<{ name: string }>(schemasQuery, [schemas]);
  if (schemas.some(s => !found.rows.some(r => r.name === s))) {
    throw new UserError('One or more requested PostgreSQL schemas do not exist.');
  }
  const tableRows = await client.query<{ schema: string; name: string; oid: string }>(tablesQuery, [schemas]);
  const tables = new Map<string, TableInfo>(tableRows.rows.map(r => [r.oid, {
    schema: r.schema, name: r.name, columns: [], primaryKey: [], uniqueConstraints: [],
  }]));
  const oids = [...tables.keys()];
  if (!oids.length) return { tables: [], foreignKeys: [] };
  const columns = await client.query<{ table_oid: string; name: string; data_type: string; nullable: boolean }>(columnsQuery, [oids]);
  for (const c of columns.rows) tables.get(c.table_oid)!.columns.push({
    name: c.name, dataType: c.data_type, nullable: c.nullable, primaryKey: false, unique: false,
  });
  const keys = await client.query<{ table_oid: string; name: string; kind: string; columns: string[] }>(keysQuery, [oids]);
  for (const k of keys.rows) {
    const t = tables.get(k.table_oid)!;
    if (k.kind === 'p') t.primaryKey = k.columns;
    else t.uniqueConstraints.push({ name: k.name, columns: k.columns });
  }
  for (const t of tables.values()) for (const c of t.columns) {
    c.primaryKey = t.primaryKey.includes(c.name);
    c.unique = t.uniqueConstraints.some(k => k.columns.length === 1 && k.columns[0] === c.name);
  }
  const fks = await client.query<ForeignKeyRow>(foreignKeysQuery, [oids]);
  return { tables: [...tables.values()], foreignKeys: groupForeignKeys(fks.rows) };
}
