import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { ENV, type Env } from '../config/env.js';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: pg.Pool | null;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 2000,
    });
  }

  /** Readiness probe: database reachable, and PostGIS version when installed. */
  async probe(): Promise<{ ok: boolean; postgis: string | null }> {
    const pool = this.pool;
    if (!pool) return { ok: true, postgis: null }; // in-memory store: nothing to probe
    try {
      await pool.query('SELECT 1');
    } catch {
      return { ok: false, postgis: null };
    }
    try {
      const r = await pool.query<{ v: string }>('SELECT PostGIS_Version() AS v');
      return { ok: true, postgis: r.rows[0]?.v ?? null };
    } catch {
      return { ok: true, postgis: null };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
