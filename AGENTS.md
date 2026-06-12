# Nkuku Companion App — Project Information

## Verified Working Ports (Milestone 1)
- API: http://localhost:30001
- Web: http://localhost:30000
- Nginx: http://localhost:30080

## Build & Test Commands

```bash
# Start all services (dev)
docker compose up --build -d

# View API logs
docker logs nkuku-companion-app-api-1 -f

# Backend tests
docker compose exec api pnpm run test:unit
docker compose exec api pnpm run test:integration
docker compose exec api pnpm run test

# Database
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed

# Stop and clean
docker compose down -v
```

## Architecture
- Backend: Node.js 20 + Fastify + TypeScript + Prisma + PostgreSQL 15 + Redis 7
- Web: Next.js 14 + Tailwind CSS + shadcn/ui (Milestone 2)
- Mobile: Flutter 3.x + Dart (Milestone 3)
- Auth: JWT + RBAC (owner / manager / viewer)
- Proxy: Nginx (dev) / Nginx + Certbot (prod)

## Key File Locations
- API source: `apps/api/src/`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Calculation engine: `apps/api/src/core/calculation-engine/`
- Unit tests: `apps/api/tests/unit/`
- Integration tests: `apps/api/tests/integration/`
- Seeds: `apps/api/src/db/seeds/main.ts`

## Milestone 1 Status (v0.1.0-alpha)
- 10 Prisma tables migrated and seeded
- 5 suppliers + all feed stages seeded (NUTRI FEED baseline)
- 14 expansion plan cycles seeded
- JWT + RBAC auth module
- CRUD APIs: suppliers, feed-stages, batches, projections, expansion-plan, overhead
- Calculation engine: 100% unit test coverage (12 tests)
- Integration tests: health + auth (2 tests)
- Docker Compose: postgres, redis, api, web, nginx

## Milestone Close-Out Protocol
At each milestone conclusion:
1. `docker compose up --build` (force rebuild)
2. Run full test suite (halt on any failure)
3. `git tag vX.Y.Z` and push
4. Create GitHub Release with auto-generated notes

## Next Steps
- Add GitHub remote: `git remote add origin <repo-url>`
- Push tags: `git push origin main --tags`
- Create GitHub Release: `gh release create v0.1.0-alpha --generate-notes`
