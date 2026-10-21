import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DomainError } from '@techfix/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../src/auth/auth.decorators.js';
import { AppModule } from '../src/app.module.js';
import { loadEnv } from '../src/config/env.js';
import { configureApp } from '../src/setup.js';

@Public()
@Controller('boom')
class BoomController {
  @Get('domain') domain() {
    throw new DomainError('INVALID_STATE_TRANSITION', 'nope');
  }
  @Get('crash') crash() {
    throw new Error('secret internals');
  }
}

const env = loadEnv({
  NODE_ENV: 'test',
  STORE: 'memory',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgresql://x:x@127.0.0.1:1/x',
  LOG_LEVEL: 'silent',
});
let app: Awaited<ReturnType<typeof boot>>;

async function boot() {
  const mod = AppModule.forRoot(env);
  mod.controllers = [...(mod.controllers ?? []), BoomController];
  const ref = await Test.createTestingModule({ imports: [mod] }).compile();
  const a = ref.createNestApplication();
  configureApp(a, env.CORS_ORIGIN);
  await a.init();
  return a;
}

beforeAll(async () => {
  app = await boot();
});
afterAll(async () => {
  await app.close();
});

describe('api skeleton', () => {
  it('wraps success in { data } and sets X-Request-Id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a valid incoming request id, replaces an unsafe one', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'abc-12345678');
    expect(ok.headers['x-request-id']).toBe('abc-12345678');
    const bad = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'a b\tc');
    expect(bad.headers['x-request-id']).not.toBe('a b\tc');
  });

  it('maps DomainError to its HTTP status with the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/boom/domain').expect(409);
    expect(res.body.error).toMatchObject({ code: 'INVALID_STATE_TRANSITION', message: 'nope' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('hides internals on unexpected errors', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/boom/crash').expect(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL', message: 'Internal error' });
  });

  it('unknown route gives NOT_FOUND envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nothing').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('readiness returns 503 when the database is down', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(res.body.error.message).toBe('Database unavailable');
  });

  it('env validation rejects missing DATABASE_URL', () => {
    expect(() => loadEnv({ JWT_ACCESS_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ STORE: 'memory' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
