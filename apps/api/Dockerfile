# syntax=docker/dockerfile:1

# ── Base stage (shared deps + Prisma) ──────
# Uses a monorepo workspace layout so pnpm.overrides from the root
# package.json apply (needed for security dep overrides like uuid).
FROM node:20-slim AS base
WORKDIR /workspace
RUN apt-get update -y && apt-get install -y openssl && corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy root package.json (contains pnpm.overrides) and workspace config
COPY package.json ./package.json
RUN echo "packages: ['apps/api']" > pnpm-workspace.yaml

# Copy API package.json and prisma schema
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma/

# Install with overrides applied (root pnpm.overrides takes effect)
RUN pnpm install --filter api
WORKDIR /workspace/apps/api
RUN npx prisma generate

# ── Production stage ─────────────────────
# Reinstall with --prod to prune dev dependencies (vitest, eslint, etc.)
FROM base AS production
WORKDIR /workspace
RUN pnpm install --filter api --prod
WORKDIR /workspace/apps/api
RUN npx prisma generate

COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx tsx src/main.ts"]

# ── Development stage ────────────────────
FROM base AS development
WORKDIR /workspace/apps/api

COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
COPY apps/api/vitest.config.ts ./
COPY apps/api/eslint.config.js ./
COPY apps/api/tests ./tests

EXPOSE 3001
CMD ["pnpm", "run", "dev"]
