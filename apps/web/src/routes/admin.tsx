import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, apiPage } from '../api/http';
import type {
  AdminDisputeRow,
  AdminPaymentRow,
  AdminRequestRow,
  AdminReviewRow,
  PaymentTotals,
} from '../api/types';
import {
  ADMIN_STATUS,
  ADMIN_UI,
  DISPUTE_OUTCOME,
  DISPUTE_REASON,
  DISPUTE_STATUS,
  PAYMENT_STATUS,
  PAY_METHOD,
  fieldMessage,
} from '../labels';
import { ApiError } from '../api/http';
import { AdminPage } from '../ui/admin-nav';
import {
  Alert,
  Button,
  Card,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Select,
  TextArea,
  Field,
} from '../ui/kit';

const money = (n: number) =>
  `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n)} ج.م`;
const day = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(iso));

/** First field message of a validation error, else the error's own Arabic text. */
function problem(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details[0];
    return (d && fieldMessage(d.field, d.code)) || e.message;
  }
  return (e as Error).message;
}

function useList<T, M = unknown>(key: unknown[], path: string) {
  return useQuery({ queryKey: ['admin', ...key], queryFn: () => apiPage<T[], M>(path) });
}
function useAct<V>(key: string, fn: (v: V) => Promise<unknown>, done?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', key] });
      done?.();
    },
  });
}
function Body({
  q,
  empty,
  children,
}: {
  q: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
    data?: unknown;
  };
  empty: boolean;
  children: ReactNode;
}) {
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (empty) return <Empty>{ADMIN_UI.noRows}</Empty>;
  return <>{children}</>;
}

// ───────────────────────── requests ─────────────────────────

export function AdminRequestsPage() {
  const [status, setStatus] = useState('');
  const [dispute, setDispute] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const q = useList<AdminRequestRow>(
    ['requests', status, dispute],
    `/admin/service-requests?limit=50${status ? `&status=${status}` : ''}${dispute ? '&hasDispute=true' : ''}`,
  );
  const cancel = useAct(
    'requests',
    (id: string) => api('POST', `/admin/service-requests/${id}/cancel`, { reason }),
    () => setCancelling(null),
  );
  const rows = q.data?.data ?? [];
  return (
    <AdminPage title={ADMIN_UI.nav.requests}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select label={ADMIN_UI.status} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{ADMIN_UI.all}</option>
          {Object.entries(ADMIN_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 pb-2">
          <input type="checkbox" checked={dispute} onChange={(e) => setDispute(e.target.checked)} />
          {ADMIN_UI.hasDispute}
        </label>
      </div>
      {cancel.isError ? <Alert>{problem(cancel.error)}</Alert> : null}
      <Body q={q} empty={rows.length === 0}>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{r.number}</strong>
                  <span>{r.serviceName}</span>
                  <Chip tone={r.status === 'CANCELLED' ? 'bad' : 'info'}>
                    {ADMIN_STATUS[r.status] ?? '—'}
                  </Chip>
                  {r.hasDispute ? <Chip tone="warn">{ADMIN_UI.hasDispute}</Chip> : null}
                  <span className="text-sm text-ink-3">{day(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-ink-2">
                  {ADMIN_UI.customer}: {r.customerName} · {ADMIN_UI.engineer}:{' '}
                  {r.engineerName ?? ADMIN_UI.notAssigned}
                </p>
                {r.status !== 'CANCELLED' && r.status !== 'RATED' && r.status !== 'COMPLETED' ? (
                  cancelling === r.id ? (
                    <form
                      className="mt-3 space-y-2"
                      onSubmit={(ev: FormEvent) => {
                        ev.preventDefault();
                        cancel.mutate(r.id);
                      }}
                    >
                      <TextArea
                        label={ADMIN_UI.cancelReason}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <Button
                        variant="danger"
                        disabled={cancel.isPending || reason.trim().length < 3}
                      >
                        {ADMIN_UI.cancelConfirm}
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setCancelling(r.id);
                          setReason('');
                        }}
                      >
                        {ADMIN_UI.cancelRequest}
                      </Button>
                    </div>
                  )
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </Body>
    </AdminPage>
  );
}

// ───────────────────────── finance ─────────────────────────

export function AdminFinancePage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [refunding, setRefunding] = useState<string | null>(null);
  const [f, setF] = useState({ amount: '', reason: '' });
  const q = useList<AdminPaymentRow, { totals: PaymentTotals }>(
    ['payments', status, method],
    `/admin/payments?limit=50${status ? `&status=${status}` : ''}${method ? `&method=${method}` : ''}`,
  );
  const refund = useAct(
    'payments',
    (id: string) =>
      api('POST', `/payments/${id}/refund`, { amount: Number(f.amount), reason: f.reason }),
    () => setRefunding(null),
  );
  const t = q.data?.meta.totals;
  const rows = q.data?.data ?? [];
  return (
    <AdminPage title={ADMIN_UI.nav.finance}>
      {t ? (
        <dl className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              [ADMIN_UI.collected, money(t.collectedNet)],
              [ADMIN_UI.cash, money(t.cashNet)],
              [ADMIN_UI.onlineFawry, money(t.onlineNet)],
              [ADMIN_UI.refunded, money(t.refundedTotal)],
              [`${ADMIN_UI.pending} (${t.pendingCount})`, money(t.pendingAmount)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface-2 p-3">
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="text-lg font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select label={ADMIN_UI.status} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{ADMIN_UI.all}</option>
          {Object.entries(PAYMENT_STATUS).map(([k, [l]]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
        <Select label={ADMIN_UI.method} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">{ADMIN_UI.all}</option>
          {Object.entries(PAY_METHOD).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      {refund.isError ? <Alert>{problem(refund.error)}</Alert> : null}
      <Body q={q} empty={rows.length === 0}>
        <ul className="space-y-3">
          {rows.map((p) => {
            const [label, tone] = PAYMENT_STATUS[p.status] ?? ['—', 'info' as const];
            const left = Math.round((p.amount - p.refunded) * 100) / 100;
            return (
              <li key={p.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{p.requestNumber}</strong>
                    <span>{money(p.amount)}</span>
                    <Chip tone={tone}>{label}</Chip>
                    <span className="text-sm text-ink-3">{PAY_METHOD[p.method]}</span>
                    {p.refunded > 0 ? (
                      <span className="text-sm text-ink-2">
                        {ADMIN_UI.refunded}: {money(p.refunded)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-ink-2">
                    {ADMIN_UI.customer}: {p.customerName} · {ADMIN_UI.engineer}:{' '}
                    {p.engineerName ?? ADMIN_UI.notAssigned}
                    {p.paidAt ? ` · ${ADMIN_UI.paidAt}: ${day(p.paidAt)}` : ''}
                    {p.reference ? ` · ${ADMIN_UI.reference}: ${p.reference}` : ''}
                  </p>
                  {(p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED') && left > 0 ? (
                    refunding === p.id ? (
                      <form
                        className="mt-3 space-y-2"
                        onSubmit={(ev: FormEvent) => {
                          ev.preventDefault();
                          refund.mutate(p.id);
                        }}
                      >
                        <Alert tone="info">{ADMIN_UI.refundNote}</Alert>
                        <Field
                          label={ADMIN_UI.refundAmount}
                          inputMode="decimal"
                          value={f.amount}
                          onChange={(e) => setF({ ...f, amount: e.target.value })}
                        />
                        <TextArea
                          label={ADMIN_UI.refundReason}
                          value={f.reason}
                          onChange={(e) => setF({ ...f, reason: e.target.value })}
                        />
                        <Button
                          disabled={
                            refund.isPending ||
                            !(Number(f.amount) > 0 && Number(f.amount) <= left) ||
                            f.reason.trim().length < 3
                          }
                        >
                          {ADMIN_UI.refundConfirm}
                        </Button>
                      </form>
                    ) : (
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRefunding(p.id);
                            setF({ amount: String(left), reason: '' });
                          }}
                        >
                          {ADMIN_UI.refund}
                        </Button>
                      </div>
                    )
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </Body>
    </AdminPage>
  );
}

// ───────────────────────── disputes ─────────────────────────

const DISPUTE_TABS = ['OPEN', 'RESOLVED', 'REJECTED'] as const;

export function AdminDisputesPage() {
  const [tab, setTab] = useState<(typeof DISPUTE_TABS)[number]>('OPEN');
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ outcome: 'CLOSE', resolution: '' });
  const q = useList<AdminDisputeRow>(['disputes', tab], `/admin/disputes?limit=50&status=${tab}`);
  const resolve = useAct(
    'disputes',
    (id: string) => api('POST', `/admin/disputes/${id}/resolve`, f),
    () => setOpen(null),
  );
  const rows = q.data?.data ?? [];
  return (
    <AdminPage title={ADMIN_UI.nav.disputes}>
      <div role="tablist" className="mb-4 flex gap-2">
        {DISPUTE_TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`rounded-md px-3 py-1.5 font-semibold ${tab === s ? 'bg-brand text-white' : 'bg-surface-2'}`}
          >
            {DISPUTE_STATUS[s]![0]}
          </button>
        ))}
      </div>
      {resolve.isError ? <Alert>{problem(resolve.error)}</Alert> : null}
      <Body q={q} empty={rows.length === 0}>
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{d.requestNumber}</strong>
                  <Chip tone={DISPUTE_STATUS[d.status]?.[1] ?? 'info'}>
                    {DISPUTE_STATUS[d.status]?.[0]}
                  </Chip>
                  <span>{DISPUTE_REASON[d.reason] ?? DISPUTE_REASON['OTHER']}</span>
                  <span className="text-sm text-ink-3">
                    {ADMIN_UI.opened} {d.openedByName} · {day(d.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-ink-2">{d.description}</p>
                {d.resolution ? (
                  <p className="mt-2 rounded-md bg-surface-2 px-3 py-2">{d.resolution}</p>
                ) : null}
                {d.status === 'OPEN' || d.status === 'UNDER_REVIEW' ? (
                  open === d.id ? (
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(ev: FormEvent) => {
                        ev.preventDefault();
                        resolve.mutate(d.id);
                      }}
                    >
                      <fieldset className="space-y-2">
                        <legend className="mb-1 text-sm font-semibold text-ink-2">
                          {ADMIN_UI.outcomeLabel}
                        </legend>
                        {Object.entries(DISPUTE_OUTCOME).map(([k, label]) => (
                          <label key={k} className="flex items-start gap-2">
                            <input
                              type="radio"
                              name={`outcome-${d.id}`}
                              checked={f.outcome === k}
                              onChange={() => setF({ ...f, outcome: k })}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <TextArea
                        label={ADMIN_UI.resolution}
                        value={f.resolution}
                        onChange={(e) => setF({ ...f, resolution: e.target.value })}
                      />
                      <Button disabled={resolve.isPending || f.resolution.trim().length < 5}>
                        {ADMIN_UI.resolve}
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-3">
                      <Button
                        onClick={() => {
                          setOpen(d.id);
                          setF({ outcome: 'CLOSE', resolution: '' });
                        }}
                      >
                        {ADMIN_UI.resolve}
                      </Button>
                    </div>
                  )
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </Body>
    </AdminPage>
  );
}

// ───────────────────────── reviews ─────────────────────────

export function AdminReviewsPage() {
  const [onlyHidden, setOnlyHidden] = useState(false);
  const q = useList<AdminReviewRow>(
    ['reviews', onlyHidden],
    `/admin/reviews?limit=50${onlyHidden ? '&hidden=true' : ''}`,
  );
  const hide = useAct('reviews', (v: { id: string; hidden: boolean }) =>
    api('POST', `/admin/reviews/${v.id}/hide`, { hidden: v.hidden }),
  );
  const rows = q.data?.data ?? [];
  return (
    <AdminPage title={ADMIN_UI.nav.reviews}>
      <label className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={onlyHidden}
          onChange={(e) => setOnlyHidden(e.target.checked)}
        />
        {ADMIN_UI.onlyHidden}
      </label>
      {hide.isError ? <Alert>{problem(hide.error)}</Alert> : null}
      <Body q={q} empty={rows.length === 0}>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <strong aria-label={`${r.rating} من 5`}>
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </strong>
                  <span>{r.requestNumber}</span>
                  {r.hidden ? <Chip tone="bad">{ADMIN_UI.hiddenChip}</Chip> : null}
                  <span className="text-sm text-ink-3">{day(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-ink-2">
                  {ADMIN_UI.customer}: {r.customerName} · {ADMIN_UI.engineer}: {r.engineerName}
                </p>
                {r.comment ? <p className="mt-2">{r.comment}</p> : null}
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    disabled={hide.isPending}
                    onClick={() => hide.mutate({ id: r.id, hidden: !r.hidden })}
                  >
                    {r.hidden ? ADMIN_UI.show : ADMIN_UI.hide}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Body>
    </AdminPage>
  );
}
