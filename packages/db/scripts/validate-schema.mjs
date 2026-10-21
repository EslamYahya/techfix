// Offline-friendly schema check using Prisma's own WASM validator (same engine as `prisma validate`).
// In a normal environment `pnpm validate` (prisma validate) is the authority; this exists for sandboxes
// that cannot download Prisma's native engines.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const wasm = require('@prisma/prisma-schema-wasm');
const prismaSchema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
try {
  wasm.validate(JSON.stringify({ prismaSchema, noColor: true }));
  console.log('schema valid (Prisma 7 grammar)');
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
