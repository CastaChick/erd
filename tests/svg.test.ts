import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { generate, generateWithSvg } from '../src/main.js';
import { renderSvgs } from '../src/render/svg.js';
import { fixture, fk, options } from './fixtures/graph.js';

it('generates a valid, stable SVG for every mmd and embeds every image in the index', async () => {
  const schema = fixture(['team', 'interview', 'asset', 'isolated'], [
    fk('interview', 'team'), fk('asset', 'interview'), fk('team', 'team', 'parent_id'),
  ]);
  const settings = { ...options, maxTables: 2, columns: 'all' as const };
  const output = await generateWithSvg(schema, settings);
  const mmds = [...output.files.keys()].filter(n => n.endsWith('.mmd'));
  expect([...output.files.keys()].filter(n => n.endsWith('.svg')).sort())
    .toEqual(mmds.map(n => n.replace(/\.mmd$/, '.svg')).sort());
  for (const name of mmds) {
    const svgName = name.replace(/\.mmd$/, '.svg');
    const svg = new JSDOM(output.files.get(svgName)!, { contentType: 'image/svg+xml' }).window.document;
    expect(svg.documentElement.localName).toBe('svg');
    expect(svg.documentElement.getAttribute('viewBox')).toBeTruthy();
    expect(Number(svg.documentElement.getAttribute('width'))).toBeGreaterThan(0);
    expect(svg.querySelectorAll('script')).toHaveLength(0);
    expect(svg.documentElement.textContent).toContain('public.');
    expect(output.files.get('index.md')).toContain(`](./${svgName})`);
    expect(output.files.get('index.md')).toContain(`](./${name})`);
  }
  const second = await generateWithSvg(schema, settings);
  for (const [name, contents] of output.files) expect(second.files.get(name) === contents, `Stable output: ${name}`).toBe(true);
  const textOnly = generate(schema, settings);
  expect(textOnly.files.get('index.md')).not.toContain('.svg');
  expect(textOnly.files.get('graph.json')).toBe(output.files.get('graph.json'));
}, 60000);

it('returns a safe actionable error when Chrome cannot launch', async () => {
  const previous = process.env.PUPPETEER_EXECUTABLE_PATH;
  // Run a fresh process because Puppeteer reads environment configuration at import time.
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { stderr } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { renderSvgs } from './src/render/svg.ts';
    try { await renderSvgs(new Map([['a.mmd', 'erDiagram\\n A']])); }
    catch (e) { console.error(e.message); }
  `], { env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: '/nonexistent/private-secret-chrome' } });
  expect(stderr).toContain('Could not start Chrome');
  expect(stderr).not.toContain('private-secret');
  expect(process.env.PUPPETEER_EXECUTABLE_PATH).toBe(previous);
});

it('handles empty diagram input without launching Chrome', async () => {
  expect(await renderSvgs(new Map([['graph.json', '{}']]))).toEqual(new Map());
});
