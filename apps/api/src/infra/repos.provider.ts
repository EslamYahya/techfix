import type { Env } from '../config/env.js';
import type { Repos } from '../repos.js';
import { createMemoryRepos } from './memory/memory-repos.js';

/** Picks the storage adapter. The Prisma adapter is loaded lazily so memory mode never needs the generated client. */
export async function createRepos(env: Env): Promise<Repos> {
  if (env.STORE === 'memory') return createMemoryRepos();
  const path = './prisma/prisma-repos.js';
  const mod = (await import(path)) as { createPrismaRepos(url: string): Repos };
  return mod.createPrismaRepos(env.DATABASE_URL!);
}
