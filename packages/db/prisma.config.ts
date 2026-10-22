import { defineConfig, env } from 'prisma/config';

// Prisma executes this file with packages/db as its working directory, while
// the development environment belongs to the workspace root. Load it here so
// `generate`, validation, and migration commands all resolve the same URL.
process.loadEnvFile(new URL('../../.env', import.meta.url));

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
