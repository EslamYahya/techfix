import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  // Node >= 26 shadows jsdom's `window.localStorage` with its own disabled global; test/setup.ts
  // restores it before any test file runs.
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
