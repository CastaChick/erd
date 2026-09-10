export type ColumnInfo = {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  /** True only for a single-column UNIQUE constraint. */
  unique: boolean;
};
export type UniqueConstraint = { name: string; columns: string[] };
export type TableInfo = {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  uniqueConstraints: UniqueConstraint[];
};
export type ForeignKeyInfo = {
  name: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumns: string[];
  targetSchema: string;
  targetTable: string;
  targetColumns: string[];
  onDelete?: string;
  onUpdate?: string;
};
export type SchemaGraph = { tables: TableInfo[]; foreignKeys: ForeignKeyInfo[] };
export type Community = {
  id: string;
  hub: string;
  tables: string[];
  contextTables: string[];
  isolated: boolean;
};
export const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
// Quote unusual identifiers so (a.b, c) and (a, b.c) cannot collide.
const identifier = (s: string): string => /^[a-z_][a-z0-9_$]*$/.test(s) ? s : `"${s.replaceAll('"', '""')}"`;
export const tableId = (schema: string, name: string): string => `${identifier(schema)}.${identifier(name)}`;
export const idOf = (table: TableInfo): string => tableId(table.schema, table.name);
export const sourceId = (fk: ForeignKeyInfo): string => tableId(fk.sourceSchema, fk.sourceTable);
export const targetId = (fk: ForeignKeyInfo): string => tableId(fk.targetSchema, fk.targetTable);
