# Navbar Redesign — Implementation Plan

## 1. Objective

Redesign the global `Navbar` in `apps/web/src/components/navbar.tsx` to be more modern, polished, and professional while preserving all existing navigation logic, role-based access control, and mobile support. The result should feel like a production SaaS navigation bar, improve scanability, and provide a consistent identity across the app.

## 2. Current State

- **File:** `apps/web/src/components/navbar.tsx`
- **Layout usage:** `apps/web/src/app/layout.tsx` renders `<Navbar />` above `<main>`.
- **Current behavior:**
  - Logo + flat text links on the left.
  - Theme toggle, alerts, settings, billing, user name, and logout icons/text on the right.
  - Hamburger menu on mobile that expands all links below the bar.
  - Active link is not visually indicated.
  - All nav links are displayed as one long flat list on desktop.
  - No grouping or hierarchy for related modules.
  - User name and logout are always visible; no consolidated user menu.
- **Tech stack:** Next.js 14, Tailwind CSS, shadcn/ui primitives (`Button`, `Dialog`, `DropdownMenu`, `Select`, `Tabs`), `lucide-react` icons.
- **Existing UI components in `components/ui/`:** `badge`, `button`, `card`, `dialog`, `input`, `label`, `select`, `table`, `tabs`.

## 3. Design Direction

- **Visual style:** clean, light, high-contrast, modern rounded surfaces, subtle shadows, and generous whitespace.
- **Brand:** keep the existing `/logo.png`; add a secondary logotype text "Nkuku" (or keep only logo if the PNG already contains it).
- **Color:** stick to the existing CSS variable palette (`bg-background`, `text-foreground`, `text-muted-foreground`, `primary`). Avoid introducing new brand colors unless requested.
- **Interaction:** soft hover states, clear active link indicators, and subtle transitions (`transition-colors`, `duration-200`).
- **Responsiveness:** full desktop nav, condensed tablet nav, and a modern slide-over mobile sheet.
- **Accessibility:** keyboard focus rings, `aria-labels`, `aria-current="page"` for active links, and reduced-motion support.

## 4. Functional Requirements

1. **Persistent brand anchor** — clickable logo that routes to `/`.
2. **Role-based navigation** — same gating as today (`owner`/`manager`/`sales_person` sees Sales; `owner`/`manager`/`viewer` sees Financials/Ledger; `owner` sees Users).
3. **Active link state** — the link matching the current `pathname` receives a distinct visual treatment (background pill or bottom accent).
4. **Grouped navigation** — group related links under clear, compact menus or sections:
   - **Production:** Dashboard, Broiler Flocks, Sales (role-gated).
   - **Health & Planning:** Diseases, Alerts, Vaccine Inventory, Suppliers.
   - **Financials:** Financials, Ledger (role-gated), Billing.
   - **Tools & Planning:** Projections, Expansion Plan.
   - **Admin:** Users (owner only).
5. **User area** — consolidated dropdown containing:
   - User name + email.
   - Theme toggle (light/dark).
   - Settings.
   - Billing & Plans.
   - Log out.
6. **Notification bell** — visible on desktop and mobile, with an optional unread badge (if data is available; otherwise a placeholder state).
7. **Mobile sheet** — a full-height slide-over from the right on small screens, showing grouped navigation and the user menu.
8. **Search/command palette** (optional MVP or phase 2) — a search button that opens a command palette for quick navigation.

## 5. Visual Design Specification

### Desktop (≥ `lg` / 1024 px)
- **Height:** `h-16` (64 px), same as today.
- **Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` with a subtle bottom border or frosted-glass shadow.
- **Logo block:** 40 px high logo, with optional text wordmark `text-xl font-bold text-foreground`.
- **Primary links:** grouped as icon + label or as dropdown triggers.
  - Each top-level item is a `Button variant="ghost"` with `h-9 px-3`.
  - Active item: `bg-muted text-foreground` or `text-primary font-semibold` with a 2 px bottom accent.
- **Right cluster:** notification, user avatar/dropdown, and a compact theme toggle inside the user menu or as a top-level icon.

### Tablet (`md` to `lg`)
- Collapse some grouped sections into a single "More" dropdown or icon-only mode.
- Keep the most-used items visible: Dashboard, Flocks, Sales, Alerts, Financials (role-gated).

### Mobile (< `md`)
- A single top bar with logo + hamburger.
- Trigger opens a `Sheet` from the right.
- Sheet header: close button + user mini-profile.
- Sheet body: grouped accordion-style or flat grouped sections with a clear separator.
- Sheet footer: theme toggle + logout.

### Dark Mode
- All components must respect `.dark` via existing CSS variables.
- Use `bg-background/80 backdrop-blur` for a subtle glass effect in both modes.

## 6. Component Architecture

### New or extended components

1. **`components/navbar.tsx` (main rewrite)**
   - Top-level layout, state, and role gating.
   - Uses new sub-components.

2. **`components/navbar/nav-link.tsx`**
   - Single nav link with active state, icon, label, and optional badge.

3. **`components/navbar/nav-group.tsx`**
   - A `DropdownMenu` trigger with a label and list of sub-links.

4. **`components/navbar/mobile-nav.tsx`**
   - A `Sheet`-based slide-over for mobile.

5. **`components/navbar/user-nav.tsx`**
   - Consolidated user dropdown or mobile user section.

6. **`components/ui/sheet.tsx`**
   - New shadcn-style sheet built on `@radix-ui/react-dialog` (already installed).

7. **`components/ui/avatar.tsx`**
   - Optional; use a fallback initial if no profile picture.

8. **`components/ui/tooltip.tsx`**
   - Optional; for icon-only top-bar items.

### External dependencies to add
- None for the core plan. `@radix-ui/react-dialog` is already installed for a custom `Sheet`.
- If an `Avatar` is desired, we can build a lightweight one with Tailwind instead of adding `@radix-ui/react-avatar`.

## 7. Navigation Structure (Proposed)

### Top-level grouped links

```
Logo -> /

Production
  Dashboard             /
  Broiler Flocks        /broiler-flocks
  Sales*                /sales

Operations
  Diseases              /diseases
  Vaccine Inventory     /vaccine-inventory
  Suppliers             /suppliers
  Alerts                /alerts

Finances
  Financials*           /financials
  Ledger*               /ledger
  Billing               /billing

Planning
  Projections           /projections
  Expansion Plan        /expansion-plan

Admin
  Users*                /users
```

`*` role-gated as today.

### Right side (desktop)
- Bell icon with optional unread badge → `/alerts`.
- User avatar/dropdown (fallback initials or silhouette icon) containing:
  - Name + email
  - Theme toggle
  - Settings
  - Billing & Plans
  - Logout

## 8. State Management

- `mobileOpen` will be moved into `MobileNav` or replaced by `Sheet` state.
- `resolvedTheme` and `setTheme` from `useTheme` will be used inside the user menu.
- Active link detection via `usePathname()` from `next/navigation`.
- Optional: `unreadAlerts` can be passed as a prop or fetched client-side if the notification badge is implemented.

## 9. Implementation Steps (Phase Plan)

### Phase 1 — Component scaffolding
1. Create `components/ui/sheet.tsx` and `components/ui/avatar.tsx` (lightweight).
2. Create `components/navbar/nav-link.tsx`.
3. Create `components/navbar/nav-group.tsx`.
4. Create `components/navbar/user-nav.tsx`.
5. Create `components/navbar/mobile-nav.tsx`.

### Phase 2 — Navbar rewrite
1. Refactor `components/navbar.tsx` to import and compose the new sub-components.
2. Add `usePathname` active link logic.
3. Wire role gating and group definitions.
4. Remove inline mobile menu in favor of `MobileNav`.

### Phase 3 — Layout & spacing polish
1. Update `layout.tsx` if needed (e.g., add a small `pt-4` to `<main>` if a sticky shadow is introduced).
2. Verify the `bg-muted/30` main area does not clash with the new navbar background.

### Phase 4 — Responsive testing
1. Test at `320 px`, `768 px`, `1024 px`, and `1440 px`.
2. Test desktop dropdown hover/focus and mobile sheet open/close.
3. Verify the hamburger is hidden at `md` and the dropdowns are hidden on mobile.

### Phase 5 — Accessibility & QA
1. Add `aria-label` to icon buttons and the mobile trigger.
2. Add `aria-current="page"` to active links.
3. Verify focus rings are visible with keyboard Tab navigation.
4. Run `pnpm run typecheck` and `pnpm run build`.

## 10. Files to Modify or Create

### New files
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/components/ui/avatar.tsx`
- `apps/web/src/components/navbar/nav-link.tsx`
- `apps/web/src/components/navbar/nav-group.tsx`
- `apps/web/src/components/navbar/user-nav.tsx`
- `apps/web/src/components/navbar/mobile-nav.tsx`

### Modified files
- `apps/web/src/components/navbar.tsx` (rewrite)
- `apps/web/src/app/layout.tsx` (minor spacing tweaks if required)

## 11. Testing & Verification Plan

| Check | Method |
|-------|--------|
| Type safety | `docker compose exec web pnpm run typecheck` |
| Build | `docker compose up --build -d web` |
| Visual smoke | Open `http://localhost:30000` in browser at multiple widths |
| Active link | Click each top-level route; the correct item is highlighted |
| Role gating | Log in as owner, manager, sales_person, viewer; verify menu items |
| Mobile sheet | Use 375 px width; open/close hamburger; all links reachable |
| Keyboard nav | Tab through navbar, press Enter on menu triggers and links |
| Dark mode | Toggle theme; all elements readable and properly colored |

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `Sheet` conflicts with existing `Dialog` | Build `Sheet` from Radix Dialog with its own `data-slot` classes; do not reuse `Dialog` CSS if it causes z-index/focus issues. |
| Active link hydration mismatch | Use `usePathname` only inside a client `Navbar`; it already is a client component. |
| Logo not sized correctly | Keep the logo image at a constrained height with `w-auto`; preserve current `max-w-none` only if needed. |
| Mobile sheet overflow on small screens | Use `overflow-y-auto` with `max-h-[100dvh]` and a safe-area padding. |

## 13. Rollback Plan

- The existing `navbar.tsx` will be replaced. Keep a backup of the current logic in the commit diff; if anything fails, `git checkout HEAD~1 -- apps/web/src/components/navbar.tsx` restores the previous version.
- New sub-components can be deleted safely; only `navbar.tsx` is imported by `layout.tsx`.

## 14. Open Questions / User Decisions

Please review and confirm before execution:

1. **Wordmark:** Do you want the logo text "Nkuku" next to the logo image, or only the existing logo PNG?
2. **Grouping:** Are the proposed group names (Production, Operations, Finances, Planning, Admin) acceptable, or do you prefer a different grouping?
3. **Search palette:** Do you want a search/command palette in the navbar as part of this work, or in a later phase?
4. **User avatar:** Should the user dropdown show a real avatar (need image source), or is an initial-based circle fallback acceptable?
5. **Notification badge:** Do you want a live unread alert count on the bell, or a static bell icon for now?
6. **Color accent:** Should the active nav link use a primary-colored underline or a muted background pill?
7. **Scope:** Should this plan also cover the `flock-subnav.tsx` sub-navigation inside flocks, or only the global navbar?
