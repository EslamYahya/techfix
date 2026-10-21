import { DomainError } from './errors';

export type QuoteItemType = 'LABOR' | 'MATERIAL' | 'OTHER';
export type QuoteKind = 'MAIN' | 'ADDITIONAL';
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface QuoteItemInput {
  type: QuoteItemType;
  description: string;
  quantity: number;
  unitPrice: number;
}
export interface QuoteItemComputed extends QuoteItemInput {
  totalPrice: number;
}
export interface QuoteInput {
  items: QuoteItemInput[];
  estimatedDurationMinutes: number;
  notes?: string;
}

const ITEM_TYPES: readonly QuoteItemType[] = ['LABOR', 'MATERIAL', 'OTHER'];
export const LIMITS = {
  maxItems: 30,
  maxQuantity: 10_000,
  maxUnitPrice: 1_000_000,
  maxDescription: 200,
};

/** Money is handled in piasters (integers) so 0.1 + 0.2 never reaches a customer. */
const toPiasters = (egp: number) => Math.round(egp * 100);
const toEgp = (p: number) => p / 100;

/**
 * Validates the engineer's items and computes every total on the server.
 * A `total` / `totalPrice` sent by the client is never read — it is not even part of the input type.
 */
export function computeQuote(input: QuoteInput): {
  items: QuoteItemComputed[];
  subtotal: number;
  total: number;
} {
  const problems: string[] = [];
  if (!Array.isArray(input.items) || input.items.length === 0)
    problems.push('items: at least one item');
  if (input.items?.length > LIMITS.maxItems) problems.push(`items: at most ${LIMITS.maxItems}`);
  if (!Number.isInteger(input.estimatedDurationMinutes) || input.estimatedDurationMinutes <= 0) {
    problems.push('estimatedDurationMinutes: positive integer');
  }
  input.items?.forEach((it, i) => {
    if (!ITEM_TYPES.includes(it.type)) problems.push(`items[${i}].type`);
    if (!it.description?.trim() || it.description.length > LIMITS.maxDescription)
      problems.push(`items[${i}].description`);
    if (!Number.isFinite(it.quantity) || it.quantity <= 0 || it.quantity > LIMITS.maxQuantity)
      problems.push(`items[${i}].quantity`);
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0 || it.unitPrice > LIMITS.maxUnitPrice)
      problems.push(`items[${i}].unitPrice`);
  });
  if (problems.length) throw new DomainError('VALIDATION_ERROR', 'Invalid quote', problems);

  const items = input.items.map((it) => ({
    ...it,
    description: it.description.trim(),
    totalPrice: toEgp(Math.round(toPiasters(it.unitPrice) * it.quantity)),
  }));
  const subtotal = toEgp(items.reduce((a, it) => a + toPiasters(it.totalPrice), 0));
  // Commission is NOT added to what the customer pays; it is deducted from the engineer's side (docs/07).
  return { items, subtotal, total: subtotal };
}

/** The agreed price of a job = accepted MAIN quote + every accepted ADDITIONAL quote. Others never count. */
export function agreedTotal(
  quotes: { kind: QuoteKind; status: QuoteStatus; total: number }[],
): number {
  return toEgp(
    quotes.filter((q) => q.status === 'ACCEPTED').reduce((a, q) => a + toPiasters(q.total), 0),
  );
}

export type QuoteEvent = 'SEND' | 'ACCEPT' | 'REJECT' | 'EXPIRE' | 'CANCEL';
const QUOTE_TRANSITIONS: Record<QuoteEvent, { from: QuoteStatus[]; to: QuoteStatus }> = {
  SEND: { from: ['DRAFT'], to: 'SENT' },
  ACCEPT: { from: ['SENT'], to: 'ACCEPTED' },
  REJECT: { from: ['SENT'], to: 'REJECTED' },
  EXPIRE: { from: ['SENT'], to: 'EXPIRED' },
  CANCEL: { from: ['DRAFT', 'SENT'], to: 'CANCELLED' },
};
export function quoteTransition(current: QuoteStatus, event: QuoteEvent): QuoteStatus {
  const r = QUOTE_TRANSITIONS[event];
  if (!r.from.includes(current))
    throw new DomainError('INVALID_STATE_TRANSITION', `Quote ${event} not allowed from ${current}`);
  return r.to;
}

/**
 * Rule: an ADDITIONAL quote may only be created while IN_PROGRESS and only when none is pending.
 * The accepted MAIN quote is immutable (audit trail) — extra work is always a new, linked quote.
 */
export function assertCanCreateQuote(
  kind: QuoteKind,
  requestStatus: string,
  existing: { kind: QuoteKind; status: QuoteStatus }[],
): void {
  if (kind === 'MAIN') {
    if (requestStatus !== 'ENGINEER_ACCEPTED' && requestStatus !== 'QUOTE_REJECTED') {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Main quote not allowed in ${requestStatus}`,
      );
    }
    return;
  }
  if (requestStatus !== 'IN_PROGRESS')
    throw new DomainError('INVALID_STATE_TRANSITION', 'Additional quote only while IN_PROGRESS');
  if (existing.some((q) => q.status === 'SENT')) throw new DomainError('PENDING_ADDITIONAL_QUOTE');
}
