import { compare, idOf, sourceId, targetId, type ForeignKeyInfo, type SchemaGraph, type TableInfo } from '../schema-graph/types.js';
export type ColumnMode = 'all' | 'keys' | 'none';
export type CardinalityMode = 'inferred' | 'simple';
export type RenderOptions = { columns: ColumnMode; cardinality: CardinalityMode };

export function token(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z]/.test(normalized) ? normalized : `T_${normalized}`;
}
// Escape potentially active Mermaid/HTML characters within quoted display labels.
export function label(value: string): string {
  return [...value].map(c => /[\p{L}\p{N} _.,:$()-]/u.test(c) ? c : `#${c.codePointAt(0)};`).join('');
}
export function typeToken(type: string): string {
  return token(type.replace('timestamp with time zone', 'timestamptz').replace('timestamp without time zone', 'timestamp')
    .replace('character varying', 'varchar').replace('double precision', 'double'));
}
function identifiers(values: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();
  for (const value of values.slice().sort(compare)) {
    const base = token(value);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    result.set(value, id);
    used.add(id);
  }
  return result;
}
export function cardinality(fk: ForeignKeyInfo, source: TableInfo, mode: CardinalityMode): string {
  if (mode === 'simple') return '}o..o{';
  const required = fk.sourceColumns.every(name => source.columns.some(c => c.name === name && !c.nullable));
  const unique = [source.primaryKey, ...source.uniqueConstraints.map(c => c.columns)]
    .some(key => key.length > 0 && key.every(c => fk.sourceColumns.includes(c)));
  const identifying = fk.sourceColumns.every(c => source.primaryKey.includes(c));
  return `${required ? '||' : '|o'}${identifying ? '--' : '..'}${unique ? 'o|' : 'o{'}`;
}

export function renderMermaid(schema: SchemaGraph, options: RenderOptions, primary?: string[], context: string[] = [], hub?: string): string {
  const allIds = schema.tables.map(idOf);
  const ids = identifiers(allIds);
  const selected = new Set(primary ? [...primary, ...context] : allIds);
  const primarySet = new Set(primary ?? allIds);
  const contextSet = new Set(context);
  const tables = new Map(schema.tables.map(t => [idOf(t), t]));
  const lines = ['erDiagram'];
  for (const id of [...selected].sort(compare)) {
    const table = tables.get(id)!;
    const entity = ids.get(id)!;
    const name = `${id}${id === hub ? ' (hub)' : ''}${contextSet.has(id) ? ' (context)' : ''}`;
    lines.push(`    ${entity}["${label(name)}"]`);
    const fkCols = new Set(schema.foreignKeys.filter(f => sourceId(f) === id).flatMap(f => f.sourceColumns));
    const ukCols = new Set(table.uniqueConstraints.flatMap(k => k.columns));
    const colIds = identifiers(table.columns.map(c => c.name));
    const cols = table.columns.filter(c => options.columns === 'all' || (options.columns === 'keys' &&
      (c.primaryKey || c.unique || fkCols.has(c.name) || ukCols.has(c.name))));
    if (options.columns !== 'none' && cols.length) {
      lines[lines.length - 1] += ' {';
      for (const c of cols) {
        const keys = [c.primaryKey ? 'PK' : '', fkCols.has(c.name) ? 'FK' : '', c.unique || ukCols.has(c.name) ? 'UK' : ''].filter(Boolean);
        const details = [c.nullable ? 'nullable' : 'not null'];
        if (colIds.get(c.name) !== c.name) details.push(`column: ${c.name}`);
        if (ukCols.has(c.name) && !c.unique) details.push('composite unique member');
        lines.push(`        ${typeToken(c.dataType)} ${colIds.get(c.name)}${keys.length ? ` ${keys.join(', ')}` : ''} "${label(details.join('; '))}"`);
      }
      lines.push('    }');
    }
    lines.push('');
  }
  for (const fk of [...schema.foreignKeys].sort((a, b) => compare(sourceId(a), sourceId(b)) || compare(a.name, b.name))) {
    const s = sourceId(fk), t = targetId(fk);
    if (!selected.has(s) || !selected.has(t) || !tables.has(s) || !tables.has(t)) continue;
    if (!primarySet.has(s) && !primarySet.has(t)) continue;
    lines.push(`    ${ids.get(t)} ${cardinality(fk, tables.get(s)!, options.cardinality)} ${ids.get(s)} : "${label(fk.sourceColumns.join(', '))}"`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
