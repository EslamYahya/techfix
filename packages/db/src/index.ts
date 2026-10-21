/**
 * Database access. Prisma 7 requires a driver adapter; the connection string is passed here at runtime
 * (the CLI reads DATABASE_URL from prisma.config.ts for migrations).
 * Geography queries (matching) use $queryRaw — see prisma/notes/postgis.sql.
 *
 * Requires `pnpm --filter @techfix/db generate` first (writes src/generated, git-ignored).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export * from './generated/client';

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
