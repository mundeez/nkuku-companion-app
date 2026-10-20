# Implementation Plan: Edit & Delete Flock Records

## Overview
Enable farm owners to edit and delete individual records (growth, feed, water, mortality, vaccination, financial) within a broiler flock detail page.

---

## Current State Audit

| Module | API DELETE | API PATCH (Edit) | Frontend UI |
|--------|-----------|------------------|-------------|
| growth-records | Yes (owner only) | **Missing** | Add only |
| feed-records | Yes (owner only) | **Missing** | Add only |
| water-records | Yes (owner only) | **Missing** | Add only |
| mortality-events | Yes (owner only) | **Missing** | Add only |
| vaccination-events | Yes (owner only) | Yes | Add only |
| financial-records | Yes (owner only) | **Missing** | Add only |

**Frontend**: `SimpleRecordTab` in `/broiler-flocks/[id]/page.tsx` renders record cards with no action buttons. Only an "Add" button exists.

**Auth**: Delete is restricted to `owner` role. Edit should be `owner` + `manager`.

---

## Phase 1: API Development (Estimated: 2 hours)

### 1.1 Add PATCH Endpoints to 5 Missing Modules

For each of the following modules, add a `PATCH /:id` endpoint following the existing pattern in `vaccination-events/routes.ts`:

- [ ] `apps/api/src/modules/growth-records/routes.ts`
- [ ] `apps/api/src/modules/feed-records/routes.ts`
- [ ] `apps/api/src/modules/water-records/routes.ts`
- [ ] `apps/api/src/modules/mortality-events/routes.ts`
- [ ] `apps/api/src/modules/financial-records/routes.ts`

#### Implementation Pattern for Each Module

```typescript
app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const data = <Module>CreateSchema.partial().parse(request.body);
  const authUser = (request as any).authUser;

  const record = await prisma.<model>.findFirst({
    where: { id },
    include: { flock: true },
  });
  if (!record || record.flock.createdBy !== authUser.userId) {
    return reply.status(404).send({ error: 'NOT_FOUND' });
  }

  return prisma.<model>.update({
    where: { id },
    data: {
      ...data,
      <dateField>: data.<dateField> ? new Date(data.<dateField>) : undefined,
    },
  });
});
```

#### Module-Specific Date Fields

| Module | Schema Name | Date Field(s) | Prisma Model |
|--------|-------------|---------------|--------------|
| growth-records | `GrowthRecordCreateSchema` | `recordDate` | `growthRecord` |
| feed-records | `FeedRecordCreateSchema` | `recordDate` | `feedRecord` |
| water-records | `WaterRecordCreateSchema` | `recordDate` | `waterRecord` |
| mortality-events | `MortalityEventCreateSchema` | `eventDate` | `mortalityEvent` |
| financial-records | `FinancialRecordCreateSchema` | `recordDate` | `financialRecord` |

### 1.2 Special Cases

- **Mortality events**: On PATCH, if `count` changes, update the flock's `currentCount` by the delta (`newCount - oldCount`). On DELETE, restore count (already implemented).
- **Feed/Financial records**: No special cascade logic needed.

---

## Phase 2: Frontend Development (Estimated: 3 hours)

### 2.1 Extend SimpleRecordTab Component

File: `apps/web/src/app/broiler-flocks/[id]/page.tsx`

#### Changes to Each Record Card

Each `<Card>` in the record list needs action buttons (only shown for `canEdit`):

```tsx
<Card key={r.id}>
  <CardContent className="py-3 flex justify-between items-center">
    <div>
      <p className="font-medium">{renderRecord(r)}</p>
      <p className="text-sm text-muted-foreground">{date}</p>
    </div>
    {canEdit && (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {user?.role === "owner" && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDelete(r)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    )}
  </CardContent>
</Card>
```

#### State Additions

```tsx
const [editingRecord, setEditingRecord] = useState<any | null>(null);
const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
const [deleteOpen, setDeleteOpen] = useState(false);
```

#### Edit Dialog

- Reuse the existing form dialog but pre-populate fields with the record's current values
- Change title from "Add" to "Edit"
- On save, call `apiFetch(config.endpoint + '/' + editingRecord.id, { method: 'PATCH', body: JSON.stringify({ ...form, flockId }) })`

#### Delete Confirmation Dialog

```tsx
<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Delete Record</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete} disabled={saving}>
        {saving ? "Deleting..." : "Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 2.2 Import Icons

Ensure `Pencil` and `Trash2` are imported from `lucide-react` (already imported in the page).

### 2.3 Handle Delete for Mortality

When deleting a mortality event, the API already restores the flock count. No extra frontend logic needed.

---

## Phase 3: Testing (Estimated: 1 hour)

### 3.1 API Unit Tests

Add tests for the new PATCH endpoints in existing test files:

- `apps/api/tests/integration/growth-records.test.ts`
- `apps/api/tests/integration/feed-records.test.ts`
- `apps/api/tests/integration/water-records.test.ts`
- `apps/api/tests/integration/mortality-events.test.ts`
- `apps/api/tests/integration/financial-records.test.ts`

Each test should verify:
- [ ] PATCH updates a record successfully (200)
- [ ] PATCH returns 404 for non-existent record
- [ ] PATCH returns 404 for records belonging to another user
- [ ] DELETE returns 404 for non-existent record

### 3.2 Frontend Manual Tests

- [ ] Edit button opens dialog with pre-filled data
- [ ] Save sends PATCH request and refreshes list
- [ ] Delete button shows confirmation dialog
- [ ] Confirm delete removes record and refreshes list
- [ ] Manager role can edit but not delete
- [ ] Viewer role sees no action buttons

---

## Phase 4: Deployment & Verification (Estimated: 30 min)

1. [ ] Run `docker compose up --build -d`
2. [ ] Run backend test suite: `docker compose exec api pnpm run test`
3. [ ] Verify in browser: create, edit, and delete each record type
4. [ ] Commit with message: `feat: add edit and delete for flock records`
5. [ ] Tag: `git tag v0.2.1`

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/modules/growth-records/routes.ts` | Add PATCH /:id endpoint |
| `apps/api/src/modules/feed-records/routes.ts` | Add PATCH /:id endpoint |
| `apps/api/src/modules/water-records/routes.ts` | Add PATCH /:id endpoint |
| `apps/api/src/modules/mortality-events/routes.ts` | Add PATCH /:id endpoint + count delta logic |
| `apps/api/src/modules/financial-records/routes.ts` | Add PATCH /:id endpoint |
| `apps/web/src/app/broiler-flocks/[id]/page.tsx` | Add edit/delete UI to SimpleRecordTab |
| `apps/api/tests/integration/*.test.ts` | Add PATCH tests (5 files) |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| PATCH on mortality count could corrupt flock count | Compute delta, use Prisma atomic update |
| Delete button visible to managers | Only render Trash2 when `user?.role === "owner"` |
| Form dialog reused for add + edit | Use `editingRecord` state to toggle title/endpoint |
