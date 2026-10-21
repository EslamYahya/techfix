# Launch checklist

A gate is passed only when someone has actually done it and written down the date. Gates 1–6 block launch.

## Gate 1 — The database exists

- [ ] On a machine with internet: `pnpm --filter @techfix/db generate`, then
      `pnpm --filter @techfix/db exec prisma migrate dev --name init --create-only`.
- [ ] Append `packages/db/prisma/notes/postgis.sql` to that migration (after the CREATE TABLE statements).
- [ ] `migrate dev` on an empty database succeeds; commit `packages/db/prisma/migrations/`.
- [ ] `pnpm --filter @techfix/api test:db` (all API tests against PostgreSQL+PostGIS) is green. This is the first
      time the Prisma adapters run — expect to fix a few things.
- [ ] CI job `db-tests` runs (it activates itself once the migration is committed).

## Gate 2 — The images run

- [ ] `docker compose -f infra/docker-compose.prod.yml --env-file infra/prod.env up --build` starts everything.
- [ ] `/api/v1/health/ready` is 200 through nginx; log in as the seeded admin; create a request end to end.
- [ ] A login rate-limit test from two different client IPs is counted separately (`TRUST_PROXY=1` works).

## Gate 3 — Money

- [ ] Fawry **sandbox** credentials in `prod.env`; the webhook URL set in Fawry's portal and reachable.
- [ ] One full online payment: create → pay at the sandbox → callback arrives → booking confirmed.
- [ ] One lost callback: pay, block the webhook, run reconcile → booking confirmed.
- [ ] Check the signature fields against Fawry's current documentation (`fawry.provider.ts`) — they were written from
      the public docs and tested against a fake only.
- [ ] Decide and write down: commission %, refund policy, what happens to an online payment on cancellation.
- [ ] Fawry **production** credentials only after the above, set by whoever owns the merchant account.

## Gate 4 — People and policy (decisions only the owners can make)

- [ ] Timeouts: engineer reply, quote validity, unpaid-booking expiry (no expiry jobs exist until these are set).
- [ ] Cancellation fees after confirmation; no-show rules; dispute SLA.
- [ ] Engineer verification: which documents, who reviews, how fast.
- [ ] Terms of use and privacy policy pages (not built); phone-number verification (OTP) yes/no for launch.

## Gate 5 — Operations

- [ ] Automated PostgreSQL backups **and a test restore**.
- [ ] Redis persistence on; alert if the outbox backlog stays above 0 for 10 minutes.
- [ ] Error and uptime monitoring on `/api/v1/health/ready`; log shipping (pino JSON on stdout).
- [ ] TLS in front of nginx; HSTS; the public origin set in `CORS_ORIGIN`.
- [ ] Object storage (S3/MinIO) bucket + credentials for attachments and engineer documents.
- [ ] Someone other than the author has read `docs/ops/runbook.md` and run one procedure from it.

## Gate 6 — Security pass

- [ ] Secrets only in the secret store; none in git (`git log -p | grep -i secret`).
- [ ] Admin password changed; admin accounts limited to people who need them.
- [ ] Dependency audit (`pnpm audit`) reviewed; Dependabot/Renovate on.
- [ ] A manual walk through: customer cannot read another customer's request (404), engineer cannot see the
      address before the booking is confirmed, webhook with a wrong signature is refused.

## After launch

- First week: check the outbox backlog, pending online payments and the `payment.*` audit entries daily.
- Watch the `PAYMENT_NEEDS_REVIEW` bell and the disputes queue; they are the early-warning signals.
