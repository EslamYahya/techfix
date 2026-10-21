import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NOTIFICATION_TYPES } from '@techfix/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import { NOTIF_TYPE, NOTIF_UI } from '../src/labels';
import { NotificationBell, NotificationsPage } from '../src/ui/notifications';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children, to, ...p }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
}));

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SessionProvider>{ui}</SessionProvider>
  </QueryClientProvider>
);
const N = (o: Partial<Record<string, unknown>> = {}) => ({
  id: 'n1',
  type: 'QUOTE_SENT',
  title: 'fallback',
  body: 'راجع عرض السعر للطلب TF-1001 ووافق عليه أو ارفضه.',
  data: { requestId: 'r1' },
  read: false,
  createdAt: '2026-10-20T10:00:00.000Z',
  ...o,
});

let calls: { method: string; url: string }[];
let list: ReturnType<typeof N>[];
let unread: number;
beforeEach(() => {
  calls = [];
  list = [N()];
  unread = 1;
  navigate.mockClear();
  tokens.set('access', 'refresh');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      const ok = (body: unknown, status = 200) =>
        ({ ok: true, status, json: async () => body }) as Response;
      if (url.endsWith('/auth/refresh'))
        return ok({
          data: {
            user: { id: 'u1', name: 'منى', role: 'CUSTOMER' },
            accessToken: 'a',
            refreshToken: 'r',
          },
        });
      if (method === 'POST') {
        if (url.endsWith('/read-all')) unread = 0;
        else unread = 0;
        return { ok: true, status: 204, json: async () => null } as Response;
      }
      return ok({ data: list, meta: { nextCursor: null, unreadCount: unread } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  tokens.clear();
});

describe('notification wording', () => {
  it('has Arabic text for every type the server can send', () => {
    for (const t of NOTIFICATION_TYPES) expect(NOTIF_TYPE[t], t).toMatch(/[؀-ۿ]/);
  });
  it('contains no programming terms', () => {
    for (const t of [...Object.values(NOTIF_TYPE), ...Object.values(NOTIF_UI)])
      expect(t).not.toMatch(/[A-Z_]{4,}|\bnull\b|\bundefined\b/);
  });
});

describe('bell', () => {
  it('shows the unread count in its accessible name', async () => {
    render(wrap(<NotificationBell />));
    expect(await screen.findByLabelText(`${NOTIF_UI.bell}: 1 ${NOTIF_UI.unread}`)).toBeTruthy();
  });
  it('shows no badge when everything is read', async () => {
    unread = 0;
    list = [N({ read: true })];
    render(wrap(<NotificationBell />));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/notifications'))).toBe(true));
    expect(screen.getByLabelText(NOTIF_UI.bell)).toBeTruthy();
  });
});

describe('notifications page', () => {
  it('shows the client wording, marks one as read and opens the request', async () => {
    render(wrap(<NotificationsPage />));
    const item = await screen.findByLabelText(NOTIF_TYPE['QUOTE_SENT']!);
    fireEvent.click(item);
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', url: '/api/v1/notifications/n1/read' }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: '/customer/requests/r1' });
  });

  it('falls back to the server text for an unknown type', async () => {
    list = [N({ type: 'SOMETHING_NEW', title: 'عنوان من الخادم' })];
    render(wrap(<NotificationsPage />));
    expect(await screen.findByText('عنوان من الخادم')).toBeTruthy();
  });

  it('marks everything read', async () => {
    render(wrap(<NotificationsPage />));
    fireEvent.click(await screen.findByText(NOTIF_UI.markAll));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', url: '/api/v1/notifications/read-all' }),
    );
  });

  it('says so when there is nothing', async () => {
    list = [];
    unread = 0;
    render(wrap(<NotificationsPage />));
    expect(await screen.findByText(NOTIF_UI.empty)).toBeTruthy();
  });
});
