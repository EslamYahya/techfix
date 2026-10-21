import { ERROR_HTTP, REQUEST_STATUSES } from '@techfix/domain';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  AVAILABILITY,
  DOC_KIND,
  UI,
  VERIFICATION,
  fieldMessage,
  ADMIN_STATUS,
  ERRORS,
  PAY_UI,
  PAYMENT_STATE,
  STATUS,
  errorText,
  statusText,
} from '../src/labels';

describe('Arabic labels', () => {
  it('cover every request status for customer, engineer and admin', () => {
    for (const s of REQUEST_STATUSES) {
      expect(STATUS[s], s).toBeDefined();
      expect(ADMIN_STATUS[s], s).toBeDefined();
    }
  });
  it('cover every error code the API can return', () => {
    for (const c of Object.keys(ERROR_HTTP))
      expect((ERRORS as Record<string, string>)[c], c).toBeTruthy();
  });
  it('shows the role-specific wording and never raw codes', () => {
    expect(statusText('MATCHING', 'customer')).toBe('اختر المهندس المناسب');
    expect(statusText('MATCHING', 'engineer')).toBe('بانتظار اختيار العميل');
    expect(statusText('NOPE', 'customer')).toBe('—');
    expect(errorText('???')).toBe(ERRORS.INTERNAL);
  });
  it('contains no programming terms in visible text', () => {
    const all = [
      ...Object.values(ERRORS),
      ...Object.values(ADMIN_STATUS),
      ...Object.values(STATUS).flatMap((r) => r.slice(0, 2)),
    ];
    for (const t of all) expect(t).not.toMatch(/[A-Z_]{4,}|\bnull\b|\bundefined\b|\bAPI\b/);
  });
  it('has Arabic text for every identity enum the API returns', () => {
    for (const v of ['PENDING', 'VERIFIED', 'REJECTED']) expect(VERIFICATION[v], v).toBeDefined();
    for (const v of ['ACTIVE', 'SUSPENDED', 'PENDING']) expect(ACCOUNT[v], v).toBeDefined();
    for (const v of ['AVAILABLE', 'OFFLINE', 'BUSY']) expect(AVAILABILITY[v], v).toBeTruthy();
    for (const v of ['NATIONAL_ID', 'CERTIFICATE', 'CRAFT_LICENSE', 'OTHER'])
      expect(DOC_KIND[v], v).toBeTruthy();
    expect(Object.values(UI).every((t) => /[\u0600-\u06FF]/.test(t))).toBe(true);
  });
  it('words known field errors and falls back to undefined for unknown ones', () => {
    expect(fieldMessage('latitude', 'out_of_area')).toContain('خارج نطاق');
    expect(fieldMessage('unknown', 'x')).toBeUndefined();
  });
});

describe('timeline wording', () => {
  it('covers every event code the API records through phase 3', async () => {
    const { TIMELINE } = await import('../src/labels');
    const codes = [
      'REQUEST_CREATED',
      'ENGINEER_SELECTED',
      'ENGINEER_ACCEPTED',
      'ENGINEER_REJECTED',
      'ENGINEER_CHANGED',
      'REQUEST_CANCELLED',
      'QUOTE_SENT',
      'QUOTE_ACCEPTED',
      'QUOTE_REJECTED',
      'BOOKING_CONFIRMED',
      'TRIP_STARTED',
      'ARRIVED',
      'JOB_STARTED',
      'JOB_COMPLETED',
      'COMPLETION_CONFIRMED',
    ];
    for (const c of codes) expect(TIMELINE[c], c).toBeTruthy();
  });
  it('has Arabic text for every payment state and no programming terms in payment wording', () => {
    for (const v of ['UNPAID', 'PARTIAL', 'PAID']) expect(PAYMENT_STATE[v], v).toBeDefined();
    for (const t of Object.values(PAY_UI)) {
      expect(t).toMatch(/[\u0600-\u06FF]/);
      expect(t).not.toMatch(/[A-Z_]{4,}|\bnull\b|\bundefined\b|\bAPI\b|webhook|callback/i);
    }
  });
});
