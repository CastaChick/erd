import { rm } from 'node:fs/promises';
// Never ship compiled modules left behind after a source file is removed.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
