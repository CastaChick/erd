import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { it, expect } from 'vitest';
import { command, parseConfig } from '../src/config.js';
const parse = (args: string[], env: NodeJS.ProcessEnv = { DATABASE_URL: 'postgres://localhost/db' }) => {
  const cmd = command().exitOverride().configureOutput({ writeErr: () => {} });
  cmd.parse(args, { from: 'user' });
  return parseConfig(cmd, env);
};
it('uses documented defaults and gives URL arguments precedence over environment', () => {
  expect(parse([])).toMatchObject({ schema: ['public'], maxTables: 15, contextDepth: 1, maxContextTables: 5, columns: 'keys' });
  expect(parse(['--database-url','postgres://localhost/override','--schema','public','--schema','auth']).databaseUrl)
    .toBe('postgres://localhost/override');
  expect(parse(['--schema','public','--schema','auth','--schema','public']).schema).toEqual(['auth','public']);
});
it('rejects unsupported, malformed or dangerous configuration', () => {
  for (const args of [['--max-tables','0'], ['--max-tables','1.5'], ['--max-tables','2x'],
    ['--max-context-tables','-1'], ['--context-depth','2'], ['--columns','bad'], ['--schema','pg_catalog']]) {
    expect(() => parse(args)).toThrow();
  }
  expect(() => parse([], {})).toThrow(/DATABASE_URL/);
  expect(() => parse(['--database-url','https://example.com'])).toThrow(/URL/);
});
it('does not echo credentials from commander or connection errors', async () => {
  const secret = 'NeverPrintThisPassword';
  const url = `postgres://user:${secret}@127.0.0.1:1/db`;
  for (const args of [['--unknown',url], ['--max-tables',url], ['--database-url',url], ['--database-url',`invalid-${secret}`]]) {
    try {
      await promisify(execFile)(process.execPath, ['--import','tsx','src/cli.ts', ...args], { env: { ...process.env, DATABASE_URL: '' } });
      expect.fail('Expected failure');
    } catch (e) {
      const error = e as Error & { stdout: string; stderr: string; code: number };
      expect(error.code).toBe(1);
      expect(error.stdout + error.stderr).not.toContain(secret);
      expect(error.stderr).toContain('Error:');
    }
  }
}, 15000);
