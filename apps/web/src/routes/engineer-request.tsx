import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { api } from '../api/http';
import type { RequestDetail } from '../api/types';
import { JOB_UI, PAY_UI, QUOTE_UI, REQ_UI, SLOT, TIMELINE } from '../labels';
import { Alert, Button, Card, ErrorState, Loading, Shell } from '../ui/kit';
import { EngineerPayment, RatingStars, useAttemptKeys } from '../ui/payments';
import { QuoteForm, QuoteView } from '../ui/quotes';
import { StatusChip } from '../ui/status';

const STEPS = [
  ['START_TRIP', 'start-trip', JOB_UI.startTrip],
  ['ARRIVE', 'arrive', JOB_UI.arrive],
  ['START_JOB', 'start', JOB_UI.start],
  ['COMPLETE_JOB', 'complete', JOB_UI.complete],
] as const;

export function EngineerRequestPage() {
  const { requestId } = useParams({ strict: false }) as { requestId: string };
  const qc = useQueryClient();
  const key = ['engineer', 'request', requestId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<RequestDetail>('GET', `/service-requests/${requestId}`),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['engineer', 'requests'] });
  };
  const confirmKey = useAttemptKeys();
  const send = useMutation({
    mutationFn: (v: { path: string; body?: unknown; key?: string }) =>
      api('POST', v.path, v.body ?? {}, v.key ? { idempotencyKey: v.key } : undefined),
    onSuccess: (_d, v) => {
      if (v.key) confirmKey.done('cash');
      refresh();
    },
    onError: refresh,
  });
  if (q.isLoading)
    return (
      <Shell wide>
        <Loading />
      </Shell>
    );
  if (q.isError)
    return (
      <Shell wide>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </Shell>
    );
  const r = q.data!;
  const can = (a: string) => r.availableActions.includes(a);
  const jobId = r.job?.id;
  return (
    <Shell wide>
      <div className="space-y-5">
        <Link to="/engineer" className="text-brand">
          ← {REQ_UI.inbox}
        </Link>
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{r.service.name}</h1>
          <StatusChip status={r.status} role="engineer" />
          <span className="text-ink-3">{r.number}</span>
        </header>
        <Card>
          <p>{r.description}</p>
          <p className="mt-2 text-sm text-ink-3">
            {r.preferredDate}
            {r.preferredSlot ? ` · ${SLOT[r.preferredSlot]}` : ''} · {r.location.area}
          </p>
          <p className="mt-2 text-ink-2">
            العميل: <strong>{r.customer.name}</strong>
            {r.customer.phone ? ` · ${r.customer.phone}` : ''}
          </p>
          {r.location.address ? <p className="text-ink-2">العنوان: {r.location.address}</p> : null}
        </Card>
        {send.isError ? <Alert>{(send.error as Error).message}</Alert> : null}

        {r.quotes.map((qt) => (
          <QuoteView key={qt.id} quote={qt} />
        ))}
        {r.job && r.payment ? (
          <EngineerPayment
            payment={r.payment}
            agreed={r.job.agreedTotal}
            canConfirm={can('CONFIRM_CASH')}
            busy={send.isPending}
            error={send.error}
            onConfirm={() =>
              send.mutate({
                path: `/jobs/${jobId}/payments/confirm-cash`,
                key: confirmKey.get('cash'),
              })
            }
          />
        ) : null}
        {r.review ? (
          <Card title={PAY_UI.yourRating}>
            <RatingStars value={r.review.rating} />
            {r.review.comment ? <p className="mt-2 text-ink-2">{r.review.comment}</p> : null}
          </Card>
        ) : null}

        {can('SEND_QUOTE') ? (
          <Card title={QUOTE_UI.title}>
            <QuoteForm
              submitLabel={QUOTE_UI.sendQuote}
              pending={send.isPending}
              error={send.error}
              onSubmit={(body) =>
                send.mutate({ path: `/service-requests/${requestId}/quotes`, body })
              }
            />
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {STEPS.filter(([ev]) => can(ev)).map(([ev, path, label]) => (
            <Button
              key={ev}
              disabled={send.isPending}
              onClick={() => send.mutate({ path: `/jobs/${jobId}/${path}` })}
            >
              {label}
            </Button>
          ))}
        </div>

        {can('SEND_ADDITIONAL_QUOTE') ? (
          <Card title={QUOTE_UI.extraTitle}>
            <QuoteForm
              submitLabel={QUOTE_UI.sendExtra}
              pending={send.isPending}
              error={send.error}
              onSubmit={(body) => send.mutate({ path: `/jobs/${jobId}/additional-quotes`, body })}
            />
          </Card>
        ) : null}

        <Card title={REQ_UI.timeline}>
          <ol className="space-y-1">
            {r.timeline.map((e, i) => (
              <li key={`${e.code}-${i}`} className="text-ink-2">
                {TIMELINE[e.code] ?? '—'}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </Shell>
  );
}
