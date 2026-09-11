import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = await mkdtemp(join(tmpdir(), 'erd-package-'));
const npm = (args, cwd = process.cwd()) => execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
try {
  const result = JSON.parse(npm(['pack', '--json', '--pack-destination', temp]))[0];
  assert.equal(result.name, '@castachick/erd');
  const files = result.files.map(f => f.path);
  for (const required of ['dist/cli.js', 'dist/main.js', 'dist/main.d.ts', 'README.md', 'package.json']) assert(files.includes(required));
  assert(files.every(f => f.startsWith('dist/') || ['README.md', 'package.json', 'LICENSE'].includes(f)), 'Unexpected file in package');
  await writeFile(join(temp, 'package.json'), '{"private":true,"type":"module"}\n');
  npm(['install', '--omit=dev', '--no-audit', '--no-fund', join(temp, result.filename)], temp);
  const installed = JSON.parse(await readFile(join(temp, 'node_modules/@castachick/erd/package.json'), 'utf8'));
  assert.equal(installed.publishConfig.access, 'public');
  const help = execFileSync(join(temp, 'node_modules/.bin/erd'), ['--help'], { encoding: 'utf8' });
  assert.match(help, /Usage: erd/);
  execFileSync(process.execPath, ['--input-type=module', '-e', `import { generateWithSvg } from '@castachick/erd';
    const graph = { tables: [{ schema: 'public', name: 'sample', columns: [], primaryKey: [], uniqueConstraints: [] }], foreignKeys: [] };
    const result = await generateWithSvg(graph, { maxTables: 15, maxContextTables: 5, contextDepth: 1, columns: 'keys', cardinality: 'inferred', includeTable: [], excludeTable: [] });
    if (!result.files.get('overview.svg')?.includes('<svg') || !result.files.get('index.md')?.includes('](./overview.svg)')) process.exit(1);`], { cwd: temp, stdio: 'inherit' });
  console.log('Packed package installs with production dependencies; erd CLI, ESM API and SVG rendering work.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
