import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { normalizePhone } from '../src/auth/phone.js';
import { boot } from './helpers.js';

let t: Awaited<ReturnType<typeof boot>>;
beforeAll(async () => {
  t = await boot({ AUTH_LOGIN_MAX_PER_15MIN: '5' });
});
afterAll(async () => {
  await t.close();
});

describe('phone and password primitives', () => {
  it('normalises Egyptian mobiles and rejects the rest', () => {
    expect(normalizePhone('+20 100 000 0000')).toBe('01000000000');
    expect(normalizePhone('0020-111-000-0000')).toBe('01110000000');
    expect(normalizePhone('٠١٠٠٠٠٠٠٠٠٠')).toBe('01000000000');
    expect(normalizePhone('0300000000')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct horse', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('register and login', () => {
  it('registers a customer and never returns secrets', async () => {
    const res = await t.register({ name: 'منى أحمد', phone: '+20 100 111 2233', role: 'CUSTOMER' });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: 'منى أحمد', role: 'CUSTOMER' });
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
  });
  it('rejects a duplicate phone (same number, different format) with CONFLICT', async () => {
    const res = await t.register({ name: 'اسم آخر', phone: '01001112233', role: 'CUSTOMER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
  it('validates input and never allows self-registered admins', async () => {
    expect((await t.register({ name: 'x', phone: '123', role: 'CUSTOMER' })).status).toBe(422);
    const admin = await t.register({ name: 'مشرف مزيف', phone: t.phone(), role: 'ADMIN' });
    expect(admin.status).toBe(422);
    const short = await t.register({
      name: 'اسم صحيح',
      phone: t.phone(),
      role: 'CUSTOMER',
      password: '123',
    });
    expect(short.body.error.details[0]).toMatchObject({ field: 'password' });
  });
  it('rejects engineer-only fields on a customer and unknown services on an engineer', async () => {
    expect(
      (await t.register({ name: 'عميل', phone: t.phone(), role: 'CUSTOMER', hasShop: true }))
        .status,
    ).toBe(422);
    const res = await t.register({
      name: 'مهندس',
      phone: t.phone(),
      role: 'ENGINEER',
      serviceIds: ['00000000-0000-4000-8000-000000000000'],
    });
    expect(res.status).toBe(422);
  });
  it('logs in by phone or email with the same error for unknown and wrong password', async () => {
    const u = await t.register({
      name: 'سامي',
      phone: t.phone(),
      email: 'Sami@Example.com',
      role: 'CUSTOMER',
    });
    expect((await t.login('sami@example.com')).status).toBe(200);
    expect((await t.login(u.body.data.user.id)).status).toBe(401);
    const wrong = await t.login('sami@example.com', 'nope-nope');
    const unknown = await t.login('nobody@example.com');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: unknown.body.error.message,
    });
  });
  it('rate-limits repeated login attempts for one identifier', async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await t.login('01022223333', 'bad-password')).status;
    expect(last).toBe(429);
  });
});

describe('tokens', () => {
  it('requires a valid bearer token', async () => {
    expect((await t.http().get('/api/v1/customers/me')).status).toBe(401);
    expect(
      (await t.http().get('/api/v1/customers/me').set('Authorization', 'Bearer nope')).status,
    ).toBe(401);
  });
  it('rotates refresh tokens and kills the family when an old one is replayed', async () => {
    const u = await t.register({ name: 'ليلى', phone: t.phone(), role: 'CUSTOMER' });
    const first = u.body.data.refreshToken as string;
    const r1 = await t.http().post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    const second = r1.body.data.refreshToken as string;
    expect(second).not.toBe(first);
    // replay of the rotated token → theft assumed
    expect((await t.http().post('/api/v1/auth/refresh').send({ refreshToken: first })).status).toBe(
      401,
    );
    expect(
      (await t.http().post('/api/v1/auth/refresh').send({ refreshToken: second })).status,
    ).toBe(401);
  });
  it('logout revokes the refresh token', async () => {
    const u = await t.register({ name: 'هالة', phone: t.phone(), role: 'CUSTOMER' });
    const a = t.as(u.body.data.accessToken);
    expect((await a.post('/auth/logout', { refreshToken: u.body.data.refreshToken })).status).toBe(
      204,
    );
    expect(
      (await t.http().post('/api/v1/auth/refresh').send({ refreshToken: u.body.data.refreshToken }))
        .status,
    ).toBe(401);
  });
});

describe('customer profile', () => {
  it('reads and updates the profile and saves addresses (first becomes default)', async () => {
    const c = await t.newUser('CUSTOMER');
    expect((await c.get('/customers/me')).body.data).toMatchObject({
      name: 'مستخدم تجريبي',
      phone: c.phone,
    });
    expect((await c.patch('/customers/me', { name: 'اسم جديد' })).body.data.name).toBe('اسم جديد');
    const a1 = await c.post('/customers/me/addresses', {
      label: 'المنزل',
      address: 'مدينة نصر',
      latitude: 30.05,
      longitude: 31.34,
    });
    expect(a1.status).toBe(201);
    expect(a1.body.data.isDefault).toBe(true);
    const a2 = await c.post('/customers/me/addresses', {
      label: 'العمل',
      address: 'وسط البلد',
      latitude: 30.04,
      longitude: 31.23,
      isDefault: true,
    });
    expect(a2.body.data.isDefault).toBe(true);
    const list = (await c.get('/customers/me/addresses')).body.data as {
      label: string;
      isDefault: boolean;
    }[];
    expect(list.filter((x) => x.isDefault).map((x) => x.label)).toEqual(['العمل']);
  });
  it('rejects an address outside the supported area', async () => {
    const c = await t.newUser('CUSTOMER');
    const res = await c.post('/customers/me/addresses', {
      label: 'لندن',
      address: 'London',
      latitude: 51.5,
      longitude: -0.12,
    });
    expect(res.status).toBe(422);
  });
  it('an engineer cannot use customer endpoints', async () => {
    const e = await t.newUser('ENGINEER');
    expect((await e.get('/customers/me/addresses')).status).toBe(403);
  });
});
