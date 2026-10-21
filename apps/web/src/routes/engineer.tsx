import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ApiError, api, publicApi } from '../api/http';
import type { EngineerMe, RequestSummary, ServiceItem } from '../api/types';
import { ACCOUNT, AVAILABILITY, DOC_KIND, REQ_UI, SLOT, UI, VERIFICATION } from '../labels';
import { Link } from '@tanstack/react-router';
import { NotificationBell } from '../ui/notifications';
import { StatusChip } from '../ui/status';
import {
  Alert,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Loading,
  Shell,
  fieldErrors,
} from '../ui/kit';

const KEY = ['engineer', 'me'];

function useMe() {
  return useQuery({ queryKey: KEY, queryFn: () => api<EngineerMe>('GET', '/engineers/me') });
}
function useSave<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

const INBOX = ['engineer', 'requests'];

function InboxCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: INBOX,
    queryFn: () => api<RequestSummary[]>('GET', '/engineer/requests'),
    refetchInterval: 30_000,
  });
  const answer = useMutation({
    mutationFn: (v: { id: string; path: 'accept' | 'reject' }) =>
      api('POST', `/service-requests/${v.id}/${v.path}`, {}),
    onSettled: () => qc.invalidateQueries({ queryKey: INBOX }),
  });
  return (
    <Card title={REQ_UI.inbox}>
      {q.isLoading ? <Loading /> : null}
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {answer.isError ? <Alert>{(answer.error as Error).message}</Alert> : null}
      {q.data && q.data.length === 0 ? <p className="text-ink-3">{REQ_UI.noInbox}</p> : null}
      <ul className="space-y-3">
        {q.data?.map((r) => (
          <li key={r.id} className="rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/engineer/requests/$requestId"
                params={{ requestId: r.id }}
                className="text-brand"
              >
                <strong>{r.service.name}</strong>
              </Link>
              <StatusChip status={r.status} role="engineer" />
            </div>
            <p className="mt-1 text-sm text-ink-2">{r.description}</p>
            <p className="mt-1 text-sm text-ink-3">
              {r.customerName} · {r.area} · {r.preferredDate}
              {r.preferredSlot ? ` · ${SLOT[r.preferredSlot]}` : ''}
            </p>
            {r.status === 'ENGINEER_SELECTED' ? (
              <div className="mt-2 flex gap-2">
                <Button
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ id: r.id, path: 'accept' })}
                >
                  {REQ_UI.accept}
                </Button>
                <Button
                  variant="ghost"
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ id: r.id, path: 'reject' })}
                >
                  {REQ_UI.reject}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function EngineerPage() {
  const me = useMe();
  if (me.isLoading)
    return (
      <Shell wide>
        <Loading />
      </Shell>
    );
  if (me.isError)
    return (
      <Shell wide>
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </Shell>
    );
  const e = me.data!;
  const [vLabel, vTone] = VERIFICATION[e.verificationStatus] ?? ['—', 'info' as const];
  const [aLabel, aTone] = ACCOUNT[e.accountStatus] ?? ['—', 'info' as const];
  return (
    <Shell wide>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{e.name}</h1>
          <Chip tone={vTone}>{vLabel}</Chip>
          <Chip tone={aTone}>{aLabel}</Chip>
          <span className="ms-auto">
            <NotificationBell />
          </span>
        </header>
        {e.verificationStatus === 'PENDING' ? (
          <Alert tone="warn">
            حسابك قيد المراجعة. أكمل بياناتك أدناه وستتلقى طلبات بعد توثيقه من الإدارة.
          </Alert>
        ) : null}
        {e.verificationStatus === 'REJECTED' ? (
          <Alert>
            تعذّر توثيق حسابك{e.rejectionReason ? `: ${e.rejectionReason}` : '.'} حدّث بياناتك وأعد
            إرسال الوثائق.
          </Alert>
        ) : null}
        <InboxCard />
        <AvailabilityCard e={e} />
        <ProfileCard e={e} />
        <LocationCard e={e} />
        <ServicesCard e={e} />
        <Card title="الوثائق">
          {e.documents.length === 0 ? (
            <p className="text-ink-3">لم تُرسَل وثائق بعد.</p>
          ) : (
            <ul className="space-y-1">
              {e.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  {DOC_KIND[d.kind] ?? d.kind}
                  <Chip tone={d.approved === null ? 'warn' : d.approved ? 'ok' : 'bad'}>
                    {d.approved === null ? 'قيد المراجعة' : d.approved ? 'مقبولة' : 'مرفوضة'}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}

function AvailabilityCard({ e }: { e: EngineerMe }) {
  const save = useSave((status: string) => api('PATCH', '/engineers/me/status', { status }));
  const verified = e.verificationStatus === 'VERIFIED';
  return (
    <Card title="حالة الاستقبال">
      <p className="mb-3">{AVAILABILITY[e.availabilityStatus]}</p>
      <div className="flex gap-2">
        <Button
          disabled={!verified || save.isPending || e.availabilityStatus === 'AVAILABLE'}
          onClick={() => save.mutate('AVAILABLE')}
        >
          ابدأ استقبال الطلبات
        </Button>
        <Button
          variant="ghost"
          disabled={!verified || save.isPending || e.availabilityStatus === 'OFFLINE'}
          onClick={() => save.mutate('OFFLINE')}
        >
          أوقف الاستقبال
        </Button>
      </div>
      {!verified ? (
        <p className="mt-2 text-sm text-ink-3">يتاح هذا الخيار بعد توثيق الحساب.</p>
      ) : null}
      {save.isError ? <Alert>{(save.error as Error).message}</Alert> : null}
    </Card>
  );
}

function ProfileCard({ e }: { e: EngineerMe }) {
  const [bio, setBio] = useState(e.bio ?? '');
  const [radius, setRadius] = useState(String(e.serviceRadiusKm));
  const save = useSave((v: object) => api('PATCH', '/engineers/me', v));
  const errors = fieldErrors(save.error);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    save.mutate({ bio: bio.trim() || null, serviceRadiusKm: Number(radius) });
  };
  return (
    <Card title="نبذة عنك">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">نبذة قصيرة عن خبرتك</span>
          <textarea
            value={bio}
            onChange={(ev) => setBio(ev.target.value)}
            rows={3}
            maxLength={600}
            className="w-full rounded-md border border-line bg-surface px-3 py-2"
          />
        </label>
        <Field
          label="أبعد مسافة تقبل الذهاب إليها (كم)"
          type="number"
          min={1}
          max={100}
          value={radius}
          onChange={(ev) => setRadius(ev.target.value)}
          error={errors['serviceRadiusKm']}
        />
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? UI.saving : UI.save}
        </Button>
        {save.isSuccess ? <Alert tone="ok">تم الحفظ.</Alert> : null}
      </form>
    </Card>
  );
}

function LocationCard({ e }: { e: EngineerMe }) {
  const [area, setArea] = useState(e.location?.area ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const save = useSave((v: { latitude: number; longitude: number; area?: string }) =>
    api('PATCH', '/engineers/me/location', v),
  );
  const errors = fieldErrors(save.error);

  function useMyLocation() {
    setMsg(null);
    if (!('geolocation' in navigator)) return setMsg('متصفحك لا يدعم تحديد الموقع.');
    navigator.geolocation.getCurrentPosition(
      (p) =>
        save.mutate({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          ...(area.trim() ? { area: area.trim() } : {}),
        }),
      () => setMsg('تعذّر تحديد موقعك. اسمح للمتصفح بالوصول إلى الموقع ثم أعد المحاولة.'),
    );
  }
  return (
    <Card title="موقع عملك">
      <p className="mb-3 text-ink-2">
        {e.location
          ? `الموقع محفوظ${e.location.area ? ` (${e.location.area})` : ''}.`
          : 'لم تحدد موقعك بعد. نستخدمه لاقتراحك على العملاء القريبين منك.'}
      </p>
      <div className="space-y-3">
        <Field label="المنطقة" value={area} onChange={(ev) => setArea(ev.target.value)} />
        <Button onClick={useMyLocation} disabled={save.isPending}>
          {save.isPending ? UI.saving : 'استخدم موقعي الحالي'}
        </Button>
        {msg ? <Alert>{msg}</Alert> : null}
        {errors['latitude'] ? <Alert>{errors['latitude']}</Alert> : null}
        {save.isSuccess ? <Alert tone="ok">تم حفظ الموقع.</Alert> : null}
      </div>
    </Card>
  );
}

function ServicesCard({ e }: { e: EngineerMe }) {
  const catalog = useQuery({
    queryKey: ['services'],
    queryFn: () => publicApi<ServiceItem[]>('GET', '/services'),
  });
  const add = useSave((serviceId: string) => api('POST', '/engineers/me/services', { serviceId }));
  const remove = useSave((serviceId: string) =>
    api('DELETE', `/engineers/me/services/${serviceId}`),
  );
  const mine = new Set(e.services.map((s) => s.id));
  const error = (add.error ?? remove.error) as ApiError | null;
  return (
    <Card title="خدماتك">
      {catalog.isLoading ? <Loading /> : null}
      {catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : null}
      <ul className="space-y-1">
        {(catalog.data ?? []).map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mine.has(s.id)}
                disabled={add.isPending || remove.isPending}
                onChange={() => (mine.has(s.id) ? remove.mutate(s.id) : add.mutate(s.id))}
              />
              <span className="text-ink-3">{s.category.name} ·</span> {s.name}
            </label>
          </li>
        ))}
      </ul>
      {error ? <Alert>{error.message}</Alert> : null}
    </Card>
  );
}
