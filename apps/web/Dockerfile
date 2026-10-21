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

# NEXT_PUBLIC_* vars are inlined at build time. ARG must be declared
# before `pnpm run build` for the flag to take effect.
ARG NEXT_PUBLIC_MARKETING_ENABLED=true
ENV NEXT_PUBLIC_MARKETING_ENABLED=${NEXT_PUBLIC_MARKETING_ENABLED}
# Umami analytics — baked into the build when provided (empty = off)
ARG NEXT_PUBLIC_UMAMI_SRC=
ENV NEXT_PUBLIC_UMAMI_SRC=${NEXT_PUBLIC_UMAMI_SRC}
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=${NEXT_PUBLIC_UMAMI_WEBSITE_ID}

# Copy reference docs into public so they can be viewed in the app
COPY docs ./public/docs
RUN pnpm run build

# Copy static files into standalone output so the server can serve them
RUN cp -R .next/static .next/standalone/.next/static
RUN cp -R public/. .next/standalone/public/

EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
