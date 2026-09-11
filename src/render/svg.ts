import { createHash } from 'node:crypto';
import type { Browser } from 'puppeteer';
import { UserError } from '../errors.js';

/** Render locally with one browser per batch. No schema is sent to a remote rendering service. */
export async function renderSvgs(files: ReadonlyMap<string, string>): Promise<Map<string, string>> {
  const diagrams = [...files].filter(([name]) => name.endsWith('.mmd'));
  const result = new Map<string, string>();
  if (!diagrams.length) return result;
  let browser: Browser | undefined;
  try {
    // Keep browser dependencies out of the synchronous metadata/analysis API startup path.
    const [{ default: puppeteer }, { renderMermaid }] = await Promise.all([
      import('puppeteer'), import('@mermaid-js/mermaid-cli'),
    ]);
    try {
      browser = await puppeteer.launch({ headless: true, timeout: 30000 });
    } catch {
      throw new UserError('Could not start Chrome for SVG generation. Install the Puppeteer browser (npx --package puppeteer@24.43.1 puppeteer browsers install chrome), or set PUPPETEER_EXECUTABLE_PATH to a compatible Chrome executable.');
    }
    for (const [name, definition] of diagrams) {
      const seed = createHash('sha256').update(name).digest('hex').slice(0, 16);
      const { data } = await renderMermaid(browser, definition, 'svg', {
        svgId: `erd-${seed}`,
        backgroundColor: 'white',
        mermaidConfig: {
          securityLevel: 'strict', theme: 'default', layout: 'dagre', look: 'classic',
          htmlLabels: false, handDrawnSeed: 42,
          er: { useMaxWidth: false },
          deterministicIds: true, deterministicIDSeed: seed,
          // The overview may contain >500 relationships on a large schema.
          maxEdges: 10000, maxTextSize: 1000000,
        },
      });
      result.set(name.replace(/\.mmd$/, '.svg'), `${Buffer.from(data).toString('utf8').trimEnd()}\n`);
    }
    return result;
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError('SVG generation failed. Check that Chrome is compatible and the generated Mermaid can be rendered.');
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
