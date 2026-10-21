import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../src/auth/session';
import { HomePage } from '../src/routes/home';

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wrap = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SessionProvider>
        <HomePage />
      </SessionProvider>
    </QueryClientProvider>,
  );

describe('HomePage', () => {
  it('shows the platform as running when health is ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    wrap();
    expect(await screen.findByText('المنصة تعمل')).toBeTruthy();
  });
  it('shows an unavailable message when health fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    wrap();
    expect(await screen.findByText('المنصة غير متاحة حاليًا')).toBeTruthy();
  });
});
