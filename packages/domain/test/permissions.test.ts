import { describe, it, expect } from 'vitest';
import { authorize, hasPermission, ACTION_GUARDS, Actor, DomainError } from '../src/index';

const customer: Actor = { id: 'u1', role: 'CUSTOMER', profileId: 'c1', userStatus: 'ACTIVE' };
const engineer: Actor = {
  id: 'u2',
  role: 'ENGINEER',
  profileId: 'e1',
  userStatus: 'ACTIVE',
  verification: 'VERIFIED',
};
const admin: Actor = { id: 'u3', role: 'ADMIN', userStatus: 'ACTIVE' };
const res = (o = {}) => ({
  customerId: 'c1',
  selectedEngineerId: 'e1',
  status: 'ENGINEER_ACCEPTED' as const,
  ...o,
});
const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return null;
};
const g = (k: string) => ACTION_GUARDS[k]!;

describe('authorization = permission + ownership + state', () => {
  it('no actor → 401', () =>
    expect(code(() => authorize(null, g('createRequest')))).toBe('UNAUTHORIZED'));
  it('customer cannot create quotes or verify engineers, even on their own request', () => {
    expect(code(() => authorize(customer, g('createQuote'), res()))).toBe('FORBIDDEN');
    expect(code(() => authorize(customer, g('verifyEngineer')))).toBe('FORBIDDEN');
  });
  it('engineer cannot accept quotes, create requests or refund', () => {
    expect(code(() => authorize(engineer, g('acceptQuote'), res({ status: 'QUOTE_SENT' })))).toBe(
      'FORBIDDEN',
    );
    expect(code(() => authorize(engineer, g('createRequest')))).toBe('FORBIDDEN');
    expect(code(() => authorize(engineer, g('refundPayment')))).toBe('FORBIDDEN');
  });
  it("someone else's request is 404, not 403 (no probing)", () => {
    expect(code(() => authorize({ ...customer, profileId: 'c9' }, g('cancelRequest'), res()))).toBe(
      'NOT_FOUND',
    );
    expect(code(() => authorize({ ...engineer, profileId: 'e9' }, g('createQuote'), res()))).toBe(
      'NOT_FOUND',
    );
  });
  it('an engineer who is not (yet) selected sees nothing', () => {
    expect(
      code(() => authorize(engineer, g('createQuote'), res({ selectedEngineerId: null }))),
    ).toBe('NOT_FOUND');
  });
  it('wrong state → 409', () => {
    expect(code(() => authorize(engineer, g('createQuote'), res({ status: 'QUOTE_SENT' })))).toBe(
      'INVALID_STATE_TRANSITION',
    );
    expect(code(() => authorize(engineer, g('createQuote'), res()))).toBeNull();
  });
  it('unverified engineer cannot operate; suspended account cannot do anything', () => {
    expect(
      code(() =>
        authorize(
          { ...engineer, verification: 'PENDING' },
          g('engineerAccept'),
          res({ status: 'ENGINEER_SELECTED' }),
        ),
      ),
    ).toBe('ENGINEER_NOT_VERIFIED');
    expect(
      code(() => authorize({ ...customer, userStatus: 'SUSPENDED' }, g('createRequest'))),
    ).toBe('ACCOUNT_SUSPENDED');
  });
  it('admin passes ownership but not permission-less actions', () => {
    expect(code(() => authorize(admin, g('adminCancel'), res()))).toBeNull();
    expect(code(() => authorize(admin, g('createQuote'), res()))).toBe('FORBIDDEN');
  });
  it('catalogue matches the Release v1 matrix', () => {
    expect(hasPermission('CUSTOMER', 'quotes.accept.own')).toBe(true);
    expect(hasPermission('CUSTOMER', 'jobs.start')).toBe(false);
    expect(hasPermission('ENGINEER', 'engineers.verify')).toBe(false);
    expect(hasPermission('ADMIN', 'engineers.verify')).toBe(true);
  });
});
