import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { InlineQueue, JOBS, type JobName, type Repeat } from '../src/queue/queue.js';
import { boot } from './helpers.js';

/** Remembers what the workers were asked to schedule; never runs anything by itself. */
class RecordingQueue extends InlineQueue {
  started: Repeat[] | null = null;
  override async startWorkers(r: Repeat[]) {
    this.started = r;
  }
}
/** A queue that loses every job — the outbox sweep must still deliver. */
class LossyQueue extends InlineQueue {
  override async add(_n: JobName) {}
}

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const tomorrow = () => new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

let t: Awaited<ReturnType<typeof boot>>;
let serviceId: string;
beforeAll(async () => {
  t = await boot();
  serviceId = ((await t.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
});
afterAll(async () => {
  await t.close();
});

async function engineer(tt = t, sid = serviceId) {
  const e = await tt.newUser('ENGINEER', { serviceIds: [sid], name: 'كريم حسن' });
  const id = (await e.get('/engineers/me')).body.data.id as string;
  await e.patch('/engineers/me/location', { ...CAIRO, area: 'وسط البلد' });
  await (await tt.admin()).post(`/admin/engineers/${id}/verify`, { approved: true });
  await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
  return { ...e, engineerId: id };
}
const quote = () => ({
  items: [{ type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 500 }],
  estimatedDurationMinutes: 60,
});
async function newRequest(tt = t, sid = serviceId) {
  const eng = await engineer(tt, sid);
  const cust = await tt.newUser('CUSTOMER', { name: 'منى السيد' });
  const res = await cust.post('/service-requests', {
    serviceId: sid,
    description: 'تركيب كاميرا على باب المبنى',
    preferredDate: tomorrow(),
    location: { ...CAIRO, address: '12 شارع التحرير، الدقي', area: 'الدقي' },
  });
  return { eng, cust, id: res.body.data.id as string };
}
const mine = async (u: { get: (p: string) => Promise<{ body: any }> }, q = '') =>
  (await u.get(`/notifications${q}`)).body as {
    data: { id: string; type: string; body: string; read: boolean; data: any }[];
    meta: { unreadCount: number; nextCursor: string | null };
  };

describe('notifications follow the request', () => {
  it('tells the right person at each step, never the one who acted', async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    expect((await mine(eng)).data.map((n) => n.type)).toEqual(['ENGINEER_SELECTED']);
    expect((await mine(cust)).data).toHaveLength(0); // the customer acted: no echo

    await eng.post(`/service-requests/${id}/accept`);
    const sent = await eng.post(`/service-requests/${id}/quotes`, quote());
    expect((await mine(cust)).data.map((n) => n.type)).toEqual(['QUOTE_SENT', 'ENGINEER_ACCEPTED']);

    const acc = await cust.post(`/quotes/${sent.body.data.id}/accept`);
    const jobId = acc.body.data.jobId as string;
    expect((await mine(eng)).data[0]!.type).toBe('QUOTE_ACCEPTED');

    expect((await cust.post(`/jobs/${jobId}/payments`, { method: 'CASH' })).status).toBe(201);
    // both sides learn the booking is confirmed; the customer who did it is skipped
    expect((await mine(eng)).data[0]).toMatchObject({ type: 'BOOKING_CONFIRMED' });
    expect((await mine(cust)).data.some((n) => n.type === 'BOOKING_CONFIRMED')).toBe(false);

    for (const step of ['start-trip', 'arrive', 'start', 'complete'])
      await eng.post(`/jobs/${jobId}/${step}`);
    const types = (await mine(cust)).data.map((n) => n.type);
    expect(types.slice(0, 4)).toEqual(['JOB_COMPLETED', 'JOB_STARTED', 'ARRIVED', 'TRIP_STARTED']);

    await cust.post(`/jobs/${jobId}/confirm-completion`);
    await eng.post(`/jobs/${jobId}/payments/confirm-cash`);
    expect((await mine(cust)).data[0]!.type).toBe('CASH_RECEIVED');
    await cust.post(`/jobs/${jobId}/review`, { rating: 5 });
    expect((await mine(eng)).data[0]!.type).toBe('REVIEWED');
  });

  it('carries a deep link and an Arabic fallback text with the request number', async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    const n = (await mine(eng)).data[0]!;
    expect(n.data.requestId).toBe(id);
    expect(n.body).toMatch(/[؀-ۿ]/);
    expect(n.body).not.toContain('{n}');
    expect(n.body).toMatch(/TF-\d+|\d{4}/);
  });

  it('notifies the engineer who was replaced, after the request already forgot him', async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    await cust.post(`/service-requests/${id}/change-engineer`);
    const types = (await mine(eng)).data.map((n) => n.type);
    expect(types).toContain('ENGINEER_CHANGED');
  });

  it('the engineer is told when the customer cancels', async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    await cust.post(`/service-requests/${id}/cancel`, { reason: 'تغيّر الموعد' });
    expect((await mine(eng)).data[0]!.type).toBe('REQUEST_CANCELLED');
  });
});

describe('reading and marking', () => {
  it('counts unread, filters, marks one and all, and pages', async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    await eng.post(`/service-requests/${id}/accept`);
    await eng.post(`/service-requests/${id}/quotes`, quote());
    // customer has 2 (accepted, quote); engineer has 1
    let list = await mine(cust);
    expect(list.meta.unreadCount).toBe(2);

    const first = list.data[0]!;
    expect((await cust.post(`/notifications/${first.id}/read`)).status).toBe(204);
    list = await mine(cust);
    expect(list.meta.unreadCount).toBe(1);
    expect((await mine(cust, '?unread=true')).data).toHaveLength(1);

    const page1 = await mine(cust, '?limit=1');
    expect(page1.data).toHaveLength(1);
    expect(page1.meta.nextCursor).toBeTruthy();
    const page2 = await mine(cust, `?limit=1&cursor=${page1.meta.nextCursor}`);
    expect(page2.data[0]!.id).not.toBe(page1.data[0]!.id);

    expect((await cust.post('/notifications/read-all')).status).toBe(204);
    expect((await mine(cust)).meta.unreadCount).toBe(0);
  });

  it("someone else's notification looks like it does not exist", async () => {
    const { eng, cust, id } = await newRequest();
    await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
    const n = (await mine(eng)).data[0]!;
    expect((await cust.post(`/notifications/${n.id}/read`)).status).toBe(404);
    expect((await mine(eng)).meta.unreadCount).toBeGreaterThan(0);
  });

  it('requires a session and validates device registration', async () => {
    expect((await t.http().get('/api/v1/notifications')).status).toBe(401);
    const u = await t.newUser('CUSTOMER');
    expect(
      (await u.post('/notifications/devices', { token: 'x', platform: 'ANDROID' })).status,
    ).toBe(422);
    expect(
      (await u.post('/notifications/devices', { token: 'fcm-token-123456', platform: 'ANDROID' }))
        .status,
    ).toBe(204);
  });
});

describe('outbox: nothing is lost when the queue is', () => {
  it('delivers through the sweep when the queue dropped the job, exactly once', async () => {
    const tt = await boot({}, undefined, new LossyQueue());
    try {
      const sid = ((await tt.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
      const { eng, cust, id } = await newRequest(tt, sid);
      await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
      expect((await mine(eng)).data).toHaveLength(0); // job lost, row waiting
      expect(await tt.repos.outbox.backlog()).toBeGreaterThan(0);

      const svc = tt.app.get(NotificationsService);
      const first = await svc.sweep();
      expect(first.delivered).toBe(first.leased);
      expect((await mine(eng)).data).toHaveLength(1);
      expect(await tt.repos.outbox.backlog()).toBe(0);
      expect((await svc.sweep()).leased).toBe(0); // nothing is delivered twice
    } finally {
      await tt.close();
    }
  });

  it('retries a failed delivery later without duplicating', async () => {
    const tt = await boot({}, undefined, new LossyQueue());
    try {
      const sid = ((await tt.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
      const { eng, cust, id } = await newRequest(tt, sid);
      await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });

      const real = tt.repos.notifications.createOnce.bind(tt.repos.notifications);
      let fail = true;
      tt.repos.notifications.createOnce = async (n: Parameters<typeof real>[0]) => {
        if (fail) throw new Error('db blip');
        return real(n);
      };
      const svc = tt.app.get(NotificationsService);
      const a = await svc.sweep();
      expect(a).toMatchObject({ leased: 1, delivered: 0 });
      expect(await tt.repos.outbox.backlog()).toBe(1);
      expect((await svc.sweep()).leased).toBe(0); // backing off, not hammered

      fail = false;
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 60_000); // the backoff has passed
      const b = await svc.sweep();
      expect(b).toMatchObject({ leased: 1, delivered: 1 });
      expect((await mine(eng)).data).toHaveLength(1); // once, not twice
      expect(await tt.repos.outbox.backlog()).toBe(0);
    } finally {
      vi.useRealTimers();
      await tt.close();
    }
  });

  it('a broken outbox never breaks the action the person took', async () => {
    const tt = await boot();
    try {
      const sid = ((await tt.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
      tt.repos.outbox.enqueue = async () => {
        throw new Error('outbox down');
      };
      const { eng, cust, id } = await newRequest(tt, sid);
      const r = await cust.post(`/service-requests/${id}/select-engineer`, {
        engineerId: eng.engineerId,
      });
      expect(r.status).toBe(200);
    } finally {
      await tt.close();
    }
  });
});

describe('workers', () => {
  it('start the sweep and the payment reconciliation when RUN_WORKERS is on and Fawry is set', async () => {
    const q = new RecordingQueue();
    const tt = await boot(
      {
        RUN_WORKERS: 'true',
        FAWRY_MERCHANT_CODE: 'M',
        FAWRY_SECURITY_KEY: 'k',
        FAWRY_BASE_URL: 'https://fawry.test',
        OUTBOX_SWEEP_INTERVAL_SECONDS: '5',
        PAYMENT_RECONCILE_INTERVAL_MINUTES: '2',
      },
      undefined,
      q,
    );
    try {
      expect(q.started).toEqual([
        { name: JOBS.sweep, everyMs: 5_000 },
        { name: JOBS.reconcile, everyMs: 120_000 },
      ]);
    } finally {
      await tt.close();
    }
  });

  it('stay off by default in tests, and skip reconciliation without a provider', async () => {
    const off = new RecordingQueue();
    const a = await boot({}, undefined, off);
    const on = new RecordingQueue();
    const b = await boot({ RUN_WORKERS: 'true' }, undefined, on);
    try {
      expect(off.started).toBeNull();
      expect(on.started?.map((r) => r.name)).toEqual([JOBS.sweep]);
    } finally {
      await a.close();
      await b.close();
    }
  });
});

describe('rules', () => {
  it('have a text and an audience for every notification type, and nothing extra', async () => {
    const { NOTIFICATION_TYPES } = await import('@techfix/domain');
    const { NOTIFICATION_RULES } = await import('../src/notifications/texts.js');
    expect(Object.keys(NOTIFICATION_RULES).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    for (const r of Object.values(NOTIFICATION_RULES)) {
      expect(r.title).toMatch(/[؀-ۿ]/);
      expect(r.body).toMatch(/[؀-ۿ]/);
    }
  });
});
