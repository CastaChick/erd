import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config.js';
import { UserError } from './errors.js';
import { readSchema } from './postgres/client.js';
import { buildSchemaGraph } from './schema-graph/build.js';
import { idOf, type Community, type SchemaGraph } from './schema-graph/types.js';
import { analysisGraph } from './analysis/graph.js';
import { partition } from './analysis/partition.js';
import { hub } from './analysis/hub.js';
import { contextTables } from './analysis/context.js';
import { renderMermaid } from './render/mermaid.js';
import { renderIndex } from './render/index.js';
import { renderJson } from './render/json.js';
export type GenerationOptions = Omit<Config, 'databaseUrl' | 'schema' | 'out'>;
export function generate(input: SchemaGraph, options: GenerationOptions): {
  files: Map<string, string>; warnings: string[]; communities: Community[];
} {
  const { graph: schema, warnings } = buildSchemaGraph(input, options.includeTable, options.excludeTable);
  if (!schema.tables.length) throw new UserError('No tables matched the requested schemas and filters.');
  const graph = analysisGraph(schema);
  const result = partition(graph, options.maxTables);
  warnings.push(...result.warnings);
  const communities: Community[] = result.groups.map((tables, index) => {
    const center = hub(graph, tables);
    return { id: `community-${index + 1}`, hub: center, tables,
      contextTables: contextTables(graph, tables, center, options.contextDepth, options.maxContextTables),
      isolated: tables.every(n => graph.degree(n) === 0) };
  });
  const names = new Map(schema.tables.map(t => [idOf(t), t.name]));
  const entries = communities.map((community, i) => ({ community,
    file: `${String(i + 1).padStart(2, '0')}-${community.isolated ? 'isolated' :
      names.get(community.hub)!.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'table'}.mmd` }));
  const files = new Map<string, string>();
  files.set('overview.mmd', renderMermaid(schema, { ...options, columns: 'none' }));
  for (const { community: c, file } of entries) files.set(file, renderMermaid(schema, options, c.tables, c.contextTables, c.hub));
  files.set('graph.json', renderJson(schema, communities));
  files.set('index.md', renderIndex(entries, warnings));
  return { files, warnings, communities };
}
export async function run(config: Config): Promise<{ diagrams: number; warnings: string[] }> {
  const schema = await readSchema(config.databaseUrl, config.schema);
  const result = generate(schema, config);
  try {
    await mkdir(config.out, { recursive: true });
    for (const [file, contents] of result.files) await writeFile(join(config.out, file), contents, 'utf8');
  } catch { throw new UserError('Could not write the output directory. Check the path and filesystem permissions.'); }
  return { diagrams: result.communities.length, warnings: result.warnings };
}
export type { SchemaGraph, TableInfo, ForeignKeyInfo, ColumnInfo, Community } from './schema-graph/types.js';
