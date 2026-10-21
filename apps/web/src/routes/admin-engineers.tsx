import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminPage } from '../ui/admin-nav';
import { useState } from 'react';
import { api } from '../api/http';
import type { AdminEngineerRow } from '../api/types';
import { ACCOUNT, ADMIN_UI, AVAILABILITY, VERIFICATION } from '../labels';
import { Alert, Button, Card, Chip, Empty, ErrorState, Loading, Shell } from '../ui/kit';

const TABS = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  PENDING: 'بانتظار التوثيق',
  VERIFIED: 'موثّقون',
  REJECTED: 'مرفوضون',
};

export function AdminEngineersPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('PENDING');
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['admin', 'engineers', tab],
    queryFn: () => api<AdminEngineerRow[]>('GET', `/admin/engineers?verification=${tab}&limit=50`),
  });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: object }) =>
      api('POST', `/admin/engineers/${id}/${action}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'engineers'] }),
  });
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <AdminPage title={ADMIN_UI.nav.engineers}>
      <div role="tablist" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 font-semibold ${tab === t ? 'bg-brand text-white' : 'bg-surface-2'}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {act.isError ? <Alert>{(act.error as Error).message}</Alert> : null}
      {list.isLoading ? <Loading /> : null}
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.length === 0 ? <Empty>لا يوجد مهندسون في هذه القائمة.</Empty> : null}
      <div className="space-y-3">
        {(list.data ?? []).map((r) => {
          const suspended = r.accountStatus === 'SUSPENDED';
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <strong>{r.name}</strong>
                <span dir="ltr" className="text-ink-3">
                  {r.phone}
                </span>
                <Chip tone={VERIFICATION[r.verificationStatus]?.[1] ?? 'info'}>
                  {VERIFICATION[r.verificationStatus]?.[0]}
                </Chip>
                <Chip tone={ACCOUNT[r.accountStatus]?.[1] ?? 'info'}>
                  {ACCOUNT[r.accountStatus]?.[0]}
                </Chip>
                <span className="text-sm text-ink-3">
                  {AVAILABILITY[r.availabilityStatus]} · {r.documentsCount} وثائق
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.verificationStatus === 'PENDING' ? (
                  <>
                    <Button
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate({ id: r.id, action: 'verify', body: { approved: true } })
                      }
                    >
                      توثيق
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRejecting(r.id);
                        setReason('');
                      }}
                    >
                      رفض
                    </Button>
                  </>
                ) : null}
                {suspended ? (
                  <Button
                    variant="ghost"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: r.id, action: 'reinstate' })}
                  >
                    رفع الإيقاف
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: r.id, action: 'suspend' })}
                  >
                    إيقاف الحساب
                  </Button>
                )}
              </div>
              {rejecting === r.id ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    act.mutate(
                      { id: r.id, action: 'verify', body: { approved: false, reason } },
                      { onSuccess: () => setRejecting(null) },
                    );
                  }}
                >
                  <label className="grow">
                    <span className="mb-1 block text-sm font-semibold text-ink-2">سبب الرفض</span>
                    <input
                      value={reason}
                      onChange={(ev) => setReason(ev.target.value)}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2"
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={reason.trim().length < 3 || act.isPending}
                  >
                    تأكيد الرفض
                  </Button>
                </form>
              ) : null}
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
