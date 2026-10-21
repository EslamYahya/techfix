import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchServiceStatus } from '../api/http';
import { homeFor, useSession } from '../auth/session';
import { ROLE, UI } from '../labels';
import { Button, Card, Shell } from '../ui/kit';

const TEXT = {
  up: 'المنصة تعمل',
  down: 'المنصة غير متاحة حاليًا',
  unknown: 'جارٍ الفحص…',
} as const;
const TONE = {
  up: 'bg-ok-soft text-ok',
  down: 'bg-bad-soft text-bad',
  unknown: 'bg-surface-2 text-ink-3',
} as const;

export function HomePage() {
  const { user, logout } = useSession();
  const { data = 'unknown', isLoading } = useQuery({
    queryKey: ['service-status'],
    queryFn: ({ signal }) => fetchServiceStatus(signal),
    refetchInterval: 30_000,
  });
  const state = isLoading ? 'unknown' : data;
  return (
    <Shell>
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">TechFix</h1>
        <p className="text-ink-2">
          سوق الخدمات الفنية الميدانية: ستالايت، كاميرات مراقبة، إنتركم وشبكات.
        </p>
        <p
          role="status"
          className={`inline-block rounded-md px-3 py-1 text-sm font-semibold ${TONE[state]}`}
        >
          {TEXT[state]}
        </p>
        {user ? (
          <Card title={`أهلًا ${user.name}`}>
            <p className="mb-3 text-ink-2">حسابك: {ROLE[user.role]}</p>
            <div className="flex gap-2">
              <Link to={homeFor(user.role)}>
                <Button>افتح لوحتك</Button>
              </Link>
              <Button variant="ghost" onClick={() => void logout()}>
                {UI.logout}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex gap-2">
            <Link to="/login">
              <Button>{UI.login}</Button>
            </Link>
            <Link to="/register">
              <Button variant="ghost">{UI.register}</Button>
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
