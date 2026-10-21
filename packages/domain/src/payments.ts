import { DomainError } from './errors';

export type PaymentMethod = 'CASH' | 'ONLINE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface PaymentLike {
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  refunded?: number;
}

/** Derived money picture of a job. `state` is what the UI shows as «لم يُدفع / جزئي / مدفوع». */
export function paymentSummary(agreedTotal: number, payments: PaymentLike[]) {
  const paid = payments
    .filter((p) => p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED')
    .reduce((a, p) => a + p.amount - (p.refunded ?? 0), 0);
  const due = Math.max(0, round2(agreedTotal - paid));
  const state = agreedTotal <= 0 || paid <= 0 ? 'UNPAID' : paid >= agreedTotal ? 'PAID' : 'PARTIAL';
  return { total: agreedTotal, paid: round2(paid), due, state } as const;
}
export const round2 = (n: number) => Math.round(n * 100) / 100;

export type PaymentEvent =
  'PROVIDER_PAID' | 'PROVIDER_FAILED' | 'CASH_RECEIVED' | 'REFUND' | 'PARTIAL_REFUND' | 'RETRY';
const PAY_TRANSITIONS: Record<PaymentEvent, { from: PaymentStatus[]; to: PaymentStatus }> = {
  PROVIDER_PAID: { from: ['PENDING'], to: 'PAID' },
  PROVIDER_FAILED: { from: ['PENDING'], to: 'FAILED' },
  CASH_RECEIVED: { from: ['PENDING'], to: 'PAID' },
  REFUND: { from: ['PAID', 'PARTIALLY_REFUNDED'], to: 'REFUNDED' },
  PARTIAL_REFUND: { from: ['PAID'], to: 'PARTIALLY_REFUNDED' },
  RETRY: { from: ['FAILED'], to: 'PENDING' },
};
export function paymentTransition(current: PaymentStatus, event: PaymentEvent): PaymentStatus {
  const r = PAY_TRANSITIONS[event];
  if (!r.from.includes(current))
    throw new DomainError(
      'INVALID_STATE_TRANSITION',
      `Payment ${event} not allowed from ${current}`,
    );
  return r.to;
}

/**
 * What a *verified* provider webhook is allowed to do. The browser redirect never calls this.
 * Returns the effect the application service must apply inside ONE transaction.
 */
export type WebhookEffect =
  | { kind: 'IGNORE_DUPLICATE' }
  | { kind: 'MARK_PAID'; confirmBooking: boolean }
  | { kind: 'MARK_FAILED' }
  | { kind: 'AMOUNT_MISMATCH' };

export function decideWebhook(input: {
  alreadyProcessed: boolean;
  signatureOk: boolean;
  providerStatus: 'SUCCESS' | 'FAILED';
  providerAmount: number;
  payment: { status: PaymentStatus; amount: number };
  requestStatus: string;
}): WebhookEffect {
  if (!input.signatureOk) throw new DomainError('UNAUTHORIZED', 'Bad webhook signature');
  if (input.alreadyProcessed || input.payment.status !== 'PENDING')
    return { kind: 'IGNORE_DUPLICATE' };
  if (input.providerStatus === 'FAILED') return { kind: 'MARK_FAILED' };
  if (round2(input.providerAmount) !== round2(input.payment.amount))
    return { kind: 'AMOUNT_MISMATCH' };
  return { kind: 'MARK_PAID', confirmBooking: input.requestStatus === 'QUOTE_ACCEPTED' };
}

/** Where may a payment row be created, and for how much? Never trust an amount from the client. */
export function assertCanCreatePayment(args: {
  requestStatus: string;
  method: PaymentMethod;
  summary: ReturnType<typeof paymentSummary>;
  hasPendingOnline: boolean;
}) {
  const { requestStatus, method, summary } = args;
  if (requestStatus !== 'QUOTE_ACCEPTED' && requestStatus !== 'COMPLETED') {
    throw new DomainError('INVALID_STATE_TRANSITION', `Payment not allowed in ${requestStatus}`);
  }
  if (summary.due <= 0) throw new DomainError('INVALID_STATE_TRANSITION', 'Nothing left to pay');
  if (method === 'CASH' && requestStatus === 'COMPLETED') {
    throw new DomainError(
      'INVALID_STATE_TRANSITION',
      'Cash is chosen at booking and confirmed by the engineer',
    );
  }
  // One payment at a time: a pending online payment may still be paid at the provider, so a second
  // one (of either kind) could end up charging the customer twice.
  if (args.hasPendingOnline)
    throw new DomainError('CONFLICT', 'An online payment is already pending');
  return { amount: summary.due } as const;
}

/** Cash is confirmed by the engineer, only after the customer confirmed completion. */
export function assertCanConfirmCash(
  requestStatus: string,
  p: PaymentLike | undefined,
  due: number,
) {
  if (requestStatus !== 'COMPLETED')
    throw new DomainError('INVALID_STATE_TRANSITION', 'Cash confirmed only after completion');
  if (!p || p.method !== 'CASH' || due <= 0)
    throw new DomainError('INVALID_STATE_TRANSITION', 'No cash amount due');
}

/** Rating is open only when the job is COMPLETED and (policy flag) fully paid. */
export function canRate(
  requestStatus: string,
  state: 'UNPAID' | 'PARTIAL' | 'PAID',
  requirePaid = true,
) {
  return requestStatus === 'COMPLETED' && (!requirePaid || state === 'PAID');
}

/** Which payment events does a provider status map to? Anything else is stored but changes nothing. */
export type ProviderOutcome = 'SUCCESS' | 'FAILED' | 'PENDING';

/**
 * A late success for a payment we already marked FAILED (e.g. EXPIRED, then paid at the last minute)
 * must not be ignored: the money has been taken. It is treated as if the payment were still pending.
 */
export function effectiveStatusForProvider(
  status: PaymentStatus,
  outcome: ProviderOutcome,
): PaymentStatus {
  return status === 'FAILED' && outcome === 'SUCCESS' ? 'PENDING' : status;
}

/** Amount the engineer confirms in cash: whatever is still due at that moment (extra work included). */
export function cashAmountDue(summary: ReturnType<typeof paymentSummary>): number {
  return summary.due;
}

export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** Mean of visible ratings, one decimal like the UI shows (4.7). */
export function ratingAverage(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

/** What an admin may hand back: a PAID/partly refunded payment, at most what is left, and always with a reason. */
export function assertCanRefund(
  p: { status: PaymentStatus; amount: number; refunded: number },
  amount: number,
) {
  if (p.status !== 'PAID' && p.status !== 'PARTIALLY_REFUNDED')
    throw new DomainError('INVALID_STATE_TRANSITION', `Cannot refund a ${p.status} payment`);
  if (!(amount > 0) || round2(amount) > round2(p.amount - p.refunded))
    throw new DomainError('VALIDATION_ERROR', 'Refund exceeds what is left', [
      { field: 'amount', code: 'too_big' },
    ]);
}
