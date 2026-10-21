# API + worker image (same code, different command). Build context: repository root.
#   docker build -f infra/docker/api.Dockerfile -t techfix-api .
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Prisma's engines need OpenSSL; the build needs internet access to Prisma's CDN (once).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* && corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# `prisma generate` needs a URL syntactically, not a live database.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @techfix/db generate
RUN pnpm turbo run build --filter=@techfix/api...

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* && corepack enable
ENV NODE_ENV=production
# The whole built workspace (keeps pnpm links intact and lets the one-shot migrate/seed jobs use the Prisma CLI).
COPY --from=build /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/v1/health || exit 1
# API:    node apps/api/dist/main.js
# Worker: node apps/api/dist/worker.js   (compose overrides the command; the HEALTHCHECK is disabled there)
CMD ["node", "apps/api/dist/main.js"]
