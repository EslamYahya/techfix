import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import { RequestDetailPage } from '../src/routes/customer';
import { EngineerRequestPage } from '../src/routes/engineer-request';

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
const stub = (routes: Record<string, () => Response>) => {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined });
      return routes[`${method} ${url.replace('/api/v1', '')}`]?.() ?? json(404, null);
    }),
  );
  return calls;
};

const item = {
  type: 'LABOR',
  description: 'تركيب وضبط',
  quantity: 1,
  unitPrice: 250,
  totalPrice: 250,
};
const quote = (over: object = {}) => ({
  id: 'q1',
  kind: 'MAIN',
  status: 'SENT',
  items: [item],
  subtotal: 250,
  total: 250,
  estimatedDurationMinutes: 90,
  notes: null,
  rejectionReason: null,
  expiresAt: null,
  ...over,
});
const detail = (over: object = {}) => ({
  id: 'r1',
  number: 'R-1001',
  status: 'QUOTE_SENT',
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
  quotes: [quote()],
  job: null,
  payment: null,
  timeline: [],
  availableActions: ['ACCEPT_QUOTE', 'REJECT_QUOTE', 'CHANGE_ENGINEER', 'CANCEL'],
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  tokens.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('customer: quote and job', () => {
  it('shows the server total in Egyptian pounds and accepts the quote', async () => {
    const calls = stub({
      'GET /service-requests/r1': () => json(200, detail()),
      'POST /quotes/q1/accept': () =>
        json(200, { requestId: 'r1', status: 'QUOTE_ACCEPTED', availableActions: [] }),
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('عرض السعر جاهز للمراجعة')).toBeTruthy();
    expect(screen.getAllByText(/٢٥٠/).length).toBeGreaterThan(0);
    expect(screen.getByText('أجر العمل', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText('أوافق على العرض'));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/quotes/q1/accept'))).toBe(true));
  });

  it('offers extra work only to accept or decline, and shows the agreed total', async () => {
    const calls = stub({
      'GET /service-requests/r1': () =>
        json(
          200,
          detail({
            status: 'IN_PROGRESS',
            quotes: [
              quote({ status: 'ACCEPTED' }),
              quote({ id: 'q2', kind: 'ADDITIONAL', total: 80 }),
            ],
            job: { id: 'j1', status: 'IN_PROGRESS', agreedTotal: 250 },
            payment: { total: 250, paid: 0, due: 250, state: 'UNPAID' },
            availableActions: ['ACCEPT_ADDITIONAL_QUOTE', 'REJECT_ADDITIONAL_QUOTE'],
          }),
        ),
      'POST /additional-quotes/q2/reject': () =>
        json(200, { requestId: 'r1', status: 'IN_PROGRESS', availableActions: [] }),
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('عمل إضافي مطلوب')).toBeTruthy();
    expect(screen.queryByText('أوافق على العرض')).toBeNull(); // the main quote is already accepted
    fireEvent.click(screen.getByText('لا أوافق'));
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/additional-quotes/q2/reject'))).toBe(true),
    );
  });

  it('confirms completion, or reports a problem', async () => {
    const calls = stub({
      'GET /service-requests/r1': () =>
        json(
          200,
          detail({
            status: 'COMPLETION_PENDING',
            quotes: [quote({ status: 'ACCEPTED' })],
            job: { id: 'j1', status: 'COMPLETION_PENDING', agreedTotal: 250 },
            payment: { total: 250, paid: 0, due: 250, state: 'UNPAID' },
            availableActions: ['CONFIRM_COMPLETION'],
          }),
        ),
      'POST /jobs/j1/report-problem': () => json(201, { id: 'd1' }),
    });
    render(wrap(<RequestDetailPage />));
    await screen.findByText('بانتظار تأكيدك للإنجاز');
    fireEvent.click(screen.getByText('الإبلاغ عن مشكلة'));
    fireEvent.change(screen.getByLabelText('اشرح المشكلة'), {
      target: { value: 'الكاميرا لا تعمل' },
    });
    fireEvent.click(screen.getByText('أرسل البلاغ'));
    expect(await screen.findByText('وصلنا بلاغك وسيراجعه فريق الدعم.')).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith('/report-problem'))?.body).toEqual({
      description: 'الكاميرا لا تعمل',
    });
  });
});

describe('engineer: quote and job', () => {
  it('sends items only — never a total', async () => {
    const calls = stub({
      'GET /service-requests/r1': () =>
        json(
          200,
          detail({
            status: 'ENGINEER_ACCEPTED',
            quotes: [],
            availableActions: ['SEND_QUOTE'],
            engineer: null,
          }),
        ),
      'POST /service-requests/r1/quotes': () => json(201, quote()),
    });
    render(wrap(<EngineerRequestPage />));
    await screen.findByText('جهّز عرض السعر');
    fireEvent.change(screen.getByLabelText('الوصف'), { target: { value: 'تركيب وضبط' } });
    fireEvent.change(screen.getByLabelText('سعر الوحدة'), { target: { value: '250' } });
    fireEvent.click(screen.getByText('أرسل عرض السعر'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      items: [{ type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 250 }],
      estimatedDurationMinutes: 60,
    });
    expect(JSON.stringify(body)).not.toMatch(/total/i);
  });

  it('shows the contact details only once the booking is confirmed, and the next job step', async () => {
    const calls = stub({
      'GET /service-requests/r1': () =>
        json(
          200,
          detail({
            status: 'CONFIRMED',
            quotes: [quote({ status: 'ACCEPTED' })],
            customer: { name: 'منى السيد', phone: '01012345678' },
            location: { area: 'الدقي', address: '12 شارع التحرير' },
            job: { id: 'j1', status: 'CONFIRMED', agreedTotal: 250 },
            availableActions: ['START_TRIP'],
          }),
        ),
      'POST /jobs/j1/start-trip': () =>
        json(200, { requestId: 'r1', status: 'ON_THE_WAY', availableActions: [] }),
    });
    render(wrap(<EngineerRequestPage />));
    expect(await screen.findByText(/01012345678/)).toBeTruthy();
    fireEvent.click(screen.getByText('بدأت التحرك إلى العميل'));
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith('/jobs/j1/start-trip'))).toBe(true),
    );
    expect(screen.queryByText('وصلت إلى الموقع')).toBeNull(); // not offered out of order
  });
});
