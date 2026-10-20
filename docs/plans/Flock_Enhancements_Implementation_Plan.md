# Flock Enhancements: Sales Records, Documents & Roles Implementation Plan

**Generated:** 2026-07-24
**Branch:** `feature/flock-enhancements-sales-roles-docs`
**Status:** Schema changes already applied in `prisma/schema.prisma` (uncommitted). All implementation work is new.

---

## 1. Overview

This plan covers three interrelated features that extend the Nkuku Companion platform beyond the completed mobile parity milestones (M3-1 through M3-6):

| Feature | Description |
|---------|-------------|
| **Sale Records** | Track individual bird sales per flock — customer info, bird count, weight, pricing, payment status. Auto-creates a `FinancialRecord` (category: `sales`) on creation. |
| **Documents** | File upload system for receipts, invoices, quotations, and other attachments linked to flocks and optionally to specific records. |
| **New Roles** | Two new RBAC roles: `flock_minder` (operational read/write) and `sales_person` (sales-focused access). |
| **Flock Collection Dates** | `expectedCollectionStart` / `expectedCollectionEnd` fields on `BroilerFlock` (schema + API already done; web/mobile UI needed). |

### Architecture Summary

```
apps/api/     → 2 new modules (sale-records, documents) + role updates + multipart upload
apps/web/     → 2 new sub-pages (sales, documents) + file-upload component + role updates
apps/mobile/  → 2 new tabs (Sales, Documents) + file_picker dep + role updates
```

---

## 2. Prisma Schema (Already Modified)

The following changes exist in `apps/api/prisma/schema.prisma` (uncommitted):

### New Models

**Document** — file metadata for uploaded attachments
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| flockId | UUID? | Optional flock link |
| recordType | VarChar(50) | e.g. `financial_record`, `sale_record`, `flock` |
| recordId | UUID? | Optional link to a specific record |
| fileName | VarChar(255) | Original filename |
| filePath | VarChar(500) | Server storage path |
| mimeType | VarChar(100) | e.g. `application/pdf` |
| fileSizeKb | Int | |
| category | VarChar(50) | `receipt`, `invoice`, `quotation`, `other` |
| uploadedBy | UUID? | FK → users.id |
| createdAt | Timestamptz | |

**SaleRecord** — individual sales transactions per flock
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| flockId | UUID | Required flock link |
| saleDate | Date | |
| customerName | VarChar(200)? | |
| customerPhone | VarChar(50)? | |
| birdCount | Int | |
| avgWeightKg | Decimal(10,3)? | |
| pricePerBirdZmw | Decimal(14,2) | |
| totalAmountZmw | Decimal(14,2) | Computed: birdCount × pricePerBirdZmw |
| paymentStatus | VarChar(20) | `pending`, `partial`, `paid` (default: `pending`) |
| amountPaidZmw | Decimal(14,2)? | |
| notes | Text? | |
| createdBy | UUID? | FK → users.id |
| createdAt / updatedAt | Timestamptz | |

### Modified Models

**BroilerFlock** — two new optional fields:
- `expectedCollectionStart` (Date?)
- `expectedCollectionEnd` (Date?)

**User** — two new relations:
- `uploadedDocuments` (Document[])
- `createdSaleRecords` (SaleRecord[])

**Role enum** — two new values:
- `flock_minder`
- `sales_person`

---

## 3. Role Permission Matrix

| Capability | owner | manager | flock_minder | sales_person | viewer |
|-----------|-------|---------|-------------|-------------|--------|
| View flocks & all records | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit flocks | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete flocks | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit growth, feed, water, mortality, vaccination, environment, medication records | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete operational records | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit sale records | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete sale records | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete documents | ✅ | ✅ | ✅ | ✅* | ❌ |
| User management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ledger / journal entries | ✅ | ✅ | ❌ | ❌ | ❌ |

\* `sales_person` can delete only documents they uploaded.

---

## 4. Milestone Breakdown

### Milestone FE-1 — API: Sale Records Module
**Effort:** M (2-3 days)

**Files to create:**
- `apps/api/src/modules/sale-records/routes.ts`

**Files to modify:**
- `apps/api/src/main.ts` — register `buildSaleRecordModule` at `/api/v1/sale-records`

**Endpoints:**

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/` | all authenticated | List sales for a flock (`?flockId=...`) |
| GET | `/:id` | all authenticated | Get single sale record |
| GET | `/summary` | all authenticated | Sales summary for a flock (`?flockId=...`) — total birds sold, total revenue, total paid, outstanding |
| POST | `/` | owner, manager, sales_person | Create sale record. Auto-creates `FinancialRecord` (category: `sales`, isIncome: true) |
| PATCH | `/:id` | owner, manager, sales_person | Update sale record. Updates linked `FinancialRecord` if present |
| DELETE | `/:id` | owner | Delete sale record. Deletes linked `FinancialRecord` if present |

**Zod Schemas:**
```typescript
const SaleRecordCreateSchema = z.object({
  flockId: z.string().uuid(),
  saleDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().max(50).optional(),
  birdCount: z.number().int().positive(),
  avgWeightKg: z.number().nonnegative().optional(),
  pricePerBirdZmw: z.number().nonnegative(),
  totalAmountZmw: z.number().nonnegative(),  // validated = birdCount × pricePerBirdZmw
  paymentStatus: z.enum(['pending', 'partial', 'paid']).default('pending'),
  amountPaidZmw: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const SaleRecordUpdateSchema = SaleRecordCreateSchema.partial().omit({ flockId: true });
```

**Implementation notes:**
- Follow `financial-records/routes.ts` pattern: flock ownership check via `createdBy === authUser.userId`
- On POST: create `FinancialRecord` with `category: 'sales'`, `isIncome: true`, `description: 'Sale: {birdCount} birds to {customerName}'`, `amountZmw: totalAmountZmw`. Store the `FinancialRecord.id` in `SaleRecord` notes or a metadata field for linking (or use a `recordId` on Document).
- On PATCH: if `totalAmountZmw` changes, update the linked `FinancialRecord`.
- On DELETE: delete the linked `FinancialRecord` first, then the `SaleRecord`.
- Use `AuditService` for audit logging (same as financial-records).
- Decimal fields: use `decimal.js` (already a dependency) for precision-safe arithmetic.

**Tests:**
- `apps/api/tests/integration/sale-records.test.ts`
  - Create sale → verify FinancialRecord auto-created
  - List sales by flockId
  - Update sale → verify FinancialRecord updated
  - Delete sale → verify FinancialRecord deleted
  - Sales summary aggregation
  - Role check: sales_person can create, viewer cannot
  - Flock ownership check

---

### Milestone FE-2 — API: Documents Module + File Upload
**Effort:** M (2-3 days)

**Dependencies to install:**
- `@fastify/multipart` (file upload handling)

**Files to create:**
- `apps/api/src/modules/documents/routes.ts`
- `apps/api/uploads/` (directory for local file storage, gitignored)

**Files to modify:**
- `apps/api/package.json` — add `@fastify/multipart`
- `apps/api/src/main.ts` — register multipart plugin + `buildDocumentModule` at `/api/v1/documents`
- `apps/api/.gitignore` — add `uploads/`

**Endpoints:**

| Method | Path | Roles | Content-Type | Description |
|--------|------|-------|-------------|-------------|
| GET | `/` | all authenticated | JSON | List documents (`?flockId=...&recordType=...`) |
| GET | `/:id` | all authenticated | JSON | Get document metadata |
| POST | `/` | owner, manager, flock_minder, sales_person | multipart/form-data | Upload file. Fields: `flockId`, `recordType`, `recordId`, `category`, `file` (binary) |
| GET | `/:id/download` | all authenticated | file stream | Download the file |
| DELETE | `/:id` | owner, manager, flock_minder, sales_person* | JSON | Delete document + file. *sales_person can only delete own uploads |

**Multipart registration in main.ts:**
```typescript
import multipart from '@fastify/multipart';
await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
```

**Upload handler pattern:**
```typescript
app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager', 'flock_minder', 'sales_person')] },
  async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'NO_FILE' });

    const fields: Record<string, string> = {};
    const fileBuffer = await data.toBuffer();
    // Parse additional fields from multipart
    // ...extract flockId, recordType, recordId, category from fields...

    // Validate flock ownership
    // Save file to uploads/{flockId}/{uuid}-{filename}
    // Create Document record in DB
    // Return document metadata
  }
);
```

**Storage strategy:**
- Local disk: `apps/api/uploads/{flockId}/{uuid}-{sanitized-filename}`
- File path stored in `Document.filePath` (relative to uploads dir)
- Download endpoint streams file back with correct Content-Type
- 10MB file size limit
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/csv`

**Tests:**
- `apps/api/tests/integration/documents.test.ts`
  - Upload PDF → verify metadata stored, file exists on disk
  - List documents by flockId
  - Download file → verify content
  - Delete document → verify file removed from disk
  - Role check: flock_minder can upload, viewer cannot
  - File size limit enforcement
  - Invalid MIME type rejection

---

### Milestone FE-3 — API: Role Updates & Flock Field Exposures
**Effort:** S (0.5 days)

**Files to modify:**

1. **`apps/api/src/modules/auth/routes.ts`** line 14:
   ```typescript
   // BEFORE
   role: z.enum(['owner', 'manager', 'viewer']),
   // AFTER
   role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']),
   ```

2. **`apps/api/src/modules/users/routes.ts`** lines 10, 18:
   ```typescript
   // UserCreateSchema + UserUpdateSchema
   role: z.enum(['owner', 'manager', 'flock_minder', 'sales_person', 'viewer']),
   ```

3. **`apps/api/src/modules/broiler-flocks/routes.ts`** — already has `expectedCollectionStart` / `expectedCollectionEnd` in Zod schemas. Verify the GET endpoints include these fields in the response (Prisma returns them automatically).

4. **`apps/api/src/db/seeds/main.ts`** — add optional seed users for `flock_minder` and `sales_person` roles (disabled by default, for testing).

**Tests:**
- Update existing auth tests to include new roles in token validation
- Verify `flock_minder` and `sales_person` roles can be assigned via POST/PATCH `/api/v1/users`

---

### Milestone FE-4 — Web: Sales Records Page
**Effort:** M (2 days)

**Files to create:**
- `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx`

**Files to modify:**
- `apps/web/src/components/flock-subnav.tsx` — add `sales` entry with `ShoppingCart` icon
- `apps/web/src/lib/types.ts` — add `SaleRecord` interface + `PaymentStatus` type

**Page structure** (follows `medication/page.tsx` pattern):
```
┌─────────────────────────────────────────────┐
│ FlockSubNav (now includes "Sales")          │
├─────────────────────────────────────────────┤
│ Summary Cards:                              │
│  [Total Birds Sold] [Total Revenue]         │
│  [Total Paid] [Outstanding]                 │
├─────────────────────────────────────────────┤
│ Add Sale Form (if canManageSales):          │
│  Sale Date | Customer Name | Customer Phone │
│  Bird Count | Avg Weight | Price/Bird       │
│  Payment Status | Amount Paid | Notes       │
│  [Save]                                     │
├─────────────────────────────────────────────┤
│ Sales Records Table:                        │
│  Date | Customer | Birds | Weight | Price   │
│  Total | Payment | Actions (edit/delete)    │
└─────────────────────────────────────────────┘
```

**Permission logic:**
```typescript
const canManageSales = user?.role === "owner" || user?.role === "manager" || user?.role === "sales_person";
const canDeleteSales = user?.role === "owner";
```

**Type definitions:**
```typescript
export interface SaleRecord {
  id: string;
  flockId: string;
  saleDate: string;
  customerName: string | null;
  customerPhone: string | null;
  birdCount: number;
  avgWeightKg: number | null;
  pricePerBirdZmw: number;
  totalAmountZmw: number;
  paymentStatus: PaymentStatus;
  amountPaidZmw: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = "pending" | "partial" | "paid";
```

---

### Milestone FE-5 — Web: Documents Page + File Upload Component
**Effort:** M (2-3 days)

**Files to create:**
- `apps/web/src/app/broiler-flocks/[id]/documents/page.tsx`
- `apps/web/src/components/ui/file-upload.tsx` — reusable file upload component

**Files to modify:**
- `apps/web/src/components/flock-subnav.tsx` — add `documents` entry with `FileText` icon
- `apps/web/src/lib/types.ts` — add `Document` interface
- `apps/web/src/lib/api/client.ts` — add `apiUpload()` function for multipart/form-data

**File Upload Component (`file-upload.tsx`):**
```
┌───────────────────────────────────┐
│  [Drop zone / Click to upload]    │
│  Accepts: PDF, JPG, PNG, DOCX     │
│  Max size: 10MB                   │
├───────────────────────────────────┤
│  Category: [Receipt ▼]            │
│  [Upload]                         │
└───────────────────────────────────┘
```

- Simple HTML `<input type="file">` styled with shadcn/ui (no extra dependency needed)
- Shows file name, size, and upload progress
- Category dropdown: Receipt, Invoice, Quotation, Other

**API client extension:**
```typescript
export async function apiUpload(
  path: string,
  formData: FormData,
): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Note: do NOT set Content-Type — browser sets it with boundary
  const res = await fetch(API_URL + path, { method: "POST", headers, body: formData });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
```

**Documents page structure:**
```
┌─────────────────────────────────────────────┐
│ FlockSubNav (now includes "Documents")      │
├─────────────────────────────────────────────┤
│ Upload Form (if canManageDocuments):        │
│  [File Upload Component]                    │
│  Category: [Receipt ▼]  Record Type: [▼]    │
│  [Upload]                                   │
├─────────────────────────────────────────────┤
│ Documents List (grouped by category):       │
│  📄 receipt-invoice.pdf  245KB  2024-01-15  │
│     [Download] [Delete]                     │
│  📄 quotation-feed.pdf   120KB  2024-01-10  │
│     [Download] [Delete]                     │
└─────────────────────────────────────────────┘
```

**Type definitions:**
```typescript
export interface DocumentRecord {
  id: string;
  flockId: string | null;
  recordType: string;
  recordId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeKb: number;
  category: string;
  uploadedBy: string | null;
  createdAt: string;
}
```

---

### Milestone FE-6 — Web: Role Updates & Flock Collection Dates
**Effort:** S (1 day)

**Files to modify:**

1. **`apps/web/src/lib/types.ts`** line 5:
   ```typescript
   role: "owner" | "manager" | "flock_minder" | "sales_person" | "viewer";
   ```
   Also add `expectedCollectionStart` and `expectedCollectionEnd` to `BroilerFlock` interface.

2. **`apps/web/src/app/users/page.tsx`:**
   - Add `flock_minder` and `sales_person` to the role select options
   - Update role badge colors (flock_minder=amber, sales_person=purple)
   - Update the `User` interface used in this page

3. **`apps/web/src/app/broiler-flocks/page.tsx`** (flock create/edit form):
   - Add `expectedCollectionStart` and `expectedCollectionEnd` date inputs

4. **`apps/web/src/app/broiler-flocks/[id]/page.tsx`** (flock detail overview):
   - Display expected collection date range in the overview tab

5. **Permission checks** — update `canCreateEdit` in relevant pages:
   - Operational record pages (growth, feed, water, etc.): `owner | manager | flock_minder`
   - Sales page: `owner | manager | sales_person`
   - Document upload: `owner | manager | flock_minder | sales_person`

---

### Milestone FE-7 — Mobile: Sales Records Tab
**Effort:** M (2 days)

**Files to create:**
- `apps/mobile/lib/models/sale_record.dart`
- `apps/mobile/lib/screens/broiler/records/sale_record_form.dart`

**Files to modify:**
- `apps/mobile/lib/services/broiler_service.dart` — add sale record CRUD methods
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` — add "Sales" tab (index 11)

**Model (`sale_record.dart`):**
```dart
class SaleRecord {
  final String id;
  final String flockId;
  final DateTime saleDate;
  final String? customerName;
  final String? customerPhone;
  final int birdCount;
  final double? avgWeightKg;
  final double pricePerBirdZmw;
  final double totalAmountZmw;
  final String paymentStatus; // pending | partial | paid
  final double? amountPaidZmw;
  final String? notes;
  // fromJson, toJson, copyWith
}
```

**Form screen** — follows `financial_record_form.dart` pattern:
- Date picker (sale date)
- Customer name + phone (optional)
- Bird count (number input, required)
- Avg weight kg (number input, optional)
- Price per bird ZMW (number input, required)
- Total amount auto-calculated display (birdCount × pricePerBird)
- Payment status dropdown
- Amount paid (number input, shown if status = partial)
- Notes (multiline)
- Role guard: `AuthService.canManageSales` (new getter)

**Flock detail screen changes:**
- `TabController(length: 12)` → `TabController(length: 13)`
- Add Tab: `Tab(icon: Icon(Icons.point_of_sale), text: 'Sales')`
- Add `_buildSalesTab()` — summary cards + list of sale records
- Add case in `_onAddRecord()` → navigate to `SaleRecordForm`
- Add sales loading in `_loadData()`
- FAB visible on sales tab if `AuthService.canManageSales`

---

### Milestone FE-8 — Mobile: Documents Tab + File Picker
**Effort:** M (2 days)

**Dependencies to add:**
- `file_picker: ^8.1.0` (file selection from device)

**Files to create:**
- `apps/mobile/lib/models/document.dart`
- `apps/mobile/lib/screens/broiler/records/document_form.dart`

**Files to modify:**
- `apps/mobile/pubspec.yaml` — add `file_picker` dependency
- `apps/mobile/lib/services/broiler_service.dart` — add document CRUD + upload methods
- `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` — add "Documents" tab (index 12)

**Model (`document.dart`):**
```dart
class DocumentRecord {
  final String id;
  final String? flockId;
  final String recordType;
  final String? recordId;
  final String fileName;
  final String filePath;
  final String mimeType;
  final int fileSizeKb;
  final String category;
  final String? uploadedBy;
  final DateTime createdAt;
  // fromJson, toJson
}
```

**Service methods:**
```dart
static Future<List<DocumentRecord>> getDocuments(String flockId) async { ... }
static Future<DocumentRecord> uploadDocument({
  required String flockId,
  required String filePath,
  required String category,
  String? recordType,
  String? recordId,
}) async {
  final formData = FormData.fromMap({
    'flockId': flockId,
    'category': category,
    if (recordType != null) 'recordType': recordType,
    if (recordId != null) 'recordId': recordId,
    'file': await MultipartFile.fromFile(filePath),
  });
  final res = await ApiService.dio.post('/api/v1/documents', data: formData);
  _assertOk(res);
  return DocumentRecord.fromJson(res.data);
}
static Future<void> deleteDocument(String id) async { ... }
```

**Form screen** — file picker + category dropdown:
- `FilePicker.platform.pickFiles()` to select file
- Show selected file name + size
- Category dropdown: Receipt, Invoice, Quotation, Other
- Upload button with progress indicator
- Role guard: `AuthService.canManageDocuments` (new getter)

**Flock detail screen changes:**
- `TabController(length: 13)` → `TabController(length: 14)`
- Add Tab: `Tab(icon: Icon(Icons.attach_file), text: 'Docs')`
- Add `_buildDocumentsTab()` — list of documents with download/delete actions
- Add case in `_onAddRecord()` → navigate to `DocumentForm`
- Add document loading in `_loadData()`
- FAB visible on documents tab if `AuthService.canManageDocuments`
- Document download: use `url_launcher` (already a dependency) to open download URL

---

### Milestone FE-9 — Mobile: Role Updates & Flock Collection Dates
**Effort:** S (0.5 days)

**Files to modify:**

1. **`apps/mobile/lib/services/auth_service.dart`** — add new role getters:
   ```dart
   static bool get isFlockMinder => role == 'flock_minder';
   static bool get isSalesPerson => role == 'sales_person';
   static bool get canManageSales => isOwner || isManager || isSalesPerson;
   static bool get canManageDocuments => isOwner || isManager || isFlockMinder || isSalesPerson;
   static bool get canManageFlockOps => isOwner || isManager || isFlockMinder;
   // Update canEdit to include flock_minder for operational records
   ```

2. **`apps/mobile/lib/screens/users_screen.dart`** — add new roles to the dropdown:
   - Add `flock_minder` (Flock Minder) and `sales_person` (Sales Person) options
   - Update role color mapping: flock_minder=amber, sales_person=purple

3. **`apps/mobile/lib/screens/broiler/flock_form_screen.dart`** — add expected collection date range pickers

4. **`apps/mobile/lib/screens/broiler/flock_detail_screen.dart`** — display expected collection dates in overview

5. **`apps/mobile/lib/screens/settings_screen.dart`** — update role display to show new role names

---

### Milestone FE-10 — Integration Testing & Polish
**Effort:** S (1 day)

**Tasks:**
1. `docker compose up --build -d` — full rebuild with new schema
2. `docker compose exec api npx prisma db push` — apply schema changes
3. `docker compose exec api npx prisma generate` — regenerate Prisma client
4. Run API tests: `docker compose exec api pnpm run test`
5. Run web build: `cd apps/web && pnpm build`
6. Run mobile analyze + test: `cd apps/mobile && flutter analyze && flutter test`
7. Run mobile web build: `cd apps/mobile && flutter build web`
8. Role smoke test:
   - Create `flock_minder` user → login → verify can create growth records, cannot create sales
   - Create `sales_person` user → login → verify can create sales, cannot create growth records
   - Verify viewer remains read-only
9. File upload smoke test: upload a PDF via web, verify it appears, download it, delete it
10. Verify auto-FinancialRecord creation on sale creation

---

## 5. Execution Order & Dependencies

```
FE-3 (API roles) ──┐
                   ├──→ FE-1 (API sales) ──→ FE-4 (web sales) ──→ FE-7 (mobile sales) ──┐
                   │                                                                       │
                   └──→ FE-2 (API docs)  ──→ FE-5 (web docs)  ──→ FE-8 (mobile docs)  ──┤
                                                                                          │
FE-6 (web roles + dates) ───────────────────────────────────────────────────────────────→ FE-10 (integration)
                                                                                          │
FE-9 (mobile roles + dates) ────────────────────────────────────────────────────────────→ FE-10
```

**Recommended parallel tracks:**
- **Track A (API):** FE-3 → FE-1 → FE-2 (sequential, FE-3 unblocks both FE-1 and FE-2)
- **Track B (Web):** FE-4 + FE-5 (after FE-1 + FE-2 API endpoints exist) → FE-6
- **Track C (Mobile):** FE-7 + FE-8 (after API endpoints exist) → FE-9

---

## 6. New Dependencies

| Package | Location | Version | Purpose |
|---------|----------|---------|---------|
| `@fastify/multipart` | apps/api | ^8.0.0 | File upload handling |
| `file_picker` | apps/mobile | ^8.1.0 | Native file picker for mobile uploads |

No new web dependencies needed — file upload uses native HTML `<input type="file">`.

---

## 7. Files Summary

### New Files (14)

| File | Milestone |
|------|-----------|
| `apps/api/src/modules/sale-records/routes.ts` | FE-1 |
| `apps/api/src/modules/documents/routes.ts` | FE-2 |
| `apps/api/tests/integration/sale-records.test.ts` | FE-1 |
| `apps/api/tests/integration/documents.test.ts` | FE-2 |
| `apps/web/src/app/broiler-flocks/[id]/sales/page.tsx` | FE-4 |
| `apps/web/src/app/broiler-flocks/[id]/documents/page.tsx` | FE-5 |
| `apps/web/src/components/ui/file-upload.tsx` | FE-5 |
| `apps/mobile/lib/models/sale_record.dart` | FE-7 |
| `apps/mobile/lib/models/document.dart` | FE-8 |
| `apps/mobile/lib/screens/broiler/records/sale_record_form.dart` | FE-7 |
| `apps/mobile/lib/screens/broiler/records/document_form.dart` | FE-8 |

### Modified Files (16)

| File | Milestone | Changes |
|------|-----------|---------|
| `apps/api/prisma/schema.prisma` | (already done) | Document, SaleRecord, new roles, flock dates |
| `apps/api/package.json` | FE-2 | Add `@fastify/multipart` |
| `apps/api/src/main.ts` | FE-1, FE-2 | Register multipart + 2 new modules |
| `apps/api/src/modules/auth/routes.ts` | FE-3 | Add new roles to Zod schema |
| `apps/api/src/modules/users/routes.ts` | FE-3 | Add new roles to Zod schemas |
| `apps/api/src/db/seeds/main.ts` | FE-3 | Optional seed users for new roles |
| `apps/api/.gitignore` | FE-2 | Add `uploads/` |
| `apps/web/src/lib/types.ts` | FE-4, FE-5, FE-6 | SaleRecord, Document, role types, flock fields |
| `apps/web/src/lib/api/client.ts` | FE-5 | Add `apiUpload()` for multipart |
| `apps/web/src/components/flock-subnav.tsx` | FE-4, FE-5 | Add Sales + Documents nav entries |
| `apps/web/src/app/users/page.tsx` | FE-6 | New role options + badges |
| `apps/web/src/app/broiler-flocks/page.tsx` | FE-6 | Collection date fields in form |
| `apps/web/src/app/broiler-flocks/[id]/page.tsx` | FE-6 | Display collection dates in overview |
| `apps/mobile/lib/services/auth_service.dart` | FE-9 | New role getters + permission methods |
| `apps/mobile/lib/services/broiler_service.dart` | FE-7, FE-8 | Sale record + document service methods |
| `apps/mobile/lib/screens/broiler/flock_detail_screen.dart` | FE-7, FE-8 | Add Sales + Documents tabs |
| `apps/mobile/lib/screens/broiler/flock_form_screen.dart` | FE-9 | Collection date pickers |
| `apps/mobile/lib/screens/users_screen.dart` | FE-9 | New role dropdown options + colors |
| `apps/mobile/lib/screens/settings_screen.dart` | FE-9 | Role display update |
| `apps/mobile/pubspec.yaml` | FE-8 | Add `file_picker` dependency |

---

## 8. Rollback Strategy

- **API:** Revert `schema.prisma`, `main.ts`, and new module files. Run `prisma db push` to drop new tables.
- **Web:** Revert new pages and component files. Revert `types.ts` and `flock-subnav.tsx` changes.
- **Mobile:** Revert new model/form files. Revert `flock_detail_screen.dart` tab count. Remove `file_picker` from `pubspec.yaml`.
- **Uploaded files:** `uploads/` directory is gitignored and can be safely deleted.

---

## 9. Decisions Made

| Question | Decision |
|----------|----------|
| File storage | Local disk (`apps/api/uploads/`). Simple, no cloud dependency. Can migrate to S3 later. |
| File size limit | 10MB |
| Allowed file types | PDF, JPEG, PNG, WebP, DOCX, CSV |
| Sale-FinancialRecord linking | Auto-create FinancialRecord on sale POST. Store link via a `saleRecordId` field added to FinancialRecord notes or a metadata column. Delete FinancialRecord when sale is deleted. |
| sales_person document delete | Can only delete own uploads (checked via `uploadedBy === authUser.userId`) |
| File picker (mobile) | `file_picker` package (supports both iOS and Android, multiple file types) |
| Web file upload UI | Native HTML `<input type="file">` styled with shadcn/ui — no extra dependency |
| Sub-page vs tab (web) | Sub-pages via `FlockSubNav` (consistent with tasks/environment/medication/calendar) |
| Sub-page vs tab (mobile) | Tabs in `FlockDetailScreen` (consistent with existing 11-tab structure) |

---

*Generated by Devin — implementation plan based on full inspection of `apps/api`, `apps/web`, and `apps/mobile` codebases.*
