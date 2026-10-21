import { defineConfig } from '@playwright/test';

/** End-to-end: real browser → Vite → API (in-memory store, seeded admin). Run with `pnpm e2e`. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'ar-EG',
    launchOptions: process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {},
  },
  webServer: [
    {
      command: 'pnpm --filter @techfix/api dev',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: true,
      env: {
        STORE: 'memory',
        JWT_ACCESS_SECRET: 'e2e-secret-e2e-secret-e2e-secret-123',
        SEED_ADMIN_PHONE: '01012345678',
        SEED_ADMIN_PASSWORD: 'admin-pass-1',
        LOG_LEVEL: 'silent',
        NODE_ENV: 'test',
      },
    },
    { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
});
