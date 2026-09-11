import type { Community } from '../schema-graph/types.js';
export type DiagramEntry = { community: Community; file: string };
const safe = (s: string) => s.replace(/[&<>`\[\]\\*_\r\n]/g, c => `&#${c.charCodeAt(0)};`);
export function renderIndex(entries: DiagramEntry[], warnings: string[], svg = false): string {
  const lines = ['# Database ER Diagrams', '', 'Generated from PostgreSQL schema metadata.', '',
    '## Overview', '',
    ...(svg ? ['![Database overview](./overview.svg)', '',
      '[SVG](./overview.svg) · [Mermaid source](./overview.mmd) · [Graph metadata](./graph.json)', ''] :
      ['[Overview](./overview.mmd) · [Graph metadata](./graph.json)', '']),
    'Primary tables belong to exactly one group. Context tables are additional one-hop neighbors.',
    'Inferred relations use dashed lines unless the FK columns are part of the child primary key.',
    'Composite UNIQUE annotations mark membership, not individual column uniqueness.', '', '## Subgraphs', ''];
  for (const { community: c, file } of entries) {
    lines.push(`### ${safe(c.id)} — ${safe(c.hub)}${c.isolated ? ' (isolated)' : ''}`, '',
      `Hub: ${safe(c.hub)}`, '', `Primary tables: ${c.tables.length} · Context tables: ${c.contextTables.length}`, '',
      ...(svg ? [`![${safe(c.hub)} ER diagram](./${file.replace(/\.mmd$/, '.svg')})`, '',
        `[SVG](./${file.replace(/\.mmd$/, '.svg')}) · [Mermaid source](./${file})`] : [`[Diagram](./${file})`]),
      '', `Tables: ${c.tables.map(safe).join(', ')}`, '',
      `Context: ${c.contextTables.length ? c.contextTables.map(safe).join(', ') : 'None'}`, '');
  }
  if (warnings.length) lines.push('## Warnings', '', ...warnings.map(w => `- ${safe(w)}`), '');
  return `${lines.join('\n').trimEnd()}\n`;
}
