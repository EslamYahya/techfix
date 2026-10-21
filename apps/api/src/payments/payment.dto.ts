import { paymentSummary, type Actor } from '@techfix/domain';
import type { PaymentRecord } from '../repos.js';

export const paymentDto = (p: PaymentRecord) => ({
  id: p.id,
  method: p.method,
  status: p.status,
  amount: p.amount,
  /** The number to pay with at Fawry (ONLINE, while PENDING). */
  reference: p.method === 'ONLINE' ? p.providerRef : null,
  expiresAt: p.expiresAt?.toISOString() ?? null,
  paidAt: p.paidAt?.toISOString() ?? null,
});

export const summaryOf = (agreedTotal: number, payments: PaymentRecord[]) =>
  paymentSummary(agreedTotal, payments);

/** The money picture the request/job screens read: totals + the one open payment, if any. */
export function paymentView(agreedTotal: number, payments: PaymentRecord[]) {
  const s = summaryOf(agreedTotal, payments);
  const open = payments.filter((p) => p.status === 'PENDING').at(-1);
  return { ...s, pending: open ? paymentDto(open) : null };
}

/** Extra actions the customer / engineer can take on the money side. They are not request-state edges. */
export function paymentActions(args: {
  role: Actor['role'];
  status: string;
  view: ReturnType<typeof paymentView>;
  reviewed: boolean;
}): string[] {
  const { role, status, view } = args;
  const out: string[] = [];
  const open = view.pending;
  if (role === 'CUSTOMER') {
    if (view.due > 0 && !open && status === 'QUOTE_ACCEPTED') out.push('PAY_CASH', 'PAY_ONLINE');
    if (view.due > 0 && !open && status === 'COMPLETED') out.push('PAY_ONLINE');
    if (status === 'COMPLETED' && view.state === 'PAID' && !args.reviewed) out.push('RATE');
  }
  if (role === 'ENGINEER' && status === 'COMPLETED' && view.due > 0 && open?.method === 'CASH')
    out.push('CONFIRM_CASH');
  return out;
}
