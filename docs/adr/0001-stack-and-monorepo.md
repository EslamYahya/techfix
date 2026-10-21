# ADR 0001 — Stack and monorepo layout

Status: accepted

## Decision

- pnpm workspaces + Turborepo. Apps: `api` (NestJS modular monolith), `worker` (BullMQ, Phase 5), `web` (React + Vite PWA).
- Packages: `domain` (pure rules, no I/O), `contracts` (OpenAPI → types), `db` (Prisma 7 + PostGIS), `design-tokens`, `config`.
- PostgreSQL + PostGIS, Redis + BullMQ, S3-compatible storage.

## Why

One repo keeps the state machine, the API contract and the UI labels in lockstep; contract tests fail the build when they drift.

## Deviation from the plan

Prisma lives in `packages/db`, not a root `prisma/` folder, so the generated client is a normal workspace dependency.
Prisma 7 requires a driver adapter and `prisma.config.ts`; PostGIS columns and constraints live in a hand-written migration (`packages/db/prisma/notes/postgis.sql`).

## Consequences

The domain package must stay free of framework imports. The API health check uses `pg` directly until Phase 1 adds the Prisma service.
