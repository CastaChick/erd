import pg from 'pg';
import { UserError } from '../errors.js';
import { introspect } from './introspect.js';
import type { SchemaGraph } from '../schema-graph/types.js';

export async function readSchema(databaseUrl: string, schemas: string[]): Promise<SchemaGraph> {
  let client: pg.Client | undefined;
  try {
    client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000,
      statement_timeout: 30000, application_name: 'postgres-erd-cli' });
    // A disconnected idle client emits an error event; suppress raw server/credential text.
    client.on('error', () => {});
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await introspect(client, schemas);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError('PostgreSQL connection or metadata query failed. Check the connection settings and catalog permissions.');
  } finally {
    // Disconnect also rolls back an unfinished read-only transaction.
    if (client) await client.end().catch(() => {});
  }
}
