FROM node:20-slim AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY apps/web/package.json ./
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "run", "dev"]

FROM node:20-slim AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
COPY apps/web/package.json ./
RUN pnpm install --prod
COPY apps/web/src ./src
COPY apps/web/public ./public
RUN pnpm run build
EXPOSE 3000
CMD ["node", "server.js"]

