# Nkuku Companion App — Dashboard Enhancement Plan

## Current State

The main dashboard (`apps/web/src/app/page.tsx`) is a **static card grid** with:
- 8 broiler management stat cards (Active Flocks, Pending Flocks, Total Birds, Mortality Rate, Vaccinations Due, Open Tasks, Environment Alerts)
- 3 production planning cards (Suppliers, Production Cycles, Batches)
- 5 quick-action links (Manage Flocks, Disease Database, Run Projection, Manage Suppliers, Vaccine Inventory)

**No charts. No trends. No comparisons. No visual data.** Just numbers in boxes.

Meanwhile, the financial pages (`/financials`) already use **recharts** for bar/pie/line charts, and the API has rich summary endpoints that the dashboard doesn't use at all.

### What's Available but Unused

| API Endpoint | Data | Dashboard Use |
|---|---|---|
| `GET /broiler-flocks/:id/dashboard` | Age, targets, mortality, recent records | Not called on main dashboard |
| `GET /financial-records/summary` | Cost/revenue/profit by category | Not called |
| `GET /financial-engine/summary` | Unified financial summary | Only on /financials page |
| `GET /financial-engine/monthly-trend` | Monthly revenue vs cost | Only on /financials page |
| `GET /financial-engine/flock-profitability` | Profit comparison across flocks | Only on /financials page |
| `GET /growth-records/analysis` | Weight vs target, FCR | Not called on dashboard |
| `GET /feed-records/summary` | Feed type breakdown, cost per bird | Not called |
| `GET /mortality-events/summary` | Cause breakdown, mortality rate | Not called |
| `GET /alerts?status=open` | All open alerts | Called but only counted, not visualized |

### Charting Library
**recharts** `^2.10.4` — already installed and used on `/financials` and `/projections`. Available components: BarChart, LineChart, PieChart, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer.

---

## Implementation Plan

### Phase 1: Dashboard Financial Overview Charts
**Goal:** Add financial visualizations to the main dashboard so the farmer sees profitability at a glance.

**New dashboard sections:**

#### 1a. Financial KPI Row (4 cards)
Replace the plain "Production Planning" section with financial KPIs:
- **Total Revenue** (all flocks, all time) — green
- **Total Costs** (all flocks, all time) — red
- **Net Profit** — green/red based on sign
- **Profit per Bird** — derived metric

**Source:** `GET /api/v1/financial-engine/summary`
**File:** `apps/web/src/app/page.tsx`

#### 1b. Monthly Revenue vs Cost (Bar Chart)
- Last 12 months, grouped bars: revenue (green) vs cost (red)
- Y-axis: ZMW
- Clickable bars drill down to `/financials`

**Source:** `GET /api/v1/financial-engine/monthly-trend?year=2026`
**File:** `apps/web/src/app/page.tsx` (new chart section)

#### 1c. Cost Breakdown (Pie/Donut Chart)
- Slices: chick_purchase, feed, vaccines, medication, labor, utilities, equipment, other
- Colors per category
- Center label: total cost in ZMW

**Source:** `GET /api/v1/financial-records/summary` (categoryBreakdown)
**File:** `apps/web/src/app/page.tsx` (new chart section)

---

### Phase 2: Flock Performance Comparison
**Goal:** Let the farmer compare active flocks side by side.

#### 2a. Flock Profitability Comparison (Bar Chart)
- One bar per active flock
- Shows net profit (or loss) per flock
- Color: green for profit, red for loss
- Clickable → navigates to flock detail

**Source:** `GET /api/v1/financial-engine/flock-profitability`
**File:** `apps/web/src/app/page.tsx` (new chart section)

#### 2b. Flock Mortality Comparison (Bar Chart)
- One bar per active flock
- Shows mortality rate %
- Color: green (<5%), amber (5-10%), red (>10%)
- Overlaid with target line at acceptable threshold

**Source:** Computed from `GET /api/v1/broiler-flocks` (currentCount vs initialCount per flock)
**File:** `apps/web/src/app/page.tsx` (new chart section)

#### 2c. Active Flocks Summary Table
- Compact table: Flock Name | Breed | Day | Birds | Mortality % | Profit (ZMW)
- Clickable rows → flock detail
- Sorted by profit descending

**Source:** Multiple endpoints combined
**File:** `apps/web/src/app/page.tsx` (new table section)

---

### Phase 3: Alerts & Health Visualization
**Goal:** Make health issues immediately visible with visual urgency.

#### 3a. Alerts by Severity (Donut Chart)
- 3 slices: critical (red), warning (amber), info (blue)
- Center: total open alerts count
- Click on a slice → filters alert list

**Source:** `GET /api/v1/alerts?status=open`
**File:** `apps/web/src/app/page.tsx` (new chart section)

#### 3b. Alerts by Type (Horizontal Bar Chart)
- Bars: vaccination_due, task_due, environmental_threshold, temperature_adjustment, feed_transition, mortality_threshold, medication_due, etc.
- Sorted by count descending
- Color-coded by severity

**Source:** `GET /api/v1/alerts?status=open` (grouped by alertType)
**File:** `apps/web/src/app/page.tsx` (new chart section)

#### 3c. Recent Alerts List (Enhanced)
- Replace the simple count cards with a scrollable list of the 5 most recent alerts
- Each row: severity icon, title, flock name, relative time ("2h ago")
- Click → navigates to flock or alerts page

**File:** `apps/web/src/app/page.tsx` (replace existing alert count cards)

---

### Phase 4: Flock Detail Page Charts
**Goal:** Add visual charts to each tab on the flock detail page.

**File:** `apps/web/src/app/broiler-flocks/[id]/page.tsx`

#### 4a. Growth Tab — Weight vs Target (Line Chart)
- X-axis: day number
- Y-axis: weight (grams)
- Line 1: Actual weight (from growth records)
- Line 2: Ross 308 target weight (from performance targets)
- Shaded area between lines showing over/under performance

**Source:** `GET /api/v1/growth-records/analysis?flockId=X`
**Chart:** LineChart with two Lines + ReferenceLine for target

#### 4b. Feed Tab — Daily Feed Consumption (Bar Chart)
- X-axis: date
- Y-axis: kg consumed
- Stacked by feed type (Starter, Grower, Finisher)
- Line overlay: cumulative feed cost (ZMW)

**Source:** Feed records already loaded on the page
**Chart:** BarChart (stacked) + LineChart (composed)

#### 4c. Water Tab — Water Consumption & pH (Composed Chart)
- Bar: daily water consumption (liters)
- Line: pH level (should be 6.5-7.5)
- Reference area: acceptable pH range (green band)

**Source:** Water records already loaded on the page
**Chart:** ComposedChart (Bar + Line)

#### 4d. Mortality Tab — Cumulative Mortality (Area Chart)
- X-axis: date
- Y-axis: cumulative deaths
- Stacked area by cause (disease, accident, unknown, etc.)
- Line overlay: mortality rate %

**Source:** Mortality events already loaded on the page
**Chart:** AreaChart (stacked)

#### 4e. Financial Tab — Cost Breakdown (Pie Chart)
- Slices by category: chick_purchase, feed, vaccines, medication, labor, utilities, other
- Center: total cost
- Below: revenue vs cost bar comparison

**Source:** Financial records already loaded on the page
**Chart:** PieChart + BarChart

#### 4f. Vaccination Tab — Vaccination Schedule Timeline
- Horizontal timeline showing completed vs upcoming vaccinations
- Completed: green checkmarks
- Upcoming: amber circles with due date
- Overdue: red circles

**Source:** Vaccination events + breed schedule
**Chart:** Custom timeline component (div-based, not recharts)

---

### Phase 5: Dashboard Layout Redesign
**Goal:** Reorganize the dashboard into a clean, information-dense layout.

**Proposed layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Dashboard" + date range selector (7d/30d/90d)    │
├─────────────────────────────────────────────────────────────┤
│  Row 1: [Active Flocks] [Total Birds] [Mortality %]        │
│         [Net Profit] [Profit/Bird] [Vaccines Due]          │
│         (6 KPI cards, compact)                              │
├──────────────────────────┬──────────────────────────────────┤
│  Row 2 Left (60%):       │  Row 2 Right (40%):              │
│  Monthly Revenue vs Cost │  Cost Breakdown (Donut)          │
│  (Bar Chart)             │                                  │
├──────────────────────────┼──────────────────────────────────┤
│  Row 3 Left (50%):       │  Row 3 Right (50%):              │
│  Flock Profitability     │  Alerts by Severity (Donut)      │
│  (Bar Chart)             │  + Recent Alerts List            │
├──────────────────────────┴──────────────────────────────────┤
│  Row 4: Active Flocks Summary Table                         │
│  (clickable rows → flock detail)                            │
├─────────────────────────────────────────────────────────────┤
│  Row 5: Quick Actions (existing, keep as-is)                │
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
- KPI cards reduced from 11 to 6 most important
- 4 new chart sections
- 1 enhanced alerts section
- 1 new comparison table
- Quick actions kept (already good)

**File:** `apps/web/src/app/page.tsx` (major rewrite)

---

### Phase 6: Date Range Selector
**Goal:** Let the farmer filter dashboard data by time range.

**Implementation:**
- Add a toggle button group at the top: 7 Days | 30 Days | 90 Days | All Time
- State stored in React useState, passed to all data-fetching effects
- All API calls parameterized with date range
- Default: 30 days

**New component:** `apps/web/src/components/date-range-selector.tsx`
**Modified:** `apps/web/src/app/page.tsx`

---

### Phase 7: New API Endpoint — Dashboard Summary
**Goal:** Reduce the number of API calls the dashboard needs to make.

Currently the dashboard makes 4 parallel API calls and computes stats client-side. A single aggregated endpoint would be more efficient.

**New endpoint:** `GET /api/v1/dashboard/summary`

**Returns:**
```json
{
  "kpis": {
    "activeFlocks": 3,
    "pendingFlocks": 1,
    "totalBirds": 4500,
    "mortalityRate": 2.3,
    "totalRevenue": 125000,
    "totalCost": 89000,
    "netProfit": 36000,
    "profitPerBird": 8.0
  },
  "monthlyTrend": [
    { "month": "Jan", "revenue": 30000, "cost": 22000 }
  ],
  "costBreakdown": [
    { "category": "feed", "amount": 45000 },
    { "category": "chick_purchase", "amount": 15000 }
  ],
  "flockProfitability": [
    { "flockId": "...", "flockName": "Flock A", "profit": 20000, "mortalityRate": 1.5 }
  ],
  "alertsBySeverity": { "critical": 2, "warning": 5, "info": 3 },
  "alertsByType": [
    { "type": "vaccination_due", "count": 4, "severity": "warning" }
  ],
  "recentAlerts": [
    { "id": "...", "title": "...", "severity": "critical", "flockName": "...", "createdAt": "..." }
  ]
}
```

**New file:** `apps/api/src/modules/dashboard/routes.ts`
**Modified:** `apps/api/src/main.ts` (register the new module)

---

## Implementation Order

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| Phase 7: Dashboard Summary API | Critical | Low | Foundation — single efficient endpoint |
| Phase 1: Financial Charts | High | Medium | Profitability visibility |
| Phase 5: Layout Redesign | High | Medium | Clean information architecture |
| Phase 3: Alerts Visualization | High | Low | Health issues at a glance |
| Phase 2: Flock Comparison | Medium | Medium | Cross-flock benchmarking |
| Phase 4: Flock Detail Charts | Medium | High | Per-flock trend visualization |
| Phase 6: Date Range Selector | Low | Low | Flexible analysis |

## Technical Approach

### Frontend
- **Chart library:** recharts (already installed, no new dependency)
- **Chart types:** BarChart, LineChart, PieChart, AreaChart, ComposedChart
- **Pattern:** Fetch data via `apiFetch()`, transform into chart-compatible arrays, render with ResponsiveContainer
- **Theme:** Use existing Tailwind color tokens (primary, destructive, etc.)
- **Interactivity:** Clickable chart elements that navigate to detail pages

### Backend
- **New module:** `apps/api/src/modules/dashboard/` with a single `routes.ts`
- **Pattern:** Aggregate data from existing Prisma models in a single query set
- **No schema changes needed** — all data already exists in the database
- **Caching:** Consider Redis caching for the summary endpoint (Redis is already running)

### Files Summary

**New files (3):**
- `apps/api/src/modules/dashboard/routes.ts` — aggregated dashboard API
- `apps/web/src/components/date-range-selector.tsx` — time range toggle
- `apps/web/src/components/charts/` — reusable chart components (optional)

**Modified files (2):**
- `apps/api/src/main.ts` — register dashboard module
- `apps/web/src/app/page.tsx` — complete dashboard rewrite with charts

**Optional modified files:**
- `apps/web/src/app/broiler-flocks/[id]/page.tsx` — add charts to tabs (Phase 4)
- `apps/web/src/lib/types.ts` — add DashboardSummary type

### Testing
- API: Add integration test for `GET /api/v1/dashboard/summary`
- Frontend: Verify charts render with empty data (no flocks) and with populated data
- Build: `docker compose -f docker-compose.prod.yml build --no-cache web` must succeed
