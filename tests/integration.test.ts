import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readSchema } from '../src/postgres/client.js';
import { buildSchemaGraph } from '../src/schema-graph/build.js';
import { generateWithSvg } from '../src/main.js';
import { options } from './fixtures/graph.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)('PostgreSQL integration (disposable schemas)', () => {
  const schema = `erd_test_${process.pid}`;
  const other = `${schema}_other`;
  let client: pg.Client;
  let connected = false;
  let output: string;
  beforeAll(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    connected = true;
    output = await mkdtemp(join(tmpdir(), 'erd-output-'));
    await client.query(`CREATE SCHEMA "${schema}"; CREATE SCHEMA "${other}";
      CREATE TYPE "${schema}".state AS ENUM ('active','inactive');
      CREATE DOMAIN "${schema}".required_id AS integer NOT NULL;
      CREATE TABLE "${schema}".parent (team_id integer, version integer, PRIMARY KEY (team_id,version));
      CREATE TABLE "${other}".parent (id integer PRIMARY KEY);
      CREATE TABLE "${schema}".child (
        id integer PRIMARY KEY, team_id integer NOT NULL, version integer NOT NULL,
        other_id integer, status "${schema}".state, tags text[], amount numeric(10,2), at timestamptz,
        CONSTRAINT shared_name FOREIGN KEY (team_id,version) REFERENCES "${schema}".parent(team_id,version) ON DELETE CASCADE,
        UNIQUE (team_id,version), FOREIGN KEY (other_id) REFERENCES "${other}".parent(id));
      CREATE TABLE "${schema}".profile (id integer PRIMARY KEY, child_id integer UNIQUE NOT NULL REFERENCES "${schema}".child(id));
      CREATE TABLE "${schema}".category (id integer PRIMARY KEY, parent_id integer,
        CONSTRAINT shared_name FOREIGN KEY (parent_id) REFERENCES "${schema}".category(id));
      CREATE TABLE "${schema}".message (id integer PRIMARY KEY,
        sender_id integer REFERENCES "${schema}".profile(id), receiver_id integer REFERENCES "${schema}".profile(id));
      CREATE TABLE "${schema}".isolated (id "${schema}".required_id, value text);
      CREATE TABLE "${schema}".partitioned (id integer PRIMARY KEY) PARTITION BY RANGE (id);
      CREATE TABLE "${schema}".partitioned_1 PARTITION OF "${schema}".partitioned FOR VALUES FROM (0) TO (10);
      CREATE TABLE "${schema}"."odd.table" ("a-b" integer, "a_b" integer, "quote""column" text);
      CREATE VIEW "${schema}".ignored_view AS SELECT * FROM "${schema}".isolated;
    `);
  });
  afterAll(async () => {
    if (client) {
      try {
        if (connected) await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE; DROP SCHEMA IF EXISTS "${other}" CASCADE`);
      } finally { await client.end(); }
    }
    if (output) await rm(output, { recursive: true, force: true });
  });
  it('extracts exact PK, UNIQUE, ordered FK, domain nullability, types and cross-schema endpoints', async () => {
    const graph = await readSchema(databaseUrl!, [schema]);
    const parent = graph.tables.find(t => t.name === 'parent')!;
    expect(parent.primaryKey).toEqual(['team_id','version']);
    const child = graph.tables.find(t => t.name === 'child')!;
    expect(child.uniqueConstraints[0].columns).toEqual(['team_id','version']);
    expect(child.columns.find(c => c.name === 'team_id')!.unique).toBe(false);
    expect(child.columns.find(c => c.name === 'tags')!.dataType).toBe('text[]');
    expect(child.columns.find(c => c.name === 'amount')!.dataType).toBe('numeric(10,2)');
    expect(graph.tables.find(t => t.name === 'isolated')!.columns[0].nullable).toBe(false);
    expect(graph.tables.find(t => t.name === 'ignored_view')).toBeUndefined();
    expect(graph.tables.some(t => t.name === 'partitioned')).toBe(true);
    const composite = graph.foreignKeys.find(f => f.sourceTable === 'child' && f.name === 'shared_name')!;
    expect(composite.sourceColumns).toEqual(['team_id','version']);
    expect(composite.targetColumns).toEqual(['team_id','version']);
    expect(composite.onDelete).toBe('CASCADE');
    expect(graph.foreignKeys.filter(f => f.name === 'shared_name')).toHaveLength(2);
    expect(graph.foreignKeys.filter(f => f.sourceTable === 'message')).toHaveLength(2);
    expect(buildSchemaGraph(graph).warnings).toHaveLength(1);
    expect(buildSchemaGraph(await readSchema(databaseUrl!, [schema,other])).warnings).toHaveLength(0);
  });
  it('produces byte-identical CLI files on rerun, matching library output', async () => {
    const args = ['--import','tsx','src/cli.ts','--schema',schema,'--schema',other,'--max-tables','3','--out',output];
    const env = { ...process.env, DATABASE_URL: databaseUrl };
    await promisify(execFile)(process.execPath, args, { env });
    const names = (await readdir(output)).sort();
    const first = await Promise.all(names.map(n => readFile(join(output,n), 'utf8')));
    await promisify(execFile)(process.execPath, args, { env });
    expect(await Promise.all(names.map(n => readFile(join(output,n), 'utf8')))).toEqual(first);
    const generated = await generateWithSvg(await readSchema(databaseUrl!, [schema,other]), { ...options, maxTables: 3 });
    for (let i = 0; i < names.length; i++) expect(first[i]).toBe(generated.files.get(names[i]));
    expect(names).toContain('index.md');
    expect(names).toContain('overview.mmd');
    expect(names).toContain('graph.json');
    expect(names).toContain('overview.svg');
    expect(first.join('')).not.toContain(databaseUrl!);
  }, 60000);
  it('reports missing schema, zero matching tables and unwritable output with safe errors', async () => {
    await expect(readSchema(databaseUrl!, [`${schema}_missing`])).rejects.toThrow(/schemas do not exist/);
    const file = join(output,'not-a-directory');
    await writeFile(file, '');
    for (const [extra, message] of [
      [['--include-table','nonexistent'], 'No tables matched'],
      [['--out',file], 'Could not write the output directory'],
    ] as const) {
      await expect(promisify(execFile)(process.execPath,
        ['--import','tsx','src/cli.ts','--schema',schema,...extra],
        { env: { ...process.env, DATABASE_URL: databaseUrl } })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining(message) });
    }
  }, 60000);
});
