import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateSchedule } from '../src/engineers/schedule.js';
import { boot } from './helpers.js';

let t: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => {
  t = await boot();
});
afterAll(async () => {
  await t.close();
});

const serviceIds = async () => {
  const res = await t.http().get('/api/v1/services');
  return res.body.data.map((s: { id: string }) => s.id) as string[];
};

describe('catalog', () => {
  it('lists the four launch categories and their services without login', async () => {
    const cats = await t.http().get('/api/v1/service-categories');
    expect(cats.body.data.map((c: { slug: string }) => c.slug).sort()).toEqual([
      'cctv',
      'intercom',
      'network',
      'satellite',
    ]);
    const cctv = await t.http().get('/api/v1/services?category=cctv');
    expect(cctv.body.data.length).toBeGreaterThan(0);
    expect(
      cctv.body.data.every((s: { category: { slug: string } }) => s.category.slug === 'cctv'),
    ).toBe(true);
  });
  it('returns 404 for an unknown or malformed service id', async () => {
    expect((await t.http().get('/api/v1/services/not-a-uuid')).status).toBe(404);
    expect(
      (await t.http().get('/api/v1/services/00000000-0000-4000-8000-000000000000')).status,
    ).toBe(404);
  });
  it('lets only admins manage services, and audits it', async () => {
    const c = await t.newUser('CUSTOMER');
    expect((await c.post('/admin/services', {})).status).toBe(403);
    const admin = await t.admin();
    const cat = (await t.http().get('/api/v1/service-categories')).body.data[0].id;
    const created = await admin.post('/admin/services', {
      categoryId: cat,
      name: 'خدمة جديدة',
      slug: 'new-service',
    });
    expect(created.status).toBe(201);
    expect(
      (await admin.post('/admin/services', { categoryId: cat, name: 'مكررة', slug: 'new-service' }))
        .status,
    ).toBe(409);
    const off = await admin.patch(`/admin/services/${created.body.data.id}`, { isActive: false });
    expect(off.body.data.isActive).toBe(false);
    expect((await t.http().get(`/api/v1/services/${created.body.data.id}`)).status).toBe(404); // hidden once inactive
    expect(await t.auditActions()).toEqual(
      expect.arrayContaining(['service.create', 'service.update']),
    );
  });
});

describe('engineer onboarding', () => {
  it('registers as PENDING, offline, with chosen specialisations', async () => {
    const ids = (await serviceIds()).slice(0, 2);
    const e = await t.newUser('ENGINEER', { serviceIds: ids, experienceYears: 6, hasShop: true });
    expect(e.res.status).toBe(201);
    const me = (await e.get('/engineers/me')).body.data;
    expect(me).toMatchObject({
      verificationStatus: 'PENDING',
      availabilityStatus: 'OFFLINE',
      hasShop: true,
      experienceYears: 6,
      accountStatus: 'ACTIVE',
    });
    expect(me.services).toHaveLength(2);
  });
  it('cannot go online until verified', async () => {
    const e = await t.newUser('ENGINEER');
    const res = await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENGINEER_NOT_VERIFIED');
  });
  it('manages profile, location, documents and specialisations while pending', async () => {
    const [s1, s2] = await serviceIds();
    const e = await t.newUser('ENGINEER');
    expect(
      (await e.patch('/engineers/me', { bio: 'فني خبرة', serviceRadiusKm: 25 })).body.data,
    ).toMatchObject({ bio: 'فني خبرة', serviceRadiusKm: 25 });
    expect((await e.patch('/engineers/me', {})).status).toBe(422);
    expect((await e.patch('/engineers/me', { serviceRadiusKm: 500 })).status).toBe(422);

    expect(
      (await e.patch('/engineers/me/location', { latitude: 48.85, longitude: 2.35 })).body.error
        .details[0].code,
    ).toBe('out_of_area');
    const loc = await e.patch('/engineers/me/location', {
      latitude: 30.05,
      longitude: 31.34,
      area: 'مدينة نصر',
    });
    expect(loc.status).toBe(200);

    expect(
      (
        await e.post('/engineers/me/documents', {
          kind: 'NATIONAL_ID',
          fileKey: 'https://evil.example/x.png',
        })
      ).status,
    ).toBe(422);
    expect(
      (await e.post('/engineers/me/documents', { kind: 'NATIONAL_ID', fileKey: '../etc/passwd' }))
        .status,
    ).toBe(422);
    const doc = await e.post('/engineers/me/documents', {
      kind: 'NATIONAL_ID',
      fileKey: 'docs/2026/id-front.jpg',
    });
    expect(doc.status).toBe(201);
    expect(JSON.stringify(doc.body)).not.toContain('id-front'); // storage keys never leave the server

    expect((await e.post('/engineers/me/services', { serviceId: s1 })).status).toBe(201);
    expect((await e.post('/engineers/me/services', { serviceId: s1 })).status).toBe(409);
    expect((await e.post('/engineers/me/services', { serviceId: s2 })).status).toBe(201);
    expect((await e.del(`/engineers/me/services/${s1}`)).status).toBe(204);
    expect((await e.del(`/engineers/me/services/${s1}`)).status).toBe(404);
    expect((await e.get('/engineers/me/services')).body.data).toHaveLength(1);
    expect((await e.get('/engineers/me')).body.data.location.area).toBe('مدينة نصر');
  });
  it('keeps customers out of engineer endpoints', async () => {
    const c = await t.newUser('CUSTOMER');
    expect((await c.get('/engineers/me')).status).toBe(403);
    expect((await c.patch('/engineers/me/location', { latitude: 30, longitude: 31 })).status).toBe(
      403,
    );
  });
});

describe('schedule rules', () => {
  const slot = (dayOfWeek: number, startTime: string, endTime: string) => ({
    dayOfWeek,
    startTime,
    endTime,
  });
  it('sorts and accepts back-to-back slots', () => {
    expect(
      validateSchedule([
        slot(1, '14:00', '18:00'),
        slot(1, '09:00', '14:00'),
        slot(0, '10:00', '12:00'),
      ]).map((s) => `${s.dayOfWeek}${s.startTime}`),
    ).toEqual(['010:00', '109:00', '114:00']);
  });
  it('rejects overlaps and inverted ranges', () => {
    expect(() =>
      validateSchedule([slot(1, '09:00', '13:00'), slot(1, '12:00', '15:00')]),
    ).toThrow();
    expect(() => validateSchedule([slot(2, '15:00', '09:00')])).toThrow();
  });
});

describe('verification lifecycle (admin)', () => {
  const makeVerified = async () => {
    const e = await t.newUser('ENGINEER', { serviceIds: (await serviceIds()).slice(0, 1) });
    const admin = await t.admin();
    const id = (await e.get('/engineers/me')).body.data.id as string;
    return { e, admin, id };
  };

  it('is invisible to customers until verified, then shows a card without private data', async () => {
    const { e, admin, id } = await makeVerified();
    await e.patch('/engineers/me/location', {
      latitude: 30.05,
      longitude: 31.34,
      area: 'مدينة نصر',
      address: 'شارع سري',
    });
    const c = await t.newUser('CUSTOMER');
    expect((await c.get(`/engineers/${id}`)).status).toBe(404);

    const ok = await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
    expect(ok.status).toBe(200);
    const card = await c.get(`/engineers/${id}`);
    expect(card.status).toBe(200);
    expect(card.body.data.area).toBe('مدينة نصر');
    expect(JSON.stringify(card.body)).not.toMatch(
      new RegExp(`${e.phone}|شارع سري|latitude|passwordHash`),
    );
    expect(
      (await e.patch('/engineers/me/status', { status: 'AVAILABLE' })).body.data.availabilityStatus,
    ).toBe('AVAILABLE');
  });

  it('allows the schedule only after verification', async () => {
    const { e, admin, id } = await makeVerified();
    const body = { slots: [{ dayOfWeek: 6, startTime: '09:00', endTime: '17:00' }] };
    expect((await e.put('/engineers/me/availability', body)).body.error.code).toBe(
      'ENGINEER_NOT_VERIFIED',
    );
    await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
    expect((await e.put('/engineers/me/availability', body)).status).toBe(200);
    expect((await e.get('/engineers/me/availability')).body.data.slots).toHaveLength(1);
    const overlap = {
      slots: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '12:00', endTime: '15:00' },
      ],
    };
    expect((await e.put('/engineers/me/availability', overlap)).status).toBe(422);
  });

  it('decides a PENDING engineer once; a rejection needs a reason; new documents reopen review', async () => {
    const { e, admin, id } = await makeVerified();
    expect((await admin.post(`/admin/engineers/${id}/verify`, { approved: false })).status).toBe(
      422,
    );
    const rejected = await admin.post(`/admin/engineers/${id}/verify`, {
      approved: false,
      reason: 'صورة البطاقة غير واضحة',
    });
    expect(rejected.body.data.verificationStatus).toBe('REJECTED');
    const again = await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
    expect((await e.get('/engineers/me')).body.data.rejectionReason).toBe('صورة البطاقة غير واضحة');
    await e.post('/engineers/me/documents', { kind: 'NATIONAL_ID', fileKey: 'docs/new-id.jpg' });
    expect((await e.get('/engineers/me')).body.data).toMatchObject({
      verificationStatus: 'PENDING',
      rejectionReason: null,
    });
  });

  it('suspends at once (token stops working, hidden, offline) and reinstates', async () => {
    const { e, admin, id } = await makeVerified();
    await admin.post(`/admin/engineers/${id}/verify`, { approved: true });
    await e.patch('/engineers/me/status', { status: 'AVAILABLE' });
    const c = await t.newUser('CUSTOMER');

    expect((await admin.post(`/admin/engineers/${id}/suspend`)).body.data.accountStatus).toBe(
      'SUSPENDED',
    );
    expect((await admin.post(`/admin/engineers/${id}/suspend`)).status).toBe(409);
    const blocked = await e.get('/engineers/me');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await t.login(e.phone)).body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await c.get(`/engineers/${id}`)).status).toBe(404);

    expect((await admin.post(`/admin/engineers/${id}/reinstate`)).body.data.accountStatus).toBe(
      'ACTIVE',
    );
    expect((await admin.post(`/admin/engineers/${id}/reinstate`)).status).toBe(409);
    const me = await e.get('/engineers/me');
    expect(me.body.data.availabilityStatus).toBe('OFFLINE'); // must go online again on purpose
    expect(await t.auditActions()).toEqual(
      expect.arrayContaining(['engineer.verify', 'engineer.suspend', 'engineer.reinstate']),
    );
  });

  it('keeps admin endpoints away from everyone else and lists with filter and cursor', async () => {
    const e = await t.newUser('ENGINEER');
    const c = await t.newUser('CUSTOMER');
    expect((await e.get('/admin/engineers')).status).toBe(403);
    expect(
      (
        await c.post(`/admin/engineers/${'0'.repeat(8)}-0000-4000-8000-000000000000/verify`, {
          approved: true,
        })
      ).status,
    ).toBe(403);
    const admin = await t.admin();
    const first = await admin.get('/admin/engineers?verification=PENDING&limit=2');
    expect(first.body.data.length).toBe(2);
    expect(first.body.meta.nextCursor).toBeTruthy();
    const second = await admin.get(
      `/admin/engineers?verification=PENDING&limit=2&cursor=${first.body.meta.nextCursor}`,
    );
    const ids = new Set([...first.body.data, ...second.body.data].map((x: { id: string }) => x.id));
    expect(ids.size).toBe(first.body.data.length + second.body.data.length); // no overlap between pages
    expect((await admin.get('/admin/engineers?cursor=garbage')).status).toBe(422);
    expect((await admin.post('/admin/engineers/not-a-uuid/suspend')).status).toBe(404);
  });
});
