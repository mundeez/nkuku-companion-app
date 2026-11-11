# Nkuku Companion App

Broiler chicken production management application for the Zambian market.

## Features

### Core Production Planning
- Supplier management with feed stage pricing
- Production cycle planning with expansion schedules
- Financial projections with cost breakdowns
- Batch tracking and revenue forecasting

### Broiler Management Module (v0.2.0)
- **Flock Management:** Create and manage broiler flocks with breed selection
- **Growth Tracking:** Record weight samples and compare against Ross 308 performance targets
- **Feed Management:** Track feed consumption by type (starter/grower/finisher) in ZMW
- **Water Management:** Monitor water consumption with pH and temperature readings
- **Mortality Tracking:** Record deaths with causes and auto-calculate mortality rates
- **Vaccination Scheduler:** Track administered vaccines and upcoming schedule
- **Financial Dashboard:** Record costs and revenue with profit/loss calculations in ZMW
- **Alert System:** Auto-generated alerts for temperature adjustments, vaccinations, feed transitions
- **Disease Database:** Searchable database of 10 common poultry diseases with organic treatment options

### Key Decisions
- **Primary Breed:** Ross 308 (Official Aviagen 2022 data)
- **Primary Currency:** ZMW (Zambian Kwacha)
- **Feed Transition:** User-configurable (default: Day 11 for Ross 308)
- **Vaccination:** Dual schedules (Standard Botswana + Ross 308 Comprehensive)
- **Deployment Target:** nkuku.deeztechnology.solutions

## Technology Stack

### Backend
- Node.js 20 + Fastify + TypeScript
- Prisma ORM + PostgreSQL 15
- Redis 7 (caching/sessions)
- JWT + RBAC (owner / manager / viewer)

### Frontend
- Next.js 14 + React 18
- Tailwind CSS + shadcn/ui components
- Lucide icons

### Infrastructure
- Docker + Docker Compose
- Nginx reverse proxy
- ISPConfig for domain management
- Let's Encrypt SSL

## Quick Start

### Development

```bash
# Clone the repository
git clone <repo-url>
cd nkuku-companion-app

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Start all services
docker compose up --build -d

# Verify
open http://localhost:30000
```

### Default Login
- Email: `owner@nkuku.local`
- Password: `change_me` (change immediately)

### Run Tests

```bash
# API tests
docker compose exec api pnpm run test

# Individual test suites
docker compose exec api pnpm run test:unit
docker compose exec api pnpm run test:integration
```

## API Documentation

### Authentication
All endpoints require a Bearer token except `/api/v1/auth/login`.

```bash
# Login
POST /api/v1/auth/login
Body: { "email": "owner@nkuku.local", "password": "change_me" }

# Response
{ "accessToken": "...", "refreshToken": "...", "user": { ... } }
```

### Broiler Management Endpoints

#### Breeds
```
GET    /api/v1/breeds
GET    /api/v1/breeds/:id
POST   /api/v1/breeds
PATCH  /api/v1/breeds/:id
DELETE /api/v1/breeds/:id
```

#### Flocks
```
GET    /api/v1/broiler-flocks?status=active&breedId=...
GET    /api/v1/broiler-flocks/:id
GET    /api/v1/broiler-flocks/:id/dashboard
POST   /api/v1/broiler-flocks
PATCH  /api/v1/broiler-flocks/:id
DELETE /api/v1/broiler-flocks/:id
```

#### Growth Records
```
GET    /api/v1/growth-records?flockId=...
GET    /api/v1/growth-records/analysis?flockId=...
POST   /api/v1/growth-records?flockId=...
DELETE /api/v1/growth-records/:id
```

#### Feed Records
```
GET    /api/v1/feed-records?flockId=...
GET    /api/v1/feed-records/summary?flockId=...
POST   /api/v1/feed-records?flockId=...
DELETE /api/v1/feed-records/:id
```

#### Water Records
```
GET    /api/v1/water-records?flockId=...
GET    /api/v1/water-records/ratio?flockId=...
POST   /api/v1/water-records?flockId=...
DELETE /api/v1/water-records/:id
```

#### Mortality Events
```
GET    /api/v1/mortality-events?flockId=...
GET    /api/v1/mortality-events/summary?flockId=...
POST   /api/v1/mortality-events?flockId=...
DELETE /api/v1/mortality-events/:id
```

#### Vaccination Events
```
GET    /api/v1/vaccination-events?flockId=...
GET    /api/v1/vaccination-events/schedule?flockId=...
POST   /api/v1/vaccination-events?flockId=...
PATCH  /api/v1/vaccination-events/:id
DELETE /api/v1/vaccination-events/:id
```

#### Financial Records
```
GET    /api/v1/financial-records?flockId=...
GET    /api/v1/financial-records/summary?flockId=...
POST   /api/v1/financial-records?flockId=...
DELETE /api/v1/financial-records/:id
```

#### Alerts
```
GET    /api/v1/alerts?status=open|resolved
GET    /api/v1/alerts/:id
POST   /api/v1/alerts
POST   /api/v1/alerts/generate
PATCH  /api/v1/alerts/:id
```

#### Diseases
```
GET    /api/v1/diseases?category=...&search=...
GET    /api/v1/diseases/categories
GET    /api/v1/diseases/:id
POST   /api/v1/diseases
PATCH  /api/v1/diseases/:id
DELETE /api/v1/diseases/:id
```

## Database Schema

### Broiler Management Tables
- **breeds** — Breed information (Ross 308, Cobb 500)
- **performance_targets** — Daily weight, feed, FCR targets by breed
- **broiler_flocks** — Flock records with user ownership
- **growth_records** — Weight measurements with sample sizes
- **feed_records** — Feed consumption by type with ZMW costs
- **water_records** — Water usage with quality metrics
- **mortality_events** — Death records with causes
- **vaccination_events** — Administered vaccines
- **financial_records** — Costs and revenue in ZMW
- **alerts** — System-generated notifications
- **diseases** — Disease reference data
- **vaccination_schedules** — Schedule templates
- **vaccination_schedule_items** — Individual schedule entries

### Seed Data
```bash
# Re-seed the database
docker compose exec api npx prisma db seed
```

## Production Deployment

See [AGENTS.md](AGENTS.md) for detailed production deployment instructions.

Quick deploy:
```bash
cd /var/www/nkuku
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | JWT signing secret | Required |
| `OWNER_PASSWORD` | Initial owner password | `change_me` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:3001` |

## License

[Your License Here]
