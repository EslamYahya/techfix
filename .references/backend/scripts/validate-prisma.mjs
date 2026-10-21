import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const w = require('@prisma/prisma-schema-wasm');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
try {
  w.validate(JSON.stringify({ prismaSchema: schema, noColor: true }));
  console.log('schema valid');
} catch (e) { console.error(e.message ?? e); process.exit(1); }
try {
  const out = w.format(JSON.stringify({ prismaSchema: schema }), JSON.stringify({}));
  console.log('format ok, bytes', out.length);
} catch (e) { console.error('format', e.message); }
