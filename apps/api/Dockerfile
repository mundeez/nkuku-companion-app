# syntax=docker/dockerfile:1

# ── Development stage ────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
RUN pnpm install

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3001
CMD ["pnpm", "run", "dev"]

# ── Production stage ─────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma/
RUN pnpm install --prod

RUN npx prisma generate
COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./
COPY apps/api/vitest.config.ts ./
COPY apps/api/tests ./tests
RUN pnpm run build

EXPOSE 3001
CMD ["node", "dist/main.js"]

