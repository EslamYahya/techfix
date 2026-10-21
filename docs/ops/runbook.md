# TechFix runbook

Audience: whoever is on call. Everything here is a procedure, not a promise — none of it has been run against
a live environment yet (see `docs/adr/0008-back-office-and-launch.md`).

## Processes

| Process | Command                                                  | Needs                                                      |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| API     | `node apps/api/dist/main.js`                             | PostgreSQL+PostGIS, Redis (optional), env below            |
| Worker  | `node apps/api/dist/worker.js`                           | same; runs the outbox sweep and the payment reconciliation |
| Web     | nginx serving `apps/web/dist`, `/api` proxied to the API | —                                                          |

Run **one** worker (several are safe — rows are leased with `SKIP LOCKED` and schedules are keyed by name — but
one is enough). Set `RUN_WORKERS=false` on API replicas.

## Environment (production)

`NODE_ENV=production`, `STORE=postgres`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (≥ 32 random chars),
`CORS_ORIGIN` (public web origin), `TRUST_PROXY=1`, optional `FAWRY_*`. The API will not start with placeholder
secrets, the memory store, or a localhost origin. Full list: `.env.example`.

## First deployment

1. Provision PostgreSQL with the PostGIS extension, Redis with persistence (AOF).
2. Apply migrations: `pnpm --filter @techfix/db migrate:deploy` (the compose `migrate` service does this).
3. Create the first admin: set `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD`, then
   `pnpm --filter @techfix/api seed` (also seeds the service catalogue). Change the password after first login.
4. Start API, worker, web. Check `GET /api/v1/health` (process up) and `/api/v1/health/ready` (database +
   PostGIS reachable; 503 otherwise).
5. If Fawry is enabled, set its dashboard's notification URL to `https://<host>/api/v1/payments/webhook`.

## Health and what to watch

- `/api/v1/health/ready` ≠ 200 → the database is unreachable; the API keeps serving `/health` so the container is
  not killed, but traffic should stop (load balancer should use `/ready`).
- **Outbox backlog** (rows with `published_at IS NULL`): should hover near 0. A growing number means the worker is
  down or Redis/DB is failing. `SELECT count(*), min(created_at) FROM outbox_events WHERE published_at IS NULL;`
- **Stuck payments**: `SELECT id, created_at FROM payments WHERE status='PENDING' AND method='ONLINE' AND created_at < now() - interval '1 hour';`
  Run `POST /admin/payments/reconcile` as admin (the worker also does it every `PAYMENT_RECONCILE_INTERVAL_MINUTES`).
- **Payments needing a human**: audit entries `payment.amount_mismatch`, `payment.needs_refund`,
  `payment.booking_not_confirmed`, `payment.unknown_reference` (admins also get a `PAYMENT_NEEDS_REVIEW` bell).
  `SELECT * FROM audit_logs WHERE action LIKE 'payment.%' ORDER BY created_at DESC LIMIT 50;`
- Every response carries `X-Request-Id`; the same id is in the logs and in `error.requestId` — ask users for it.

## Procedures

**Fawry says paid, the app says pending.** Reconcile (above). If the answer is still `PENDING`, the order is
unpaid at Fawry; if `AMOUNT_MISMATCH`, never accept it silently: refund the difference through Fawry's portal and
record it in the finance page.

**Customer paid online but the request was cancelled.** `payment.needs_refund` is in the audit log. Refund in
Fawry's merchant portal, then record it: Finance → _تسجيل ردّ مبلغ_.

**Redis is down.** Requests keep working (publishing gives up after 1.5 s). Events stay in `outbox_events` and are
delivered by the sweep once Redis is back. Nothing to do but restore Redis.

**A bad deploy.** Roll the images back to the previous tag. Migrations are forward-only: never roll a schema back
under running code; write a new migration instead.

**Restore.** Backups are the database's job (managed PostgreSQL PITR, or `pg_dump` nightly + WAL archiving).
Test a restore before launch (checklist gate 5). Redis can be lost: only in-flight jobs are affected and the sweep
recovers them from PostgreSQL.

**Rotate the JWT secret.** Change `JWT_ACCESS_SECRET` and restart: access tokens (15 min) become invalid, refresh
tokens still work and issue new ones.

**Suspend an account / hide a review / close a dispute.** All from the admin pages; each action is audited.
