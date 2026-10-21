import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const prod = {
  NODE_ENV: 'production',
  STORE: 'postgres',
  DATABASE_URL: 'postgresql://u:p@db:5432/techfix',
  JWT_ACCESS_SECRET: 'k3J9xQ2mP7vL5nR8tW1yZ4aB6cD0eF2gH5iJ8kL1',
  CORS_ORIGIN: 'https://app.techfix.example.org',
};

describe('production environment', () => {
  it('accepts a real configuration', () => {
    const e = loadEnv(prod);
    expect(e.RUN_WORKERS).toBe(true);
    expect(e.TRUST_PROXY).toBe(0);
  });
  it.each([
    ['memory store', { STORE: 'memory' }, 'STORE'],
    [
      'placeholder JWT secret',
      { JWT_ACCESS_SECRET: 'change-me-min-32-chars-change-me-0001' },
      'JWT_ACCESS_SECRET',
    ],
    ['localhost CORS', { CORS_ORIGIN: 'http://localhost:5173' }, 'CORS_ORIGIN'],
    [
      'placeholder admin password',
      { SEED_ADMIN_PASSWORD: 'change-me-admin' },
      'SEED_ADMIN_PASSWORD',
    ],
  ])('refuses %s', (_n, patch, field) => {
    expect(() => loadEnv({ ...prod, ...patch })).toThrow(field);
  });
  it('lets development and tests keep their defaults', () => {
    const base = { JWT_ACCESS_SECRET: 'change-me-min-32-chars-change-me-0001', STORE: 'memory' };
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).RUN_WORKERS).toBe(true);
    expect(loadEnv({ ...base, NODE_ENV: 'test' }).RUN_WORKERS).toBe(false);
  });
  it('requires the Fawry trio to go together', () => {
    expect(() => loadEnv({ ...prod, FAWRY_MERCHANT_CODE: 'M' })).toThrow('FAWRY');
  });
});
