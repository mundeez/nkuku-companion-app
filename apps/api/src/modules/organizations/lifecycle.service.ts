// ── TENANT LIFECYCLE: EXPORT + SOFT-DELETE + PURGE ─────
// P-6: DPA data-portability (export) and right-to-erasure (delete → purge).
// Export produces a gzip'd JSON document of every org-scoped table.
// Delete is a soft-delete: the org is deactivated immediately and a daily
// cron permanently removes all rows (and S3 objects) once purgeAfter passes.

import { gzipSync } from 'node:zlib';
import type { PrismaClient } from '@prisma/client';
import { deleteObject } from '../../core/storage/storage.service.js';

const PURGE_DELAY_DAYS = 30;

// Direct org-scoped models (organizationId column).
const ORG_MODELS = [
  'supplier',
  'productionCycle',
  'batch',
  'broilerFlock',
  'feedPurchase',
  'lightingTemperatureSchedule',
  'auditLog',
  'monthlyOverhead',
  'journalEntry',
  'ledgerBalance',
  'document',
  'saleRecord',
  'adEvent',
  'subscription',
  'invoice',
  'organizationMember',
  'invite',
] as const;

// Flock-child models — scoped transitively via flockId.
const FLOCK_CHILD_MODELS = [
  'growthRecord',
  'feedRecord',
  'waterRecord',
  'mortalityEvent',
  'vaccinationEvent',
  'medicationRecord',
  'environmentalRecord',
  'financialRecord',
  'flockTask',
  'flockOverheadAllocation',
  'alert',
] as const;

export async function exportOrganization(prisma: PrismaClient, organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw Object.assign(new Error('ORG_NOT_FOUND'), { statusCode: 404 });

  const tables: Record<string, unknown[]> = {};
  for (const model of ORG_MODELS) {
    tables[model] = await (prisma as any)[model].findMany({ where: { organizationId } });
  }

  const flocks = tables.broilerFlock as { id: string }[];
  const flockIds = flocks.map((f) => f.id);
  for (const model of FLOCK_CHILD_MODELS) {
    tables[model] = await (prisma as any)[model].findMany({ where: { flockId: { in: flockIds } } });
  }

  const entries = tables.journalEntry as { id: string }[];
  tables.journalLine = await prisma.journalLine.findMany({
    where: { journalId: { in: entries.map((e) => e.id) } },
  });

  const schedules = tables.lightingTemperatureSchedule as { id: string }[];
  tables.lightingTemperatureScheduleItem = await prisma.lightingTemperatureScheduleItem.findMany({
    where: { scheduleId: { in: schedules.map((s) => s.id) } },
  });

  // Member accounts: identity fields only — no password hashes or tokens.
  const members = tables.organizationMember as { userId: string }[];
  tables.user = await prisma.user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, email: true, phone: true, name: true, role: true, createdAt: true },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    organization: org,
    tables,
  };
  const filename = `nkuku-export-${org.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json.gz`;
  return { buffer: gzipSync(JSON.stringify(payload, null, 2)), filename };
}

export async function requestDeletion(prisma: PrismaClient, organizationId: string) {
  const purgeAfter = new Date(Date.now() + PURGE_DELAY_DAYS * 24 * 60 * 60 * 1000);
  return prisma.organization.update({
    where: { id: organizationId },
    data: { deletedAt: new Date(), purgeAfter, isActive: false },
  });
}

// ── PURGE (daily cron) ────────────────────────────────
// Journal tables are protected by immutability RULEs — disable the delete
// rules, remove the rows, re-enable. Requires the DB user to own the tables.
export async function purgeExpiredOrganizations(prisma: PrismaClient): Promise<{ purged: string[] }> {
  const due = await prisma.organization.findMany({
    where: { purgeAfter: { lte: new Date() } },
    select: { id: true, name: true },
  });
  const purged: string[] = [];

  for (const org of due) {
    try {
      // S3 objects first — collect keys before the DB rows disappear.
      const docs = await prisma.document.findMany({
        where: { organizationId: org.id },
        select: { storageKey: true },
      });
      for (const d of docs) {
        if (d.storageKey) {
          try { await deleteObject(d.storageKey); } catch { /* S3 cleanup is best-effort */ }
        }
      }

      const flockIds = (await prisma.broilerFlock.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      })).map((f) => f.id);

      await prisma.$executeRawUnsafe('ALTER TABLE "journal_lines" DISABLE RULE "no_delete_journal_lines"');
      await prisma.$executeRawUnsafe('ALTER TABLE "journal_entries" DISABLE RULE "no_delete_journal_entries"');
      try {
        await prisma.journalLine.deleteMany({ where: { journal: { organizationId: org.id } } });
        await prisma.journalEntry.deleteMany({ where: { organizationId: org.id } });
      } finally {
        await prisma.$executeRawUnsafe('ALTER TABLE "journal_lines" ENABLE RULE "no_delete_journal_lines"');
        await prisma.$executeRawUnsafe('ALTER TABLE "journal_entries" ENABLE RULE "no_delete_journal_entries"');
      }

      // Explicit flock-child deletes keep this immune to schema drift even
      // though flock→child FKs are onDelete: Cascade.
      for (const model of FLOCK_CHILD_MODELS) {
        await (prisma as any)[model].deleteMany({ where: { flockId: { in: flockIds } } });
      }
      await prisma.journalLine.deleteMany({ where: { flockId: { in: flockIds } } });

      // Direct org-scoped rows (Restrict FKs — must precede org delete).
      for (const model of ORG_MODELS) {
        if (model === 'broilerFlock' || model === 'organizationMember') continue;
        await (prisma as any)[model].deleteMany({ where: { organizationId: org.id } });
      }
      await prisma.broilerFlock.deleteMany({ where: { organizationId: org.id } });

      // Deactivate member users with no remaining memberships.
      const memberUserIds = (await prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        select: { userId: true },
      })).map((m) => m.userId);
      await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });
      for (const userId of memberUserIds) {
        const remaining = await prisma.organizationMember.count({ where: { userId } });
        if (remaining === 0) {
          await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
        }
      }

      await prisma.organization.delete({ where: { id: org.id } });
      purged.push(org.name);
    } catch (err) {
      // Leave the org queued — next run retries. Surface loudly via throw
      // so the caller's error logging captures which org failed.
      throw Object.assign(new Error(`PURGE_FAILED:${org.name}:${(err as Error).message}`), { cause: err });
      }
  }
  return { purged };
}
