# ADR 0007 — Notifications, outbox and background jobs

Status: accepted · Phase 5

## Decisions

1. **In-app notifications only for now.** A notification is a row (`notifications`) with a machine `type`,
   a deep link (`data.requestId`, `data.jobId`) and Arabic fallback `title/body`. The web app shows its own
   wording from `NOTIF_TYPE` (unknown types fall back to the server text). Push (FCM) is **not** sent yet:
   device tokens are stored (`POST /notifications/devices`) so the channel can be added without a migration.
   SMS/WhatsApp are out of scope.
2. **One list of event types** (`NOTIFICATION_TYPES` in `@techfix/domain`). The API rules (`texts.ts`) and the
   web wording are both tested against it, so a new event without Arabic text fails a test.
3. **Who is told**: `NOTIFICATION_RULES` maps each type to CUSTOMER / ENGINEER / BOTH / ADMIN. The person who
   did the action is never notified about it. The engineer is resolved from the event (`engineerId`) because
   the request has already forgotten him after a rejection, change or cancel.
4. **Outbox, not fire-and-forget.** Services call `DomainEvents.publish()` after a successful action. It
   (a) stores an `outbox_events` row, then (b) queues a delivery job. If either fails it is logged and the
   person's action still succeeds. A periodic **sweep** leases every due, undelivered row
   (`FOR UPDATE SKIP LOCKED` on PostgreSQL, so several workers never take the same row) and delivers it, with
   exponential backoff on failure (20 s … 1 h). Delivery is idempotent: `createOnce` skips a (user, eventId)
   pair it has already written, so a retry or a crash between "write" and "mark published" cannot double-notify.
   Delivery is at-least-once, effects are exactly-once.
   Known limit: the event is stored _after_ the business transaction commits (not inside it). A crash in that
   tiny gap loses the notification (never the business change). Moving the insert into each repository
   transaction is the next step if that ever matters.
5. **Queue = a port** (`JobQueue`): `InlineQueue` (no Redis: runs the handler immediately, used in tests and
   local dev) and `BullMqQueue` (Redis; used when `REDIS_URL` is set and `NODE_ENV` is not `test`).
   Publishing is bounded to 1.5 s, so a dead Redis never hangs a request — the sweep delivers later.
6. **Jobs** (`JOBS`): `outbox.dispatch` (one row), `outbox.sweep` (every `OUTBOX_SWEEP_INTERVAL_SECONDS`),
   `payments.reconcile` (every `PAYMENT_RECONCILE_INTERVAL_MINUTES`, only when Fawry is configured). The
   reconcile job calls the same `PaymentsService.reconcilePending()` as the admin endpoint, which ends in the
   same `applyProviderEvent` as a webhook.
7. **Where workers run**: `RUN_WORKERS` (default true outside tests). One process, or `pnpm worker` for a
   background-only process; set `RUN_WORKERS=false` on API-only replicas. BullMQ job schedulers are keyed by
   job name, so several workers never duplicate a schedule.

## Verified / not verified

- Verified: memory adapters (180 API tests), BullMQ against a real Redis 7 (add, worker, repeatable job,
  Redis-down behaviour; `REDIS_URL=… pnpm --filter @techfix/api test`), API and worker processes start with
  `workers started (bullmq)`.
- **Not verified**: the Prisma adapters (`notifications`, `outbox`, including the raw `SKIP LOCKED` lease and
  the JSON-path `eventId` lookup) — the Prisma client cannot be generated in the build sandbox and there is
  no PostgreSQL there. Run `TEST_DATABASE_URL=… pnpm --filter @techfix/api test:db` once on a real database.

## Open decisions (not invented here)

- Request/quote timeouts and automatic expiry jobs (no durations decided yet, so no job exists).
- Notification retention (old rows are kept forever for now).
- Quiet hours, per-user notification settings, push provider.
