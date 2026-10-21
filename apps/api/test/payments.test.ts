import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JOB_QUEUE, JOBS } from '../src/queue/queue.js';
import { boot } from './helpers.js';

const MERCHANT = 'MERCH123';
const KEY = 'secure-key-for-tests';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** A stand-in for Fawry's servers: records every call and answers like the documented API. */
const fawry = {
  calls: [] as { url: string; init?: RequestInit }[],
  fail: false,
  status: { paymentStatus: 'UNPAID' as string, orderAmount: undefined as number | undefined },
  fetch: (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    fawry.calls.push({ url: u, ...(init ? { init } : {}) });
    const json = (o: unknown, ok = true) =>
      ({ ok, status: ok ? 200 : 500, json: async () => o }) as Response;
    if (fawry.fail) return json({}, false);
    if (u.includes('/payments/charge')) {
      const body = JSON.parse(String(init!.body));
      return json({
        statusCode: 200,
        referenceNumber: `9${body.merchantRefNum.slice(0, 8).replace(/\D/g, '1')}`,
      });
    }
    return json({
      statusCode: 200,
      referenceNumber: '912345678',
      paymentStatus: fawry.status.paymentStatus,
      orderAmount: fawry.status.orderAmount,
    });
  }) as typeof fetch,
};

let t: Awaited<ReturnType<typeof boot>>;
let serviceId: string;
beforeAll(async () => {
  t = await boot(
    {
      FAWRY_MERCHANT_CODE: MERCHANT,
      FAWRY_SECURITY_KEY: KEY,
      FAWRY_BASE_URL: 'https://fawry.test',
      PAYMENT_RECONCILE_AFTER_MINUTES: '0',
    },
    fawry.fetch,
  );
  serviceId = ((await t.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
});
afterAll(async () => {
  await t.close();
});

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const tomorrow = () => new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

async function engineer() {
  const e = await t.newUser('ENGINEER', {
    serviceIds: [serviceId],
    name: 'كريم حسن',
    experienceYears: 4,
  });
  const id = (await e.get('/engineers/me')).body.data.id as string;
  await e.patch('/engineers/me/location', { ...CAIRO, area: 'وسط البلد' });
  await (await t.admin()).post(`/admin/engineers/${id}/verify`, { approved: true });
  await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
  return { ...e, engineerId: id };
}
const quote = () => ({
  items: [{ type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 500 }],
  estimatedDurationMinutes: 60,
});

/** Request with the main quote ACCEPTED (500 EGP) — the point where payment is chosen. */
async function accepted() {
  const eng = await engineer();
  const cust = await t.newUser('CUSTOMER', { name: 'منى السيد', email: `m${Math.random()}@x.com` });
  const res = await cust.post('/service-requests', {
    serviceId,
    description: 'تركيب كاميرا على باب المبنى',
    preferredDate: tomorrow(),
    location: { ...CAIRO, address: '12 شارع التحرير، الدقي', area: 'الدقي' },
  });
  const id = res.body.data.id as string;
  await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
  await eng.post(`/service-requests/${id}/accept`);
  const sent = await eng.post(`/service-requests/${id}/quotes`, quote());
  const acc = await cust.post(`/quotes/${sent.body.data.id}/accept`);
  expect(acc.status, JSON.stringify(acc.body)).toBe(200);
  return { eng, cust, id, jobId: acc.body.data.jobId as string };
}
type S = Awaited<ReturnType<typeof accepted>>;
const status = async (s: S) =>
  (await s.cust.get(`/service-requests/${s.id}`)).body.data.status as string;
const detail = async (s: S, who: 'cust' | 'eng' = 'cust') =>
  (await s[who].get(`/service-requests/${s.id}`)).body.data;

async function finishJob(s: S) {
  for (const step of ['start-trip', 'arrive', 'start', 'complete'])
    expect((await s.eng.post(`/jobs/${s.jobId}/${step}`)).status).toBe(200);
  expect((await s.cust.post(`/jobs/${s.jobId}/confirm-completion`)).status).toBe(200);
}

/** What Fawry would POST to us, signed the way Server Notification V2 describes. */
function callback(
  paymentId: string,
  o: Partial<{ status: string; amount: number; key: string; ref: string }> = {},
) {
  const b = {
    requestId: 'r-1',
    fawryRefNumber: o.ref ?? `9${paymentId.replace(/\D/g, '').slice(0, 8)}`,
    merchantRefNumber: paymentId.replaceAll('-', ''),
    paymentAmount: (o.amount ?? 500) + 5,
    orderAmount: o.amount ?? 500,
    orderStatus: o.status ?? 'PAID',
    paymentMethod: 'PAYATFAWRY',
    paymentRefrenceNumber: '55512345',
    messageSignature: '',
  };
  b.messageSignature = sha(
    b.fawryRefNumber +
      b.merchantRefNumber +
      b.paymentAmount.toFixed(2) +
      b.orderAmount.toFixed(2) +
      b.orderStatus +
      b.paymentMethod +
      b.paymentRefrenceNumber +
      (o.key ?? KEY),
  );
  return b;
}
const webhook = (body: unknown) =>
  t
    .http()
    .post('/api/v1/payments/webhook')
    .send(body as object);
const online = async (s: S) => {
  const r = await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'ONLINE' });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data as { paymentId: string; reference: string; amount: number };
};

describe('cash', () => {
  it('choosing cash confirms the booking at once; nothing is paid until the engineer confirms', async () => {
    const s = await accepted();
    expect((await detail(s)).availableActions).toEqual(
      expect.arrayContaining(['PAY_CASH', 'PAY_ONLINE']),
    );
    const r = await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ method: 'CASH', status: 'PENDING', amount: 500 });
    expect(await status(s)).toBe('CONFIRMED');
    const d = await detail(s);
    expect(d.job.confirmedAt).toBeTruthy();
    expect(d.payment).toMatchObject({ total: 500, paid: 0, due: 500, state: 'UNPAID' });
    // address and phone open up for the engineer once the booking is confirmed
    expect((await detail(s, 'eng')).customer.phone).toBeTruthy();
  });

  it('the engineer confirms receipt only after the customer confirmed completion', async () => {
    const s = await accepted();
    await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    expect((await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`)).status).toBe(409);
    await finishJob(s);
    expect((await s.cust.post(`/jobs/${s.jobId}/payments/confirm-cash`)).status).toBe(403);
    expect((await detail(s, 'eng')).availableActions).toContain('CONFIRM_CASH');
    const ok = await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data).toMatchObject({ paid: 500, due: 0, state: 'PAID' });
    expect((await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`)).status).toBe(409);
  });

  it('collects the extra work agreed after booking too', async () => {
    const s = await accepted();
    await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    for (const step of ['start-trip', 'arrive', 'start'])
      await s.eng.post(`/jobs/${s.jobId}/${step}`);
    const extra = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, {
      items: [{ type: 'MATERIAL', description: 'كابل إضافي', quantity: 1, unitPrice: 120 }],
      estimatedDurationMinutes: 20,
    });
    await s.cust.post(`/additional-quotes/${extra.body.data.id}/accept`);
    await s.eng.post(`/jobs/${s.jobId}/complete`);
    await s.cust.post(`/jobs/${s.jobId}/confirm-completion`);
    const ok = await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`);
    expect(ok.body.data).toMatchObject({ total: 620, paid: 620, due: 0, state: 'PAID' });
  });

  it('is only possible from QUOTE_ACCEPTED and never twice', async () => {
    const s = await accepted();
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(201);
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(409);
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'ONLINE' })).status).toBe(409);
  });

  it('is private: another customer, the engineer and anonymous callers cannot start a payment', async () => {
    const s = await accepted();
    const other = await t.newUser('CUSTOMER');
    expect((await other.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(404);
    expect((await s.eng.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(403);
    expect(
      (await t.http().post(`/api/v1/jobs/${s.jobId}/payments`).send({ method: 'CASH' })).status,
    ).toBe(401);
    expect(
      (await (await t.admin()).post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status,
    ).toBe(403);
  });

  it('ignores an amount sent by the client', async () => {
    const s = await accepted();
    const r = await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH', amount: 1 });
    expect(r.status).toBe(422);
    const ok = await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    expect(ok.body.data.amount).toBe(500);
  });
});

describe('online (Fawry)', () => {
  it('creates a signed order at Fawry and gives the customer a reference — the booking is NOT confirmed yet', async () => {
    const s = await accepted();
    fawry.calls.length = 0;
    const p = await online(s);
    expect(p.amount).toBe(500);
    expect(p.reference).toMatch(/^\d+$/);
    const call = fawry.calls.find((c) => c.url.endsWith('/ECommerceWeb/Fawry/payments/charge'))!;
    const body = JSON.parse(String(call.init!.body));
    expect(body).toMatchObject({ merchantCode: MERCHANT, amount: '500.00', currencyCode: 'EGP' });
    expect(body.merchantRefNum).toBe(p.paymentId.replaceAll('-', ''));
    expect(body.signature).toBe(
      sha(MERCHANT + body.merchantRefNum + 'PAYATFAWRY' + '500.00' + KEY),
    );
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
    const d = await detail(s);
    expect(d.payment.pending).toMatchObject({
      method: 'ONLINE',
      status: 'PENDING',
      reference: p.reference,
    });
    expect(d.availableActions).not.toContain('PAY_CASH'); // one payment at a time
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(409);
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'ONLINE' })).status).toBe(409);
  });

  it('a correctly signed PAID callback marks it paid and confirms the booking in one step', async () => {
    const s = await accepted();
    const p = await online(s);
    const res = await webhook(callback(p.paymentId));
    expect(res.status).toBe(200);
    expect(res.text).toBe('');
    expect(await status(s)).toBe('CONFIRMED');
    const d = await detail(s);
    expect(d.payment).toMatchObject({ paid: 500, due: 0, state: 'PAID', pending: null });
    expect(d.job.confirmedAt).toBeTruthy();
    expect(d.timeline.map((x: { code: string }) => x.code)).toContain('BOOKING_CONFIRMED');
    expect(await t.auditActions()).toContain('payment.paid');
  });

  it('the browser coming back from Fawry proves nothing: only the callback does', async () => {
    const s = await accepted();
    await online(s);
    // the customer "returns" and the page reloads: still waiting for the verified callback
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
    expect((await detail(s)).payment.state).toBe('UNPAID');
  });

  it('rejects a bad or missing signature and changes nothing', async () => {
    const s = await accepted();
    const p = await online(s);
    expect((await webhook(callback(p.paymentId, { key: 'wrong-key' }))).status).toBe(401);
    expect(
      (await webhook({ ...callback(p.paymentId), orderStatus: 'PAID', messageSignature: 'abcd' }))
        .status,
    ).toBe(401);
    expect((await webhook({ hello: 'world' })).status).toBe(401);
    // tampering with the amount after signing
    expect((await webhook({ ...callback(p.paymentId), orderAmount: 1 })).status).toBe(401);
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
  });

  it('is idempotent: the same callback twice is applied once', async () => {
    const s = await accepted();
    const p = await online(s);
    const cb = callback(p.paymentId);
    const count = async () => (await t.auditActions()).filter((a) => a === 'payment.paid').length;
    const before = await count();
    expect((await webhook(cb)).status).toBe(200);
    expect(await count()).toBe(before + 1);
    expect((await webhook(cb)).status).toBe(200); // Fawry retries: answered 200, applied once
    expect(await count()).toBe(before + 1);
    expect((await detail(s)).payment.paid).toBe(500);
    expect((await s.cust.get(`/jobs/${s.jobId}/payments`)).body.data.payments).toHaveLength(1);
  });

  it('does not accept money of a different size, and records why', async () => {
    const s = await accepted();
    const p = await online(s);
    expect((await webhook(callback(p.paymentId, { amount: 499 }))).status).toBe(200);
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
    expect((await detail(s)).payment).toMatchObject({ paid: 0, state: 'UNPAID' });
    expect(await t.auditActions()).toContain('payment.amount_mismatch');
  });

  it('an expired order fails, and the customer can start a new one', async () => {
    const s = await accepted();
    const p = await online(s);
    expect((await webhook(callback(p.paymentId, { status: 'EXPIRED' }))).status).toBe(200);
    const d = await detail(s);
    expect(d.payment.pending).toBeNull();
    expect(d.availableActions).toEqual(expect.arrayContaining(['PAY_CASH', 'PAY_ONLINE']));
    const p2 = await online(s);
    expect(p2.paymentId).not.toBe(p.paymentId);
  });

  it('a late PAID after EXPIRED is still honoured — the money was taken', async () => {
    const s = await accepted();
    const p = await online(s);
    await webhook(callback(p.paymentId, { status: 'EXPIRED' }));
    await webhook(callback(p.paymentId, { status: 'PAID' }));
    expect(await status(s)).toBe('CONFIRMED');
    expect((await detail(s)).payment.state).toBe('PAID');
  });

  it('NEW and unknown references are stored but change nothing', async () => {
    const s = await accepted();
    const p = await online(s);
    expect((await webhook(callback(p.paymentId, { status: 'NEW' }))).status).toBe(200);
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
    const ghost = '00000000-0000-4000-8000-0000000000aa';
    expect((await webhook(callback(ghost))).status).toBe(200);
    expect(await t.auditActions()).toContain('payment.unknown_reference');
  });

  it('online payment after completion settles the rest (extra work) without touching the booking', async () => {
    const s = await accepted();
    const p = await online(s);
    await webhook(callback(p.paymentId));
    for (const step of ['start-trip', 'arrive', 'start'])
      await s.eng.post(`/jobs/${s.jobId}/${step}`);
    const extra = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, {
      items: [{ type: 'MATERIAL', description: 'كابل إضافي', quantity: 1, unitPrice: 120 }],
      estimatedDurationMinutes: 20,
    });
    await s.cust.post(`/additional-quotes/${extra.body.data.id}/accept`);
    await s.eng.post(`/jobs/${s.jobId}/complete`);
    await s.cust.post(`/jobs/${s.jobId}/confirm-completion`);
    let d = await detail(s);
    expect(d.payment).toMatchObject({ total: 620, paid: 500, due: 120, state: 'PARTIAL' });
    expect(d.availableActions).toEqual(expect.arrayContaining(['PAY_ONLINE']));
    expect(d.availableActions).not.toContain('RATE');
    const p2 = await online(s);
    expect(p2.amount).toBe(120);
    await webhook(callback(p2.paymentId, { amount: 120, ref: '912345999' }));
    d = await detail(s);
    expect(d.payment).toMatchObject({ paid: 620, due: 0, state: 'PAID' });
    expect(d.status).toBe('COMPLETED');
    expect(d.availableActions).toContain('RATE');
  });

  it('says "unavailable" (503) when Fawry is down and leaves no stuck order behind', async () => {
    const s = await accepted();
    fawry.fail = true;
    const r = await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'ONLINE' });
    fawry.fail = false;
    expect(r.status).toBe(503);
    expect((await detail(s)).payment.pending).toBeNull();
    expect((await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' })).status).toBe(201);
  });
});

describe('reconciliation', () => {
  it('asks Fawry about orders still pending and applies the answer like a callback', async () => {
    const s = await accepted();
    const p = await online(s);
    const a = await t.admin();
    await new Promise((r) => setTimeout(r, 5));
    // Fawry still says unpaid: nothing changes
    const idle = await a.post('/admin/payments/reconcile');
    expect(idle.body.data.paid).toBe(0);
    expect(await status(s)).toBe('QUOTE_ACCEPTED');
    // the callback was lost, but Fawry knows the order is paid
    fawry.status = { paymentStatus: 'PAID', orderAmount: 500 };
    const r = await a.post('/admin/payments/reconcile');
    fawry.status = { paymentStatus: 'UNPAID', orderAmount: undefined };
    expect(r.body.data.paid).toBeGreaterThanOrEqual(1);
    expect(await status(s)).toBe('CONFIRMED');
    expect((await detail(s)).payment.state).toBe('PAID');
    expect(p.paymentId).toBeTruthy();
    // a second run has nothing left to do for it
    expect((await a.post('/admin/payments/reconcile')).body.data.paid).toBe(0);
  });

  it('runs by itself: the scheduled job reconciles and both sides are notified', async () => {
    const s = await accepted();
    await online(s);
    await new Promise((r) => setTimeout(r, 5));
    fawry.status = { paymentStatus: 'PAID', orderAmount: 500 };
    await t.app.get(JOB_QUEUE).add(JOBS.reconcile, {}); // what the worker fires every few minutes
    fawry.status = { paymentStatus: 'UNPAID', orderAmount: undefined };
    expect(await status(s)).toBe('CONFIRMED');
    const types = async (u: typeof s.cust) =>
      ((await u.get('/notifications')).body.data as { type: string }[]).map((n) => n.type);
    expect(await types(s.eng)).toContain('BOOKING_CONFIRMED');
    expect(await types(s.cust)).toContain('BOOKING_CONFIRMED'); // paid by the provider, not by the customer's click
  });

  it('is for admins only', async () => {
    const c = await t.newUser('CUSTOMER');
    expect((await c.post('/admin/payments/reconcile')).status).toBe(403);
  });
});

describe('Idempotency-Key', () => {
  it('replays the first answer instead of starting a second payment', async () => {
    const s = await accepted();
    const call = (body: object, key: string) =>
      s.cust.post(`/jobs/${s.jobId}/payments`, body, { 'Idempotency-Key': key });
    const first = await call({ method: 'ONLINE' }, 'key-aaaa-0001');
    const second = await call({ method: 'ONLINE' }, 'key-aaaa-0001');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    expect((await s.cust.get(`/jobs/${s.jobId}/payments`)).body.data.payments).toHaveLength(1);
    const clash = await call({ method: 'CASH' }, 'key-aaaa-0001');
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await call({ method: 'CASH' }, 'x')).status).toBe(422);
  });

  it('confirm-cash is safe to retry', async () => {
    const s = await accepted();
    await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    await finishJob(s);
    const k = { 'Idempotency-Key': 'confirm-0001-xx' };
    const a = await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`, undefined, k);
    const b = await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`, undefined, k);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.data.paid).toBe(500);
  });
});

describe('rating', () => {
  async function paidOnline() {
    const s = await accepted();
    const p = await online(s);
    await webhook(callback(p.paymentId));
    await finishJob(s);
    return s;
  }

  it('opens only after the job is completed AND fully paid; once; updates the engineer rating', async () => {
    const s = await accepted();
    await s.cust.post(`/jobs/${s.jobId}/payments`, { method: 'CASH' });
    await finishJob(s);
    const early = await s.cust.post(`/jobs/${s.jobId}/review`, { rating: 5 });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('PAYMENT_NOT_VERIFIED');
    await s.eng.post(`/jobs/${s.jobId}/payments/confirm-cash`);
    expect((await s.eng.post(`/jobs/${s.jobId}/review`, { rating: 5 })).status).toBe(403);
    expect((await s.cust.post(`/jobs/${s.jobId}/review`, { rating: 6 })).status).toBe(422);
    expect((await s.cust.post(`/jobs/${s.jobId}/review`, { rating: 0 })).status).toBe(422);
    const ok = await s.cust.post(`/jobs/${s.jobId}/review`, {
      rating: 4,
      comment: 'شغل نظيف وفي الميعاد',
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.data).toMatchObject({ rating: 4, status: 'RATED', customerName: 'منى' });
    expect(await status(s)).toBe('RATED');
    expect((await s.cust.post(`/jobs/${s.jobId}/review`, { rating: 5 })).status).toBe(409);
    const eng = await s.eng.get('/engineers/me');
    expect(eng.body.data.rating).toMatchObject({ average: 4, count: 1 });
  });

  it('averages several jobs and lists reviews without personal data', async () => {
    const a = await paidOnline();
    const engineerId = (await a.eng.get('/engineers/me')).body.data.id as string;
    await a.cust.post(`/jobs/${a.jobId}/review`, { rating: 5, comment: 'ممتاز' });
    const list = await a.cust.get(`/engineers/${engineerId}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ rating: 5, comment: 'ممتاز', customerName: 'منى' });
    expect(JSON.stringify(list.body)).not.toMatch(/01\d{9}/);
    expect((await a.cust.get(`/engineers/${engineerId}`)).body.data.rating).toMatchObject({
      average: 5,
      count: 1,
    });
    const other = await engineer();
    expect((await other.get(`/engineers/${engineerId}/reviews`)).status).toBe(403);
  });

  it('a stranger cannot rate someone else’s job', async () => {
    const s = await paidOnline();
    const other = await t.newUser('CUSTOMER');
    expect((await other.post(`/jobs/${s.jobId}/review`, { rating: 1 })).status).toBe(404);
  });
});

describe('contract', () => {
  it('payment detail never leaks the provider key or raw provider payload', async () => {
    const s = await accepted();
    await online(s);
    const body = JSON.stringify((await s.cust.get(`/jobs/${s.jobId}/payments`)).body);
    expect(body).not.toContain(KEY);
    expect(body).not.toContain('signature');
  });
});
