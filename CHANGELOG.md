# Changelog

## v1.6.0-alpha — 2026-08-04

### Added
- **Document Attachments for Financial Transactions.** Receipts, invoices, and
  other supporting documents can now be attached to `FinancialRecord`,
  `JournalEntry`, and `SaleRecord` (backward-compatible `BroilerFlock`
  documents remain supported).
  - MinIO/S3 storage backend using the shared `pom-minio` container, a
    dedicated `nkuku-app` service account, and the `nkuku-documents` bucket.
  - Generalized documents API module with generic ownership, MinIO
    upload/download, attachment count limits, full-text search, and virus
    scanning.
  - `FinancialRecord`, `JournalEntry`, and `SaleRecord` `GET /:id` endpoints
    now include associated documents.
  - ClamAV virus scanning container plus `clamav.service`, fail-closed by
    default.
  - OCR and text extraction on upload for PDF, DOCX, images (tesseract.js),
    and CSV; extracted text is indexed in a PostgreSQL `tsvector` column for
    fast full-text search.
  - Web `AttachmentPanel` component embedded in the financial records page,
    journal detail page, and sales page.
  - Mobile `AttachmentSection` widget and generalized `DocumentForm` embedded
    in the journal detail and financial record forms.
  - Backfill script `apps/api/src/db/seeds/migrate-documents-to-s3.ts` for
    migrating existing local documents into S3.
  - 47 unit tests (6 files) and 18 new integration tests for documents on
    financial transactions.

### Security
- Ownership filtering on global document search.
- Role check on journal document access.
- Path-traversal protection on legacy file endpoints.
- MinIO secret removed from `AGENTS.md`; the `infra/minio/setup-nkuku-account.sh`
  setup script now requires `NKUKU_SECRET_KEY` to be supplied via environment
  (no default secret in version control).
- `.env` is gitignored — real `S3_SECRET_KEY`, `JWT_SECRET`, and database
  credentials must stay in `.env` and never be committed.

### Migration Notes
- Apply Prisma schema changes with `docker compose exec api npx prisma migrate deploy`.
- Enable the full-text search column/index by running:
  `docker compose exec api psql "$DATABASE_URL" -f /app/prisma/sql/documents-search.sql`
- Backfill legacy documents with:
  `docker compose exec api npx tsx src/db/seeds/migrate-documents-to-s3.ts`

### Test Summary
- 47 unit tests pass.
- 115 integration tests; 1 pre-existing `gaap balance sheet` failure remains
  (not introduced by this phase).

### Notes
- API package version advanced from `0.1.0-alpha` to `0.2.0-alpha` to mark
  the new documents backend.

## v1.5.4-alpha — 2026-08-03

### Added
- **Harvest Date & Days to Harvest on mobile app.** Mirrors the web
  app changes on the Flutter mobile app:
  - Flock list cards now show a harvest date row with calendar icon,
    formatted date, and color-coded days-remaining label.
  - Flock detail overview tab shows Harvest Date and Days to Harvest
    lines (with color coding) between Age and Status.
  - BroilerFlock model gained `harvestDate`, `daysToHarvest`, and
    `harvestDateStr` computed getters.

## v1.5.3-alpha — 2026-08-03

### Changed
- **Removed prominent harvest stat cards from flock detail page.** Per
  user request, the two large harvest cards at the top of the flock
  detail page have been removed. Harvest info remains in the header
  subtitle and in the Flock Summary card in the Overview tab.

## v1.5.2-alpha — 2026-08-03

### Changed
- **Harvest fields now prominent at top of flock detail page.** The
  Harvest Date and Days to Harvest cards were previously buried in the
  Flock Summary card below the fold. Added two prominent stat cards at
  the top of the page (before Birds/Mortality/Revenue), styled with
  primary-colored borders and CalendarDays icons.
- **Switched web container to production build.** The dev server's JS
  chunks are not content-hashed, so ISPConfig nginx's `expires 365d`
  caching on `/_next/static` caused browsers to load stale JS after
  redeploys. Production build uses content-hashed filenames that bust
  cache correctly.

## v1.5.1-alpha — 2026-08-03

### Fixed
- **NetworkError on production site.** The `.env` file had
  `NEXT_PUBLIC_API_URL=http://localhost:30001`, which got embedded in
  client-side JS. When users visited the production site, their browsers
  tried to fetch API data from `http://localhost:30001` on their own
  machines — causing NetworkError and mixed-content blocking (HTTPS page
  requesting HTTP resource). Fixed by setting `NEXT_PUBLIC_API_URL` to
  empty so the browser uses same-origin relative URLs (`/api/v1/...`),
  which ISPConfig nginx proxies to the backend.

## v1.5.0-alpha — 2026-08-03

### Added
- **Harvest Date & Days to Harvest on broiler flock cards.** Each flock
  card on /broiler-flocks now shows two new fields:
  - Harvest Date: the date when the flock reaches targetAge (default 42
    days) of age, computed as startDate + targetAge.
  - Days to Harvest: remaining days until harvest (targetAge - ageDays).
  Both show "Pending collection" when chicks aren't collected yet. Days
  to Harvest is color-coded: red when due/overdue, orange within 7 days.
- **Harvest info on flock detail page.** The header subtitle now includes
  the harvest date and days remaining. The Flock Summary card in the
  Overview tab also shows both fields.

## v1.4.7-alpha — 2026-08-03

### Changed
- **Cost Breakdown chart — clean design, slightly bigger.** Reverted the
  label nudging hack from v1.4.6. Back to the clean two-line label design
  (two <text> elements, no x offset manipulation). Increased chart height
  from 300→340px for a bigger pie while keeping outerRadius at 80 — the
  value that fits all labels within the 304px SVG width without hacks.

## v1.4.6-alpha — 2026-08-03

### Changed
- **Cost Breakdown chart — slightly larger.** Increased chart height
  from 300→360px and outerRadius from 80→82 for a bigger pie. Nudged
  right-side labels 4px inward to keep all two-line labels within the
  SVG bounds. Label font size unchanged at 11px — no truncation.

## v1.4.5-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — two-line labels now render correctly.** The
  previous <tspan dy> approach produced lines only 13px apart, making them
  appear as one line. Switched to two separate <text> elements inside a <g>:
  category name (bold) at y-8, ZMW amount (muted) at y+8, giving 16px
  separation — clearly two distinct lines.

## v1.4.4-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — two-line labels.** Reverted to the original
  inline pie label design but split each label into two lines: category
  name on top, ZMW amount on the bottom. This halves the horizontal width
  of each label (e.g. "chick purchase" + "ZMW 7700" instead of
  "chick_purchase: ZMW 7700" on one line), preventing truncation without
  shrinking the chart. Uses custom label render with two `<tspan>` elements.

## v1.4.3-alpha — 2026-08-03

### Fixed
- **Cost Breakdown chart — vaccines label truncation.** With 5 categories
  the legend wrapped to 4 rows (~80px). The 320px chart height left the
  last item "vaccines: ZMW 346" clipped at the SVG bottom edge. Increased
  chart height to 380px, reduced outerRadius to 80, moved cy to 35%.

## v1.4.2-alpha — 2026-08-03

### Fixed
- **Mobile CRUD gaps.** Filled three missing CRUD functionalities:
  - Documents: added PATCH endpoint and edit form for document metadata
    (category, recordType).
  - Alerts: added DELETE endpoint and delete button with confirmation dialog.
  - Flock Tasks: added FAB and create dialog for manual task creation
    (API already supported POST).
- **ageDays calculation.** The API list (GET /api/v1/broiler-flocks) and
  detail (GET /api/v1/broiler-flocks/:id) endpoints were not returning
  ageDays, causing all flocks to show "Day 0" in the mobile app. Both
  endpoints now compute ageDays from startDate. Flocks without a startDate
  show "Pending" instead of "Day 0".
- **Overhead category mapping.** The overhead allocation service was passing
  OverheadCategory enum values (e.g. 'labour', 'vaccination', 'electricity')
  directly as FinancialRecord.category, which expects FinancialCategory enum
  values (e.g. 'labor', 'vaccines', 'utilities'). This caused a 500 error
  when creating monthly overheads. Added a mapping table.
- **Cost Breakdown chart truncation.** The "Cost Breakdown by Category" pie
  chart on /financials used inline labels that overflowed the SVG container
  by up to 145px, truncating category names and amounts. Replaced with a
  proper Legend component that wraps within the chart bounds.

### Changed
- Docker Compose restored to use shared external PostgreSQL and Redis
  services (shared-net network) instead of local containers.
- Mobile flock list card shows "Pending" for flocks without a startDate.

### Test Summary
- 129/129 backend tests pass (11 test files)
- Flutter analyze: no issues
- All containers healthy (api, web, nginx, ntfy)

## v1.4.1-alpha — 2026-08-03

### Fixed
- **Flaky alert generation test.** The `generates alerts including
  vaccination and task alerts` integration test was failing because the
  test flock's `collectionDate` was hardcoded to `2026-06-01`, making the
  flock ~63 days old. The vaccination schedule only has items up to day
  21, and the alert generation looks for schedule items within a ±2 day
  window of the flock's current age — so no `vaccination_due` alerts were
  generated for the old flock.
- The test now creates a separate flock with a dynamic `collectionDate`
  of today, guaranteeing the flock is day 0 and the Marek's/Newcastle
  vaccines (scheduled at age 0) always trigger `vaccination_due` alerts.
  The flock is cleaned up after the test. This follows the project
  guideline of creating new flocks for testing rather than modifying
  existing ones.
- Test count: 129 (was 127).

### Files Modified
- `apps/api/tests/integration/broiler-management.test.ts`
- `package.json` (version bump)

### Test Summary
- 129 backend tests pass (11 test files, all green, verified across
  multiple consecutive runs).

## v1.4.0-alpha — 2026-08-03

### Added
- **Supplier price history / audit trail.** Every time a feed stage's
  `unitPriceZmw` or `unitSizeKg` is updated via `PATCH /api/v1/feed-stages/:id`,
  the API now automatically records the old and new values, who made the
  change, and when — in a new `FeedStagePriceHistory` table.
- **Price history API endpoints:**
  - `GET /api/v1/feed-stages/:id/price-history` — history for a single stage
  - `GET /api/v1/suppliers/:id/price-history` — history for all stages of a
    supplier (includes stage name, old/new price, old/new unit size,
    changed-by, changed-at)
- **Price history UI on Suppliers page.** Each supplier card now has a
  history icon button that opens a dialog showing the full audit trail:
  stage name, old price, new price (with diff highlighted green/red), unit
  size changes, and timestamp.
- Added `FeedStagePriceHistory` TypeScript interface.

### Database Changes
- New table: `feed_stage_price_history` (id, feed_stage_id, old/new
  unit_price_zmw, old/new unit_size_kg, changed_by, changed_at). Applied
  via `prisma db push`. No data migration needed — the table starts empty
  and populates on future price changes.

### Files Modified
- `apps/api/prisma/schema.prisma` — new `FeedStagePriceHistory` model
- `apps/api/src/modules/feed-stages/routes.ts` — auto-record on PATCH + GET history
- `apps/api/src/modules/suppliers/routes.ts` — supplier-level GET history
- `apps/web/src/app/suppliers/page.tsx` — price history dialog + button
- `apps/web/src/lib/types.ts` — `FeedStagePriceHistory` interface
- `package.json` (version bump)

### Test Summary
- 126 backend tests pass (1 pre-existing flaky alert-generation test fails
  independently of this change — confirmed by stashing changes and re-running).
- Web production build passes (typecheck + lint via `next build`).

### Notes
- Historical financial records were already snapshotted at creation time
  (feed record `costZmw` and financial record `amountZmw` are copies, not
  live references). This feature adds visibility into *when* and *how*
  supplier prices changed, complementing the existing snapshot behavior.
- The price history table starts empty — it only records changes made
  from now on. Past price changes (before this feature) are not
  retroactively logged.

## v1.3.3-alpha — 2026-08-02

### Changed
- **Renamed profit labels to revenue/profit correctly.** Both the flock list
  cards and the flock detail dashboard now distinguish between revenue and
  profit:
  - **Projected Revenue** = sale price per bird × remaining birds
  - **Projected Profit** = projected revenue − total costs
  - **Actual Revenue** = sales income recorded so far (no costs subtracted)
  - **Actual Profit** = actual revenue − total costs
- Flock detail dashboard cards now show revenue as the headline figure with
  profit shown beneath it (color-coded green/red).
- Flock list cards now show all four figures: Sale Price/Bird, Projected
  Revenue, Projected Profit, Actual Revenue, Actual Profit.
- Added testing guideline to `AGENTS.md`: never modify existing flocks for
  testing — always create new flocks specifically for test runs.

### Files Modified
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/app/broiler-flocks/page.tsx`
- `AGENTS.md`
- `package.json` (version bump)

### Test Summary
- 127 backend tests pass (12 unit + 115 integration).
- Web production build passes (typecheck + lint via `next build`).

## v1.3.2-alpha — 2026-08-02

### Changed
- **Flock list cards: financial summary.** Each flock card on the
  `/broiler-flocks` page now shows Sale Price/Bird, Projected Profit
  (sale price × remaining birds), and Actual Profit (revenue − costs from
  financials) in addition to the existing Birds/Mortality rows.
- **Flock detail dashboard: Actual Profit card.** Added an "Actual Profit"
  card next to the "Projected Profit" card at the top of the flock detail
  page. It shows revenue minus costs from recorded financial transactions
  (green when positive, red when negative, 0.00 when no sales yet).
- **API: flock list endpoint** (`GET /api/v1/broiler-flocks`) now includes
  minimal `financialRecords` (amountZmw, isIncome, category) so the
  frontend can compute actual profit per flock without extra requests.
- Added optional `financialRecords` to the `BroilerFlock` TypeScript
  interface.

### Files Modified
- `apps/api/src/modules/broiler-flocks/routes.ts`
- `apps/web/src/app/broiler-flocks/page.tsx`
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/lib/types.ts`
- `package.json` (version bump)

### Test Summary
- 127 backend tests pass (12 unit + 115 integration).
- Web production build passes (typecheck + lint via `next build`).

## v1.3.1-alpha — 2026-08-02

### Changed
- **Flock dashboard: projected profit card.** Replaced the financials-based
  "Profit (ZMW)" card on the flock detail page with a "Projected Profit"
  card. It now calculates projected profit as
  `projected sale price per bird × remaining birds (currentCount)`,
  instead of deriving profit from recorded financial transactions.
- Added an inline input field on the card to enter/save the projected sale
  price per bird. The value persists via the existing `salePriceZmw` field
  on `BroilerFlock` (PATCH `/api/v1/broiler-flocks/:id`). Viewers see the
  value read-only; owners/managers can edit and save.
- Added `salePriceZmw` to the `BroilerFlock` TypeScript interface
  (`apps/web/src/lib/types.ts`).

### Files Modified
- `apps/web/src/app/broiler-flocks/[id]/page.tsx`
- `apps/web/src/lib/types.ts`
- `package.json` (version bump)

### Notes
- No backend or database schema changes — `salePriceZmw` already existed on
  the `BroilerFlock` Prisma model and was already accepted by the PATCH
  endpoint.
- The Overview tab's "Flock Summary" still shows Total Cost / Total Revenue
  from financials for reference; only the top dashboard card changed.
