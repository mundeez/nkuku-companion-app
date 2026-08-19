# Nkuku Companion — Admin Guide

## User Management

### Roles
- **Owner:** Full access to all features, can manage users and organization settings
- **Manager:** Can create/edit flocks and records, cannot delete users or manage organization settings
- **Flock Minder:** Can manage daily flock records (growth, feed, water, mortality, vaccination, medication, environmental) but cannot manage financial records, sales, or organization settings
- **Sales Person:** Can manage sale records and view flock information but cannot manage financial records, organization settings, or other operational records
- **Viewer:** Read-only access to view data, cannot create or modify

### Creating Users
1. Go to **Users** in the navigation (owner only)
2. Click **Create User**
3. Enter name, email, select role
4. The user will receive a temporary password

### Managing Users
- **Edit:** Change name, email, or role
- **Deactivate:** Temporarily disable access
- **Delete:** Permanently remove user (owner only)

## System Configuration

### Environment Variables
Key variables in `.env`:
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET` — Must be strong and rotated periodically
- `OWNER_PASSWORD` — Change immediately after first login
- `CORS_ORIGINS` — Allowed frontend domains

### Database Management

#### Re-seeding Data
```bash
docker compose exec api npx prisma db seed
```

#### Database Backup
```bash
docker compose exec postgres pg_dump -U nkuku_user nkuku_db > backup_$(date +%Y%m%d).sql
```

#### Database Restore
```bash
docker compose exec -T postgres psql -U nkuku_user nkuku_db < backup_file.sql
```

## Monitoring

### Container Health
```bash
docker compose ps
docker compose logs api --tail 100
docker compose logs web --tail 100
```

### API Health Check
```bash
curl -s http://localhost:30001/health
```

## Security Best Practices

1. **Change default passwords immediately**
2. **Rotate JWT_SECRET** every 90 days
3. **Use strong passwords** for all accounts
4. **Enable SSL** in production (Let's Encrypt)
5. **Restrict database access** to internal network only
6. **Regular backups** — daily automated backups recommended

## Updating the Application

### Minor Updates
```bash
cd /var/www/nkuku
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### Major Updates (with schema changes)
```bash
cd /var/www/nkuku
git pull
# Review migration changes
docker compose -f docker-compose.prod.yml up --build -d
# Verify database migrated successfully
```

## Double-Entry Ledger

The application includes a full double-entry bookkeeping system (GAAP-compliant) alongside the legacy financial records.

### Chart of Accounts
- 37 system accounts organized by type: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), COGS (5xxx), OpEx (6xxx)
- Manage via **Accounts** module or the web UI at `/ledger/accounts`
- Accounts support a hierarchical structure with header and detail accounts

### Journal Entries
- Manual entries are created at `/ledger/journal/new` with multi-line debit/credit support and a live balance check
- **Immutability:** Once posted, journal entries and lines cannot be edited or deleted (enforced at the PostgreSQL level via `CREATE RULE` and at the API level with 405 responses on PATCH/DELETE)
- To correct an error, post a **reversal entry** that references the original

### Financial Statements
- **Trial Balance** — `/ledger` — verifies total debits equal total credits
- **Income Statement** — `/ledger/income-statement` — GAAP profit & loss
- **Balance Sheet** — `/ledger/balance-sheet` — assets, liabilities, and equity
- **Cash Flow Statement** — `/ledger/cash-flow` — indirect method

### Period & Year-End Close
- **Period Close** — `/ledger/close` — closes a reporting period
- **Year-End Close** — automatically posts closing journal entries to zero out revenue and expense accounts into Retained Earnings
- See `apps/api/src/core/double-entry/closing.service.ts` for implementation details

### Migration from Legacy Financial Records
Existing `FinancialRecord` rows are auto-posted into the ledger via the auto-post service. To run a manual backfill:
```bash
docker compose exec api npx tsx src/db/seeds/migrate-to-double-entry.ts
```

## Document Attachments

Documents (receipts, invoices, etc.) can be attached to financial records, journal entries, sale records, and flocks.

### Storage
- Files are stored in **MinIO/S3** (bucket: `nkuku-documents`)
- Supported file types: PDF, JPG, PNG, WebP, DOC, DOCX, CSV, XLSX, XLS
- Maximum file size: 25 MB
- Maximum attachments per record: 20 (configurable via `MAX_ATTACHMENTS_PER_RECORD`)

### Security
- **Virus scanning** via ClamAV on every upload (fail-closed by default; set `REQUIRE_VIRUS_SCAN=false` for dev)
- **OCR & text extraction** runs asynchronously on upload — PDF, DOCX, images (Tesseract), and CSV are supported
- Extracted text is indexed in PostgreSQL `tsvector` for full-text search (`GET /api/v1/documents/search`)

### Key Environment Variables
```env
S3_ENDPOINT=http://pom-minio:9000
S3_BUCKET=nkuku-documents
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
REQUIRE_VIRUS_SCAN=true
MAX_ATTACHMENTS_PER_RECORD=20
```

## Bulk Operations

Several record types support bulk create and bulk delete to speed up data entry for high-volume days.

### Supported Record Types
| Record Type | Bulk Endpoint | Actions |
|-------------|---------------|---------|
| Growth records | `POST /api/v1/growth-records/bulk` | create, delete |
| Feed records | `POST /api/v1/feed-records/bulk` | create, delete |
| Water records | `POST /api/v1/water-records/bulk` | create, delete |
| Mortality events | `POST /api/v1/mortality-events/bulk` | create, delete |
| Vaccination events | `POST /api/v1/vaccination-events/bulk` | create, delete |
| Financial records | `POST /api/v1/financial-records/bulk` | create, delete |
| Alerts | `POST /api/v1/alerts/bulk` | mark_read, mark_resolved, delete |

### Access Control
- **Bulk create:** Owner and Manager roles
- **Bulk delete:** Owner only (alerts bulk delete is also owner-only)
- All bulk endpoints are protected by a dedicated `bulkRateLimit` to prevent abuse
- Maximum 500 records per bulk request

## Billing & Monetization

The application supports subscription-based billing with tiered plans.

### Subscription Tiers
| Tier | Price | Limits |
|------|-------|--------|
| **Free** | K0 | 1 active flock, 1 user, 2 cycles of history, core tracking, disease DB, basic alerts — no ledger/exports |
| **Starter** | Affordable monthly/cycle | Multiple flocks, more users, financial ledger, exports |
| **Pro** | Standard monthly/cycle | Unlimited flocks, full ledger, document attachments, advanced analytics |
| **Enterprise** | Custom quote | Unlimited users, white-label branding, dedicated onboarding, SLA, optional self-hosted deployment |

### Billing Cycles
- **Monthly** — billed each month
- **Per 3-month production cycle** — discounted (~13%, "2 months free" pattern)
- **Annual** — billed yearly

### Payment Processing
- **Primary processor:** Flutterwave (pan-African coverage, mobile money + cards)
- Payment provider abstraction in the API allows adding a second processor later
- Invoices and payment events are tracked in the database (`Invoice`, `PaymentEvent` models)

### Billing Page
- Web: `/billing` settings page for plan management and payment
- Mobile: shows plan status and deep-links to the web billing page (avoids app-store IAP fees)
- Feature-gating middleware enforces flock/user/document limits per tier, returning `402 PLAN_LIMIT_REACHED`

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
