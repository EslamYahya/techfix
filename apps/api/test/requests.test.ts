import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot } from './helpers.js';

let t: Awaited<ReturnType<typeof boot>>;
let serviceId: string;
let otherServiceId: string;
beforeAll(async () => {
  t = await boot();
  const list = (await t.http().get('/api/v1/services')).body.data as { id: string }[];
  serviceId = list[0]!.id;
  otherServiceId = list[list.length - 1]!.id;
});
afterAll(async () => {
  await t.close();
});

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };
const tomorrow = () => new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

/** A verified, available engineer who does `serviceId`, based at the given point. */
async function engineer(
  opts: {
    at?: { latitude: number; longitude: number };
    services?: string[];
    verify?: boolean;
    radius?: number;
    experienceYears?: number;
  } = {},
) {
  const e = await t.newUser('ENGINEER', {
    serviceIds: opts.services ?? [serviceId],
    experienceYears: opts.experienceYears ?? 3,
  });
  const id = (await e.get('/engineers/me')).body.data.id as string;
  await e.patch('/engineers/me/location', { ...(opts.at ?? CAIRO), area: 'وسط البلد' });
  if (opts.radius) await e.patch('/engineers/me', { serviceRadiusKm: opts.radius });
  if (opts.verify !== false) {
    const admin = await t.admin();
    await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
    await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
  }
  return { ...e, engineerId: id };
}
const body = (extra: Record<string, unknown> = {}) => ({
  serviceId,
  description: 'الطبق لا يلتقط إشارة بعد العاصفة',
  preferredDate: tomorrow(),
  preferredSlot: 'EVENING',
  location: { ...CAIRO, address: '12 شارع التحرير، الدقي', area: 'الدقي' },
  ...extra,
});
async function request(
  c: Awaited<ReturnType<typeof t.newUser>>,
  extra: Record<string, unknown> = {},
) {
  const res = await c.post('/service-requests', body(extra));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: string; number: string; status: string };
}

describe('creating a request', () => {
  it('starts in MATCHING with a public number and a timeline entry', async () => {
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    expect(r).toMatchObject({ status: 'MATCHING' });
    expect(r.number).toMatch(/^R-\d+$/);
    const d = (await c.get(`/service-requests/${r.id}`)).body.data;
    expect(d.timeline.map((e: { code: string }) => e.code)).toEqual(['REQUEST_CREATED']);
    expect(d.availableActions).toEqual(expect.arrayContaining(['SELECT_ENGINEER', 'CANCEL']));
    expect(await t.auditActions()).toContain('request.create');
  });

  it('is for customers only', async () => {
    const e = await engineer();
    expect((await e.post('/service-requests', body())).status).toBe(403);
    expect((await t.http().post('/api/v1/service-requests').send(body())).status).toBe(401);
  });

  it.each([
    ['short description', { description: 'قصير' }],
    ['past date', { preferredDate: '2020-01-01' }],
    ['unknown service', { serviceId: '00000000-0000-4000-8000-000000000000' }],
    [
      'outside the supported area',
      { location: { latitude: 51.5, longitude: -0.12, address: 'London' } },
    ],
    ['end before start', { preferredStartTime: '19:00', preferredEndTime: '17:00' }],
    ['location without address or area', { location: { ...CAIRO } }],
    ['path-like attachment', { attachmentKeys: ['../secret'] }],
  ])('rejects %s with a field-level validation error', async (_n, extra) => {
    const c = await t.newUser('CUSTOMER');
    const res = await c.post('/service-requests', body(extra));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('visibility', () => {
  it('only the owner sees a request; everyone else gets 404', async () => {
    const owner = await t.newUser('CUSTOMER');
    const other = await t.newUser('CUSTOMER');
    const r = await request(owner);
    expect((await other.get(`/service-requests/${r.id}`)).status).toBe(404);
    expect((await other.post(`/service-requests/${r.id}/cancel`, {})).status).toBe(404);
    expect((await other.get(`/service-requests/${r.id}/recommendations`)).status).toBe(404);
    expect((await owner.get('/service-requests/not-a-uuid')).status).toBe(404);
    const mine = (await owner.get('/service-requests')).body.data;
    expect(mine.map((x: { id: string }) => x.id)).toEqual([r.id]);
    expect((await other.get('/service-requests')).body.data).toEqual([]);
  });

  it('lists newest first, filters by status and paginates', async () => {
    const c = await t.newUser('CUSTOMER');
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await request(c)).id);
    await c.post(`/service-requests/${ids[0]}/cancel`, {});
    const p1 = (await c.get('/service-requests?limit=2')).body;
    expect(p1.data).toHaveLength(2);
    expect(p1.meta.nextCursor).toBeTruthy();
    const p2 = (await c.get(`/service-requests?limit=2&cursor=${p1.meta.nextCursor}`)).body;
    expect(p2.data).toHaveLength(1);
    expect(p2.meta.nextCursor).toBeNull();
    const cancelled = (await c.get('/service-requests?status=CANCELLED')).body.data;
    expect(cancelled.map((x: { id: string }) => x.id)).toEqual([ids[0]]);
    expect((await c.get('/service-requests?status=BOGUS')).status).toBe(422);
  });
});

describe('matching', () => {
  it('recommends only eligible engineers, ranked, without any raw score', async () => {
    const near = await engineer({ experienceYears: 10 });
    const far = await engineer({ at: { latitude: 30.1, longitude: 31.4 }, radius: 3 }); // outside its own radius
    const unverified = await engineer({ verify: false });
    const wrongService = await engineer({ services: [otherServiceId] });
    const offline = await engineer();
    await offline.patch('/engineers/me/status', { status: 'OFFLINE' });
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    const rec = (await c.get(`/service-requests/${r.id}/recommendations`)).body.data as {
      engineerId: string;
    }[];
    const ids = rec.map((x) => x.engineerId);
    expect(ids).toContain(near.engineerId);
    for (const bad of [far, unverified, wrongService, offline])
      expect(ids).not.toContain(bad.engineerId);
    const first = rec[0]! as Record<string, unknown>;
    expect(Object.keys(first).sort()).toEqual(
      [
        'area',
        'availability',
        'completedJobs',
        'distanceKm',
        'engineerId',
        'etaMinutes',
        'name',
        'ratingCount',
        'rating',
        'reasons',
      ].sort(),
    );
    expect(JSON.stringify(rec)).not.toMatch(/score/i);
  });

  it('only the customer may ask, and only while MATCHING', async () => {
    const e = await engineer();
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    expect((await e.get(`/service-requests/${r.id}/recommendations`)).status).toBe(403);
    await c.post(`/service-requests/${r.id}/cancel`, {});
    const res = await c.get(`/service-requests/${r.id}/recommendations`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('selecting and answering', () => {
  it('walks MATCHING → ENGINEER_SELECTED → ENGINEER_ACCEPTED and hides contact data from the engineer', async () => {
    const e = await engineer();
    const c = await t.newUser('CUSTOMER', { name: 'منى السيد' });
    const r = await request(c);
    const sel = await c.post(`/service-requests/${r.id}/select-engineer`, {
      engineerId: e.engineerId,
    });
    expect(sel.status, JSON.stringify(sel.body)).toBe(200);
    expect(sel.body.data).toMatchObject({ requestId: r.id, status: 'ENGINEER_SELECTED' });

    const inbox = (await e.get('/engineer/requests')).body.data;
    expect(inbox.map((x: { id: string }) => x.id)).toEqual([r.id]);
    expect(inbox[0].customerName).toBe('منى');

    const seen = (await e.get(`/service-requests/${r.id}`)).body.data;
    expect(seen.availableActions).toEqual(
      expect.arrayContaining(['ENGINEER_ACCEPT', 'ENGINEER_REJECT']),
    );
    expect(seen.location).toEqual({ area: 'الدقي' });
    expect(seen.customer).toEqual({ name: 'منى' });
    expect(JSON.stringify(seen)).not.toContain('التحرير');

    const acc = await e.post(`/service-requests/${r.id}/accept`);
    expect(acc.body.data.status).toBe('ENGINEER_ACCEPTED');
    const cust = (await c.get(`/service-requests/${r.id}`)).body.data;
    expect(cust.engineer).toEqual({ id: e.engineerId, name: 'مستخدم تجريبي', area: 'وسط البلد' }); // no phone before CONFIRMED
    expect(cust.timeline.map((x: { code: string }) => x.code)).toEqual([
      'REQUEST_CREATED',
      'ENGINEER_SELECTED',
      'ENGINEER_ACCEPTED',
    ]);
    expect(await t.auditActions()).toEqual(
      expect.arrayContaining(['request.engineer_selected', 'request.engineer_accepted']),
    );
  });

  it('re-checks eligibility at selection time', async () => {
    const e = await engineer();
    const wrong = await engineer({ services: [otherServiceId] });
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    const res = await c.post(`/service-requests/${r.id}/select-engineer`, {
      engineerId: wrong.engineerId,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ENGINEER_NOT_ELIGIBLE');
    await e.patch('/engineers/me/status', { status: 'OFFLINE' }); // went offline after the list was shown
    expect(
      (await c.post(`/service-requests/${r.id}/select-engineer`, { engineerId: e.engineerId })).body
        .error.code,
    ).toBe('ENGINEER_NOT_ELIGIBLE');
    expect(
      (await c.post(`/service-requests/${r.id}/select-engineer`, { engineerId: 'x' })).status,
    ).toBe(422);
  });

  it('an engineer who declines returns the request to MATCHING and is never offered it again', async () => {
    const a = await engineer();
    const b = await engineer();
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    await c.post(`/service-requests/${r.id}/select-engineer`, { engineerId: a.engineerId });
    const rej = await a.post(`/service-requests/${r.id}/reject`, { reason: 'مشغول' });
    expect(rej.body.data.status).toBe('MATCHING');
    expect((await a.get(`/service-requests/${r.id}`)).status).toBe(404); // no longer theirs
    const ids = (await c.get(`/service-requests/${r.id}/recommendations`)).body.data.map(
      (x: { engineerId: string }) => x.engineerId,
    );
    expect(ids).toContain(b.engineerId);
    expect(ids).not.toContain(a.engineerId);
  });

  it('an unverified or unassigned engineer cannot answer', async () => {
    const assigned = await engineer();
    const stranger = await engineer();
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    await c.post(`/service-requests/${r.id}/select-engineer`, { engineerId: assigned.engineerId });
    expect((await stranger.post(`/service-requests/${r.id}/accept`)).status).toBe(404);
    expect((await c.post(`/service-requests/${r.id}/accept`)).status).toBe(403);
    const res = await assigned.post(`/service-requests/${r.id}/accept`);
    expect(res.status).toBe(200);
    expect((await assigned.post(`/service-requests/${r.id}/accept`)).status).toBe(409); // double click
  });

  it('the customer can change engineer; the old one is excluded', async () => {
    const a = await engineer();
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    await c.post(`/service-requests/${r.id}/select-engineer`, { engineerId: a.engineerId });
    await a.post(`/service-requests/${r.id}/accept`);
    const ch = await c.post(`/service-requests/${r.id}/change-engineer`);
    expect(ch.body.data.status).toBe('MATCHING');
    const ids = (await c.get(`/service-requests/${r.id}/recommendations`)).body.data.map(
      (x: { engineerId: string }) => x.engineerId,
    );
    expect(ids).not.toContain(a.engineerId);
    expect((await c.post(`/service-requests/${r.id}/change-engineer`)).status).toBe(409); // already MATCHING
  });
});

describe('cancelling', () => {
  it('is free before the booking is confirmed, keeps the reason, and is final', async () => {
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    const res = await c.post(`/service-requests/${r.id}/cancel`, { reason: 'غيّرت رأيي' });
    expect(res.body.data.status).toBe('CANCELLED');
    expect((await c.get(`/service-requests/${r.id}`)).body.data.cancelReason).toBe('غيّرت رأيي');
    expect((await c.post(`/service-requests/${r.id}/cancel`, {})).status).toBe(409);
    expect(
      (
        await c.post(`/service-requests/${r.id}/select-engineer`, {
          engineerId: '00000000-0000-4000-8000-000000000000',
        })
      ).status,
    ).toBe(409);
  });
});

describe('admin', () => {
  it('can read any request but cannot act as the customer', async () => {
    const c = await t.newUser('CUSTOMER');
    const r = await request(c);
    const admin = await t.admin();
    const d = await admin.get(`/service-requests/${r.id}`);
    expect(d.status).toBe(200);
    expect(d.body.data.availableActions).toEqual([]);
    expect((await admin.post(`/service-requests/${r.id}/cancel`, {})).status).toBe(403);
  });
});
