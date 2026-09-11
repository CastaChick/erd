#!/usr/bin/env node
import { CommanderError } from 'commander';
import { command, parseConfig } from './config.js';
import { UserError } from './errors.js';
import { run } from './main.js';

const program = command().exitOverride().configureOutput({ writeErr: () => {} });
try {
  program.parse();
  const result = await run(parseConfig(program));
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
  console.log(`Generated ${result.diagrams} ER diagrams and overview (Mermaid + SVG), index.md and graph.json.`);
} catch (error) {
  if (error instanceof CommanderError && error.exitCode === 0) {
    process.exitCode = 0;
  } else {
    // Never forward arbitrary driver/parser errors: they may include a supplied URL.
    console.error(`Error: ${error instanceof UserError ? error.message :
      error instanceof CommanderError ? 'Invalid CLI arguments. Run erd --help for usage.' : 'ER diagram generation failed.'}`);
    process.exitCode = 1;
  }
}
