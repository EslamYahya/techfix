# @techfix/db

Prisma 7 schema + client factory.

## First-time setup (needs internet access to Prisma's engine CDN)

```bash
pnpm infra:up                         # postgis + redis + minio + mailpit
cp .env.example .env                  # at repo root
pnpm --filter @techfix/db generate    # writes src/generated
pnpm --filter @techfix/db exec prisma migrate dev --name init --create-only
# append the contents of prisma/notes/postgis.sql to the generated migration.sql (after the CREATE TABLE statements)
pnpm --filter @techfix/db exec prisma migrate dev
```

`pnpm --filter @techfix/db validate:offline` checks the schema grammar without downloading engines.

## Rules

- Never write `service_requests.status` directly — always go through `transition()` from `@techfix/domain`.
- Raw SQL only for PostGIS, only inside `matching.repository`, always parameterised.
