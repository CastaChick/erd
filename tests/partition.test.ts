import { describe, it, expect } from 'vitest';
import { analysisGraph } from '../src/analysis/graph.js';
import { detectCommunities } from '../src/analysis/communities.js';
import { partition, greedySplit } from '../src/analysis/partition.js';
import { hub } from '../src/analysis/hub.js';
import { contextTables } from '../src/analysis/context.js';
import { generate } from '../src/main.js';
import { fixture, fk, options } from './fixtures/graph.js';

describe('graph analysis', () => {
  it('preserves multi-FK weights, ignores self loops only for analysis, and chooses the internal hub', () => {
    const schema = fixture(['team', 'interview', 'recording', 'transcript', 'asset'],
      [fk('interview', 'team'), fk('recording', 'interview'), fk('transcript', 'interview'), fk('asset', 'interview'),
        fk('interview', 'team', 'second_team_id'), fk('team', 'team', 'parent_id')]);
    const g = analysisGraph(schema);
    expect(g.order).toBe(5);
    expect(g.size).toBe(4);
    expect(g.getEdgeAttribute('public.interview', 'public.team', 'weight')).toBe(2);
    expect(hub(g, g.nodes())).toBe('public.interview');
    expect(schema.foreignKeys).toHaveLength(6);
  });
  it('finds multiple densely connected communities with a weak bridge', () => {
    const edges = [fk('c', 'd')];
    for (const group of [['a', 'b', 'c'], ['d', 'e', 'f']]) for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) edges.push(fk(group[i], group[j]));
    expect(detectCommunities(analysisGraph(fixture(['a','b','c','d','e','f'], edges))).length).toBeGreaterThan(1);
  });
  it('covers every primary exactly once, bounds dense groups, and is deterministic under input permutations', () => {
    const names = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const edges = names.flatMap((n, i) => names.slice(i + 1).map(m => fk(n, m)));
    const schema = fixture(names, edges);
    const out = generate(schema, { ...options, maxTables: 10 });
    const primary = out.communities.flatMap(c => c.tables);
    expect(new Set(primary).size).toBe(20);
    expect(primary).toHaveLength(20);
    expect(out.communities.every(c => c.tables.length <= 10 && c.contextTables.length <= 5)).toBe(true);
    expect(out.warnings.some(w => w.includes('fallback'))).toBe(true);
    const reversed = { tables: schema.tables.slice().reverse(), foreignKeys: edges.slice().reverse() };
    expect([...generate(reversed, { ...options, maxTables: 10 }).files]).toEqual([...out.files]);
    expect(JSON.parse(out.files.get('graph.json')!).foreignKeys).toHaveLength(edges.length);
  });
  it('handles cycles, disconnected nodes, and maxTables=1', () => {
    const schema = fixture(['a', 'b', 'c', 'alone', 'also_alone'], [fk('a', 'b'), fk('b', 'c'), fk('c', 'a')]);
    const g = analysisGraph(schema);
    const { groups } = partition(g, 1);
    expect(groups).toHaveLength(5);
    expect(groups.every(g => g.length === 1)).toBe(true);
    const noContext = generate(schema, { ...options, contextDepth: 0 });
    expect(noContext.communities.every(c => c.contextTables.length === 0)).toBe(true);
    expect(noContext.communities.find(c => c.isolated)?.tables).toEqual(['public.alone', 'public.also_alone']);
    expect(() => partition(g, 0)).toThrow();
  });
  it('greedy fallback keeps each region connected', () => {
    const g = analysisGraph(fixture(['a','b','c','d','e'], [fk('a','b'),fk('b','c'),fk('d','e')]));
    for (const group of greedySplit(g, 3)) {
      const seen = new Set([group[0]]);
      const queue = [group[0]];
      while (queue.length) for (const n of g.neighbors(queue.shift()!)) if (group.includes(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      expect(seen.size).toBe(group.length);
    }
  });
  it('ranks context by weighted connections and stops at one hop', () => {
    const g = analysisGraph(fixture(['a','b','c','d'], [fk('a','b'),fk('a','c'),fk('a','c','other_c'),fk('c','d')]));
    expect(contextTables(g, ['public.a'], 'public.a', 1, 1)).toEqual(['public.c']);
    expect(contextTables(g, ['public.a'], 'public.a', 1, 5)).toEqual(['public.b','public.c']);
  });
});
