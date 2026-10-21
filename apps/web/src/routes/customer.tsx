import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { api, publicApi } from '../api/http';
import type { Recommendation, RequestDetail, RequestSummary, ServiceItem } from '../api/types';
import { useSession } from '../auth/session';
import { AREAS, JOB_UI, PAY_UI, QUOTE_UI, REASON, REQ_UI, SLOT, TIMELINE, UI } from '../labels';
import { NotificationBell } from '../ui/notifications';
import { QuoteView } from '../ui/quotes';
import {
  Alert,
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Loading,
  Select,
  Shell,
  TextArea,
  fieldErrors,
} from '../ui/kit';
import { CustomerPayment, RatingForm, RatingStars, useAttemptKeys } from '../ui/payments';
import { StatusChip } from '../ui/status';

const LIST = ['requests', 'mine'];
const dateText = (d: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(`${d}T00:00:00`));

export function CustomerHomePage() {
  const { user, logout } = useSession();
  const q = useQuery({
    queryKey: LIST,
    queryFn: () => api<RequestSummary[]>('GET', '/service-requests'),
  });
  return (
    <Shell wide>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{REQ_UI.myRequests}</h1>
          <div className="flex gap-2">
            <NotificationBell />
            <Link to="/customer/new">
              <Button>{REQ_UI.newRequest}</Button>
            </Link>
            <Button variant="ghost" onClick={() => void logout()}>
              {UI.logout}
            </Button>
          </div>
        </header>
        {user ? <p className="text-ink-2">أهلًا {user.name}</p> : null}
        {q.isLoading ? <Loading /> : null}
        {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
        {q.data && q.data.length === 0 ? <Empty>{REQ_UI.noRequests}</Empty> : null}
        <ul className="space-y-3">
          {q.data?.map((r) => (
            <li key={r.id}>
              <Link to="/customer/requests/$requestId" params={{ requestId: r.id }}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{r.service.name}</strong>
                    <StatusChip status={r.status} role="customer" />
                  </div>
                  <p className="mt-1 text-sm text-ink-3">
                    {r.number} · {r.area} · {dateText(r.preferredDate)}
                  </p>
                  {r.engineer ? (
                    <p className="text-sm text-ink-2">المهندس: {r.engineer.name}</p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

export function NewRequestPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => publicApi<ServiceItem[]>('GET', '/services'),
  });
  const [f, setF] = useState({
    serviceId: '',
    description: '',
    preferredDate: '',
    preferredSlot: 'EVENING',
    area: String(AREAS[0].name),
    address: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((v) => ({ ...v, [k]: e.target.value }));
  const create = useMutation({
    mutationFn: () => {
      const area = AREAS.find((a) => a.name === f.area) ?? AREAS[0];
      return api<{ id: string }>('POST', '/service-requests', {
        serviceId: f.serviceId,
        description: f.description,
        preferredDate: f.preferredDate,
        preferredSlot: f.preferredSlot,
        location: {
          latitude: area.latitude,
          longitude: area.longitude,
          area: area.name,
          address: f.address || area.name,
        },
      });
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: LIST });
      void navigate({ to: '/customer/requests/$requestId', params: { requestId: r.id } });
    },
  });
  const errs = fieldErrors(create.error);
  const grouped = new Map<string, ServiceItem[]>();
  for (const s of services.data ?? [])
    grouped.set(s.category.name, [...(grouped.get(s.category.name) ?? []), s]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-2xl font-extrabold">{REQ_UI.newRequest}</h1>
        {services.isLoading ? <Loading /> : null}
        {services.isError ? (
          <ErrorState error={services.error} onRetry={() => void services.refetch()} />
        ) : null}
        <Select
          label={REQ_UI.service}
          value={f.serviceId}
          onChange={set('serviceId')}
          error={errs['serviceId']}
          required
        >
          <option value="" disabled>
            —
          </option>
          {[...grouped].map(([cat, list]) => (
            <optgroup key={cat} label={cat}>
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <TextArea
          label={REQ_UI.problem}
          value={f.description}
          onChange={set('description')}
          error={errs['description']}
          required
        />
        <Field
          label={REQ_UI.date}
          type="date"
          value={f.preferredDate}
          onChange={set('preferredDate')}
          error={errs['preferredDate']}
          required
        />
        <Select label={REQ_UI.slot} value={f.preferredSlot} onChange={set('preferredSlot')}>
          {Object.entries(SLOT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select label={REQ_UI.area} value={f.area} onChange={set('area')} error={errs['location']}>
          {AREAS.map((a) => (
            <option key={a.name}>{a.name}</option>
          ))}
        </Select>
        <Field label={REQ_UI.address} value={f.address} onChange={set('address')} />
        {create.isError && Object.keys(errs).length === 0 ? (
          <Alert>{(create.error as Error).message}</Alert>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? REQ_UI.submitting : REQ_UI.submit}
          </Button>
          <Link to="/customer">
            <Button type="button" variant="ghost">
              {REQ_UI.back}
            </Button>
          </Link>
        </div>
      </form>
    </Shell>
  );
}

const Stars = ({ value }: { value: number }) => (
  <span aria-label={`التقييم ${value}`}>{value > 0 ? `★ ${value.toFixed(1)}` : 'جديد'}</span>
);

function Recommendations({ id, onDone }: { id: string; onDone: () => void }) {
  const q = useQuery({
    queryKey: ['requests', id, 'recommendations'],
    queryFn: () => api<Recommendation[]>('GET', `/service-requests/${id}/recommendations`),
  });
  const pick = useMutation({
    mutationFn: (engineerId: string) =>
      api('POST', `/service-requests/${id}/select-engineer`, { engineerId }),
    onSuccess: onDone,
    onError: () => void q.refetch(),
  });
  return (
    <Card title={REQ_UI.chooseEngineer}>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {pick.isError ? <Alert>{(pick.error as Error).message}</Alert> : null}
      {q.data && q.data.length === 0 ? <Empty>{REQ_UI.noEngineers}</Empty> : null}
      <ul className="mt-3 space-y-3">
        {q.data?.map((r) => (
          <li key={r.engineerId} className="rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>{r.name}</strong>
                <p className="text-sm text-ink-3">
                  {r.area} · <Stars value={r.rating} /> ({r.ratingCount}) · {r.completedJobs} مهمة
                </p>
                <p className="text-sm text-ink-2">
                  يبعد {r.distanceKm} كم · يصل خلال نحو {r.etaMinutes} دقيقة
                </p>
                <p className="mt-1 flex flex-wrap gap-1 text-xs">
                  {r.reasons.map((x) => (
                    <span key={x} className="rounded bg-teal-soft px-2 py-0.5 text-teal">
                      {REASON[x] ?? x}
                    </span>
                  ))}
                </p>
              </div>
              <Button disabled={pick.isPending} onClick={() => pick.mutate(r.engineerId)}>
                {REQ_UI.select}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RequestDetailPage() {
  const { requestId } = useParams({ strict: false }) as { requestId: string };
  const qc = useQueryClient();
  const key = ['requests', requestId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<RequestDetail>('GET', `/service-requests/${requestId}`),
    // While an online payment waits for Fawry's confirmation, look again every few seconds.
    // The browser coming back from Fawry proves nothing: only the verified callback moves the request.
    refetchInterval: (query) =>
      query.state.data?.payment?.pending?.method === 'ONLINE' ? 5000 : false,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: LIST });
  };
  const keys = useAttemptKeys();
  const pay = useMutation({
    mutationFn: (method: 'CASH' | 'ONLINE') =>
      api(
        'POST',
        `/jobs/${q.data?.job?.id}/payments`,
        { method },
        { idempotencyKey: keys.get(method) },
      ),
    onSuccess: (_d, method) => {
      keys.done(method);
      refresh();
    },
    onError: refresh,
  });
  const rate = useMutation({
    mutationFn: (v: { rating: number; comment?: string }) =>
      api('POST', `/jobs/${q.data?.job?.id}/review`, v),
    onSuccess: refresh,
    onError: refresh,
  });
  const act = useMutation({
    mutationFn: (path: string) => api('POST', path, {}),
    onSuccess: refresh,
    onError: refresh,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const report = useMutation({
    mutationFn: (description: string) =>
      api('POST', `/jobs/${q.data?.job?.id}/report-problem`, { description }),
    onSuccess: () => setProblem(''),
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
  return (
    <Shell wide>
      <div className="space-y-5">
        <Link to="/customer" className="text-brand">
          ← {REQ_UI.myRequests}
        </Link>
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{r.service.name}</h1>
          <StatusChip status={r.status} role="customer" />
          <span className="text-ink-3">{r.number}</span>
        </header>
        <Card>
          <p>{r.description}</p>
          <p className="mt-2 text-sm text-ink-3">
            {dateText(r.preferredDate)}
            {r.preferredSlot ? ` · ${SLOT[r.preferredSlot]}` : ''} · {r.location.area}
          </p>
          {r.engineer ? (
            <p className="mt-2 text-ink-2">
              المهندس: <strong>{r.engineer.name}</strong>
              {r.engineer.phone ? ` · ${r.engineer.phone}` : ''}
            </p>
          ) : null}
          {r.cancelReason ? (
            <p className="mt-2 text-sm text-ink-3">سبب الإلغاء: {r.cancelReason}</p>
          ) : null}
        </Card>
        {r.quotes.map((qt) => (
          <QuoteView key={qt.id} quote={qt}>
            {qt.status === 'SENT' && qt.kind === 'MAIN' && can('ACCEPT_QUOTE') ? (
              <>
                <Button
                  disabled={act.isPending}
                  onClick={() => act.mutate(`/quotes/${qt.id}/accept`)}
                >
                  {QUOTE_UI.accept}
                </Button>
                <Button
                  variant="ghost"
                  disabled={act.isPending}
                  onClick={() => act.mutate(`/quotes/${qt.id}/reject`)}
                >
                  {QUOTE_UI.reject}
                </Button>
              </>
            ) : null}
            {qt.status === 'SENT' && qt.kind === 'ADDITIONAL' && can('ACCEPT_ADDITIONAL_QUOTE') ? (
              <>
                <Button
                  disabled={act.isPending}
                  onClick={() => act.mutate(`/additional-quotes/${qt.id}/accept`)}
                >
                  {QUOTE_UI.acceptExtra}
                </Button>
                <Button
                  variant="ghost"
                  disabled={act.isPending}
                  onClick={() => act.mutate(`/additional-quotes/${qt.id}/reject`)}
                >
                  {QUOTE_UI.rejectExtra}
                </Button>
              </>
            ) : null}
          </QuoteView>
        ))}
        {r.job && r.payment ? (
          <CustomerPayment
            payment={r.payment}
            agreed={r.job.agreedTotal}
            canCash={can('PAY_CASH')}
            canOnline={can('PAY_ONLINE')}
            busy={pay.isPending}
            error={pay.error}
            onPay={(m) => pay.mutate(m)}
          />
        ) : null}
        {can('RATE') ? (
          <RatingForm
            pending={rate.isPending}
            error={rate.error}
            onSubmit={(v) => rate.mutate(v)}
          />
        ) : null}
        {r.review ? (
          <Card title={PAY_UI.yourRating}>
            <RatingStars value={r.review.rating} />
            {r.review.comment ? <p className="mt-2 text-ink-2">{r.review.comment}</p> : null}
            <p className="mt-2 text-sm text-ink-3">{PAY_UI.rated}</p>
          </Card>
        ) : null}
        {can('CONFIRM_COMPLETION') ? (
          <Card>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={act.isPending}
                onClick={() => act.mutate(`/jobs/${r.job?.id}/confirm-completion`)}
              >
                {JOB_UI.confirm}
              </Button>
              {problem === null ? (
                <Button variant="ghost" onClick={() => setProblem('')}>
                  {JOB_UI.report}
                </Button>
              ) : null}
            </div>
            {report.isSuccess ? <Alert tone="ok">{JOB_UI.reportDone}</Alert> : null}
            {problem !== null && !report.isSuccess ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  report.mutate(problem);
                }}
              >
                <TextArea
                  label={JOB_UI.reportText}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  error={fieldErrors(report.error)['description']}
                  required
                />
                <Button type="submit" disabled={report.isPending}>
                  {JOB_UI.reportSend}
                </Button>
              </form>
            ) : null}
          </Card>
        ) : null}
        {act.isError ? <Alert>{(act.error as Error).message}</Alert> : null}
        {can('SELECT_ENGINEER') ? <Recommendations id={requestId} onDone={refresh} /> : null}
        <div className="flex flex-wrap gap-2">
          {can('CHANGE_ENGINEER') ? (
            <Button
              variant="ghost"
              disabled={act.isPending}
              onClick={() => act.mutate(`/service-requests/${requestId}/change-engineer`)}
            >
              {REQ_UI.changeEngineer}
            </Button>
          ) : null}
          {can('CANCEL') ? (
            <Button
              variant="danger"
              disabled={act.isPending}
              onClick={() => act.mutate(`/service-requests/${requestId}/cancel`)}
            >
              {REQ_UI.cancel}
            </Button>
          ) : null}
        </div>
        <Card title={REQ_UI.timeline}>
          <ol className="space-y-1">
            {r.timeline.map((e, i) => (
              <li key={`${e.code}-${i}`} className="text-ink-2">
                {TIMELINE[e.code] ?? '—'}
                <span className="text-sm text-ink-3">
                  {' '}
                  ·{' '}
                  {new Intl.DateTimeFormat('ar-EG', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(e.at))}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </Shell>
  );
}
