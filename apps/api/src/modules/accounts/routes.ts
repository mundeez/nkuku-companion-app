import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';

const AccountCreateSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  parentCode: z.string().max(10).optional(),
  description: z.string().optional(),
});

const AccountUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function buildAccountModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET / — full chart of accounts (hierarchical)
  app.get('/', { preHandler: [authenticate] }, async () => {
    const accounts = await prisma.account.findMany({
      orderBy: { code: 'asc' },
    });
    return accounts;
  });

  // GET /:code — single account + recent journal lines
  app.get('/:code', { preHandler: [authenticate] }, async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const account = await prisma.account.findUnique({ where: { code } });
    if (!account) return reply.status(404).send({ error: 'ACCOUNT_NOT_FOUND' });

    const recentLines = await prisma.journalLine.findMany({
      where: { accountId: account.id },
      include: { journal: true },
      orderBy: { journal: { entryDate: 'desc' } },
      take: 20,
    });

    return { ...account, recentLines };
  });

  // POST / — create custom account (owner/manager)
  app.post('/', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const data = AccountCreateSchema.parse(request.body);

    const existing = await prisma.account.findUnique({ where: { code: data.code } });
    if (existing) return reply.status(409).send({ error: 'ACCOUNT_CODE_ALREADY_EXISTS' });

    const account = await prisma.account.create({
      data: { ...data, isSystem: false },
    });
    return reply.status(201).send(account);
  });

  // PATCH /:code — update name/description (cannot change type of system accounts)
  app.patch('/:code', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const data = AccountUpdateSchema.parse(request.body);

    const account = await prisma.account.findUnique({ where: { code } });
    if (!account) return reply.status(404).send({ error: 'ACCOUNT_NOT_FOUND' });

    const updated = await prisma.account.update({
      where: { code },
      data,
    });
    return updated;
  });

  // DELETE /:code — deactivate (cannot delete if has journal lines or isSystem=true)
  app.delete('/:code', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params);
    const account = await prisma.account.findUnique({ where: { code } });
    if (!account) return reply.status(404).send({ error: 'ACCOUNT_NOT_FOUND' });
    if (account.isSystem) return reply.status(400).send({ error: 'CANNOT_DELETE_SYSTEM_ACCOUNT' });

    const lineCount = await prisma.journalLine.count({ where: { accountId: account.id } });
    if (lineCount > 0) return reply.status(400).send({ error: 'CANNOT_DELETE_ACCOUNT_WITH_JOURNAL_LINES' });

    const updated = await prisma.account.update({
      where: { code },
      data: { isActive: false },
    });
    return { deactivated: true, account: updated };
  });
}
