# syntax=docker/dockerfile:1

# ── Development stage ────────────────────
FROM node:20-slim AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY apps/web/package.json ./
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

# ── Production stage ─────────────────────
FROM node:20-slim AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package and configs first for layer caching
COPY apps/web/package.json ./
COPY apps/web/next.config.js ./
COPY apps/web/tsconfig.json ./
COPY apps/web/tailwind.config.ts ./
COPY apps/web/postcss.config.js ./
RUN pnpm install

# Copy source and build
COPY apps/web/src ./src
COPY apps/web/public ./public
RUN pnpm run build

# Copy static files into standalone output so the server can serve them
RUN cp -R .next/static .next/standalone/.next/static

EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
