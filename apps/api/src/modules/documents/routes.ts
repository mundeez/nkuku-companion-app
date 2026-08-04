import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';
import { putObject, getObject, deleteObject, buildStorageKey } from '../../core/storage/storage.service.js';
import { scanBuffer } from '../../core/security/clamav.service.js';
import { extractAndStore } from '../../core/documents/text-extraction.service.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Resolve a legacy file path safely, preventing path traversal.
 * Returns null if the resolved path escapes the UPLOAD_DIR.
 */
function safeResolveLegacyPath(filePath: string): string | null {
  const resolved = path.resolve(UPLOAD_DIR, filePath);
  // Prevent path traversal — resolved path must start with UPLOAD_DIR
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return null;
  }
  return resolved;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const VALID_CATEGORIES = [
  'receipt', 'invoice', 'quotation', 'other',
  'bank_statement', 'contract', 'delivery_note',
];

const DocumentQuerySchema = z.object({
  flockId: z.string().uuid().optional(),
  recordType: z.string().max(50).optional(),
  financialRecordId: z.string().uuid().optional(),
  journalEntryId: z.string().uuid().optional(),
  saleRecordId: z.string().uuid().optional(),
});

const DocumentIdSchema = z.object({
  id: z.string().uuid(),
});

const SearchSchema = z.object({
  q: z.string().min(1).max(200),
  recordType: z.string().max(50).optional(),
  flockId: z.string().uuid().optional(),
  financialRecordId: z.string().uuid().optional(),
  journalEntryId: z.string().uuid().optional(),
  saleRecordId: z.string().uuid().optional(),
});

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getMaxAttachments(): number {
  return parseInt(process.env.MAX_ATTACHMENTS_PER_TX || '20', 10);
}

/**
 * Resolve ownership for a document based on which entity it's attached to.
 * Returns the flockId (if applicable) or null for global entities.
 * Throws an error with a message if ownership check fails.
 */
async function resolveOwnership(
  prisma: any,
  authUser: any,
  opts: {
    flockId?: string;
    financialRecordId?: string;
    journalEntryId?: string;
    saleRecordId?: string;
  },
): Promise<{ flockId: string | null; recordType: string }> {
  // FinancialRecord — flock-scoped
  if (opts.financialRecordId) {
    const record = await prisma.financialRecord.findFirst({
      where: { id: opts.financialRecordId },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      throw new Error('NOT_FOUND');
    }
    return { flockId: record.flockId, recordType: 'FinancialRecord' };
  }

  // SaleRecord — flock-scoped
  if (opts.saleRecordId) {
    const record = await prisma.saleRecord.findFirst({
      where: { id: opts.saleRecordId },
      include: { flock: true },
    });
    if (!record || record.flock.createdBy !== authUser.userId) {
      throw new Error('NOT_FOUND');
    }
    return { flockId: record.flockId, recordType: 'SaleRecord' };
  }

  // JournalEntry — global ledger, owner/manager only
  if (opts.journalEntryId) {
    if (authUser.role !== 'owner' && authUser.role !== 'manager') {
      throw new Error('NOT_FOUND');
    }
    const entry = await prisma.journalEntry.findUnique({
      where: { id: opts.journalEntryId },
    });
    if (!entry) {
      throw new Error('NOT_FOUND');
    }
    return { flockId: null, recordType: 'JournalEntry' };
  }

  // Flock-only document (legacy / general flock docs)
  if (opts.flockId) {
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: opts.flockId, createdBy: authUser.userId },
    });
    if (!flock) {
      throw new Error('NOT_FOUND');
    }
    return { flockId: opts.flockId, recordType: 'flock' };
  }

  throw new Error('NO_TARGET_SPECIFIED');
}

/**
 * Count existing attachments for a target entity.
 */
async function countAttachments(
  prisma: any,
  opts: {
    flockId?: string;
    financialRecordId?: string;
    journalEntryId?: string;
    saleRecordId?: string;
  },
): Promise<number> {
  const where: any = {};
  if (opts.financialRecordId) where.financialRecordId = opts.financialRecordId;
  if (opts.journalEntryId) where.journalEntryId = opts.journalEntryId;
  if (opts.saleRecordId) where.saleRecordId = opts.saleRecordId;
  if (opts.flockId && !opts.financialRecordId && !opts.saleRecordId) {
    where.flockId = opts.flockId;
    where.financialRecordId = null;
    where.saleRecordId = null;
    where.journalEntryId = null;
  }
  return prisma.document.count({ where });
}

/**
 * Check ownership for an existing document (for GET/download/delete).
 * Resolves which entity the doc is linked to and verifies access.
 */
async function checkDocumentOwnership(prisma: any, doc: any, authUser: any): Promise<boolean> {
  // Linked to a FinancialRecord
  if (doc.financialRecordId) {
    const record = await prisma.financialRecord.findFirst({
      where: { id: doc.financialRecordId },
      include: { flock: true },
    });
    return !!record && record.flock.createdBy === authUser.userId;
  }

  // Linked to a SaleRecord
  if (doc.saleRecordId) {
    const record = await prisma.saleRecord.findFirst({
      where: { id: doc.saleRecordId },
      include: { flock: true },
    });
    return !!record && record.flock.createdBy === authUser.userId;
  }

  // Linked to a JournalEntry — owner/manager can access
  if (doc.journalEntryId) {
    return authUser.role === 'owner' || authUser.role === 'manager';
  }

  // Linked to a flock (legacy or general flock doc)
  if (doc.flockId) {
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: doc.flockId, createdBy: authUser.userId },
    });
    return !!flock;
  }

  // No link at all — deny
  return false;
}

export async function buildDocumentModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  // GET / — list documents (optionally filtered)
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const query = DocumentQuerySchema.parse(request.query);
    const authUser = (request as any).authUser;

    // Verify ownership of the target entity
    try {
      await resolveOwnership(prisma, authUser, query);
    } catch (err: any) {
      if (err.message === 'NO_TARGET_SPECIFIED') {
        return reply.status(400).send({ error: 'Must specify at least one filter' });
      }
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const where: any = {};
    if (query.financialRecordId) where.financialRecordId = query.financialRecordId;
    if (query.journalEntryId) where.journalEntryId = query.journalEntryId;
    if (query.saleRecordId) where.saleRecordId = query.saleRecordId;
    if (query.flockId && !query.financialRecordId && !query.saleRecordId) {
      where.flockId = query.flockId;
    }
    if (query.recordType) where.recordType = query.recordType;

    const docs = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Exclude filePath/storageKey from response; return download URL
    return docs.map((doc: any) => {
      const { filePath, storageKey, contentText, ...safe } = doc;
      return { ...safe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
    });
  });

  // GET /search — full-text search across document content
  app.get('/search', { preHandler: [authenticate] }, async (request, reply) => {
    const query = SearchSchema.parse(request.query);
    const authUser = (request as any).authUser;

    // Verify ownership of the target entity (if specified)
    let isGlobalSearch = false;
    try {
      await resolveOwnership(prisma, authUser, query);
    } catch (err: any) {
      if (err.message === 'NO_TARGET_SPECIFIED') {
        // Global search — restrict to documents linked to flocks owned by the user
        isGlobalSearch = true;
      } else {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    // Build the search query using raw SQL for tsvector
    const params: any[] = [query.q];
    let whereClause = 'search_vector @@ websearch_to_tsquery(\'english\', $1)';
    let paramIdx = 2;

    const filters: string[] = [];
    if (query.financialRecordId) {
      params.push(query.financialRecordId);
      filters.push(`financial_record_id = $${paramIdx}::uuid`);
      paramIdx++;
    }
    if (query.journalEntryId) {
      params.push(query.journalEntryId);
      filters.push(`journal_entry_id = $${paramIdx}::uuid`);
      paramIdx++;
    }
    if (query.saleRecordId) {
      params.push(query.saleRecordId);
      filters.push(`sale_record_id = $${paramIdx}::uuid`);
      paramIdx++;
    }
    if (query.flockId && !query.financialRecordId && !query.saleRecordId) {
      params.push(query.flockId);
      filters.push(`flock_id = $${paramIdx}::uuid`);
      paramIdx++;
    }
    if (query.recordType) {
      params.push(query.recordType);
      filters.push(`record_type = $${paramIdx++}`);
    }

    // For global search (no target), restrict to flocks owned by the user
    if (isGlobalSearch) {
      params.push(authUser.userId);
      filters.push(`flock_id IN (SELECT id FROM broiler_flocks WHERE created_by = $${paramIdx}::uuid)`);
      paramIdx++;
    }

    if (filters.length > 0) {
      whereClause += ' AND ' + filters.join(' AND ');
    }

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, file_name, mime_type, file_size_kb, category, record_type,
              flock_id, financial_record_id, journal_entry_id, sale_record_id,
              scan_status, extraction_status, created_at,
              ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
       FROM documents
       WHERE ${whereClause}
       ORDER BY rank DESC
       LIMIT 50`,
      ...params,
    );

    return rows.map((row: any) => ({
      ...row,
      downloadUrl: `/api/v1/documents/${row.id}/download`,
    }));
  });

  // GET /:id — document metadata
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const hasAccess = await checkDocumentOwnership(prisma, doc, authUser);
    if (!hasAccess) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const { filePath, storageKey, contentText, ...safe } = doc;
    return { ...safe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
  });

  // POST / — multipart upload
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager', 'flock_minder', 'sales_person')] }, async (request, reply) => {
    const authUser = (request as any).authUser;

    const parts = request.parts();
    const fields: Record<string, string> = {};
    let filePart: any = null;
    let fileBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        filePart = part;
        fileBuffer = await part.toBuffer();
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!filePart || !fileBuffer) {
      return reply.status(400).send({ error: 'FILE_REQUIRED' });
    }

    const mimeType = filePart.mimetype as string;
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return reply.status(400).send({ error: 'UNSUPPORTED_MIME_TYPE' });
    }

    const category = fields.category;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return reply.status(400).send({ error: 'INVALID_CATEGORY' });
    }

    // Parse target entity IDs
    const targetOpts = {
      flockId: fields.flockId || undefined,
      financialRecordId: fields.financialRecordId || undefined,
      journalEntryId: fields.journalEntryId || undefined,
      saleRecordId: fields.saleRecordId || undefined,
    };

    // Resolve ownership and get flockId + recordType
    let ownership: { flockId: string | null; recordType: string };
    try {
      ownership = await resolveOwnership(prisma, authUser, targetOpts);
    } catch (err: any) {
      if (err.message === 'NO_TARGET_SPECIFIED') {
        return reply.status(400).send({ error: 'Must specify flockId, financialRecordId, journalEntryId, or saleRecordId' });
      }
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Check attachment count limit
    const currentCount = await countAttachments(prisma, targetOpts);
    const maxAttachments = getMaxAttachments();
    if (currentCount >= maxAttachments) {
      return reply.status(429).send({
        error: 'ATTACHMENT_LIMIT_REACHED',
        message: `Maximum ${maxAttachments} attachments per transaction`,
      });
    }

    // Virus scan (synchronous)
    const scanResult = await scanBuffer(fileBuffer);
    if (!scanResult.clean) {
      await audit.log({
        userId: authUser.userId,
        entityType: 'Document',
        entityId: authUser.userId, // no document ID yet; use user ID as entity ref
        action: 'virus_scan_rejected',
        newState: { fileName: filePart.filename, reason: scanResult.reason },
        ipAddress: request.ip,
      });
      return reply.status(422).send({
        error: 'INFECTED_FILE',
        reason: scanResult.reason,
      });
    }

    const originalFilename = filePart.filename as string;
    const sanitized = sanitizeFilename(originalFilename);
    const uuid = crypto.randomUUID();

    // Determine the record ID for the storage key
    const recordId = targetOpts.financialRecordId || targetOpts.journalEntryId ||
      targetOpts.saleRecordId || targetOpts.flockId || uuid;
    const storageKey = buildStorageKey(ownership.recordType, recordId, uuid, sanitized);

    // Upload to MinIO
    try {
      await putObject(storageKey, fileBuffer, mimeType);
    } catch (err: any) {
      app.log.error(`[Documents] S3 upload failed: ${err.message}`);
      return reply.status(500).send({ error: 'UPLOAD_FAILED' });
    }

    // Persist document metadata
    const created = await prisma.document.create({
      data: {
        flockId: ownership.flockId,
        recordType: ownership.recordType,
        recordId: targetOpts.financialRecordId || targetOpts.journalEntryId ||
          targetOpts.saleRecordId || targetOpts.flockId || null,
        financialRecordId: targetOpts.financialRecordId || null,
        journalEntryId: targetOpts.journalEntryId || null,
        saleRecordId: targetOpts.saleRecordId || null,
        fileName: originalFilename,
        filePath: null, // New uploads use storageKey, not local filePath
        storageKey,
        bucket: process.env.S3_BUCKET || 'nkuku-documents',
        mimeType,
        fileSizeKb: Math.ceil(fileBuffer.length / 1024),
        category,
        scanStatus: scanResult.scannerAvailable ? 'clean' : 'skipped',
        scannedAt: new Date(),
        extractionStatus: 'pending',
        uploadedBy: authUser.userId,
      },
    });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: created.id,
      action: 'create',
      newState: { ...created, filePath: undefined, storageKey: undefined, contentText: undefined },
      ipAddress: request.ip,
    });

    // Fire-and-forget text extraction (async, non-blocking)
    setImmediate(() => {
      extractAndStore(prisma, created.id, fileBuffer!, mimeType).catch((err) => {
        app.log.error(`[Documents] Text extraction failed for ${created.id}: ${err.message}`);
      });
    });

    const { filePath, storageKey: _sk, contentText, ...safe } = created;
    return {
      ...safe,
      downloadUrl: `/api/v1/documents/${created.id}/download`,
    };
  });

  // GET /:id/download — stream file back to client (download mode)
  app.get('/:id/download', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const hasAccess = await checkDocumentOwnership(prisma, doc, authUser);
    if (!hasAccess) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    let buffer: Buffer;
    if (doc.storageKey) {
      // New uploads — fetch from MinIO
      try {
        buffer = await getObject(doc.storageKey);
      } catch (err: any) {
        app.log.error(`[Documents] S3 download failed: ${err.message}`);
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }
    } else if (doc.filePath) {
      // Legacy uploads — read from local filesystem (with path traversal protection)
      const fullPath = safeResolveLegacyPath(doc.filePath);
      if (!fullPath || !fs.existsSync(fullPath)) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }
      buffer = fs.readFileSync(fullPath);
    } else {
      return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
    }

    reply.header('Content-Type', doc.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    return reply.send(buffer);
  });

  // GET /:id/view — stream file inline for in-browser viewing (PDFs, images)
  app.get('/:id/view', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const hasAccess = await checkDocumentOwnership(prisma, doc, authUser);
    if (!hasAccess) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    let buffer: Buffer;
    if (doc.storageKey) {
      try {
        buffer = await getObject(doc.storageKey);
      } catch (err: any) {
        app.log.error(`[Documents] S3 view failed: ${err.message}`);
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }
    } else if (doc.filePath) {
      const fullPath = safeResolveLegacyPath(doc.filePath);
      if (!fullPath || !fs.existsSync(fullPath)) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }
      buffer = fs.readFileSync(fullPath);
    } else {
      return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
    }

    reply.header('Content-Type', doc.mimeType);
    reply.header('Content-Disposition', 'inline');
    return reply.send(buffer);
  });

  // DELETE /:id — remove document + file
  app.delete('/:id', { preHandler: [authenticate, requireRole('owner', 'manager', 'flock_minder', 'sales_person')] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const hasAccess = await checkDocumentOwnership(prisma, doc, authUser);
    if (!hasAccess) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Non-owner roles may only delete documents they uploaded
    if (authUser.role !== 'owner' && doc.uploadedBy !== authUser.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    // Remove file from storage
    if (doc.storageKey) {
      await deleteObject(doc.storageKey);
    } else if (doc.filePath) {
      const fullPath = safeResolveLegacyPath(doc.filePath);
      if (fullPath) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // file may already be removed — ignore
        }
      }
    }

    await prisma.document.delete({ where: { id } });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: id,
      action: 'delete',
      previousState: { ...doc, filePath: undefined, storageKey: undefined, contentText: undefined },
      ipAddress: request.ip,
    });

    return { deleted: true };
  });

  // PATCH /:id — update document metadata (category)
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager', 'flock_minder', 'sales_person')] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;
    const body = z.object({
      category: z.enum(['receipt', 'invoice', 'quotation', 'other', 'bank_statement', 'contract', 'delivery_note']).optional(),
    }).parse(request.body);

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const hasAccess = await checkDocumentOwnership(prisma, doc, authUser);
    if (!hasAccess) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    // Non-owner roles may only edit documents they uploaded
    if (authUser.role !== 'owner' && doc.uploadedBy !== authUser.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    const updateData: any = {};
    if (body.category !== undefined) updateData.category = body.category;

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: id,
      action: 'update',
      previousState: { ...doc, filePath: undefined, storageKey: undefined, contentText: undefined },
      newState: { ...updated, filePath: undefined, storageKey: undefined, contentText: undefined },
      ipAddress: request.ip,
    });

    const { filePath, storageKey, contentText, ...safe } = updated;
    return { ...safe, downloadUrl: `/api/v1/documents/${updated.id}/download` };
  });
}
