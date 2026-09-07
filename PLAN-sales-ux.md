# Implementation Plan — Sales Dashboard UX Improvements

**Version:** 1.0  
**Date:** 2026-09-06  
**Status:** Pending Approval  

## Overview

Improve the Sales Dashboard on both **web** and **mobile** with:
1. Auto-refresh after CRUD operations (silent background refresh)
2. Side drawer panel for expanded sale details
3. Two-line payment status with amounts on each sales row
4. Click-to-sort column headers with asc/desc toggle

## Design Decisions (from Q&A)

| Decision | Choice |
|----------|--------|
| Auto-refresh behavior | Silent background refresh — toast + data appears within ~1s |
| Expand details UI | Side drawer panel (slides in from right) |
| Payment display format | Progress bar + amounts — mini bar showing % paid, plus amounts as text |
| Sort interaction | Click column header to sort, click again to toggle asc/desc |
| Platforms | Both web and mobile |
| Drawer contents | Payment breakdown + customer info + notes + attachments |

---

## Phase 1 — Web Auto-Refresh Fix

### Problem
After create/edit/delete on the sales dashboard, the list does not refresh until a manual page reload. The `invalidateQueries` calls use prefix paths like `"/api/v1/sale-records"` but the actual query keys are full paths with query strings like `"/api/v1/sale-records/all?limit=20&offset=0"`.

### Root Cause
The mutation hook's `onSuccess` handler already uses predicate-based invalidation (fixed in the previous session). However, the sales page's `invalidatePaths` don't cover the actual query paths used by the page:

- Page queries: `/api/v1/sale-records/all?...` and `/api/v1/sale-records/dashboard?...`
- Invalidate paths: `"/api/v1/sale-records"`, `"/api/v1/sale-records/dashboard"`, `"/api/v1/sale-records/summary"`

The predicate `key.startsWith("/api/v1/sale-records")` should match `/api/v1/sale-records/all?...` — so the invalidation should be working. The issue may be that `refetchOnMount: true` is set but `staleTime: 60 * 1000` means the query is still considered fresh within 60 seconds, so invalidation marks it stale but TanStack Query may not refetch if the component is still mounted and the query is not being observed with `refetchOnMount`.

### Fix
1. **Reduce staleTime** on the sales list query to 5 seconds (from 60s) so invalidation triggers an immediate refetch
2. **Add `refetchOnMount: "always"`** to the sales queries so they always refetch when the component mounts
3. **Verify the predicate matching** is working by adding the exact paths to `invalidatePaths`
4. **Add `onSuccess` callback** to the mutations that explicitly calls `queryClient.refetchQueries` for the sales paths

### Files to Edit
- `apps/web/src/app/sales/page.tsx` — reduce staleTime, add refetchQueries
- `apps/web/src/lib/api/hooks.ts` — ensure predicate invalidation is correct

### Estimated Changes
~20 lines

---

## Phase 2 — Web Side Drawer for Sale Details

### Design
A right-side drawer (Sheet component) that slides in when clicking a sale row. It shows:

**Header:** Sale date + flock name  
**Payment Breakdown section:**
- Total Amount: ZMW X
- Amount Paid: ZMW Y
- Amount Remaining: ZMW Z (highlighted in amber if > 0)
- Payment Status badge

**Customer Info section:**
- Customer Name
- Customer Phone (with tap-to-call on mobile)

**Notes section:**
- Full notes text (or "No notes" if empty)

**Attachments section:**
- Reuse existing `AttachmentPanel` component
- Shows uploaded documents with view/download links

**Actions:**
- Edit button (if user has permission)
- Delete button (if owner)

### Implementation
1. Use Radix UI's `Sheet` component (already available via shadcn/ui)
2. Create a new `SaleDetailDrawer` component in `apps/web/src/components/sales/sale-detail-drawer.tsx`
3. Replace the inline expandable row with a click handler that opens the drawer
4. Keep the attachment paperclip button as a shortcut to open the drawer scrolled to attachments

### Files to Create/Edit
- `apps/web/src/components/sales/sale-detail-drawer.tsx` (NEW)
- `apps/web/src/app/sales/page.tsx` — replace inline expand with drawer
- `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx` — same drawer integration

### Estimated Changes
~150 lines new, ~30 lines modified

---

## Phase 3 — Web Progress Bar Payment Display

### Design
Each sales row's Payment column shows a mini progress bar with amounts:

**Visual layout (compact, fits in a table cell):**

```
┌─────────────────────────────┐
│ ● Partial                   │  ← status dot + label
│ ████████░░░░  ZMW 500/1,500 │  ← progress bar + amounts
│ ZMW 1,000 remaining          │  ← remaining (partials only)
└─────────────────────────────┘
```

**By status:**
- **Paid** → green dot + "Paid" + full bar (100%) + "ZMW 1,500 fully paid"
- **Partial** → amber dot + "Partial" + partial bar (e.g. 33%) + "ZMW 500 paid / ZMW 1,000 remaining"
- **Pending** → red dot + "Pending" + empty bar (0%) + "ZMW 1,500 unpaid"

### Implementation
Replace the current single-badge Payment cell with a progress bar layout:

```tsx
<td className="p-2 min-w-[160px]">
  <div className="flex flex-col gap-1">
    {/* Status dot + label */}
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", statusColor)} />
      <span className="text-xs font-medium capitalize">{s.paymentStatus}</span>
    </div>
    {/* Progress bar */}
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${pctPaid}%` }}
      />
    </div>
    {/* Amounts */}
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>ZMW {fmt(paid)}</span>
      <span>ZMW {fmt(total)}</span>
    </div>
    {s.paymentStatus === "partial" && (
      <span className="text-xs text-amber-600 font-medium">
        ZMW {fmt(remaining)} remaining
      </span>
    )}
  </div>
</td>
```

Where:
- `paid` = `Number(s.amountPaidZmw ?? 0)`
- `total` = `Number(s.totalAmountZmw)`
- `remaining` = `total - paid`
- `pctPaid` = `total > 0 ? (paid / total) * 100 : 0`
- `statusColor` / `barColor` = green/amber/red based on payment status

### Files to Edit
- `apps/web/src/app/sales/page.tsx` — payment column cell
- `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx` — same change

### Estimated Changes
~35 lines per file

---

## Phase 4 — Web Click-to-Sort Column Headers

### Current State
The sales page already has a `SortHeader` component and `toggleSort` function. The sort state is stored in the `filter` object and sent to the API via query params. This is already functional.

### Improvements
1. **Visual feedback:** Add ↑/↓ arrow icons on the active sort column (already partially done)
2. **Highlight active column:** Add a subtle background color to the active sort header
3. **Default sort:** Sale date descending (already the default)
4. **Sortable fields:** saleDate, flockName, customerName, birdCount, pricePerBirdZmw, totalAmountZmw, paymentStatus

### Files to Edit
- `apps/web/src/app/sales/page.tsx` — enhance SortHeader styling
- `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx` — add same SortHeader if not present

### Estimated Changes
~15 lines

---

## Phase 5 — Mobile Auto-Refresh

### Problem
After CRUD operations on the mobile sales dashboard, the list does not refresh. The screens use `setState` + manual `loadData()` calls, but after migrating to online-first `OfflineRepository`, the data flow may not trigger a re-fetch.

### Fix
1. After every successful mutation (create/edit/delete), call `_loadData(forceRefresh: true)` to reload from the API
2. Ensure the sales dashboard screen's `_loadData` method calls `BroilerService.getSaleRecordsAll()` with fresh data
3. Show a brief SnackBar toast on success

### Files to Edit
- `apps/mobile/lib/screens/sales_dashboard_screen.dart` — add forceRefresh after mutations
- `apps/mobile/lib/screens/broiler/records/sale_record_form.dart` — return success result

### Estimated Changes
~30 lines

---

## Phase 6 — Mobile Sale Detail Bottom Sheet

### Design
Use a Flutter ` showModalBottomSheet` (or a full-screen route on small devices) that slides up from the bottom when tapping a sale row. Contents:

**Header:** Sale date + flock name  
**Payment Breakdown:** Total, paid, remaining, status badge  
**Customer Info:** Name, phone (with tap-to-call)  
**Notes:** Full notes text  
**Attachments:** Reuse `AttachmentSection` widget  
**Actions:** Edit, Delete buttons

### Implementation
1. Create a new `SaleDetailSheet` widget in `apps/mobile/lib/widgets/sale_detail_sheet.dart`
2. Replace the current expandable row with a tap handler that opens the bottom sheet
3. Add edit/delete actions in the sheet

### Files to Create/Edit
- `apps/mobile/lib/widgets/sale_detail_sheet.dart` (NEW)
- `apps/mobile/lib/screens/sales_dashboard_screen.dart` — replace expand with tap-to-open
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` — sales tab integration

### Estimated Changes
~200 lines new, ~40 lines modified

---

## Phase 7 — Mobile Progress Bar Payment Display

### Design
Each sale card/list item shows a mini progress bar with amounts:

**Visual layout (within a ListTile or Card):**

```
● Partial
████████░░░░░░░░░░░░  33%
ZMW 500 paid / ZMW 1,000 remaining
```

**By status:**
- **Paid** → green dot + "Paid" + full bar (100%) + "ZMW 1,500 fully paid"
- **Partial** → amber dot + "Partial" + partial bar (e.g. 33%) + "ZMW 500 / 1,500 (1,000 remaining)"
- **Pending** → red dot + "Pending" + empty bar (0%) + "ZMW 1,500 unpaid"

### Implementation
Modify the sale card widget to include a `LinearProgressIndicator` (or a custom painted bar) with the payment percentage, plus amounts as text below.

```dart
Widget _buildPaymentProgress(SaleRecord r) {
  final total = (r.totalAmountZmw ?? 0).toDouble();
  final paid = (r.amountPaidZmw ?? 0).toDouble();
  final remaining = total - paid;
  final pct = total > 0 ? (paid / total).clamp(0.0, 1.0) : 0.0;
  final color = r.paymentStatus == 'paid'
      ? Colors.green
      : r.paymentStatus == 'partial'
          ? Colors.amber
          : Colors.red;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(children: [
        Icon(Icons.circle, size: 8, color: color),
        SizedBox(width: 4),
        Text(r.paymentStatus[0].toUpperCase() + r.paymentStatus.substring(1),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
      ]),
      SizedBox(height: 4),
      ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          value: pct,
          backgroundColor: Colors.grey.shade200,
          color: color,
          minHeight: 6,
        ),
      ),
      SizedBox(height: 4),
      Text(
        r.paymentStatus == 'paid'
            ? 'ZMW ${fmt(total)} fully paid'
            : r.paymentStatus == 'partial'
                ? 'ZMW ${fmt(paid)} / ${fmt(total)} (${fmt(remaining)} remaining)'
                : 'ZMW ${fmt(total)} unpaid',
        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
      ),
    ],
  );
}
```

### Files to Edit
- `apps/mobile/lib/screens/sales_dashboard_screen.dart` — payment display in sale card
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` — sales tab sale items

### Estimated Changes
~45 lines per file

---

## Phase 8 — Mobile Click-to-Sort

### Design
Add a sort bar above the sales list with tappable column headers. Tapping a column toggles asc/desc. Show an arrow icon on the active sort field.

**Sort bar layout:** A horizontal scrollable row of chips:
- [Date ↓] [Flock] [Customer] [Birds] [Price] [Total] [Payment]

Tap to sort by that field. Tap again to toggle direction. The active chip is highlighted with an arrow.

### Implementation
1. Add sort state to the sales dashboard screen (`_sortBy`, `_sortDir`)
2. Build a `_buildSortBar` widget with tappable chips
3. Pass sort params to the API call via `SalesFilter`

### Files to Edit
- `apps/mobile/lib/screens/sales_dashboard_screen.dart` — sort bar + state
- `apps/mobile/lib/models/sales_filter.dart` — ensure sortBy/sortDir fields exist

### Estimated Changes
~80 lines

---

## Phase 9 — Validation & Testing

### Web
- `docker compose build web` — production build
- Verify all 40 pages generate
- Manual testing:
  - Create a sale → list refreshes automatically
  - Edit a sale → list refreshes, changes visible
  - Delete a sale → list refreshes, item removed
  - Click a sale row → drawer opens with full details
  - Check partial payment display on a partial sale
  - Click column headers → sort changes, arrow visible

### Mobile
- `flutter analyze` — 0 errors
- `flutter test` — all tests pass
- `flutter build apk --release` — APK builds
- Manual testing:
  - Create/edit/delete sale → list refreshes
  - Tap sale → bottom sheet opens
  - Check partial payment display
  - Tap sort chips → list reorders

### API
- `docker compose exec api pnpm run test` — 330 tests pass
- No API changes needed — existing sort params and sale-records endpoints are sufficient

---

## Execution Order

1. Phase 1 — Web auto-refresh fix (quick, high impact)
2. Phase 2 — Web side drawer (new component)
3. Phase 3 — Web progress bar payment display (quick)
4. Phase 4 — Web sort enhancements (quick, mostly already done)
5. Phase 5 — Mobile auto-refresh (quick)
6. Phase 6 — Mobile bottom sheet (new widget)
7. Phase 7 — Mobile progress bar payment display (quick)
8. Phase 8 — Mobile sort bar (moderate)
9. Phase 9 — Validation & testing

**Total estimated effort:** ~600 lines of new/modified code across 12 files.

---

## Files Summary

### New Files
- `apps/web/src/components/sales/sale-detail-drawer.tsx`
- `apps/mobile/lib/widgets/sale_detail_sheet.dart`

### Modified Web Files
- `apps/web/src/app/sales/page.tsx`
- `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx`
- `apps/web/src/lib/api/hooks.ts`

### Modified Mobile Files
- `apps/mobile/lib/screens/sales_dashboard_screen.dart`
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart`
- `apps/mobile/lib/screens/broiler/records/sale_record_form.dart`
- `apps/mobile/lib/models/sales_filter.dart` (if sortBy/sortDir missing)

### No Changes Needed
- API — existing endpoints support sort params and return all required fields
- Database — no schema changes
- Types — `SaleRecord` already has `amountPaidZmw`, `notes`, `customerPhone`, etc.
