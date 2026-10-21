import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import {
  ADMIN_UI,
  DISPUTE_OUTCOME,
  DISPUTE_REASON,
  DISPUTE_STATUS,
  PAYMENT_STATUS,
  PAY_METHOD,
} from '../src/labels';
import {
  AdminDisputesPage,
  AdminFinancePage,
  AdminRequestsPage,
  AdminReviewsPage,
} from '../src/routes/admin';

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SessionProvider>{ui}</SessionProvider>
  </QueryClientProvider>
);
type Call = { method: string; url: string; body: unknown };
let calls: Call[];
let data: Record<string, { data: unknown[]; meta?: unknown }>;

beforeEach(() => {
  calls = [];
  tokens.set('access', 'refresh');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined });
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
      if (url.endsWith('/auth/refresh'))
        return ok({
          data: {
            user: { id: 'a1', name: 'مشرف', role: 'ADMIN' },
            accessToken: 'a',
            refreshToken: 'r',
          },
        });
      if (method === 'POST') return ok({ data: {} });
      if (url.includes('/notifications')) return ok({ data: [], meta: { unreadCount: 0 } });
      const key = Object.keys(data).find((k) => url.includes(k));
      return ok(key ? data[key] : { data: [], meta: {} });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  tokens.clear();
});

const payment = (o: object = {}) => ({
  id: 'p1',
  requestId: 'r1',
  requestNumber: 'R-1001',
  method: 'CASH',
  status: 'PAID',
  amount: 500,
  refunded: 0,
  reference: null,
  customerName: 'منى السيد',
  engineerName: 'كريم حسن',
  createdAt: '2026-10-20T10:00:00.000Z',
  paidAt: '2026-10-21T10:00:00.000Z',
  ...o,
});

describe('admin wording', () => {
  it('has Arabic text for every status, method, reason and outcome', () => {
    for (const k of ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
      expect(PAYMENT_STATUS[k]?.[0], k).toMatch(/[؀-ۿ]/);
    for (const k of ['CASH', 'ONLINE']) expect(PAY_METHOD[k], k).toBeTruthy();
    for (const k of ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'])
      expect(DISPUTE_STATUS[k]?.[0], k).toBeTruthy();
    for (const k of ['PROBLEM_REPORTED', 'QUALITY', 'PRICE', 'OTHER'])
      expect(DISPUTE_REASON[k], k).toBeTruthy();
    for (const k of ['CONFIRM_COMPLETION', 'CLOSE', 'REJECT'])
      expect(DISPUTE_OUTCOME[k]).toBeTruthy();
  });
  it('contains no programming terms', () => {
    const all = [
      ...Object.values(ADMIN_UI).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
      ...Object.values(DISPUTE_OUTCOME),
    ];
    for (const t of all) expect(t).not.toMatch(/[A-Z_]{4,}|\bnull\b|\bundefined\b|\bAPI\b/);
  });
});

describe('finance page', () => {
  beforeEach(() => {
    data = {
      '/admin/payments': {
        data: [payment(), payment({ id: 'p2', status: 'PENDING', requestNumber: 'R-1002' })],
        meta: {
          totals: {
            collectedNet: 1250,
            cashNet: 750,
            onlineNet: 500,
            refundedTotal: 100,
            pendingCount: 1,
            pendingAmount: 500,
          },
        },
      },
    };
  });

  it('shows totals and rows with Arabic status', async () => {
    render(wrap(<AdminFinancePage />));
    expect(await screen.findByText(ADMIN_UI.collected)).toBeTruthy();
    expect(await screen.findAllByText(PAYMENT_STATUS['PAID']![0])).toBeTruthy();
    expect(screen.getByText('R-1002')).toBeTruthy();
  });

  it('offers a refund only for paid payments and sends amount and reason', async () => {
    render(wrap(<AdminFinancePage />));
    const btns = await screen.findAllByText(ADMIN_UI.refund);
    expect(btns).toHaveLength(1); // the pending one has none
    fireEvent.click(btns[0]!);
    const submit = screen.getByText(ADMIN_UI.refundConfirm) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // no reason yet
    fireEvent.change(screen.getByLabelText(ADMIN_UI.refundAmount), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(ADMIN_UI.refundReason), {
      target: { value: 'خصم اتفاق' },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/v1/payments/p1/refund',
        body: { amount: 150, reason: 'خصم اتفاق' },
      }),
    );
  });

  it('will not allow refunding more than what is left', async () => {
    render(wrap(<AdminFinancePage />));
    fireEvent.click((await screen.findAllByText(ADMIN_UI.refund))[0]!);
    fireEvent.change(screen.getByLabelText(ADMIN_UI.refundAmount), { target: { value: '501' } });
    fireEvent.change(screen.getByLabelText(ADMIN_UI.refundReason), { target: { value: 'سبب' } });
    expect((screen.getByText(ADMIN_UI.refundConfirm) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('disputes page', () => {
  it('resolves with the chosen outcome and a written decision', async () => {
    data = {
      '/admin/disputes': {
        data: [
          {
            id: 'd1',
            requestId: 'r1',
            requestNumber: 'R-1001',
            openedByName: 'منى السيد',
            openedByRole: 'CUSTOMER',
            reason: 'QUALITY',
            description: 'الكاميرا لا تعمل بعد التركيب',
            status: 'OPEN',
            resolution: null,
            createdAt: '2026-10-21T10:00:00.000Z',
          },
        ],
        meta: {},
      },
    };
    render(wrap(<AdminDisputesPage />));
    expect(await screen.findByText('الكاميرا لا تعمل بعد التركيب')).toBeTruthy();
    expect(screen.getByText(DISPUTE_REASON['QUALITY']!)).toBeTruthy();
    fireEvent.click(screen.getByText(ADMIN_UI.resolve));
    fireEvent.click(screen.getByLabelText(DISPUTE_OUTCOME['CONFIRM_COMPLETION']!));
    const send = screen.getAllByText(ADMIN_UI.resolve).at(-1) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(ADMIN_UI.resolution), {
      target: { value: 'تم فحص العمل وهو سليم' },
    });
    fireEvent.click(send);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/v1/admin/disputes/d1/resolve',
        body: { outcome: 'CONFIRM_COMPLETION', resolution: 'تم فحص العمل وهو سليم' },
      }),
    );
  });
});

describe('reviews page', () => {
  it('hides a visible review and shows a hidden one', async () => {
    const r = (id: string, hidden: boolean) => ({
      id,
      requestNumber: 'R-1',
      rating: 4,
      comment: `تعليق ${id}`,
      hidden,
      customerName: 'منى',
      engineerName: 'كريم',
      createdAt: '2026-10-21T10:00:00.000Z',
    });
    data = { '/admin/reviews': { data: [r('a', false), r('b', true)], meta: {} } };
    render(wrap(<AdminReviewsPage />));
    fireEvent.click(await screen.findByText(ADMIN_UI.hide));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/v1/admin/reviews/a/hide',
        body: { hidden: true },
      }),
    );
    fireEvent.click(screen.getByText(ADMIN_UI.show));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/v1/admin/reviews/b/hide',
        body: { hidden: false },
      }),
    );
  });
});

describe('requests page', () => {
  it('cancels only with a reason, and never offers it for finished requests', async () => {
    const row = (id: string, status: string) => ({
      id,
      number: `R-${id}`,
      status,
      serviceName: 'كاميرات مراقبة',
      customerName: 'منى',
      engineerName: null,
      hasDispute: false,
      createdAt: '2026-10-21T10:00:00.000Z',
    });
    data = {
      '/admin/service-requests': { data: [row('1', 'CONFIRMED'), row('2', 'RATED')], meta: {} },
    };
    render(wrap(<AdminRequestsPage />));
    const cancel = await screen.findAllByText(ADMIN_UI.cancelRequest);
    expect(cancel).toHaveLength(1);
    fireEvent.click(cancel[0]!);
    const ok = screen.getByText(ADMIN_UI.cancelConfirm) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(ADMIN_UI.cancelReason), {
      target: { value: 'بطلب الطرفين' },
    });
    fireEvent.click(ok);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/v1/admin/service-requests/1/cancel',
        body: { reason: 'بطلب الطرفين' },
      }),
    );
  });
});
