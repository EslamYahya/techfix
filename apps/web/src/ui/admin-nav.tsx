import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ADMIN_UI } from '../labels';
import { NotificationBell } from './notifications';
import { Shell } from './kit';

const LINKS = [
  ['/admin/engineers', ADMIN_UI.nav.engineers],
  ['/admin/requests', ADMIN_UI.nav.requests],
  ['/admin/finance', ADMIN_UI.nav.finance],
  ['/admin/disputes', ADMIN_UI.nav.disputes],
  ['/admin/reviews', ADMIN_UI.nav.reviews],
] as const;

/** Page frame of the back office: one navigation, the bell, and the page title. */
export function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Shell wide>
      <nav aria-label="الإدارة" className="mb-4 flex flex-wrap items-center gap-2">
        {LINKS.map(([to, label]) => (
          <Link
            key={to}
            to={to}
            activeProps={{ 'aria-current': 'page', className: 'bg-brand text-white' }}
            inactiveProps={{ className: 'bg-surface-2 text-ink' }}
            className="rounded-md px-3 py-1.5 font-semibold"
          >
            {label}
          </Link>
        ))}
        <span className="ms-auto">
          <NotificationBell />
        </span>
      </nav>
      <h1 className="mb-4 text-2xl font-extrabold">{title}</h1>
      {children}
    </Shell>
  );
}
