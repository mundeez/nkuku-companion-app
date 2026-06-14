# syntax=docker/dockerfile:1

# ── Base stage (shared deps + Prisma) ──────
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
RUN pnpm install
RUN npx prisma generate

# ── Production stage ─────────────────────
FROM base AS production

# Copy full source (tsx runs TypeScript directly)
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
COPY apps/api/vitest.config.ts ./
COPY apps/api/tests ./tests

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx tsx src/main.ts"]

# ── Development stage ────────────────────
FROM base AS development

COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
COPY apps/api/vitest.config.ts ./
COPY apps/api/tests ./tests

EXPOSE 3001
CMD ["pnpm", "run", "dev"]
