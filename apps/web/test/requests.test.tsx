import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import { CustomerHomePage, NewRequestPage, RequestDetailPage } from '../src/routes/customer';
import { EngineerPage } from '../src/routes/engineer';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
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
type Route = (method: string, body: unknown) => Response | undefined;
const stub = (routes: Record<string, Route>) => {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      const hit = Object.entries(routes).find(
        ([k]) => k === `${method} ${url.replace('/api/v1', '')}`,
      );
      return hit?.[1](method, body) ?? json(404, null);
    }),
  );
  return calls;
};

const summary = {
  id: 'r1',
  number: 'R-1001',
  status: 'MATCHING',
  service: { id: 's1', name: 'تركيب كاميرات جديدة', category: 'كاميرات المراقبة' },
  description: 'أحتاج تركيب أربع كاميرات',
  preferredDate: '2030-01-05',
  preferredSlot: 'EVENING',
  area: 'الدقي',
  createdAt: '2030-01-01T10:00:00Z',
};
const detail = (over: object = {}) => ({
  ...summary,
  location: { area: 'الدقي', address: '12 شارع التحرير' },
  customer: { name: 'منى' },
  engineer: null,
  cancelReason: null,
  quotes: [],
  job: null,
  payment: null,
  timeline: [
    {
      at: '2030-01-01T10:00:00Z',
      status: 'MATCHING',
      code: 'REQUEST_CREATED',
      actorRole: 'CUSTOMER',
    },
  ],
  availableActions: ['SELECT_ENGINEER', 'CANCEL'],
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  tokens.clear();
  navigate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('customer requests', () => {
  it('lists requests with the customer wording, never raw status codes', async () => {
    stub({ 'GET /service-requests': () => json(200, [{ ...summary, engineer: null }]) });
    render(wrap(<CustomerHomePage />));
    expect(await screen.findByText('اختر المهندس المناسب')).toBeTruthy();
    expect(screen.queryByText(/MATCHING/)).toBeNull();
  });

  it('shows an empty state', async () => {
    stub({ 'GET /service-requests': () => json(200, []) });
    render(wrap(<CustomerHomePage />));
    expect(await screen.findByText(/لا توجد طلبات بعد/)).toBeTruthy();
  });

  it('sends the new request and opens it', async () => {
    const calls = stub({
      'GET /services': () =>
        json(200, [
          {
            id: 's1',
            name: 'تركيب كاميرات جديدة',
            slug: 'x',
            description: null,
            isActive: true,
            category: { id: 'c', name: 'كاميرات المراقبة', slug: 'cctv' },
          },
        ]),
      'POST /service-requests': () => json(201, { id: 'r9', number: 'R-1009', status: 'MATCHING' }),
      'GET /service-requests': () => json(200, []),
    });
    render(wrap(<NewRequestPage />));
    await screen.findByText('تركيب كاميرات جديدة');
    fireEvent.change(screen.getByLabelText('الخدمة'), { target: { value: 's1' } });
    fireEvent.change(screen.getByLabelText('اشرح المشكلة'), {
      target: { value: 'أحتاج تركيب أربع كاميرات' },
    });
    fireEvent.change(screen.getByLabelText('التاريخ المناسب'), { target: { value: '2030-01-05' } });
    fireEvent.click(screen.getByText('أرسل الطلب'));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({
      serviceId: 's1',
      preferredDate: '2030-01-05',
      location: { area: 'وسط القاهرة' },
    });
    expect(JSON.stringify(post.body)).not.toMatch(/total|price/i);
  });

  it('shows field-level Arabic messages when the server rejects the form', async () => {
    stub({
      'GET /services': () => json(200, []),
      'POST /service-requests': () =>
        ({
          ok: false,
          status: 422,
          json: async () => ({
            error: {
              code: 'VALIDATION_ERROR',
              details: [{ field: 'description', code: 'too_small' }],
            },
          }),
        }) as Response,
    });
    render(wrap(<NewRequestPage />));
    fireEvent.change(screen.getByLabelText('اشرح المشكلة'), { target: { value: 'قصير' } });
    fireEvent.change(screen.getByLabelText('التاريخ المناسب'), { target: { value: '2030-01-05' } });
    fireEvent.change(screen.getByLabelText('الخدمة'), { target: { value: '' } });
    const form = screen.getByText('أرسل الطلب').closest('form')!;
    fireEvent.submit(form);
    expect(await screen.findByText('اشرح المشكلة في 10 أحرف على الأقل.')).toBeTruthy();
  });

  it('offers engineers while matching and selects one', async () => {
    const calls = stub({
      'GET /service-requests/r1': () => json(200, detail()),
      'GET /service-requests/r1/recommendations': () =>
        json(200, [
          {
            engineerId: 'e1',
            name: 'كريم حسن',
            area: 'وسط البلد',
            rating: 4.9,
            ratingCount: 12,
            completedJobs: 30,
            distanceKm: 2.1,
            etaMinutes: 14,
            availability: 'AVAILABLE',
            reasons: ['NEARBY', 'TOP_RATED'],
          },
        ]),
      'POST /service-requests/r1/select-engineer': () =>
        json(200, { requestId: 'r1', status: 'ENGINEER_SELECTED', availableActions: [] }),
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('كريم حسن')).toBeTruthy();
    expect(screen.getByText('قريب منك')).toBeTruthy();
    expect(screen.queryByText(/NEARBY/)).toBeNull();
    fireEvent.click(screen.getByText('اختر هذا المهندس'));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith('/select-engineer'))?.body).toEqual({
        engineerId: 'e1',
      }),
    );
  });

  it('after selection offers change/cancel and no engineer list', async () => {
    stub({
      'GET /service-requests/r1': () =>
        json(
          200,
          detail({
            status: 'ENGINEER_SELECTED',
            engineer: { id: 'e1', name: 'كريم حسن', area: 'وسط البلد' },
            availableActions: ['CHANGE_ENGINEER', 'CANCEL'],
          }),
        ),
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText('اختيار مهندس آخر')).toBeTruthy();
    expect(screen.getByText('بانتظار رد المهندس')).toBeTruthy();
    expect(screen.queryByText('اختر هذا المهندس')).toBeNull();
    expect(screen.queryByText(/01\d{9}/)).toBeNull(); // no phone before confirmation
  });

  it('shows a friendly message when the request is not theirs', async () => {
    stub({
      'GET /service-requests/r1': () =>
        ({
          ok: false,
          status: 404,
          json: async () => ({ error: { code: 'NOT_FOUND', details: [] } }),
        }) as Response,
    });
    render(wrap(<RequestDetailPage />));
    expect(await screen.findByText(/لم نجد هذا الطلب/)).toBeTruthy();
  });
});

describe('engineer inbox', () => {
  it('lets the engineer accept a request addressed to them', async () => {
    const calls = stub({
      'GET /engineers/me': () =>
        json(200, {
          id: 'e1',
          name: 'كريم',
          phone: '0100',
          email: null,
          accountStatus: 'ACTIVE',
          hasShop: false,
          bio: null,
          experienceYears: 3,
          verificationStatus: 'VERIFIED',
          rejectionReason: null,
          availabilityStatus: 'AVAILABLE',
          serviceRadiusKm: 15,
          rating: { average: 0, count: 0 },
          completedJobs: 0,
          services: [],
          location: null,
          schedule: [],
          documents: [],
        }),
      'GET /engineer/requests': () =>
        json(200, [{ ...summary, status: 'ENGINEER_SELECTED', customerName: 'منى' }]),
      'POST /service-requests/r1/accept': () =>
        json(200, { requestId: 'r1', status: 'ENGINEER_ACCEPTED', availableActions: [] }),
    });
    render(wrap(<EngineerPage />));
    expect(await screen.findByText('طلب جديد بانتظار ردّك')).toBeTruthy();
    expect(screen.getByText(/منى/)).toBeTruthy();
    fireEvent.click(screen.getByText('قبول الطلب'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/accept'))).toBe(true),
    );
  });
});
