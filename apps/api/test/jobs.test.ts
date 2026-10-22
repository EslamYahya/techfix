import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.js';

let t: Awaited<ReturnType<typeof boot>>;
let serviceId: string;
beforeAll(async () => {
  t = await boot();
  serviceId = ((await t.http().get('/api/v1/services')).body.data as { id: string }[])[0]!.id;
});
afterAll(async () => {
  await t.close();
});

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const tomorrow = () => new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
type U = Awaited<ReturnType<typeof t.newUser>>;

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
const items = (extra: object[] = []) => [
  { type: 'LABOR', description: 'تركيب وضبط', quantity: 1, unitPrice: 250 },
  { type: 'MATERIAL', description: 'كابل محوري', quantity: 3, unitPrice: 33.33 },
  ...extra,
];
const quote = (extra: object = {}) => ({ items: items(), estimatedDurationMinutes: 90, ...extra });

/** Customer + engineer with the request already at ENGINEER_ACCEPTED. */
async function accepted() {
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
  return { eng, cust, id };
}
async function quoted(q: object = quote()) {
  const s = await accepted();
  const sent = await s.eng.post(`/service-requests/${s.id}/quotes`, q);
  expect(sent.status, JSON.stringify(sent.body)).toBe(201);
  return { ...s, quoteId: sent.body.data.id as string, sent: sent.body.data };
}
async function booked() {
  const s = await quoted();
  const acc = await s.cust.post(`/quotes/${s.quoteId}/accept`);
  expect(acc.status, JSON.stringify(acc.body)).toBe(200);
  const jobId = acc.body.data.jobId as string;
  // Choosing cash is what confirms the booking (Release v1) — the real endpoint, not a shortcut.
  const pay = await s.cust.post(`/jobs/${jobId}/payments`, { method: 'CASH' });
  expect(pay.status, JSON.stringify(pay.body)).toBe(201);
  return { ...s, jobId };
}
const status = async (u: U, id: string) =>
  (await u.get(`/service-requests/${id}`)).body.data.status as string;

describe('main quote', () => {
  it('computes every total on the server, in exact money', async () => {
    const s = await quoted();
    expect(s.sent).toMatchObject({ kind: 'MAIN', status: 'SENT', subtotal: 349.99, total: 349.99 });
    expect(s.sent.items.map((i: { totalPrice: number }) => i.totalPrice)).toEqual([250, 99.99]);
    expect(await status(s.cust, s.id)).toBe('QUOTE_SENT');
    const seen = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(seen.quotes).toHaveLength(1);
    expect(seen.availableActions).toEqual(expect.arrayContaining(['ACCEPT_QUOTE', 'REJECT_QUOTE']));
    expect(await t.auditActions()).toContain('quote.send');
  });

  it.each([
    ['a client-sent total', { total: 1 }],
    [
      'a client-sent item total',
      { items: [{ type: 'LABOR', description: 'x', quantity: 1, unitPrice: 5, totalPrice: 1 }] },
    ],
    ['no items', { items: [] }],
    [
      'a negative price',
      { items: [{ type: 'LABOR', description: 'x', quantity: 1, unitPrice: -5 }] },
    ],
    ['zero quantity', { items: [{ type: 'LABOR', description: 'x', quantity: 0, unitPrice: 5 }] }],
    [
      'an unknown item type',
      { items: [{ type: 'GIFT', description: 'x', quantity: 1, unitPrice: 5 }] },
    ],
    ['no duration', { estimatedDurationMinutes: 0 }],
  ])('rejects %s', async (_n, extra) => {
    const s = await accepted();
    const res = await s.eng.post(`/service-requests/${s.id}/quotes`, quote(extra));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await status(s.cust, s.id)).toBe('ENGINEER_ACCEPTED');
  });

  it('only the assigned, accepted engineer may quote — once at a time', async () => {
    const s = await accepted();
    const stranger = await engineer();
    expect((await stranger.post(`/service-requests/${s.id}/quotes`, quote())).status).toBe(404);
    expect((await s.cust.post(`/service-requests/${s.id}/quotes`, quote())).status).toBe(403);
    expect((await s.eng.post(`/service-requests/${s.id}/quotes`, quote())).status).toBe(201);
    const again = await s.eng.post(`/service-requests/${s.id}/quotes`, quote());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejection lets the engineer send a revised quote; history is kept', async () => {
    const s = await quoted();
    const rej = await s.cust.post(`/quotes/${s.quoteId}/reject`, { reason: 'السعر مرتفع' });
    expect(rej.body.data.status).toBe('QUOTE_REJECTED');
    expect((await s.cust.post(`/quotes/${s.quoteId}/reject`, {})).status).toBe(409);
    const revised = await s.eng.post(
      `/service-requests/${s.id}/quotes`,
      quote({ items: [items()[0]] }),
    );
    expect(revised.status).toBe(201);
    const list = (await s.cust.get(`/service-requests/${s.id}/quotes`)).body.data;
    expect(list.map((q: { status: string }) => q.status)).toEqual(['REJECTED', 'SENT']);
    expect(list[0].rejectionReason).toBe('السعر مرتفع');
  });

  it('acceptance creates the job, freezes the price and cannot be repeated', async () => {
    const s = await quoted();
    expect((await s.eng.post(`/quotes/${s.quoteId}/accept`)).status).toBe(403); // engineers cannot accept
    const other = await t.newUser('CUSTOMER');
    expect((await other.post(`/quotes/${s.quoteId}/accept`)).status).toBe(404);
    const acc = await s.cust.post(`/quotes/${s.quoteId}/accept`);
    expect(acc.body.data).toMatchObject({ status: 'QUOTE_ACCEPTED', requestId: s.id });
    expect(acc.body.data.jobId).toBeTruthy();
    expect((await s.cust.post(`/quotes/${s.quoteId}/accept`)).status).toBe(409); // double click
    expect((await s.eng.post(`/service-requests/${s.id}/quotes`, quote())).status).toBe(409); // no second main quote
    const d = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(d.job).toMatchObject({ agreedTotal: 349.99, status: 'QUOTE_ACCEPTED' });
    expect(d.payment).toMatchObject({ total: 349.99, due: 349.99, paid: 0 });
    expect(d.quotes[0].status).toBe('ACCEPTED');
  });

  it('changing the engineer withdraws the open quote', async () => {
    const s = await quoted();
    await s.cust.post(`/service-requests/${s.id}/change-engineer`);
    const list = (await s.cust.get(`/service-requests/${s.id}/quotes`)).body.data;
    expect(list[0].status).toBe('CANCELLED');
    expect((await s.cust.post(`/quotes/${s.quoteId}/accept`)).status).toBe(409); // the request is back in matching
  });

  it('an expired quote cannot be accepted', async () => {
    const s = await quoted();
    // Expire the stored row itself: mutating a copy the repository hands out does not reach the
    // database, so it proves nothing about the adapter's own guard.
    await t.repos.quotes.expire(s.quoteId, new Date(Date.now() - 1000));
    const q = (await t.repos.quotes.get(s.quoteId))!;
    expect(q.expiresAt!.getTime()).toBeLessThan(Date.now());
    const res = await s.cust.post(`/quotes/${s.quoteId}/accept`);
    expect(res.status).toBe(409);
    // Nothing was decided: the request is still waiting for the customer to accept the quote.
    expect((await s.cust.get(`/service-requests/${s.id}`)).body.data.status).toBe('QUOTE_SENT');
  });

  it('an expired quote is refused when the row expires between the read and the write', async () => {
    // The service loads the quote, then the repository decides. Expiring the stored row while that
    // load is in flight leaves the service holding a valid copy and the database holding an expired
    // one — the repository has to make the call against the row it is actually deciding on.
    const s = await quoted();
    const realGet = t.repos.quotes.get.bind(t.repos.quotes);
    let patched = false;
    t.repos.quotes.get = (async (id: string) => {
      const row = await realGet(id);
      if (!patched && id === s.quoteId) {
        patched = true;
        await t.repos.quotes.expire(id, new Date(Date.now() - 1000));
      }
      return row; // still the valid copy the service read before the row moved
    }) as typeof t.repos.quotes.get;
    const res = await s.cust.post(`/quotes/${s.quoteId}/accept`);
    expect(res.status).toBe(409);
    // Nothing was decided: the request is still waiting for the customer to accept the quote.
    expect((await s.cust.get(`/service-requests/${s.id}`)).body.data.status).toBe('QUOTE_SENT');
  });
});

describe('job lifecycle', () => {
  it('walks CONFIRMED → ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETION_PENDING → COMPLETED in order', async () => {
    const s = await booked();
    // privacy flips at CONFIRMED
    const eng = (await s.eng.get(`/service-requests/${s.id}`)).body.data;
    expect(eng.location).toMatchObject({ address: '12 شارع التحرير، الدقي' });
    expect(eng.customer.phone).toBeTruthy();
    const cust = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(cust.engineer.phone).toBeTruthy();

    expect((await s.cust.post(`/jobs/${s.jobId}/start-trip`)).status).toBe(403);
    expect((await s.eng.post(`/jobs/${s.jobId}/arrive`)).status).toBe(409); // out of order
    expect((await s.eng.post(`/jobs/${s.jobId}/start-trip`)).body.data.status).toBe('ON_THE_WAY');
    expect((await s.eng.post(`/jobs/${s.jobId}/start-trip`)).status).toBe(409);
    expect((await s.eng.post(`/jobs/${s.jobId}/arrive`)).body.data.status).toBe('ARRIVED');
    expect((await s.eng.post(`/jobs/${s.jobId}/start`)).body.data.status).toBe('IN_PROGRESS');
    expect((await s.cust.post(`/jobs/${s.jobId}/confirm-completion`)).status).toBe(409); // not finished yet
    expect((await s.eng.post(`/jobs/${s.jobId}/complete`)).body.data.status).toBe(
      'COMPLETION_PENDING',
    );
    expect((await s.eng.post(`/jobs/${s.jobId}/confirm-completion`)).status).toBe(403);
    const done = await s.cust.post(`/jobs/${s.jobId}/confirm-completion`);
    expect(done.body.data.status).toBe('COMPLETED');
    expect((await s.cust.post(`/jobs/${s.jobId}/confirm-completion`)).status).toBe(409);

    const job = (await s.cust.get(`/jobs/${s.jobId}`)).body.data;
    expect(job).toMatchObject({ id: s.jobId, requestId: s.id, status: 'COMPLETED' });
    expect(job.job.confirmedByCustomerAt).toBeTruthy();
    expect(job.timeline.map((e: { code: string }) => e.code)).toEqual([
      'REQUEST_CREATED',
      'ENGINEER_SELECTED',
      'ENGINEER_ACCEPTED',
      'QUOTE_SENT',
      'QUOTE_ACCEPTED',
      'BOOKING_CONFIRMED',
      'TRIP_STARTED',
      'ARRIVED',
      'JOB_STARTED',
      'JOB_COMPLETED',
      'COMPLETION_CONFIRMED',
    ]);
    expect(await t.auditActions()).toEqual(
      expect.arrayContaining(['job.trip_started', 'job.job_completed', 'job.completion_confirmed']),
    );
  });

  it('is private to the two parties (and readable by admin)', async () => {
    const s = await booked();
    const other = await t.newUser('CUSTOMER');
    const stranger = await engineer();
    for (const u of [other, stranger]) expect((await u.get(`/jobs/${s.jobId}`)).status).toBe(404);
    expect((await stranger.post(`/jobs/${s.jobId}/start-trip`)).status).toBe(404);
    expect((await (await t.admin()).get(`/jobs/${s.jobId}`)).status).toBe(200);
    expect((await s.cust.get('/jobs/not-a-uuid')).status).toBe(404);
  });

  it('cannot be cancelled by the customer once the engineer is on the way', async () => {
    const s = await booked();
    expect((await s.cust.post(`/service-requests/${s.id}/cancel`, {})).body.data.status).toBe(
      'CANCELLED',
    );
    const s2 = await booked();
    await s2.eng.post(`/jobs/${s2.jobId}/start-trip`);
    expect((await s2.cust.post(`/service-requests/${s2.id}/cancel`, {})).status).toBe(409);
  });
});

describe('extra work', () => {
  async function inProgress() {
    const s = await booked();
    await s.eng.post(`/jobs/${s.jobId}/start-trip`);
    await s.eng.post(`/jobs/${s.jobId}/arrive`);
    await s.eng.post(`/jobs/${s.jobId}/start`);
    return s;
  }
  const extra = {
    items: [{ type: 'MATERIAL', description: 'مقسم إشارة', quantity: 2, unitPrice: 40 }],
    estimatedDurationMinutes: 20,
  };

  it('is allowed only while in progress, one at a time, linked to the main quote', async () => {
    const s = await booked();
    expect((await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra)).status).toBe(409); // not started
    await s.eng.post(`/jobs/${s.jobId}/start-trip`);
    await s.eng.post(`/jobs/${s.jobId}/arrive`);
    await s.eng.post(`/jobs/${s.jobId}/start`);
    expect((await s.cust.post(`/jobs/${s.jobId}/additional-quotes`, extra)).status).toBe(403);
    const sent = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra);
    expect(sent.status).toBe(201);
    expect(sent.body.data).toMatchObject({ kind: 'ADDITIONAL', status: 'SENT', total: 80 });
    const second = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PENDING_ADDITIONAL_QUOTE');
    const d = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(d.availableActions).toEqual(
      expect.arrayContaining(['ACCEPT_ADDITIONAL_QUOTE', 'REJECT_ADDITIONAL_QUOTE']),
    );
  });

  it('blocks finishing until decided; accepting adds to the agreed total', async () => {
    const s = await inProgress();
    const sent = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra);
    const blocked = await s.eng.post(`/jobs/${s.jobId}/complete`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PENDING_ADDITIONAL_QUOTE');
    expect((await s.eng.post(`/additional-quotes/${sent.body.data.id}/accept`)).status).toBe(403);
    const ok = await s.cust.post(`/additional-quotes/${sent.body.data.id}/accept`);
    expect(ok.body.data.status).toBe('IN_PROGRESS');
    expect((await s.cust.post(`/additional-quotes/${sent.body.data.id}/accept`)).status).toBe(409);
    const d = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(d.job.agreedTotal).toBe(429.99);
    expect(d.payment.due).toBe(429.99);
    expect((await s.eng.post(`/jobs/${s.jobId}/complete`)).body.data.status).toBe(
      'COMPLETION_PENDING',
    );
  });

  it('a rejected extra keeps the original price and lets the engineer ask again', async () => {
    const s = await inProgress();
    const sent = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra);
    const rej = await s.cust.post(`/additional-quotes/${sent.body.data.id}/reject`, {
      reason: 'ليس الآن',
    });
    expect(rej.status).toBe(200);
    const d = (await s.cust.get(`/service-requests/${s.id}`)).body.data;
    expect(d.job.agreedTotal).toBe(349.99);
    expect(d.quotes.map((q: { status: string }) => q.status)).toEqual(['ACCEPTED', 'REJECTED']);
    expect((await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra)).status).toBe(201);
  });

  it('a main quote id cannot be used on the extra-work routes and vice versa', async () => {
    const s = await inProgress();
    const main = (await s.cust.get(`/service-requests/${s.id}/quotes`)).body.data[0].id;
    expect((await s.cust.post(`/additional-quotes/${main}/accept`)).status).toBe(404);
    const sent = await s.eng.post(`/jobs/${s.jobId}/additional-quotes`, extra);
    expect((await s.cust.post(`/quotes/${sent.body.data.id}/accept`)).status).toBe(404);
  });
});

describe('reporting a problem', () => {
  it('opens a dispute only while waiting for the customer to confirm, and leaves the state alone', async () => {
    const s = await booked();
    expect(
      (await s.cust.post(`/jobs/${s.jobId}/report-problem`, { description: 'العمل غير مكتمل' }))
        .status,
    ).toBe(409);
    await s.eng.post(`/jobs/${s.jobId}/start-trip`);
    await s.eng.post(`/jobs/${s.jobId}/arrive`);
    await s.eng.post(`/jobs/${s.jobId}/start`);
    await s.eng.post(`/jobs/${s.jobId}/complete`);
    expect(
      (await s.cust.post(`/jobs/${s.jobId}/report-problem`, { description: 'قص' })).status,
    ).toBe(422);
    const res = await s.cust.post(`/jobs/${s.jobId}/report-problem`, {
      description: 'الكاميرا لا تعمل بعد التركيب',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();
    expect(await status(s.cust, s.id)).toBe('COMPLETION_PENDING');
    expect(await t.auditActions()).toContain('dispute.open');
  });
});
