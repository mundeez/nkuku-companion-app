# Changelog

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
