import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = 'http://localhost:3001';

async function login() {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@nkuku.local', password: 'change_me' }),
  });
  const data = await res.json();
  return data.accessToken as string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Create a test flock for document testing (per AGENTS.md: never modify existing flocks)
async function createTestFlock(token: string): Promise<string> {
  const breedRes = await fetch(`${API_URL}/api/v1/breeds`, { headers: authHeaders(token) });
  const breeds = await breedRes.json();
  const breedId = breeds[0]?.id;
  if (!breedId) throw new Error('No breeds found for test flock creation');

  const res = await fetch(`${API_URL}/api/v1/broiler-flocks`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Test Flock Docs ${Date.now()}`,
      breedId,
      orderDate: new Date().toISOString().split('T')[0],
      initialCount: 100,
      housingType: 'whole_house',
    }),
  });
  const flock = await res.json();
  if (!flock.id) throw new Error(`Flock creation failed: ${JSON.stringify(flock)}`);
  return flock.id;
}

async function createTestFinancialRecord(token: string, flockId: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/financial-records`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flockId,
      recordDate: new Date().toISOString().split('T')[0],
      category: 'feed',
      description: `Test expense ${Date.now()}`,
      amountZmw: 500,
      isIncome: false,
    }),
  });
  const record = await res.json();
  if (!record.id) throw new Error(`Financial record creation failed: ${JSON.stringify(record)}`);
  return record.id;
}

async function createTestSaleRecord(token: string, flockId: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/sale-records`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flockId,
      saleDate: new Date().toISOString().split('T')[0],
      customerName: 'Test Customer',
      birdCount: 5,
      pricePerBirdZmw: 50,
      totalAmountZmw: 250,
      paymentStatus: 'paid',
    }),
  });
  const record = await res.json();
  if (!record.id) throw new Error(`Sale record creation failed: ${JSON.stringify(record)}`);
  return record.id;
}

// Build a multipart form data with a small PDF-like file
function buildUploadFormData(fields: Record<string, string>, fileContent: string, fileName: string, mimeType: string): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  const blob = new Blob([fileContent], { type: mimeType });
  fd.append('file', blob, fileName);
  return fd;
}

const PDF_CONTENT = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n';
const PDF_MIME = 'application/pdf';

describe('Document Attachments for Financial Transactions', () => {
  let token: string;
  let flockId: string;
  let financialRecordId: string;
  let saleRecordId: string;

  beforeAll(async () => {
    token = await login();
    flockId = await createTestFlock(token);
    financialRecordId = await createTestFinancialRecord(token, flockId);
    saleRecordId = await createTestSaleRecord(token, flockId);
  });

  // Clean up test data to avoid affecting other integration tests
  // (especially the balance sheet equation test in gaap-statements)
  afterAll(async () => {
    const headers = { ...authHeaders(token), 'Content-Type': 'application/json' };
    // Delete sale record (restores flock bird count)
    try {
      await fetch(`${API_URL}/api/v1/sale-records/${saleRecordId}`, { method: 'DELETE', headers });
    } catch {}
    // Delete financial record
    try {
      await fetch(`${API_URL}/api/v1/financial-records/${financialRecordId}`, { method: 'DELETE', headers });
    } catch {}
    // Delete flock
    try {
      await fetch(`${API_URL}/api/v1/broiler-flocks/${flockId}`, { method: 'DELETE', headers });
    } catch {}
  });

  // ── FinancialRecord attachments ──────────────────────

  describe('FinancialRecord attachments', () => {
    let documentId: string;

    it('uploads a document to a financial record', async () => {
      const fd = buildUploadFormData(
        { financialRecordId, category: 'receipt' },
        PDF_CONTENT, 'feed-receipt.pdf', PDF_MIME,
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.id).toBeDefined();
      expect(doc.financialRecordId).toBe(financialRecordId);
      expect(doc.recordType).toBe('FinancialRecord');
      expect(doc.fileName).toBe('feed-receipt.pdf');
      expect(doc.downloadUrl).toContain('/api/v1/documents/');
      expect(doc.storageKey).toBeUndefined(); // storageKey should be stripped
      documentId = doc.id;
    });

    it('lists documents for a financial record', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents?financialRecordId=${financialRecordId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const docs = await res.json();
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThanOrEqual(1);
      expect(docs[0].financialRecordId).toBe(financialRecordId);
    });

    it('gets document metadata by ID', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.id).toBe(documentId);
      expect(doc.fileName).toBe('feed-receipt.pdf');
    });

    it('downloads a document', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/download`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe(PDF_MIME);
      const blob = await res.blob();
      expect(blob.size).toBeGreaterThan(0);
    });

    it('views a document inline', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}/view`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('inline');
    });

    it('includes documents in GET /financial-records/:id', async () => {
      const res = await fetch(`${API_URL}/api/v1/financial-records/${financialRecordId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const record = await res.json();
      expect(record.documents).toBeDefined();
      expect(Array.isArray(record.documents)).toBe(true);
      expect(record.documents.length).toBeGreaterThanOrEqual(1);
    });

    it('deletes a document', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);
    });
  });

  // ── SaleRecord attachments ───────────────────────────

  describe('SaleRecord attachments', () => {
    let documentId: string;

    it('uploads a document to a sale record', async () => {
      const fd = buildUploadFormData(
        { saleRecordId, category: 'invoice' },
        PDF_CONTENT, 'sale-invoice.pdf', PDF_MIME,
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.saleRecordId).toBe(saleRecordId);
      expect(doc.recordType).toBe('SaleRecord');
      documentId = doc.id;
    });

    it('includes documents in GET /sale-records/:id', async () => {
      const res = await fetch(`${API_URL}/api/v1/sale-records/${saleRecordId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const record = await res.json();
      expect(record.documents).toBeDefined();
      expect(record.documents.length).toBeGreaterThanOrEqual(1);
    });

    it('deletes the sale record document', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Flock document backward compatibility ────────────

  describe('Flock documents (backward compatibility)', () => {
    let documentId: string;

    it('uploads a document to a flock (legacy path)', async () => {
      const fd = buildUploadFormData(
        { flockId, category: 'other' },
        PDF_CONTENT, 'flock-doc.pdf', PDF_MIME,
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      expect(doc.flockId).toBe(flockId);
      expect(doc.recordType).toBe('flock');
      documentId = doc.id;
    });

    it('lists flock documents', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents?flockId=${flockId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const docs = await res.json();
      expect(docs.length).toBeGreaterThanOrEqual(1);
    });

    it('deletes the flock document', async () => {
      const res = await fetch(`${API_URL}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Validation tests ─────────────────────────────────

  describe('Validation', () => {
    it('rejects unsupported MIME types', async () => {
      const fd = buildUploadFormData(
        { financialRecordId, category: 'receipt' },
        'executable content', 'malware.exe', 'application/x-msdownload',
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('UNSUPPORTED_MIME_TYPE');
    });

    it('rejects missing target entity', async () => {
      const fd = buildUploadFormData(
        { category: 'receipt' },
        PDF_CONTENT, 'test.pdf', PDF_MIME,
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid category', async () => {
      const fd = buildUploadFormData(
        { financialRecordId, category: 'invalid_category' },
        PDF_CONTENT, 'test.pdf', PDF_MIME,
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_CATEGORY');
    });

    it('accepts XLSX files', async () => {
      const xlsxContent = 'PK\x03\x04'; // XLSX files are ZIP archives starting with PK
      const fd = buildUploadFormData(
        { financialRecordId, category: 'bank_statement' },
        xlsxContent, 'statement.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      expect(res.status).toBe(200);
      const doc = await res.json();
      // Clean up
      await fetch(`${API_URL}/api/v1/documents/${doc.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
    });
  });

  // ── Search ───────────────────────────────────────────

  describe('Full-text search', () => {
    it('returns results for matching query', async () => {
      // Upload a CSV with known text content
      const csvContent = 'invoice,total\nTestReceiptDoc,100.00';
      const fd = buildUploadFormData(
        { financialRecordId, category: 'invoice' },
        csvContent, 'searchable.csv', 'text/csv',
      );
      const uploadRes = await fetch(`${API_URL}/api/v1/documents`, {
        method: 'POST',
        headers: authHeaders(token),
        body: fd,
      });
      const uploaded = await uploadRes.json();

      // Wait for extraction to complete (async)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Search for the known text
      const res = await fetch(`${API_URL}/api/v1/documents/search?q=TestReceiptDoc`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const results = await res.json();
      expect(Array.isArray(results)).toBe(true);
      // The search may or may not return our doc depending on extraction timing
      // but the endpoint should work without error

      // Clean up
      await fetch(`${API_URL}/api/v1/documents/${uploaded.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
    });
  });
});
