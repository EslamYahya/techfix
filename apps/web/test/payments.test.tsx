import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import { RequestDetailPage } from '../src/routes/customer';
import { EngineerRequestPage } from '../src/routes/engineer-request';
import { PAY_UI } from '../src/labels';

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  useParams: () => ({ requestId: 'r1' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const json = (status: number, data: unknown) =>
  ({ ok: status < 400, status, json: async () => ({ data }) }) as Response;
const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SessionProvider>{ui}</SessionProvider>
  </QueryClientProvider>
);
type Call = { method: string; url: string; body: unknown; headers: Record<string, string> };
const stub = (routes: Record<string, () => Response>) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (
        url: string,
        init?: { method?: string; body?: string; headers?: Record<string, string> },
      ) => {
        const method = init?.method ?? 'GET';
        calls.push({
          method,
          url,
          body: init?.body ? JSON.parse(init.body) : undefined,
          headers: init?.headers ?? {},
        });
        return routes[`${method} ${url.replace('/api/v1', '')}`]?.() ?? json(404, null);
      },
    ),
  );
  return calls;
};

const quote = {
  id: 'q1',
  kind: 'MAIN',
  status: 'ACCEPTED',
  items: [
    { type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 500, totalPrice: 500 },
  ],
  subtotal: 500,
  total: 500,
  estimatedDurationMinutes: 60,
  notes: null,
  rejectionReason: null,
  expiresAt: null,
};
const money = (o: object = {}) => ({
  total: 500,
  paid: 0,
  due: 500,
  state: 'UNPAID',
  pending: null,
  ...o,
});
const detail = (over: object = {}) => ({
  id: 'r1',
  number: 'R-1001',
  status: 'QUOTE_ACCEPTED',
  service: { id: 's1', name: 'تركيب كاميرات جديدة', category: 'كاميرات المراقبة' },
  description: 'أحتاج تركيب كاميرا',
  preferredDate: '2030-01-05',
  preferredSlot: 'EVENING',
  area: 'الدقي',
  createdAt: '2030-01-01T10:00:00Z',
  location: { area: 'الدقي', address: '12 شارع التحرير' },
  customer: { name: 'منى' },
  engineer: { id: 'e1', name: 'كريم حسن', area: 'وسط البلد' },
  cancelReason: null,
  quotes: [quote],
  job: { id: 'j1', status: 'QUOTE_ACCEPTED', agreedTotal: 500 },
  payment: money(),
  review: null,
  timeline: [],
  availableActions: ['PAY_CASH', 'PAY_ONLINE', 'CANCEL'],
  ...over,
});
const refresh = (d: object) => ({ 'GET /service-requests/r1': () => json(200, d) });

beforeEach(() => {
  localStorage.clear();
  tokens.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('customer: choosing how to pay', () => {
  it('offers cash and Fawry; picking cash sends the method only — never an amount', async () => {
    const calls = stub({
      ...refresh(detail()),
      'POST /jobs/j1/payments': () =>
        json(201, { paymentId: 'p1', method: 'CASH', status: 'PENDING', amount: 500 }),
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText(PAY_UI.chooseTitle)).toBeTruthy();
    expect(screen.getByText(PAY_UI.online)).toBeTruthy();
    fireEvent.click(screen.getByText(PAY_UI.cash));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/api/v1/jobs/j1/payments');
    expect(post.body).toEqual({ method: 'CASH' });
    expect(post.headers['Idempotency-Key']).toBeTruthy();
  });

  it('shows the Fawry number and waits for the verified confirmation — no "paid" on its own', async () => {
    stub(
      refresh(
        detail({
          payment: money({
            pending: {
              id: 'p1',
              method: 'ONLINE',
              status: 'PENDING',
              amount: 500,
              reference: '912345678',
              expiresAt: '2030-01-02T10:00:00Z',
              paidAt: null,
            },
          }),
          availableActions: ['CANCEL'],
        }),
      ),
    );
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('912345678')).toBeTruthy();
    expect(screen.getByText(PAY_UI.verifying)).toBeTruthy();
    expect(screen.queryByText(PAY_UI.cash)).toBeNull(); // one payment at a time
    expect(screen.queryByText(PAY_UI.paid)).toBeNull();
  });

  it('after booking by cash it only reminds the customer; after full payment it asks for a rating', async () => {
    stub(
      refresh(
        detail({
          status: 'CONFIRMED',
          payment: money({
            pending: {
              id: 'p1',
              method: 'CASH',
              status: 'PENDING',
              amount: 500,
              reference: null,
              expiresAt: null,
              paidAt: null,
            },
          }),
          availableActions: ['CANCEL'],
        }),
      ),
    );
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText(PAY_UI.cashPending)).toBeTruthy();
    cleanup();

    stub(
      refresh(
        detail({
          status: 'COMPLETED',
          payment: money({ paid: 500, due: 0, state: 'PAID' }),
          availableActions: ['RATE'],
        }),
      ),
    );
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText(PAY_UI.rateTitle)).toBeTruthy();
    expect(screen.getByText('مدفوع بالكامل')).toBeTruthy();
  });

  it('shows Arabic wording for a server error, never a code', async () => {
    stub({
      ...refresh(detail()),
      'POST /jobs/j1/payments': () =>
        ({
          ok: false,
          status: 503,
          json: async () => ({ error: { code: 'UNAVAILABLE' } }),
        }) as Response,
    });
    render(wrap(<RequestDetailPage />));
    fireEvent.click(await screen.findByText(PAY_UI.online));
    expect(await screen.findByText(/الخدمة غير متاحة مؤقتًا/)).toBeTruthy();
    expect(screen.queryByText(/UNAVAILABLE/)).toBeNull();
  });
});

describe('customer: rating', () => {
  it('needs a star choice, then sends rating and comment', async () => {
    const calls = stub({
      ...refresh(
        detail({
          status: 'COMPLETED',
          payment: money({ paid: 500, due: 0, state: 'PAID' }),
          availableActions: ['RATE'],
        }),
      ),
      'POST /jobs/j1/review': () => json(201, { rating: 4, status: 'RATED' }),
    });
    render(wrap(<RequestDetailPage />));
    const send = await screen.findByText(PAY_UI.rateSend);
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(`4 ${PAY_UI.stars}`));
    fireEvent.change(screen.getByLabelText(PAY_UI.comment), { target: { value: 'شغل نظيف' } });
    fireEvent.click(send);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/review'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/review'))?.body).toEqual({
      rating: 4,
      comment: 'شغل نظيف',
    });
  });

  it('shows the given rating once rated, with no form', async () => {
    stub(
      refresh(
        detail({
          status: 'RATED',
          payment: money({ paid: 500, due: 0, state: 'PAID' }),
          review: { rating: 5, comment: 'ممتاز' },
          availableActions: [],
        }),
      ),
    );
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('ممتاز')).toBeTruthy();
    expect(screen.queryByText(PAY_UI.rateSend)).toBeNull();
  });
});

describe('engineer: cash', () => {
  it('confirms the cash received once the job is completed, with an idempotency key', async () => {
    const calls = stub({
      ...refresh(
        detail({
          status: 'COMPLETED',
          customer: { name: 'منى', phone: '01111111111' },
          payment: money({
            pending: {
              id: 'p1',
              method: 'CASH',
              status: 'PENDING',
              amount: 500,
              reference: null,
              expiresAt: null,
              paidAt: null,
            },
          }),
          availableActions: ['CONFIRM_CASH'],
        }),
      ),
      'POST /jobs/j1/payments/confirm-cash': () => json(200, { paid: 500, due: 0, state: 'PAID' }),
    });
    render(wrap(<EngineerRequestPage />));
    fireEvent.click(await screen.findByText(PAY_UI.confirmCash));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/confirm-cash'))).toBe(true));
    expect(
      calls.find((c) => c.url.endsWith('/confirm-cash'))?.headers['Idempotency-Key'],
    ).toBeTruthy();
  });

  it('has no cash button before completion, and never shows rating controls', async () => {
    stub(
      refresh(
        detail({
          status: 'IN_PROGRESS',
          customer: { name: 'منى' },
          payment: money({
            pending: {
              id: 'p1',
              method: 'CASH',
              status: 'PENDING',
              amount: 500,
              reference: null,
              expiresAt: null,
              paidAt: null,
            },
          }),
          availableActions: ['COMPLETE_JOB'],
        }),
      ),
    );
    render(wrap(<EngineerRequestPage />));
    await screen.findByText(PAY_UI.title);
    expect(screen.queryByText(PAY_UI.confirmCash)).toBeNull();
    expect(screen.queryByText(PAY_UI.rateSend)).toBeNull();
  });
});
