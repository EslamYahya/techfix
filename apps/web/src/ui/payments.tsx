import { useRef, useState } from 'react';
import type { PaymentView } from '../api/types';
import { PAYMENT_STATE, PAY_UI, QUOTE_UI } from '../labels';
import { Alert, Button, Card, Chip, TextArea, fieldErrors } from './kit';
import { money } from './quotes';

/** One key per method until it succeeds: a retried click replays the first answer instead of paying twice. */
export function useAttemptKeys() {
  const keys = useRef<Record<string, string>>({});
  const fresh = () =>
    globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    get: (name: string) => (keys.current[name] ??= fresh()),
    done: (name: string) => {
      delete keys.current[name];
    },
  };
}

const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

export function PaymentSummaryRows({ payment, agreed }: { payment: PaymentView; agreed: number }) {
  const [label, tone] = PAYMENT_STATE[payment.state] ?? PAYMENT_STATE['UNPAID']!;
  return (
    <>
      <p className="flex justify-between">
        <span>{QUOTE_UI.agreed}</span>
        <strong>{money(agreed)}</strong>
      </p>
      <p className="flex justify-between text-ink-2">
        <span>{QUOTE_UI.due}</span>
        <span>{money(payment.due)}</span>
      </p>
      <p className="mt-2">
        <Chip tone={tone}>{label}</Chip>
      </p>
    </>
  );
}

/** The customer's money card: choose how to pay, see the Fawry number, or wait for verification. */
export function CustomerPayment({
  payment,
  agreed,
  canCash,
  canOnline,
  busy,
  error,
  onPay,
}: {
  payment: PaymentView;
  agreed: number;
  canCash: boolean;
  canOnline: boolean;
  busy: boolean;
  error: unknown;
  onPay: (method: 'CASH' | 'ONLINE') => void;
}) {
  const open = payment.pending;
  return (
    <Card title={PAY_UI.title}>
      <PaymentSummaryRows payment={payment} agreed={agreed} />

      {open?.method === 'ONLINE' ? (
        <div className="mt-4 space-y-2 rounded-md bg-surface-2 p-4" role="status">
          <p className="text-sm text-ink-2">{PAY_UI.refTitle}</p>
          <p className="text-2xl font-extrabold tracking-widest" dir="ltr">
            {open.reference}
          </p>
          <p className="text-sm text-ink-2">{PAY_UI.refHelp}</p>
          <p className="text-sm text-ink-2">
            {PAY_UI.amount}: <strong>{money(open.amount)}</strong>
            {open.expiresAt ? ` · ${PAY_UI.expires} ${dateTime(open.expiresAt)}` : ''}
          </p>
          <Alert tone="info">{PAY_UI.verifying}</Alert>
        </div>
      ) : null}

      {open?.method === 'CASH' ? (
        <p className="mt-3 text-sm text-ink-2">{PAY_UI.cashPending}</p>
      ) : null}

      {canCash || canOnline ? (
        <div className="mt-4 space-y-3">
          {canCash && canOnline ? <h3 className="font-bold">{PAY_UI.chooseTitle}</h3> : null}
          {canCash ? (
            <div>
              <Button disabled={busy} onClick={() => onPay('CASH')}>
                {PAY_UI.cash}
              </Button>
              <p className="mt-1 text-sm text-ink-3">{PAY_UI.cashHint}</p>
            </div>
          ) : null}
          {canOnline ? (
            <div>
              <Button
                variant={canCash ? 'ghost' : 'primary'}
                disabled={busy}
                onClick={() => onPay('ONLINE')}
              >
                {canCash ? PAY_UI.online : PAY_UI.payRest}
              </Button>
              {canCash ? <p className="mt-1 text-sm text-ink-3">{PAY_UI.onlineHint}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <Alert>{(error as Error).message}</Alert> : null}
    </Card>
  );
}

/** The engineer's side: what to collect in cash, and the one button that confirms it. */
export function EngineerPayment({
  payment,
  agreed,
  canConfirm,
  busy,
  error,
  onConfirm,
}: {
  payment: PaymentView;
  agreed: number;
  canConfirm: boolean;
  busy: boolean;
  error: unknown;
  onConfirm: () => void;
}) {
  return (
    <Card title={PAY_UI.title}>
      <PaymentSummaryRows payment={payment} agreed={agreed} />
      {payment.pending?.method === 'ONLINE' ? (
        <p className="mt-2 text-sm text-ink-2">{PAY_UI.verifying}</p>
      ) : null}
      {canConfirm ? (
        <div className="mt-4 space-y-2">
          <p>
            {PAY_UI.cashDue}: <strong>{money(payment.due)}</strong>
          </p>
          <p className="text-sm text-ink-3">{PAY_UI.confirmCashHelp}</p>
          <Button disabled={busy} onClick={onConfirm}>
            {PAY_UI.confirmCash}
          </Button>
        </div>
      ) : null}
      {error ? <Alert>{(error as Error).message}</Alert> : null}
    </Card>
  );
}

export function RatingStars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} ${PAY_UI.stars}`} className="text-warn">
      {'★'.repeat(value)}
      <span className="text-ink-3">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export function RatingForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (v: { rating: number; comment?: string }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <Card title={PAY_UI.rateTitle}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (rating) onSubmit({ rating, ...(comment.trim() ? { comment: comment.trim() } : {}) });
        }}
      >
        <p className="text-sm text-ink-3">{PAY_UI.rateHelp}</p>
        <div role="radiogroup" aria-label={PAY_UI.rating} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${PAY_UI.stars}`}
              onClick={() => setRating(n)}
              className={`text-3xl ${n <= rating ? 'text-warn' : 'text-ink-3'}`}
            >
              ★
            </button>
          ))}
        </div>
        <TextArea
          label={PAY_UI.comment}
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
          error={fieldErrors(error)['comment']}
        />
        <Button type="submit" disabled={pending || rating === 0}>
          {PAY_UI.rateSend}
        </Button>
        {error && !fieldErrors(error)['comment'] ? <Alert>{(error as Error).message}</Alert> : null}
      </form>
    </Card>
  );
}
