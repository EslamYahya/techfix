# TechFix

Marketplace for field tech services in Egypt (satellite, CCTV, intercom, networking).

## Layout

`apps/api` · `apps/web` · `apps/worker` (later) · `packages/{domain,contracts,db,design-tokens,config}` · `infra` · `docs/adr`

## Start

```bash
nvm use && corepack enable && pnpm install
cp .env.example .env
pnpm infra:up                      # Postgres+PostGIS, Redis, MinIO, Mailpit
pnpm --filter @techfix/db generate # needs internet (Prisma engines)
pnpm --filter @techfix/db migrate:dev   # see packages/db/README.md for the PostGIS step
pnpm dev                           # api :3000, web :5173
```

Checks: `pnpm lint typecheck test build`. Health: `GET /api/v1/health` and `/api/v1/health/ready`.

## Operations

- Production stack: `infra/docker-compose.prod.yml` (see `infra/prod.env.example`).
- Runbook: `docs/ops/runbook.md` · Launch checklist: `docs/ops/launch-checklist.md` — **gate 1 (the baseline database migration) is still open.**
- Decisions: `docs/adr/` (0001 – 0008).
