import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, tokens } from '../src/api/http';
import { SessionProvider } from '../src/auth/session';
import { AdminEngineersPage } from '../src/routes/admin-engineers';
import { RegisterPage } from '../src/routes/register';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SessionProvider>{ui}</SessionProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  localStorage.clear();
  tokens.clear();
  navigate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('turns an error envelope into an Arabic message', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(json(403, { error: { code: 'ENGINEER_NOT_VERIFIED', details: [] } })),
    );
    const err = await api('GET', '/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe(
      'حسابك قيد المراجعة. ستتلقى طلبات بعد توثيقه من الإدارة.',
    );
  });

  it('refreshes an expired token once, then retries the call', async () => {
    tokens.set('old', 'refresh-1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED' } }))
      .mockResolvedValueOnce(
        json(200, {
          data: {
            user: { id: '1', name: 'س', role: 'CUSTOMER' },
            accessToken: 'new',
            refreshToken: 'refresh-2',
          },
        }),
      )
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await api('GET', '/customers/me')).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retry = fetchMock.mock.calls[2]![1] as { headers: Record<string, string> };
    expect(retry.headers['Authorization']).toBe('Bearer new');
    expect(tokens.refresh).toBe('refresh-2');
  });

  it('reports a network failure as unavailable, in Arabic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(api('GET', '/x')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      message: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.',
    });
  });
});

describe('register page', () => {
  it('sends the engineer fields and goes to the engineer dashboard', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: unknown) =>
      url.endsWith('/services')
        ? json(200, {
            data: [
              {
                id: 's1',
                name: 'تركيب كاميرات',
                slug: 'x',
                description: null,
                isActive: true,
                category: { id: 'c', name: 'كاميرات المراقبة', slug: 'cctv' },
              },
            ],
          })
        : json(201, {
            data: {
              user: { id: '1', name: 'مهندس', role: 'ENGINEER' },
              accessToken: 'a',
              refreshToken: 'r',
            },
          }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(wrap(<RegisterPage />));
    fireEvent.click(screen.getByLabelText('مهندس أقدّم خدمة'));
    fireEvent.change(screen.getByLabelText('الاسم'), { target: { value: 'مهندس' } });
    fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '01012345678' } });
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'password-1' } });
    fireEvent.click(await screen.findByLabelText('تركيب كاميرات'));
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء حساب' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/engineer' }));
    const post = fetchMock.mock.calls.find((c) => c[0].endsWith('/auth/register'))!;
    expect(JSON.parse((post[1] as { body: string }).body)).toMatchObject({
      role: 'ENGINEER',
      serviceIds: ['s1'],
      hasShop: false,
    });
  });

  it('shows field-level Arabic messages from a validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(422, {
          error: {
            code: 'VALIDATION_ERROR',
            details: [
              { field: 'phone', code: 'custom' },
              { field: 'password', code: 'too_small' },
            ],
          },
        }),
      ),
    );
    render(wrap(<RegisterPage />));
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء حساب' }));
    expect(await screen.findByText('اكتب رقم هاتف مصري صحيحًا، مثل 01012345678.')).toBeTruthy();
    expect(screen.getByText('كلمة المرور 8 أحرف على الأقل.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('admin engineers page', () => {
  it('shows an empty state, and approves a pending engineer', async () => {
    const row = {
      id: 'e1',
      name: 'كريم',
      phone: '01012345678',
      accountStatus: 'ACTIVE',
      verificationStatus: 'PENDING',
      availabilityStatus: 'OFFLINE',
      documentsCount: 2,
    };
    let approved = false;
    const fetchMock = vi.fn(async (url: string, _init?: unknown) => {
      if (url.includes('/verify')) {
        approved = true;
        return json(200, { data: {} });
      }
      return json(200, { data: approved ? [] : [row] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(wrap(<AdminEngineersPage />));
    expect(await screen.findByText('كريم')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'توثيق' }));
    expect(await screen.findByText('لا يوجد مهندسون في هذه القائمة.')).toBeTruthy();
    const call = fetchMock.mock.calls.find((c) => c[0].includes('/verify'))!;
    expect(JSON.parse((call[1] as { body: string }).body)).toEqual({ approved: true });
  });
});
