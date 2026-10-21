import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { api, apiPage } from '../api/http';
import type { AppNotification, NotificationMeta } from '../api/types';
import { homeFor, useSession } from '../auth/session';
import { NOTIF_TYPE, NOTIF_UI } from '../labels';
import { Button, Card, Empty, ErrorState, Loading, Shell } from './kit';

export const NOTIF_KEY = ['notifications'] as const;
const LIST_PATH = '/notifications?limit=30';

const fetchList = () => apiPage<AppNotification[], NotificationMeta>(LIST_PATH);

/** Where a notification leads, by who is reading it. Admins have no request page yet. */
function targetOf(role: 'CUSTOMER' | 'ENGINEER' | 'ADMIN', n: AppNotification): string | null {
  const id = n.data?.requestId;
  if (!id) return null;
  if (role === 'CUSTOMER') return `/customer/requests/${id}`;
  if (role === 'ENGINEER') return `/engineer/requests/${id}`;
  return null;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

/** The bell in the page header: a link with the unread count, refreshed every half minute. */
export function NotificationBell() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: fetchList,
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const unread = q.data?.meta.unreadCount ?? 0;
  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `${NOTIF_UI.bell}: ${unread} ${NOTIF_UI.unread}` : NOTIF_UI.bell}
      className="relative inline-flex items-center rounded-md border border-line bg-surface px-3 py-2 text-ink hover:bg-surface-2"
    >
      <span aria-hidden="true">🔔</span>
      {unread > 0 ? (
        <span className="absolute -top-1 -start-1 min-w-5 rounded-full bg-bad px-1 text-center text-xs font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function NotificationsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: NOTIF_KEY, queryFn: fetchList });
  const refresh = () => qc.invalidateQueries({ queryKey: NOTIF_KEY });
  const readOne = useMutation({
    mutationFn: (id: string) => api<void>('POST', `/notifications/${id}/read`),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => api<void>('POST', '/notifications/read-all'),
    onSuccess: refresh,
  });

  const open = (n: AppNotification) => {
    if (!n.read) readOne.mutate(n.id);
    const to = user ? targetOf(user.role, n) : null;
    if (to) void navigate({ to });
  };

  const items = q.data?.data ?? [];
  const unread = q.data?.meta.unreadCount ?? 0;
  return (
    <Shell wide>
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">{NOTIF_UI.title}</h1>
          <Button
            variant="ghost"
            disabled={unread === 0 || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            {NOTIF_UI.markAll}
          </Button>
        </header>
        {q.isLoading ? <Loading /> : null}
        {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
        {q.data && items.length === 0 ? <Empty>{NOTIF_UI.empty}</Empty> : null}
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className="block w-full text-start"
                aria-label={NOTIF_TYPE[n.type] ?? n.title}
              >
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <strong className={n.read ? 'font-semibold text-ink-2' : 'font-extrabold'}>
                        {NOTIF_TYPE[n.type] ?? n.title}
                      </strong>
                      <p className="text-ink-2">{n.body}</p>
                      <time className="text-sm text-ink-3" dateTime={n.createdAt}>
                        {when(n.createdAt)}
                      </time>
                    </div>
                    {n.read ? null : (
                      <span
                        role="img"
                        aria-label={NOTIF_UI.unread}
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
                      />
                    )}
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
        <Link to={user ? homeFor(user.role) : '/'} className="inline-block text-brand">
          {NOTIF_UI.back}
        </Link>
      </div>
    </Shell>
  );
}
