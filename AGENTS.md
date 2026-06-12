# Nkuku Companion App — Project Information

## Build & Test Commands

```bash
# Start all services (dev)
docker compose up --build

# Backend tests
docker compose exec api pnpm run test:unit
docker compose exec api pnpm run test:integration

# Database
docker compose exec api npx prisma migrate dev
docker compose exec api npx prisma db seed
docker compose exec api npx prisma studio

# Stop and clean
docker compose down -v
```

## Architecture
- Backend: Node.js 20 + Fastify + TypeScript + Prisma + PostgreSQL 15 + Redis 7
- Web: Next.js 14 + Tailwind CSS + shadcn/ui (Milestone 2)
- Mobile: Flutter 3.x + Dart (Milestone 3)
- Auth: JWT + RBAC (owner / manager / viewer)
- Proxy: Nginx (dev) / Nginx + Certbot (prod)

## Ports
- API: http://localhost:3001
- Web: http://localhost:3000
- Adminer: http://localhost:8080
- Nginx: http://localhost:80

## Key File Locations
- API source: `apps/api/src/`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Calculation engine: `apps/api/src/core/calculation-engine/`
- Unit tests: `apps/api/tests/unit/`
- Integration tests: `apps/api/tests/integration/`
- Seeds: `apps/api/src/db/seeds/main.ts`

## Git & Release Protocol
At each milestone close-out:
1. `docker compose up --build` (force rebuild)
2. Run full test suite (halt on any failure)
3. `git tag vX.Y.Z-alpha` and push
4. `gh release create vX.Y.Z-alpha --generate-notes`

