import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { loadEnv } from '../src/config/env.js';
import pg from 'pg';
import { createMemoryRepos } from '../src/infra/memory/memory-repos.js';
import { SeedService } from '../src/seed.service.js';
import type { JobQueue } from '../src/queue/queue.js';
import { configureApp } from '../src/setup.js';

export const ADMIN = { phone: '01099999999', password: 'admin-pass-123' };

export async function boot(
  extra: Record<string, string> = {},
  fetchImpl?: typeof fetch,
  queue?: JobQueue,
) {
  const env = loadEnv({
    NODE_ENV: 'test',
    STORE: 'memory',
    JWT_ACCESS_SECRET: 's'.repeat(40),
    LOG_LEVEL: 'silent',
    AUTH_LOGIN_MAX_PER_15MIN: '1000',
    AUTH_REGISTER_MAX_PER_HOUR: '1000',
    SEED_ADMIN_PHONE: ADMIN.phone,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    ...extra,
  });
  // TEST_DATABASE_URL switches the very same tests to the real PostgreSQL adapter.
  const url = process.env['TEST_DATABASE_URL'];
  const mem = url ? null : createMemoryRepos();
  // Loaded lazily: the PostgreSQL adapter needs the generated Prisma client, memory mode does not.
  const prismaPath = '../src/infra/prisma/prisma-repos.js';
  const repos = mem ?? (await import(prismaPath)).createPrismaRepos(url!);
  const pool = url ? new pg.Pool({ connectionString: url, max: 1 }) : null;
  if (pool)
    await pool.query(
      'TRUNCATE audit_logs, webhook_events, outbox_events, idempotency_keys, notifications, availabilities, engineer_locations, engineer_services, engineer_documents, engineer_profiles, customer_addresses, customer_profiles, refresh_tokens, services, service_categories, users CASCADE',
    );
  const auditActions = async (): Promise<string[]> =>
    mem
      ? mem.audits.map((a) => a.action)
      : (await pool!.query<{ action: string }>('SELECT action FROM audit_logs')).rows.map(
          (r) => r.action,
        );
  const ref = await Test.createTestingModule({
    imports: [AppModule.forRoot(env, repos, fetchImpl, queue)],
  }).compile();
  const app = ref.createNestApplication();
  configureApp(app, env.CORS_ORIGIN, env.TRUST_PROXY);
  await app.init();
  await app.get(SeedService).run();
  const http = () => request(app.getHttpServer());
  let n = 0;
  const phone = () => `0111${String(1_000_000 + ++n).slice(-7)}`;

  const register = async (body: Record<string, unknown>) =>
    http()
      .post('/api/v1/auth/register')
      .send({ password: 'password-1', ...body });
  const login = async (identifier: string, password = 'password-1') =>
    http().post('/api/v1/auth/login').send({ identifier, password });
  const as = (token: string) => ({
    get: (u: string) => http().get(`/api/v1${u}`).set('Authorization', `Bearer ${token}`),
    post: (u: string, b?: unknown, headers: Record<string, string> = {}) =>
      http()
        .post(`/api/v1${u}`)
        .set('Authorization', `Bearer ${token}`)
        .set(headers)
        .send(b as object),
    patch: (u: string, b?: unknown) =>
      http()
        .patch(`/api/v1${u}`)
        .set('Authorization', `Bearer ${token}`)
        .send(b as object),
    put: (u: string, b?: unknown) =>
      http()
        .put(`/api/v1${u}`)
        .set('Authorization', `Bearer ${token}`)
        .send(b as object),
    del: (u: string) => http().delete(`/api/v1${u}`).set('Authorization', `Bearer ${token}`),
  });
  const newUser = async (role: 'CUSTOMER' | 'ENGINEER', extra: Record<string, unknown> = {}) => {
    const p = phone();
    const res = await register({ name: 'مستخدم تجريبي', phone: p, role, ...extra });
    return { phone: p, id: res.body.data.user.id as string, ...as(res.body.data.accessToken), res };
  };
  const admin = async () => as((await login(ADMIN.phone, ADMIN.password)).body.data.accessToken);

  return {
    app,
    repos,
    http,
    register,
    login,
    as,
    newUser,
    admin,
    phone,
    auditActions,
    close: async () => {
      await app.close();
      await repos.close();
      await pool?.end();
    },
  };
}
