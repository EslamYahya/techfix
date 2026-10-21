import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { homeFor, useSession } from './auth/session';
import { AdminEngineersPage } from './routes/admin-engineers';
import {
  AdminDisputesPage,
  AdminFinancePage,
  AdminRequestsPage,
  AdminReviewsPage,
} from './routes/admin';
import { CustomerHomePage, NewRequestPage, RequestDetailPage } from './routes/customer';
import { EngineerRequestPage } from './routes/engineer-request';
import { EngineerPage } from './routes/engineer';
import { HomePage } from './routes/home';
import { LoginPage } from './routes/login';
import { RegisterPage } from './routes/register';
import { Loading, Shell } from './ui/kit';
import { NotificationsPage } from './ui/notifications';

type Role = 'CUSTOMER' | 'ENGINEER' | 'ADMIN';

/** Shows the page only to the given role; everyone else is sent to login or to their own home. */
function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, restoring } = useSession();
  if (restoring)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (!user) return <Navigate to="/login" />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} />;
  return <>{children}</>;
}

/** Any signed-in person; everyone else goes to login. */
function SignedIn({ children }: { children: ReactNode }) {
  const { user, restoring } = useSession();
  if (restoring)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  return user ? <>{children}</> : <Navigate to="/login" />;
}

/** Login and register are for signed-out visitors only. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, restoring } = useSession();
  if (restoring)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  return user ? <Navigate to={homeFor(user.role)} /> : <>{children}</>;
}

const root = createRootRoute({ component: () => <Outlet /> });
const home = createRoute({ getParentRoute: () => root, path: '/', component: HomePage });
const login = createRoute({
  getParentRoute: () => root,
  path: '/login',
  component: () => (
    <GuestOnly>
      <LoginPage />
    </GuestOnly>
  ),
});
const register = createRoute({
  getParentRoute: () => root,
  path: '/register',
  component: () => (
    <GuestOnly>
      <RegisterPage />
    </GuestOnly>
  ),
});
const notifications = createRoute({
  getParentRoute: () => root,
  path: '/notifications',
  component: () => (
    <SignedIn>
      <NotificationsPage />
    </SignedIn>
  ),
});
const customer = createRoute({
  getParentRoute: () => root,
  path: '/customer',
  component: () => (
    <Guard role="CUSTOMER">
      <CustomerHomePage />
    </Guard>
  ),
});
const customerNew = createRoute({
  getParentRoute: () => root,
  path: '/customer/new',
  component: () => (
    <Guard role="CUSTOMER">
      <NewRequestPage />
    </Guard>
  ),
});
const customerRequest = createRoute({
  getParentRoute: () => root,
  path: '/customer/requests/$requestId',
  component: () => (
    <Guard role="CUSTOMER">
      <RequestDetailPage />
    </Guard>
  ),
});
const engineer = createRoute({
  getParentRoute: () => root,
  path: '/engineer',
  component: () => (
    <Guard role="ENGINEER">
      <EngineerPage />
    </Guard>
  ),
});
const engineerRequest = createRoute({
  getParentRoute: () => root,
  path: '/engineer/requests/$requestId',
  component: () => (
    <Guard role="ENGINEER">
      <EngineerRequestPage />
    </Guard>
  ),
});
const adminEngineers = createRoute({
  getParentRoute: () => root,
  path: '/admin/engineers',
  component: () => (
    <Guard role="ADMIN">
      <AdminEngineersPage />
    </Guard>
  ),
});

const adminRequests = createRoute({
  getParentRoute: () => root,
  path: '/admin/requests',
  component: () => (
    <Guard role="ADMIN">
      <AdminRequestsPage />
    </Guard>
  ),
});
const adminFinance = createRoute({
  getParentRoute: () => root,
  path: '/admin/finance',
  component: () => (
    <Guard role="ADMIN">
      <AdminFinancePage />
    </Guard>
  ),
});
const adminDisputes = createRoute({
  getParentRoute: () => root,
  path: '/admin/disputes',
  component: () => (
    <Guard role="ADMIN">
      <AdminDisputesPage />
    </Guard>
  ),
});
const adminReviews = createRoute({
  getParentRoute: () => root,
  path: '/admin/reviews',
  component: () => (
    <Guard role="ADMIN">
      <AdminReviewsPage />
    </Guard>
  ),
});

export const router = createRouter({
  routeTree: root.addChildren([
    home,
    login,
    register,
    customer,
    customerNew,
    customerRequest,
    engineer,
    engineerRequest,
    adminEngineers,
    adminRequests,
    adminFinance,
    adminDisputes,
    adminReviews,
    notifications,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
