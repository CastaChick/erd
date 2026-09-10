import { it, expect } from 'vitest';
import { groupForeignKeys } from '../src/postgres/introspect.js';
import { buildSchemaGraph } from '../src/schema-graph/build.js';
import { tableId } from '../src/schema-graph/types.js';
import { fixture, fk } from './fixtures/graph.js';
it('groups composite FK columns by constraint OID and ordinal, even with duplicate constraint names', () => {
  const base = { constraint_oid: '1', name: 'same_name', source_schema: 'public', source_table: 'child',
    target_schema: 'public', target_table: 'parent', on_delete_code: 'c', on_update_code: 'r' };
  const result = groupForeignKeys([
    { ...base, source_column: 'version', target_column: 'revision', column_position: 2 },
    { ...base, source_column: 'team_id', target_column: 'id', column_position: 1 },
    { ...base, constraint_oid: '2', source_table: 'other_child', source_column: 'parent_id', target_column: 'id', column_position: 1 },
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].sourceColumns).toEqual(['team_id','version']);
  expect(result[0].targetColumns).toEqual(['id','revision']);
  expect(result[0].onDelete).toBe('CASCADE');
  expect(result[0].onUpdate).toBe('RESTRICT');
});
it('keeps excluded-target FK metadata and applies qualified/unqualified glob filters', () => {
  const schema = fixture(['child','parent','__drizzle_migrations'], [fk('child','parent')]);
  const result = buildSchemaGraph(schema, ['public.*'], ['parent','__drizzle_*']);
  expect(result.graph.tables.map(t => t.name)).toEqual(['child']);
  expect(result.graph.foreignKeys).toHaveLength(1);
  expect(result.warnings).toHaveLength(1);
});
it('distinguishes dotted and quoted PostgreSQL identifiers', () => {
  expect(tableId('a.b','c')).not.toBe(tableId('a','b.c'));
  expect(tableId('public','users')).toBe('public.users');
});
