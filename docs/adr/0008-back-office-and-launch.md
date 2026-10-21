# ADR 0008 — Back office and launch readiness

Status: accepted · Phase 6

## Back office (admin)

1. **Read everything, act on little.** Admin endpoints: requests (list, cancel), payments (list + totals, record
   a refund), disputes (queue, resolve), reviews (list, hide/show). Every action needs its own permission
   (`requests.manage`, `payments.refund`, `disputes.manage`, `reviews.moderate`), is audited, and notifies the
   people it concerns. Admin still cannot act _as_ a customer or engineer (Release v1).
2. **Refund = a record, not a money movement.** `POST /payments/:id/refund` stores the refund, moves the
   payment to `PARTIALLY_REFUNDED` / `REFUNDED` and keeps `paid − refunded` honest in every total. The money is
   handed back outside the platform (cash, or Fawry's merchant portal). Calling Fawry's refund API from here was
   **not** done: it cannot be verified from the build sandbox, and the refund policy (who pays, when, how much)
   is an open business decision. A refund never exceeds what is left (checked in the domain and again atomically
   in the repository).
3. **Disputes have three outcomes** and none moves money by itself:
   `CONFIRM_COMPLETION` (admin confirms the job for the customer → `COMPLETED`; the only place an admin triggers
   a customer edge), `CLOSE` (decision recorded, request unchanged), `REJECT` (complaint unfounded). The written
   resolution is mandatory and shown to nobody but admins; both parties get a `DISPUTE_RESOLVED` notification.
4. **Cancelling from the back office** is allowed from every state a customer may cancel from, and — for admins
   only — while the engineer is on the way, has arrived or is working. Not after completion. A reason is
   required. An online payment already taken is flagged by the existing `payment.needs_refund` audit entry and a
   `PAYMENT_NEEDS_REVIEW` notification to admins.
5. **Hiding a review** recomputes the engineer's average and count from the visible reviews in the same
   transaction; showing it again restores them.
6. **Commission is not computed anywhere** — the percentage is still undecided. Totals are gross-of-commission,
   net-of-refunds.

## Launch readiness

- **Production refuses unsafe configuration** (`config/env.ts`): memory store, placeholder JWT secret, localhost
  CORS origin or placeholder admin password stop the process at boot (tested).
- **`TRUST_PROXY`**: behind nginx the API reads the real client address, so audit entries and the login rate
  limit are per client, not per proxy.
- **Images**: `infra/docker/api.Dockerfile` (API and worker are the same image), `web.Dockerfile` (static build
  behind nginx, which proxies `/api`). `infra/docker-compose.prod.yml` wires PostgreSQL+PostGIS, Redis (AOF on),
  a one-shot `migrate`, `api` (workers off), a single `worker`, and `web`.
- **CI** now also runs the BullMQ tests against a real Redis, builds both images, and — as soon as a baseline
  migration is committed — runs the API tests against PostgreSQL+PostGIS.

## Not done / not verified (be explicit)

- **There is no baseline SQL migration yet.** Prisma cannot download its engine in the build sandbox, so
  `prisma migrate dev --create-only` could not run, and hand-writing 40 tables of SQL would be worse than
  generating them. Until it is committed, `migrate deploy` applies nothing and the API cannot work on a real
  database. This is gate 1 in `docs/ops/launch-checklist.md`.
- **The Docker images and compose file were not built or run** (no Docker daemon in the sandbox).
- **All Prisma adapters** (including the admin queries added here) are typechecked only against nothing — the
  generated client could not be produced — and have not run on PostgreSQL.
- **Fawry**: signature fields, endpoints and the status vocabulary come from Fawry's public documentation and
  are exercised only against a fake. A sandbox run with real merchant credentials is a launch gate.
- No SMS/OTP, no object storage wiring for attachments/documents in production, no monitoring stack, no backups
  automation (documented as procedures in the runbook).
