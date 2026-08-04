# Nkuku Companion App — Project Information

## Testing Guidelines
- **Never modify existing flocks for testing.** When testing flock-related features, always create new flocks specifically for that purpose. Existing flocks contain real user data and must not be altered during test runs.

## Verified Working Ports (Milestone 1 & 2)
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

# Database (manual — only when needed)
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed   # only on fresh DB or after schema changes

# Apply journal immutability rules (after db push)
docker exec nkuku-companion-app-postgres-1 psql -U nkuku_user -d nkuku_db -f /docker-entrypoint-initdb.d/journal-immutability.sql
# Or from host: docker compose exec api npx tsx -e "..." (see apps/api/prisma/sql/journal-immutability.sql)

# Migrate FinancialRecord → double-entry (idempotent)
docker compose exec api npx tsx src/db/seeds/migrate-to-double-entry.ts

# Regenerate Prisma client (after schema changes, before restart)
docker compose exec api npx prisma generate
docker restart nkuku-companion-app-api-1

# Rebuild with PRESERVED DATA (use this for code changes)
docker compose down && docker compose up --build -d

# FULL RESET — destroys ALL data (use with caution)
docker compose down -v && docker compose up --build -d
docker compose exec api npx prisma db seed   # re-seed after full reset
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
- Double-entry engine: `apps/api/src/core/double-entry/`
- GAAP statements: `apps/api/src/core/double-entry/gaap-statement.service.ts`
- Closing service: `apps/api/src/core/double-entry/closing.service.ts`
- Unit tests: `apps/api/tests/unit/`
- Integration tests: `apps/api/tests/integration/`
- Seeds: `apps/api/src/db/seeds/main.ts`
- Migration seed: `apps/api/src/db/seeds/migrate-to-double-entry.ts`
- Broiler API modules: `apps/api/src/modules/broiler-*/`
- Broiler web pages: `apps/web/src/app/broiler-flocks/`
- Ledger web pages: `apps/web/src/app/ledger/`
- Ledger mobile screens: `apps/mobile/lib/screens/ledger/`
- Ledger API modules: `apps/api/src/modules/accounts/`, `journal/`, `ledger/`
- Journal immutability SQL: `apps/api/prisma/sql/journal-immutability.sql`

## Milestone 1 Status (v0.1.0-alpha)
- 10 Prisma tables migrated and seeded
- 5 suppliers + all feed stages seeded (NUTRI FEED baseline)
- 14 expansion plan cycles seeded
- JWT + RBAC auth module
- CRUD APIs: suppliers, feed-stages, batches, projections, expansion-plan, overhead
- Calculation engine: 100% unit test coverage (12 tests)
- Integration tests: health + auth (2 tests)
- Docker Compose: postgres, redis, api, web, nginx

## Milestone 2 Status (v0.2.0) — Broiler Management Module

### Database (25 tables total)
**New broiler management tables (13):**
- `breeds` — Ross 308 (primary), Cobb 500
- `performance_targets` — 57 Ross 308 + 9 Cobb 500 daily targets
- `broiler_flocks` — Flock management with user relations
- `growth_records` — Weight tracking by day
- `feed_records` — Feed consumption with ZMW costs
- `water_records` — Water consumption & pH monitoring
- `mortality_events` — Death tracking with causes
- `vaccination_events` — Vaccination administration records
- `financial_records` — Cost/revenue tracking (ZMW)
- `alerts` — Auto-generated alerts system
- `diseases` — 10 diseases with organic treatments
- `vaccination_schedules` — 2 customizable schedules
- `vaccination_schedule_items` — Schedule line items

### Seed Data
- **Ross 308:** 57 official Aviagen 2022 performance targets (0-56 days)
- **Cobb 500:** 9 performance targets (0-56 days)
- **Diseases:** 10 common poultry diseases with symptoms, prevention, treatment, organic options
- **Vaccination Schedules:** Standard Botswana + Ross 308 Comprehensive

### API Modules (10 new modules, 50+ endpoints)
| Module | Endpoints | Key Features |
|--------|-----------|--------------|
| breeds | GET /, GET /:id, POST, PATCH, DELETE | Breed management with performance targets |
| broiler-flocks | GET /, GET /:id, GET /:id/dashboard, POST, PATCH, DELETE | Flock CRUD + dashboard with age, mortality, targets |
| growth-records | GET /, GET /analysis, POST, DELETE | Growth tracking with FCR calculation vs targets |
| feed-records | GET /, GET /summary, POST, DELETE | Feed management with cost per bird (ZMW) |
| water-records | GET /, GET /ratio, POST, DELETE | Water tracking with water-to-feed ratio |
| mortality-events | GET /, GET /summary, POST, DELETE | Mortality tracking with cause breakdown + count updates |
| vaccination-events | GET /, GET /schedule, POST, PATCH, DELETE | Vaccination management with schedule tracking |
| financial-records | GET /, GET /summary, POST, DELETE | Financial tracking with profit/loss (ZMW) |
| alerts | GET /, GET /:id, POST, POST /generate, PATCH | Auto-generated alerts for temp, vaccine, feed |
| diseases | GET /, GET /categories, GET /:id, POST, PATCH, DELETE | Disease database with search & organic treatments |

### Web Frontend (5 new pages)
| Page | Features |
|------|----------|
| /broiler-flocks | Flock list cards, CRUD dialogs, breed selection, mortality display |
| /broiler-flocks/[id] | Tabbed detail: Overview, Growth, Feed, Water, Mortality, Vaccination, Financial |
| /diseases | Searchable database with category filter, detail modal, organic treatments |
| /alerts | Alert list with severity, generate button, mark read/resolve |
| / (Dashboard) | Broiler stats: active flocks, total birds, mortality rate, diseases count |

### Key Decisions
- **Primary Breed:** Ross 308 (Official Aviagen 2022 data)
- **Primary Currency:** ZMW (Zambian Kwacha)
- **Feed Transition:** User-configurable (default: Day 11 for Ross 308)
- **Vaccination:** Dual schedules (Standard Botswana + Ross 308 Comprehensive)
- **Deployment Target:** Same domain as existing Nkuku app

## Double-Entry Bookkeeping (Milestones B–G, v0.9.1–v1.0.0)

### Database (3 new tables)
- `accounts` — Chart of accounts (37 system accounts, GAAP hierarchy)
- `journal_entries` — Header with entryDate, description, sourceType, reversalRef
- `journal_lines` — Lines with accountCode, debitZmw/creditZmw, flockId

### Chart of Accounts (37 system accounts)
- Assets 1xxx: 1000 (header), 1010 Cash, 1020 AR, 1030-1070 Inventory/Prepaid, 1080/1081 Equipment & Accum. Depreciation
- Liabilities 2xxx: 2000 (header), 2010 AP, 2020 Accrued, 2030 Deferred Revenue
- Equity 3xxx: 3000 (header), 3010 Owner's Capital, 3020 Retained Earnings, 3030 Current Year Earnings
- Revenue 4xxx: 4000 (header), 4010 Bird Sales, 4020 By-product, 4030 Other Income
- COGS 5xxx: 5000 (header), 5010-5050 Chick/Feed/Vaccine/Medication/Mortality Loss
- OpEx 6xxx: 6000 (header), 6010-6080 Labour/Electricity/Water/Transport/Litter/Maint/Insurance/Other

### API Modules (3 new modules)
| Module | Endpoints | Key Features |
|--------|-----------|--------------|
| accounts | GET /, GET /:code, POST, PATCH, DELETE | Chart of accounts CRUD with hierarchy |
| journal | GET /, GET /:id, POST, POST /:id/reverse, PATCH (405), DELETE (405) | Manual journal entries with 405 immutability guards |
| ledger | GET /trial-balance, GET /account/:code, GET /export/trial-balance, POST /period-close, GET /income-statement, GET /balance-sheet, GET /cash-flow, POST /year-end-close | GAAP financial statements + period close |

### Double-Entry Core Services
- `journal.engine.ts` — Balance validation, entry number sequencing, reversal posting
- `auto-post.service.ts` — Auto-creates journal entries from FinancialRecord (sales, expenses, etc.)
- `ledger.service.ts` — Trial balance, account ledger, period close
- `gaap-statement.service.ts` — Income statement, balance sheet, cash flow (indirect method)
- `closing.service.ts` — Year-end close with closing journal entries

### Migration
- `migrate-to-double-entry.ts` — Idempotent batched migration from FinancialRecord → JournalEntry + JournalLine
- Run: `docker compose exec api npx tsx src/db/seeds/migrate-to-double-entry.ts`

### Immutability (Milestone G)
- PostgreSQL CREATE RULE on `journal_entries` and `journal_lines` (no UPDATE, no DELETE)
- CHECK constraints: `one_side_only` (exactly one of debit/credit), `amounts_nonneg` (no negatives)
- SQL file: `apps/api/prisma/sql/journal-immutability.sql` — run after `prisma db push`
- API 405 guards on PATCH/DELETE `/api/v1/journal/:id`
- Deprecation headers on v0.8.0 `/api/v1/financial-engine/*` endpoints (Sunset: 2027-01-01)

### Web Frontend (10 new pages under /ledger)
- `/ledger` — Trial balance with balance indicator
- `/ledger/accounts` — Collapsible chart of accounts tree
- `/ledger/accounts/[code]` — General ledger for one account
- `/ledger/journal` — Journal entry list with filters
- `/ledger/journal/new` — Multi-line entry form with live balance check
- `/ledger/journal/[id]` — Entry detail with reverse action
- `/ledger/close` — Year-end close wizard
- `/ledger/income-statement` — GAAP income statement
- `/ledger/balance-sheet` — GAAP balance sheet
- `/ledger/cash-flow` — Cash flow statement

### Mobile (6 new Flutter screens)
- `ledger_dashboard_screen.dart` — Hub with trial balance summary
- `trial_balance_screen.dart` — Two-column debit/credit table
- `chart_of_accounts_screen.dart` — Expandable hierarchy by type
- `account_ledger_screen.dart` — General ledger with running balance
- `journal_list_screen.dart` — Paginated list with source type filter
- `journal_detail_screen.dart` — Entry detail with lines table

### Test Count
- 124 tests total (12 unit + 112 integration) — all passing

## Milestone Close-Out Protocol
At each milestone conclusion:
1. `docker compose up --build` (force rebuild)
2. Run full test suite (halt on any failure)
3. `git tag vX.Y.Z-phase-N` and push
4. Create GitHub Release with auto-generated notes

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
The API base URL is set at build time via `--dart-define=APP_API_BASE_URL=...`. No source edit is required.

**Development builds**
```bash
# Android emulator
cd apps/mobile
flutter build apk --debug --dart-define=APP_API_BASE_URL=http://10.0.2.2:30001

# iOS simulator
flutter build ios --debug --dart-define=APP_API_BASE_URL=http://localhost:30001
```

**Production build**
```bash
cd apps/mobile
flutter build apk --release --dart-define=APP_API_BASE_URL=https://nkuku.deeztechnology.solutions
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

## Document Attachments for Financial Transactions

### Overview
Documents (receipts, invoices, etc.) can be attached to any financial transaction:
- **FinancialRecord** (expenses/income)
- **JournalEntry** (manual journal entries)
- **SaleRecord** (bird sales)
- **BroilerFlock** (general flock documents — backward compatible)

### Storage Backend
- **MinIO/S3** (shared `pom-minio` container on `shared-net` network)
- Bucket: `nkuku-documents`
- Dedicated service account: `nkuku-app` (secret in `.env`, never committed)
- Files stored with key pattern: `<recordType>/<recordId>/<uuid>-<filename>`

### Security Features
- **Virus scanning**: ClamAV container (`clamav` service in docker-compose)
  - Synchronous scan on upload via `clamscan` npm package
  - Fail-closed when `REQUIRE_VIRUS_SCAN=true` (default)
  - Fail-open when `REQUIRE_VIRUS_SCAN=false` (dev convenience)
- **MIME type validation**: Only PDF, JPG, PNG, WebP, DOC, DOCX, CSV, XLSX, XLS
- **File size limit**: 25MB max
- **Attachment count limit**: Configurable via `MAX_ATTACHMENTS_PER_RECORD` (default 20)

### OCR & Full-Text Search
- **Text extraction** on upload (async): PDF (pdf-parse), DOCX (mammoth), images (tesseract.js OCR), CSV (plain text)
- **Full-text search**: PostgreSQL `tsvector` on extracted text
- Search endpoint: `GET /api/v1/documents/search?q=<query>&financialRecordId=<id>`

### API Endpoints (Documents Module)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/documents` | Upload document (multipart: file + target ID + category) |
| GET | `/api/v1/documents` | List documents (filter by flockId, financialRecordId, journalEntryId, saleRecordId) |
| GET | `/api/v1/documents/:id` | Get document metadata |
| GET | `/api/v1/documents/:id/download` | Download file (attachment) |
| GET | `/api/v1/documents/:id/view` | View file inline |
| DELETE | `/api/v1/documents/:id` | Delete document (owner/manager only) |
| PATCH | `/api/v1/documents/:id` | Update document category |
| GET | `/api/v1/documents/search` | Full-text search |

### Key File Locations
- S3 client: `apps/api/src/core/storage/s3-client.ts`
- Storage service: `apps/api/src/core/storage/storage.service.ts`
- ClamAV service: `apps/api/src/core/security/clamav.service.ts`
- Text extraction: `apps/api/src/core/documents/text-extraction.service.ts`
- Documents API: `apps/api/src/modules/documents/routes.ts`
- Backfill script: `apps/api/src/db/seeds/migrate-documents-to-s3.ts`
- Web AttachmentPanel: `apps/web/src/components/attachments/AttachmentPanel.tsx`
- Mobile AttachmentSection: `apps/mobile/lib/widgets/attachment_section.dart`

### Environment Variables
```env
# S3/MinIO
S3_ENDPOINT=http://pom-minio:9000
S3_ACCESS_KEY=<set-in-env>
S3_SECRET_KEY=<set-in-env>
S3_BUCKET=nkuku-documents
S3_REGION=us-east-1

# ClamAV
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
REQUIRE_VIRUS_SCAN=true

# Attachment limits
MAX_ATTACHMENTS_PER_RECORD=20
```

### Backfill Existing Documents
```bash
docker compose exec api npx tsx src/db/seeds/migrate-documents-to-s3.ts
```

### Settle AP/Accrued Balances (balance sheet fix)
If the balance sheet equation (Assets = Liabilities + Equity) is out of balance due to
the original auto-post mapping crediting AP instead of Cash, run:
```bash
docker compose exec api npx tsx src/db/seeds/settle-ap-to-cash.ts
```
This creates balancing entries to settle outstanding AP/Accrued to Owner's Capital.

### Test Count (with document attachments)
- 48 unit tests (6 files) — all passing
- 115 integration tests (9 files) — all passing
- Total: 163 tests — all passing
- TypeScript: 0 errors (tsc --noEmit passes clean)
- New tests: storage.service (5), text-extraction.service (6), clamav.service (5), documents-financial-transactions (18)
