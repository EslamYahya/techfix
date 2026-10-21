import { describe, it, expect } from 'vitest';
import { computeQuote, agreedTotal, quoteTransition, assertCanCreateQuote, DomainError } from '../src';

const item = (type: 'LABOR' | 'MATERIAL' | 'OTHER', description: string, quantity: number, unitPrice: number) => ({ type, description, quantity, unitPrice });

describe('computeQuote', () => {
  it('computes totals server-side (prototype R-1061 → 2000)', () => {
    const q = computeQuote({ estimatedDurationMinutes: 480, items: [
      item('LABOR', 'أجر التركيب', 1, 700), item('MATERIAL', 'كابل', 20, 40), item('MATERIAL', 'مصدر طاقة', 1, 200), item('OTHER', 'تمديد', 1, 500),
    ] });
    expect(q.subtotal).toBe(2200);
    expect(q.total).toBe(2200);
    expect(q.items.map((i) => i.totalPrice)).toEqual([700, 800, 200, 500]);
  });
  it('has no floating point drift', () => {
    const q = computeQuote({ estimatedDurationMinutes: 60, items: [item('MATERIAL', 'x', 3, 0.1), item('MATERIAL', 'y', 1, 0.2)] });
    expect(q.total).toBe(0.5);
  });
  it('ignores any client-sent totals', () => {
    const q = computeQuote({ estimatedDurationMinutes: 60, items: [{ ...item('LABOR', 'x', 2, 100), totalPrice: 1, total: 1 } as any], total: 1 } as any);
    expect(q.total).toBe(200);
  });
  it.each([
    ['empty items', { items: [], estimatedDurationMinutes: 60 }],
    ['zero qty', { items: [item('LABOR', 'x', 0, 10)], estimatedDurationMinutes: 60 }],
    ['negative price', { items: [item('LABOR', 'x', 1, -5)], estimatedDurationMinutes: 60 }],
    ['blank description', { items: [item('LABOR', '  ', 1, 5)], estimatedDurationMinutes: 60 }],
    ['bad type', { items: [{ ...item('LABOR', 'x', 1, 5), type: 'TAX' as any }], estimatedDurationMinutes: 60 }],
    ['no duration', { items: [item('LABOR', 'x', 1, 5)], estimatedDurationMinutes: 0 }],
    ['NaN', { items: [item('LABOR', 'x', NaN, 5)], estimatedDurationMinutes: 60 }],
  ])('rejects %s', (_n, input) => {
    expect(() => computeQuote(input as any)).toThrowError(DomainError);
  });
});

describe('quotes lifecycle', () => {
  it('agreed total = accepted main + accepted additional only', () => {
    expect(agreedTotal([
      { kind: 'MAIN', status: 'ACCEPTED', total: 1000 }, { kind: 'ADDITIONAL', status: 'ACCEPTED', total: 250 },
      { kind: 'ADDITIONAL', status: 'REJECTED', total: 999 }, { kind: 'MAIN', status: 'CANCELLED', total: 5 },
    ])).toBe(1250);
  });
  it('accepted quotes are immutable', () => {
    expect(() => quoteTransition('ACCEPTED', 'REJECT')).toThrow();
    expect(() => quoteTransition('REJECTED', 'ACCEPT')).toThrow();
    expect(quoteTransition('SENT', 'EXPIRE')).toBe('EXPIRED');
  });
  it('additional quote: only IN_PROGRESS and only one pending', () => {
    expect(() => assertCanCreateQuote('ADDITIONAL', 'CONFIRMED', [])).toThrow();
    expect(() => assertCanCreateQuote('ADDITIONAL', 'IN_PROGRESS', [{ kind: 'ADDITIONAL', status: 'SENT' }])).toThrowError(/PENDING_ADDITIONAL_QUOTE/);
    expect(() => assertCanCreateQuote('ADDITIONAL', 'IN_PROGRESS', [{ kind: 'ADDITIONAL', status: 'REJECTED' }])).not.toThrow();
    expect(() => assertCanCreateQuote('MAIN', 'ENGINEER_ACCEPTED', [])).not.toThrow();
    expect(() => assertCanCreateQuote('MAIN', 'IN_PROGRESS', [])).toThrow();
  });
});
