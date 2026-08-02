# Changelog

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
