import { Command, InvalidArgumentError, Option } from 'commander';
import type { CardinalityMode, ColumnMode } from './render/mermaid.js';
import { UserError } from './errors.js';
export type Config = {
  databaseUrl: string; schema: string[]; out: string; maxTables: number;
  contextDepth: number; maxContextTables: number; columns: ColumnMode;
  cardinality: CardinalityMode; includeTable: string[]; excludeTable: string[];
};
const integer = (minimum: number) => (value: string): number => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) {
    throw new InvalidArgumentError(`Expected an integer >= ${minimum}.`);
  }
  return Number(value);
};
const collect = (value: string, previous: string[]): string[] => [...previous, value];
export function command(): Command {
  return new Command().name('erd').description('Generate decomposed PostgreSQL Mermaid ER diagrams')
    .option('--database-url <url>', 'PostgreSQL URL (fallback: DATABASE_URL)')
    .option('--schema <schema>', 'schema to include; repeatable (default: public)', collect, [])
    .option('--out <directory>', 'output directory', './erd')
    .option('--max-tables <number>', 'maximum primary tables per diagram', integer(1), 15)
    .option('--context-depth <number>', 'context hops: 0 or 1', integer(0), 1)
    .option('--max-context-tables <number>', 'additional context tables per diagram', integer(0), 5)
    .addOption(new Option('--columns <mode>', 'column display').choices(['all', 'keys', 'none']).default('keys'))
    .addOption(new Option('--cardinality <mode>', 'inferred or unconstrained structural relations').choices(['inferred', 'simple']).default('inferred'))
    .option('--include-table <glob>', 'match table name or schema.table; repeatable', collect, [])
    .option('--exclude-table <glob>', 'exclude matching tables; repeatable', collect, []);
}
export function parseConfig(program: Command, env: NodeJS.ProcessEnv = process.env): Config {
  const options = program.opts<Config>();
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  if (!databaseUrl) throw new UserError('Provide --database-url or set DATABASE_URL.');
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch { throw new UserError('The database URL must be a valid postgres:// or postgresql:// URL.'); }
  if (options.contextDepth > 1) throw new UserError('--context-depth supports only 0 or 1.');
  const schemas = [...new Set(options.schema.length ? options.schema : ['public'])].sort();
  if (schemas.some(s => !s || s === 'information_schema' || s.startsWith('pg_'))) {
    throw new UserError('Specify non-empty application schemas; PostgreSQL system schemas are excluded.');
  }
  if (!options.out) throw new UserError('--out must be a non-empty directory.');
  return { ...options, databaseUrl, schema: schemas };
}
