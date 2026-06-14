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

## Production Deployment at nkuku.deeztechnology.solutions

### Prerequisites
- VPS with Docker + Docker Compose installed
- ISPConfig managing the domain `nkuku.deeztechnology.solutions`
- Git cloned to `/var/www/nkuku` (or your preferred path)

### Step 1 — Environment
```bash
cp .env.example .env
nano .env   # fill in real values (DB_PASSWORD, JWT_SECRET, OWNER_PASSWORD)
```

### Step 2 — Build & Start (first time)
```bash
cd /var/www/nkuku
docker compose -f docker-compose.prod.yml up --build -d
```

### Step 3 — Verify containers
```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1:30001/health
curl -s http://127.0.0.1:30000 | head -c 100
```

### Step 4 — ISPConfig Nginx Directives
In ISPConfig:
1. Go to **Sites** → `nkuku.deeztechnology.solutions`
2. Open the **Options** tab
3. Paste the contents of `infra/ispconfig/nginx-directives.conf` into the **nginx Directives** field
4. Save and wait for ISPConfig to rewrite the vhost (or run `ispconfig_update.sh`)

### Step 5 — SSL (Let's Encrypt)
In ISPConfig:
1. Go to **Sites** → `nkuku.deeztechnology.solutions` → **SSL**
2. Enable **SSL** and **Let's Encrypt**
3. Save — ISPConfig will request and install the certificate automatically

The directives already include `X-Forwarded-Proto` so the backend correctly detects HTTPS.

### Step 6 — Mobile APK for Production
Edit `apps/mobile/lib/services/api_service.dart`:
```dart
const String _baseUrl = 'https://nkuku.deeztechnology.solutions/api';
```
Then rebuild:
```bash
cd apps/mobile
flutter build apk --release
```

### Updates (subsequent deploys)
```bash
cd /var/www/nkuku
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### Rolling Back
```bash
cd /var/www/nkuku
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up --build -d
```

### Security Notes
- Docker containers bind to `127.0.0.1` only (no direct external access)
- ISPConfig nginx is the only entrypoint from the internet
- Change `OWNER_PASSWORD` immediately after first login
- Rotate `JWT_SECRET` periodically
