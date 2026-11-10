# syntax=docker/dockerfile:1

# ── Development stage ────────────────────
FROM node:20-slim AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY apps/admin-web/package.json ./
RUN pnpm install
EXPOSE 3003
CMD ["pnpm", "run", "dev"]

# ── Production stage ─────────────────────
FROM node:20-slim AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package and configs first for layer caching
COPY apps/admin-web/package.json ./
COPY apps/admin-web/next.config.js ./
COPY apps/admin-web/tsconfig.json ./
COPY apps/admin-web/tailwind.config.ts ./
COPY apps/admin-web/postcss.config.js ./
RUN pnpm install

# Copy source
COPY apps/admin-web/src ./src

# NEXT_PUBLIC_* vars are inlined at build time. ARG must be declared
# before `pnpm run build` for the flag to take effect.
ARG NEXT_PUBLIC_API_URL=https://nkuku.zeendeefood.solutions
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_TENANT_APP_URL=https://nkuku.zeendeefood.solutions
ENV NEXT_PUBLIC_TENANT_APP_URL=${NEXT_PUBLIC_TENANT_APP_URL}

RUN pnpm run build

# Copy static files into standalone output so the server can serve them
RUN cp -R .next/static .next/standalone/.next/static

EXPOSE 3003
CMD ["node", ".next/standalone/server.js"]
