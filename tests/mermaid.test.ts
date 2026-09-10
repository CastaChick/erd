import { beforeAll, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { generate } from '../src/main.js';
import { renderMermaid } from '../src/render/mermaid.js';
import { tableId } from '../src/schema-graph/types.js';
import { fixture, fk, options, table } from './fixtures/graph.js';
let mermaid: typeof import('mermaid').default;
beforeAll(async () => {
  const dom = new JSDOM('');
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
});
it('parses every generated diagram, including self, multiple and optional relations', async () => {
  const schema = fixture(['team','interview','asset','isolated'],
    [fk('interview','team'),fk('asset','interview'),fk('team','team','parent_id'),fk('interview','team','second_team_id')]);
  schema.tables[1].columns[1].nullable = true;
  for (const columns of ['all','keys','none'] as const) for (const cardinality of ['inferred','simple'] as const) {
    const result = generate(schema, { ...options, maxTables: 2, columns, cardinality });
    for (const [name, text] of result.files) if (name.endsWith('.mmd')) {
      await expect(mermaid.parse(text)).resolves.toBeTruthy();
      expect(text.endsWith('\n')).toBe(true);
    }
    expect(result.files.get('overview.mmd')).toContain('public_team');
    expect(result.files.get('overview.mmd')!.match(/ : /g)).toHaveLength(4);
  }
});
it('sanitizes adversarial names and types without entity or column collisions', async () => {
  const names = ['a-b','a_b','a_b_2','日本語', 'quote"\n} %% <script>'];
  const schema = { tables: names.map(n => table(n)), foreignKeys: [] };
  schema.tables[0].columns.push(...['a-b','a_b','a_b_2','quote"\n}', '1column'].map(name => ({
    name, dataType: 'numeric(10,2)[]', primaryKey: false, unique: false, nullable: true,
  })));
  const text = renderMermaid(schema, { ...options, columns: 'all' });
  await expect(mermaid.parse(text)).resolves.toBeTruthy();
  expect(new Set([...text.matchAll(/^    (\w+)\[/gm)].map(m => m[1])).size).toBe(names.length);
  expect(text).not.toContain('<script>');
});
it('renders only primary-to-context edges, never context-to-context edges', async () => {
  const schema = fixture(['a','b','c'], [fk('a','b'),fk('a','c'),fk('b','c'),fk('b','b','self')]);
  const text = renderMermaid(schema, options, ['public.a'], ['public.b','public.c']);
  expect(text.match(/ : /g)).toHaveLength(2);
  expect(text).toContain('(context)');
  await expect(mermaid.parse(text)).resolves.toBeTruthy();
});
it('handles multiple schemas with the same table names', async () => {
  const schema = { tables: [table('user','auth'),table('user','public')], foreignKeys: [] };
  const text = renderMermaid(schema, options);
  expect(text).toContain(tableId('auth','user'));
  expect(text).toContain(tableId('public','user'));
  await expect(mermaid.parse(text)).resolves.toBeTruthy();
});
