import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.js';

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const tomorrow = () => new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

let t: Awaited<ReturnType<typeof boot>>;
let serviceId: string;
let admin: Awaited<ReturnType<typeof t.admin>>;
beforeAll(async () => {
  t = await boot();
  serviceId = ((await t.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
  admin = await t.admin();
});
afterAll(async () => {
  await t.close();
});

async function engineer() {
  const e = await t.newUser('ENGINEER', { serviceIds: [serviceId], name: 'كريم حسن' });
  const id = (await e.get('/engineers/me')).body.data.id as string;
  await e.patch('/engineers/me/location', { ...CAIRO, area: 'وسط البلد' });
  await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
  await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
  return { ...e, engineerId: id };
}
/** Booking confirmed by choosing cash; 500 EGP. */
async function booked() {
  const eng = await engineer();
  const cust = await t.newUser('CUSTOMER', { name: 'منى السيد' });
  const res = await cust.post('/service-requests', {
    serviceId,
    description: 'تركيب كاميرا على باب المبنى',
    preferredDate: tomorrow(),
    location: { ...CAIRO, address: '12 شارع التحرير، الدقي', area: 'الدقي' },
  });
  const id = res.body.data.id as string;
  await cust.post(`/service-requests/${id}/select-engineer`, { engineerId: eng.engineerId });
  await eng.post(`/service-requests/${id}/accept`);
  const sent = await eng.post(`/service-requests/${id}/quotes`, {
    items: [{ type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 500 }],
    estimatedDurationMinutes: 60,
  });
  const acc = await cust.post(`/quotes/${sent.body.data.id}/accept`);
  const jobId = acc.body.data.jobId as string;
  expect((await cust.post(`/jobs/${jobId}/payments`, { method: 'CASH' })).status).toBe(201);
  return { eng, cust, id, jobId };
}
type B = Awaited<ReturnType<typeof booked>>;
const run = async (b: B, upTo: 'complete' | 'confirm') => {
  for (const s of ['start-trip', 'arrive', 'start', 'complete'])
    expect((await b.eng.post(`/jobs/${b.jobId}/${s}`)).status).toBe(200);
  if (upTo === 'confirm') await b.cust.post(`/jobs/${b.jobId}/confirm-completion`);
};
const status = async (b: B) =>
  (await b.cust.get(`/service-requests/${b.id}`)).body.data.status as string;
const types = async (u: { get: (p: string) => Promise<{ body: any }> }) =>
  ((await u.get('/notifications')).body.data as { type: string }[]).map((n) => n.type);

describe('access', () => {
  it('is closed to everyone but admins', async () => {
    const c = await t.newUser('CUSTOMER');
    const e = await t.newUser('ENGINEER', { serviceIds: [serviceId] });
    const id = '00000000-0000-4000-8000-000000000000';
    for (const u of [c, e]) {
      for (const path of [
        '/admin/service-requests',
        '/admin/payments',
        '/admin/disputes',
        '/admin/reviews',
      ])
        expect((await u.get(path)).status, path).toBe(403);
      expect((await u.post(`/payments/${id}/refund`, { amount: 1, reason: 'xxx' })).status).toBe(
        403,
      );
      expect((await u.post(`/admin/disputes/${id}/resolve`, {})).status).toBe(403);
      expect((await u.post(`/admin/reviews/${id}/hide`, { hidden: true })).status).toBe(403);
      expect((await u.post(`/admin/service-requests/${id}/cancel`, { reason: 'xxx' })).status).toBe(
        403,
      );
    }
    expect((await t.http().get('/api/v1/admin/payments')).status).toBe(401);
  });
});

describe('finance', () => {
  it('lists payments and totals net of refunds', async () => {
    const b = await booked();
    let r = await admin.get('/admin/payments?method=CASH');
    expect(r.status).toBe(200);
    const row = (r.body.data as any[]).find((p) => p.jobId === b.jobId);
    expect(row).toMatchObject({ method: 'CASH', status: 'PENDING', amount: 500, refunded: 0 });
    expect(row.customerName).toBe('منى السيد');
    expect(row.requestNumber).toMatch(/^R-\d+$/);
    const before = r.body.meta.totals;

    await run(b, 'confirm');
    await b.eng.post(`/jobs/${b.jobId}/payments/confirm-cash`);
    r = await admin.get('/admin/payments?status=PAID');
    expect((r.body.data as any[]).some((p) => p.jobId === b.jobId)).toBe(true);
    expect(r.body.meta.totals.collectedNet).toBe(before.collectedNet + 500);
    expect(r.body.meta.totals.pendingCount).toBe(before.pendingCount - 1);
  });

  it('rejects unknown filters', async () => {
    expect((await admin.get('/admin/payments?status=NOPE')).status).toBe(422);
    expect((await admin.get('/admin/payments?method=CARD')).status).toBe(422);
  });

  it('refunds partly then fully, audits it, tells the customer, and never over-refunds', async () => {
    const b = await booked();
    await run(b, 'confirm');
    await b.eng.post(`/jobs/${b.jobId}/payments/confirm-cash`);
    const pid = ((await admin.get('/admin/payments?status=PAID')).body.data as any[]).find(
      (p) => p.jobId === b.jobId,
    ).id as string;

    expect((await admin.post(`/payments/${pid}/refund`, { amount: 100 })).status).toBe(422); // reason
    expect(
      (await admin.post(`/payments/${pid}/refund`, { amount: 600, reason: 'خطأ' })).status,
    ).toBe(422);
    const part = await admin.post(`/payments/${pid}/refund`, { amount: 150, reason: 'خصم اتفاق' });
    expect(part.status, JSON.stringify(part.body)).toBe(200);
    expect(part.body.data).toMatchObject({ status: 'PARTIALLY_REFUNDED', refunded: 150 });
    expect(
      (await admin.post(`/payments/${pid}/refund`, { amount: 351, reason: 'زيادة' })).status,
    ).toBe(422);
    const full = await admin.post(`/payments/${pid}/refund`, { amount: 350, reason: 'ردّ الباقي' });
    expect(full.body.data).toMatchObject({ status: 'REFUNDED', refunded: 500 });
    expect(
      (await admin.post(`/payments/${pid}/refund`, { amount: 1, reason: 'مرة أخرى' })).status,
    ).toBe(409);

    expect(await types(b.cust)).toContain('PAYMENT_REFUNDED');
    expect(await t.auditActions()).toContain('payment.refund');
    expect(
      (await admin.post(`/payments/not-a-uuid/refund`, { amount: 1, reason: 'xxx' })).status,
    ).toBe(404);
  });

  it('will not refund a payment that was never paid', async () => {
    const b = await booked();
    const pid = ((await admin.get('/admin/payments?status=PENDING')).body.data as any[]).find(
      (p) => p.jobId === b.jobId,
    ).id as string;
    expect(
      (await admin.post(`/payments/${pid}/refund`, { amount: 10, reason: 'تجربة' })).status,
    ).toBe(409);
  });
});

describe('reviews', () => {
  it('hides and restores a review, recomputing the engineer rating', async () => {
    const b = await booked();
    await run(b, 'confirm');
    await b.eng.post(`/jobs/${b.jobId}/payments/confirm-cash`);
    expect(
      (await b.cust.post(`/jobs/${b.jobId}/review`, { rating: 2, comment: 'متأخر' })).status,
    ).toBe(201);
    const rating = async () => (await b.eng.get('/engineers/me')).body.data.rating;
    expect(await rating()).toEqual({ average: 2, count: 1 });

    const all = (await admin.get('/admin/reviews')).body.data as any[];
    const rv = all.find((r) => r.comment === 'متأخر');
    expect(rv).toMatchObject({ rating: 2, hidden: false, customerName: 'منى السيد' });

    expect((await admin.post(`/admin/reviews/${rv.id}/hide`, { hidden: true })).status).toBe(200);
    expect(await rating()).toEqual({ average: 0, count: 0 });
    expect(
      ((await admin.get('/admin/reviews?hidden=true')).body.data as any[]).some(
        (r) => r.id === rv.id,
      ),
    ).toBe(true);
    expect(
      ((await admin.get('/admin/reviews?hidden=false')).body.data as any[]).some(
        (r) => r.id === rv.id,
      ),
    ).toBe(false);

    await admin.post(`/admin/reviews/${rv.id}/hide`, { hidden: false });
    expect(await rating()).toEqual({ average: 2, count: 1 });
    expect(await t.auditActions()).toEqual(
      expect.arrayContaining(['review.hide', 'review.unhide']),
    );
    expect((await admin.post(`/admin/reviews/${rv.id}/hide`, { hidden: 'yes' })).status).toBe(422);
  });
});

describe('disputes', () => {
  const open = async (b: B) => {
    await run(b, 'complete');
    const r = await b.cust.post(`/jobs/${b.jobId}/report-problem`, {
      reason: 'QUALITY',
      description: 'الكاميرا لا تعمل بعد التركيب',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.data.id as string;
  };

  it('reaches the admins, shows in the queue and can be closed without changing the request', async () => {
    const b = await booked();
    const id = await open(b);
    expect(await types(admin)).toContain('DISPUTE_OPENED');
    const q = (await admin.get('/admin/disputes?status=OPEN')).body.data as any[];
    expect(q.find((d) => d.id === id)).toMatchObject({
      status: 'OPEN',
      reason: 'QUALITY',
      openedByName: 'منى السيد',
      openedByRole: 'CUSTOMER',
    });
    expect(
      ((await admin.get('/admin/service-requests?hasDispute=true')).body.data as any[]).some(
        (r) => r.id === b.id,
      ),
    ).toBe(true);

    expect(
      (await admin.post(`/admin/disputes/${id}/resolve`, { outcome: 'CLOSE', resolution: 'x' }))
        .status,
    ).toBe(422);
    const r = await admin.post(`/admin/disputes/${id}/resolve`, {
      outcome: 'CLOSE',
      resolution: 'اتفق الطرفان على زيارة ثانية',
    });
    expect(r.body.data).toMatchObject({
      status: 'RESOLVED',
      resolution: 'اتفق الطرفان على زيارة ثانية',
    });
    expect(await status(b)).toBe('COMPLETION_PENDING');
    expect(await types(b.cust)).toContain('DISPUTE_RESOLVED');
    expect(await types(b.eng)).toContain('DISPUTE_RESOLVED');

    const again = await admin.post(`/admin/disputes/${id}/resolve`, {
      outcome: 'CLOSE',
      resolution: 'محاولة ثانية',
    });
    expect(again.status).toBe(409);
  });

  it('can confirm the completion for the customer', async () => {
    const b = await booked();
    const id = await open(b);
    const r = await admin.post(`/admin/disputes/${id}/resolve`, {
      outcome: 'CONFIRM_COMPLETION',
      resolution: 'تم فحص العمل وهو سليم',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await status(b)).toBe('COMPLETED');
    expect(await t.auditActions()).toContain('dispute.resolve');
  });

  it('can reject the complaint', async () => {
    const b = await booked();
    const id = await open(b);
    const r = await admin.post(`/admin/disputes/${id}/resolve`, {
      outcome: 'REJECT',
      resolution: 'لا أساس للشكوى',
    });
    expect(r.body.data.status).toBe('REJECTED');
    expect(await status(b)).toBe('COMPLETION_PENDING');
  });

  it('answers 404 for an unknown dispute', async () => {
    const r = await admin.post('/admin/disputes/00000000-0000-4000-8000-000000000000/resolve', {
      outcome: 'CLOSE',
      resolution: 'غير موجود',
    });
    expect(r.status).toBe(404);
  });
});

describe('requests', () => {
  it('lists with a status filter and cancels a confirmed booking with a reason', async () => {
    const b = await booked();
    const list = await admin.get('/admin/service-requests?status=CONFIRMED');
    expect((list.body.data as any[]).find((r) => r.id === b.id)).toMatchObject({
      status: 'CONFIRMED',
      customerName: 'منى السيد',
      engineerName: 'كريم حسن',
    });
    expect((await admin.get('/admin/service-requests?status=NOPE')).status).toBe(422);

    expect((await admin.post(`/admin/service-requests/${b.id}/cancel`, {})).status).toBe(422);
    const r = await admin.post(`/admin/service-requests/${b.id}/cancel`, {
      reason: 'بطلب الطرفين',
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await status(b)).toBe('CANCELLED');
    expect(await types(b.cust)).toContain('REQUEST_CANCELLED_BY_ADMIN');
    expect(await types(b.eng)).toContain('REQUEST_CANCELLED_BY_ADMIN');
    expect(await t.auditActions()).toContain('request.admin_cancel');
    expect(
      (await admin.post(`/admin/service-requests/${b.id}/cancel`, { reason: 'مرة ثانية' })).status,
    ).toBe(409);
  });

  it('may cancel a job on its way (admin only), but not one that is already completed', async () => {
    const b = await booked();
    await b.eng.post(`/jobs/${b.jobId}/start-trip`);
    expect((await b.cust.post(`/service-requests/${b.id}/cancel`, {})).status).toBe(409); // customer cannot
    expect(
      (await admin.post(`/admin/service-requests/${b.id}/cancel`, { reason: 'سبب إداري' })).status,
    ).toBe(200);

    const c = await booked();
    await run(c, 'confirm');
    expect(
      (await admin.post(`/admin/service-requests/${c.id}/cancel`, { reason: 'بعد الإنجاز' }))
        .status,
    ).toBe(409);
  });
});
