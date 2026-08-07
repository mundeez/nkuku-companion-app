import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { JournalEngine } from '../../core/double-entry/journal.engine.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';

const JournalLineSchema = z.object({
  accountCode: z.string().min(1).max(10),
  debitZmw: z.number().positive().optional(),
  creditZmw: z.number().positive().optional(),
  description: z.string().max(200).optional(),
  flockId: z.string().uuid().optional(),
});

const ManualEntrySchema = z.object({
  entryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  description: z.string().min(1).max(300),
  reference: z.string().max(100).optional(),
  lines: z.array(JournalLineSchema).min(2),
});

const ListQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceType: z.string().optional(),
  accountCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function buildJournalModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const engine = new JournalEngine(prisma);

  // GET / — list entries (filter by date, sourceType, accountCode)
  app.get('/', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const q = ListQuerySchema.parse(request.query);
    const where: any = { organizationId };
    if (q.fromDate || q.toDate) {
      where.entryDate = {};
      if (q.fromDate) where.entryDate.gte = new Date(q.fromDate);
      if (q.toDate) where.entryDate.lte = new Date(q.toDate);
    }
    if (q.sourceType) where.sourceType = q.sourceType;

    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: q.limit,
      skip: q.offset,
    });

    if (q.accountCode) {
      return entries.filter((e: any) =>
        e.lines.some((l: any) => l.account.code === q.accountCode),
      );
    }

    return entries;
  });

  // GET /:id — single entry with all lines + documents
  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
      include: {
        lines: { include: { account: true } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!entry) return reply.status(404).send({ error: 'JOURNAL_ENTRY_NOT_FOUND' });

    // Strip sensitive fields from documents
    const { documents, ...safe } = entry;
    return {
      ...safe,
      documents: documents.map((doc: any) => {
        const { filePath, storageKey, contentText, ...docSafe } = doc;
        return { ...docSafe, downloadUrl: `/api/v1/documents/${doc.id}/download` };
      }),
    };
  });

  // POST / — post manual entry (owner/manager)
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const data = ManualEntrySchema.parse(request.body);
    const authUser = (request as any).authUser;

    try {
      const id = await engine.post({
        entryDate: new Date(data.entryDate),
        description: data.description,
        reference: data.reference,
        sourceType: 'manual',
        lines: data.lines,
        postedBy: authUser.userId,
        organizationId,
      });
      const entry = await prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: { include: { account: true } } },
      });
      return reply.status(201).send(entry);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /:id/reverse — post reversing entry (owner only)
  app.post('/:id/reverse', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().optional() }).parse(request.body ?? {});
    const authUser = (request as any).authUser;

    const original = await prisma.journalEntry.findFirst({ where: { id, organizationId } });
    if (!original) return reply.status(404).send({ error: 'JOURNAL_ENTRY_NOT_FOUND' });

    try {
      const reversalId = await engine.reverse(id, authUser.userId, reason);
      const entry = await prisma.journalEntry.findUnique({
        where: { id: reversalId },
        include: { lines: { include: { account: true } } },
      });
      return reply.status(201).send(entry);
    } catch (err: any) {
      if (err.message.includes('NOT_FOUND')) {
        return reply.status(404).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message });
    }
  });

  // ── 405 Guards: journal entries are immutable ─────
  // No UPDATE or DELETE allowed — reversal is the only correction mechanism
  app.patch('/:id', { preHandler: [authenticate] }, async (_request, reply) => {
    reply.header('Allow', 'GET, POST');
    return reply.status(405).send({ error: 'METHOD_NOT_ALLOWED', message: 'Journal entries are immutable. Use POST /:id/reverse to correct errors.' });
  });

  app.delete('/:id', { preHandler: [authenticate] }, async (_request, reply) => {
    reply.header('Allow', 'GET, POST');
    return reply.status(405).send({ error: 'METHOD_NOT_ALLOWED', message: 'Journal entries are immutable. Use POST /:id/reverse to correct errors.' });
  });
}
