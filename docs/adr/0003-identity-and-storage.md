# ADR 0003 — Identity, permissions and storage adapters

Status: accepted

- Passwords: scrypt (node:crypto, no native build). Access token: short-lived JWT (jose, HS256). Refresh token: opaque, stored as a hash, rotated on every use; reuse of a revoked token revokes the whole family.
- Every route requires a login unless marked public. Authorization = permission + ownership + state through `authorize()` from `@techfix/domain`; a non-owner gets 404.
- Engineers register as PENDING and OFFLINE; they appear to customers only after admin verification. Admin actions are audited.
- Data access goes through repository interfaces. `STORE=postgres` (default) uses Prisma; `STORE=memory` serves tests and local demos. The Prisma adapter is loaded lazily.
- Seed: `pnpm --filter @techfix/api seed` creates the launch catalog and, when `SEED_ADMIN_*` are set, the first admin.

Deviation: scrypt instead of argon2id/bcrypt (docs/07) to avoid native dependencies; revisit if a security review asks for argon2.
Not verified in the build sandbox: the Prisma adapter against a live database (needs `generate` + `migrate`, then `pnpm --filter @techfix/api test:db`).
