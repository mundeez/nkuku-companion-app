import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { AuditService } from '../../core/financial-engine/audit.service.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
];

const DocumentQuerySchema = z.object({
  flockId: z.string().uuid().optional(),
  recordType: z.string().max(50).optional(),
});

const DocumentIdSchema = z.object({
  id: z.string().uuid(),
});

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function buildDocumentModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const audit = new AuditService(prisma);

  // GET / — list documents (optionally filtered by flockId / recordType)
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { flockId, recordType } = DocumentQuerySchema.parse(request.query);
    const authUser = (request as any).authUser;

    if (flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: flockId, createdBy: authUser.userId },
      });
      if (!flock) return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const where: any = {};
    if (flockId) where.flockId = flockId;
    if (recordType) where.recordType = recordType;

    return prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  });

  // GET /:id — document metadata
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (doc.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: doc.flockId, createdBy: authUser.userId },
      });
      if (!flock) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    return doc;
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

    const flockId = fields.flockId;
    if (!flockId || !z.string().uuid().safeParse(flockId).success) {
      return reply.status(400).send({ error: 'INVALID_FLOCK_ID' });
    }

    const category = fields.category;
    if (!category || !['receipt', 'invoice', 'quotation', 'other'].includes(category)) {
      return reply.status(400).send({ error: 'INVALID_CATEGORY' });
    }

    const recordType = fields.recordType || 'flock';
    const recordId = fields.recordId || null;

    // Flock ownership check
    const flock = await prisma.broilerFlock.findFirst({
      where: { id: flockId, createdBy: authUser.userId },
    });
    if (!flock) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const originalFilename = filePart.filename as string;
    const sanitized = sanitizeFilename(originalFilename);
    const uuid = crypto.randomUUID();
    const relativePath = path.join(flockId, `${uuid}-${sanitized}`);
    const fullPath = path.join(UPLOAD_DIR, relativePath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, fileBuffer);

    const created = await prisma.document.create({
      data: {
        flockId,
        recordType,
        recordId: recordId ?? null,
        fileName: originalFilename,
        filePath: relativePath,
        mimeType,
        fileSizeKb: Math.ceil(fileBuffer.length / 1024),
        category,
        uploadedBy: authUser.userId,
      },
    });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: created.id,
      action: 'create',
      newState: { ...created, filePath: undefined },
      ipAddress: request.ip,
    });

    // Exclude filePath from response; return download URL instead
    const { filePath, ...safe } = created;
    return { ...safe, downloadUrl: `/api/v1/documents/${created.id}/download` };
  });

  // GET /:id/download — stream file back to client (download mode)
  app.get('/:id/download', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (doc.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: doc.flockId, createdBy: authUser.userId },
      });
      if (!flock) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    const fullPath = path.resolve(UPLOAD_DIR, doc.filePath);
    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
    }

    const buffer = fs.readFileSync(fullPath);
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

    if (doc.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: doc.flockId, createdBy: authUser.userId },
      });
      if (!flock) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    const fullPath = path.resolve(UPLOAD_DIR, doc.filePath);
    if (!fs.existsSync(fullPath)) {
      return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
    }

    const buffer = fs.readFileSync(fullPath);
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

    if (doc.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: doc.flockId, createdBy: authUser.userId },
      });
      if (!flock) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    // Non-owner roles may only delete documents they uploaded
    if (authUser.role !== 'owner' && doc.uploadedBy !== authUser.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    // Remove file from disk (ignore errors if already gone)
    const fullPath = path.resolve(UPLOAD_DIR, doc.filePath);
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // file may already be removed — ignore
    }

    await prisma.document.delete({ where: { id } });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: id,
      action: 'delete',
      previousState: { ...doc, filePath: undefined },
      ipAddress: request.ip,
    });

    return { deleted: true };
  });

  // PATCH /:id — update document metadata (category, recordType)
  app.patch('/:id', { preHandler: [authenticate, requireRole('owner', 'manager', 'flock_minder', 'sales_person')] }, async (request, reply) => {
    const { id } = DocumentIdSchema.parse(request.params);
    const authUser = (request as any).authUser;
    const body = z.object({
      category: z.enum(['receipt', 'invoice', 'quotation', 'other']).optional(),
      recordType: z.string().max(50).optional(),
    }).parse(request.body);

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    if (doc.flockId) {
      const flock = await prisma.broilerFlock.findFirst({
        where: { id: doc.flockId, createdBy: authUser.userId },
      });
      if (!flock) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
    }

    // Non-owner roles may only edit documents they uploaded
    if (authUser.role !== 'owner' && doc.uploadedBy !== authUser.userId) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    const updateData: any = {};
    if (body.category !== undefined) updateData.category = body.category;
    if (body.recordType !== undefined) updateData.recordType = body.recordType;

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    await audit.log({
      userId: authUser.userId,
      entityType: 'Document',
      entityId: id,
      action: 'update',
      previousState: { ...doc, filePath: undefined },
      newState: { ...updated, filePath: undefined },
      ipAddress: request.ip,
    });

    const { filePath, ...safe } = updated;
    return { ...safe, downloadUrl: `/api/v1/documents/${updated.id}/download` };
  });
}
