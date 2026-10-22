import { describe, it, expect } from 'vitest';
import {
  paymentSummary,
  decideWebhook,
  assertCanCreatePayment,
  cashAmountDue,
  effectiveStatusForProvider,
  ratingAverage,
  assertCanConfirmCash,
  canRate,
  paymentTransition,
  redactForEngineer,
} from '../src/index';

describe('payments', () => {
  it('summary derives UNPAID / PARTIAL / PAID and ignores PENDING & FAILED', () => {
    expect(paymentSummary(1000, []).state).toBe('UNPAID');
    expect(
      paymentSummary(1000, [{ method: 'ONLINE', status: 'PENDING', amount: 1000 }]).state,
    ).toBe('UNPAID');
    expect(paymentSummary(1000, [{ method: 'ONLINE', status: 'PAID', amount: 400 }])).toMatchObject(
      { state: 'PARTIAL', due: 600 },
    );
    expect(paymentSummary(1000, [{ method: 'CASH', status: 'PAID', amount: 1000 }])).toMatchObject({
      state: 'PAID',
      due: 0,
    });
    expect(
      paymentSummary(1000, [
        { method: 'ONLINE', status: 'PARTIALLY_REFUNDED', amount: 1000, refunded: 300 },
      ]).paid,
    ).toBe(700);
  });
  it('job COMPLETED is not payment PAID (separate machines)', () => {
    expect(canRate('COMPLETED', 'UNPAID')).toBe(false);
    expect(canRate('COMPLETED', 'PAID')).toBe(true);
    expect(canRate('COMPLETED', 'UNPAID', false)).toBe(true);
    expect(canRate('IN_PROGRESS', 'PAID')).toBe(false);
  });
  it('webhook: bad signature is rejected, duplicate is a no-op, amount mismatch is flagged', () => {
    const ok = {
      alreadyProcessed: false,
      signatureOk: true,
      providerStatus: 'SUCCESS' as const,
      providerAmount: 2300,
      payment: { status: 'PENDING' as const, amount: 2300 },
      requestStatus: 'QUOTE_ACCEPTED',
    };
    expect(() => decideWebhook({ ...ok, signatureOk: false })).toThrow();
    expect(decideWebhook({ ...ok, alreadyProcessed: true })).toEqual({ kind: 'IGNORE_DUPLICATE' });
    expect(decideWebhook({ ...ok, payment: { status: 'PAID', amount: 2300 } })).toEqual({
      kind: 'IGNORE_DUPLICATE',
    });
    expect(decideWebhook({ ...ok, providerAmount: 1 })).toEqual({ kind: 'AMOUNT_MISMATCH' });
    expect(decideWebhook({ ...ok, providerStatus: 'FAILED' })).toEqual({ kind: 'MARK_FAILED' });
    expect(decideWebhook(ok)).toEqual({ kind: 'MARK_PAID', confirmBooking: true });
    expect(decideWebhook({ ...ok, requestStatus: 'COMPLETED' })).toEqual({
      kind: 'MARK_PAID',
      confirmBooking: false,
    });
  });
  it('a provider status without an amount pays nothing (it is audited and re-asked)', () => {
    const base = {
      alreadyProcessed: false,
      signatureOk: true,
      payment: { status: 'PENDING' as const, amount: 2300 },
      requestStatus: 'QUOTE_ACCEPTED',
    };
    // "PAID" with no amount is not proof of payment: the order may still be unpaid at the outlet.
    expect(decideWebhook({ ...base, providerStatus: 'SUCCESS', providerAmount: null })).toEqual({
      kind: 'IGNORED_UNVERIFIED',
    });
    expect(
      decideWebhook({ ...base, providerStatus: 'SUCCESS', providerAmount: undefined }),
    ).toEqual({ kind: 'IGNORED_UNVERIFIED' });
    // A failure verdict needs no amount to be actionable: the customer can retry.
    expect(decideWebhook({ ...base, providerStatus: 'FAILED', providerAmount: null })).toEqual({
      kind: 'MARK_FAILED',
    });
    // With an amount, the money check still happens.
    expect(decideWebhook({ ...base, providerStatus: 'SUCCESS', providerAmount: 2300 })).toEqual({
      kind: 'MARK_PAID',
      confirmBooking: true,
    });
  });
  it('payment creation takes the amount from the server, only in valid states', () => {
    const due = paymentSummary(2300, []);
    expect(
      assertCanCreatePayment({
        requestStatus: 'QUOTE_ACCEPTED',
        method: 'ONLINE',
        summary: due,
        hasPendingOnline: false,
      }),
    ).toEqual({ amount: 2300 });
    expect(() =>
      assertCanCreatePayment({
        requestStatus: 'IN_PROGRESS',
        method: 'ONLINE',
        summary: due,
        hasPendingOnline: false,
      }),
    ).toThrow();
    expect(() =>
      assertCanCreatePayment({
        requestStatus: 'COMPLETED',
        method: 'CASH',
        summary: due,
        hasPendingOnline: false,
      }),
    ).toThrow();
    expect(() =>
      assertCanCreatePayment({
        requestStatus: 'QUOTE_ACCEPTED',
        method: 'ONLINE',
        summary: due,
        hasPendingOnline: true,
      }),
    ).toThrow();
    expect(() =>
      assertCanCreatePayment({
        requestStatus: 'COMPLETED',
        method: 'ONLINE',
        summary: paymentSummary(100, [{ method: 'ONLINE', status: 'PAID', amount: 100 }]),
        hasPendingOnline: false,
      }),
    ).toThrow();
  });
  it('cash is confirmed only after completion and only if due', () => {
    expect(() =>
      assertCanConfirmCash('COMPLETED', { method: 'CASH', status: 'PENDING', amount: 1 }, 1),
    ).not.toThrow();
    expect(() =>
      assertCanConfirmCash(
        'COMPLETION_PENDING',
        { method: 'CASH', status: 'PENDING', amount: 1 },
        1,
      ),
    ).toThrow();
    expect(() =>
      assertCanConfirmCash('COMPLETED', { method: 'ONLINE', status: 'PENDING', amount: 1 }, 1),
    ).toThrow();
  });
  it('payment machine: PAID → REFUNDED, FAILED → retry only', () => {
    expect(paymentTransition('PENDING', 'PROVIDER_PAID')).toBe('PAID');
    expect(paymentTransition('FAILED', 'RETRY')).toBe('PENDING');
    expect(() => paymentTransition('PENDING', 'REFUND')).toThrow();
    expect(() => paymentTransition('PAID', 'PROVIDER_PAID')).toThrow();
  });
});

describe('visibility', () => {
  const full = {
    name: 'طارق محمود',
    phone: '0100 123 4567',
    address: 'شارع التحرير، الدقي',
    area: 'الدقي',
    latitude: 30.03,
    longitude: 31.21,
  };
  it('hides address/phone/coords from the engineer until CONFIRMED', () => {
    for (const s of [
      'ENGINEER_SELECTED',
      'ENGINEER_ACCEPTED',
      'QUOTE_SENT',
      'QUOTE_ACCEPTED',
    ] as const) {
      const v = redactForEngineer(s, full);
      expect(v).toEqual({ area: 'الدقي', customerName: 'طارق' });
    }
    expect(redactForEngineer('CONFIRMED', full)).toMatchObject({
      address: full.address,
      customerPhone: full.phone,
    });
  });
});

describe('phase 4 helpers', () => {
  it('a pending online payment blocks a second payment of either kind', () => {
    const due = paymentSummary(500, []);
    for (const method of ['CASH', 'ONLINE'] as const)
      expect(() =>
        assertCanCreatePayment({
          requestStatus: 'QUOTE_ACCEPTED',
          method,
          summary: due,
          hasPendingOnline: true,
        }),
      ).toThrow();
  });
  it('a late success for a FAILED payment is treated as pending, so the money is not ignored', () => {
    expect(effectiveStatusForProvider('FAILED', 'SUCCESS')).toBe('PENDING');
    expect(effectiveStatusForProvider('FAILED', 'FAILED')).toBe('FAILED');
    expect(effectiveStatusForProvider('PAID', 'SUCCESS')).toBe('PAID');
  });
  it('cash due is whatever is still unpaid', () => {
    expect(
      cashAmountDue(paymentSummary(620, [{ method: 'ONLINE', status: 'PAID', amount: 500 }])),
    ).toBe(120);
  });
  it('rating average is one decimal and 0 when empty', () => {
    expect(ratingAverage([])).toBe(0);
    expect(ratingAverage([5, 4, 4])).toBe(4.3);
    expect(ratingAverage([5])).toBe(5);
  });
});
