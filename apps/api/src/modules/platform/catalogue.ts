// ── PLATFORM CATALOGUE (/api/v1/platform/catalogue) ──────
// P4: staff-side CRUD over the GLOBAL reference-catalogue tables —
// diseases, breeds, performance-targets, vaccination-schedules, and
// supplier-category-templates. These are shared across all tenants;
// tenant-side write routes on the same entities are locked to staff
// tokens (catalogue.write) and this is the surface the admin console
// actually calls.
//
//   GET    /catalogue/:entity            any staff
//   POST   /catalogue/:entity            catalogue.write
//   PATCH  /catalogue/:entity/:id        catalogue.write
//   DELETE /catalogue/:entity/:id        catalogue.write
//
// :entity ∈ diseases | breeds | performance-targets |
//           vaccination-schedules | supplier-category-templates
//
// Writes are platform-audited (action 'catalogue.<entity>.<verb>').

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireStaff, getClientIp } from '../../core/staff-auth/staff-auth.service.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';

// ── Per-entity config ────────────────────────────────────
// Each entity declares its zod create/update schemas and the prisma
// delegate names so the generic handlers can stay thin.

const DiseaseSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  incubation: z.string().optional(),
  mortalityRate: z.string().optional(),
  symptoms: z.string().optional(),
  prevention: z.string().optional(),
  treatment: z.string().optional(),
  organicTreatments: z.string().optional(),
});

const BreedSchema = z.object({
  name: z.string().min(1).max(100),
  supplier: z.string().min(1).max(100),
  isPrimary: z.boolean().optional(),
});

const PerformanceTargetSchema = z.object({
  breedId: z.string().uuid(),
  ageDays: z.number().int().min(0).max(400),
  targetWeight: z.number().min(0),
  targetFeed: z.number().min(0),
  targetFcr: z.number().min(0),
  targetWater: z.number().min(0).nullable().optional(),
});
const PerformanceTargetPatchSchema = PerformanceTargetSchema.partial();

const ScheduleItemSchema = z.object({
  vaccineName: z.string().min(1).max(100),
  vaccineType: z.string().min(1).max(100),
  ageDays: z.number().int().min(0),
  adminMethod: z.string().min(1).max(50),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
});

const VaccinationScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  breedId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  description: z.string().nullable().optional(),
  // When provided, REPLACES the whole item list (nested write).
  items: z.array(ScheduleItemSchema).optional(),
});
const VaccinationSchedulePatchSchema = VaccinationScheduleSchema.partial();

const TemplateItemSchema = z.object({
  itemName: z.string().min(1).max(50),
  itemType: z.enum(['feed', 'chick', 'medication', 'other']).default('feed'),
  sortOrder: z.number().int().default(0),
  defaultFields: z.record(z.any()).nullable().optional(),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().optional(),
});

const SupplierTemplateSchema = z.object({
  category: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().optional(),
  // When provided, REPLACES the whole item list (nested write).
  items: z.array(TemplateItemSchema).optional(),
});
const SupplierTemplatePatchSchema = SupplierTemplateSchema.omit({ category: true }).partial();

interface EntityDef {
  delegate: string; // prisma delegate property name
  createSchema: z.ZodTypeAny;
  patchSchema: z.ZodTypeAny;
  listInclude?: any;
  auditType: string;
}

const ENTITIES: Record<string, EntityDef> = {
  diseases: {
    delegate: 'disease',
    createSchema: DiseaseSchema,
    patchSchema: DiseaseSchema.partial(),
    auditType: 'disease',
  },
  breeds: {
    delegate: 'breed',
    createSchema: BreedSchema,
    patchSchema: BreedSchema.partial(),
    listInclude: { performanceTargets: { orderBy: { ageDays: 'asc' } } },
    auditType: 'breed',
  },
  'performance-targets': {
    delegate: 'performanceTarget',
    createSchema: PerformanceTargetSchema,
    patchSchema: PerformanceTargetPatchSchema,
    listInclude: { breed: { select: { id: true, name: true } } },
    auditType: 'performance_target',
  },
  'vaccination-schedules': {
    delegate: 'vaccinationSchedule',
    createSchema: VaccinationScheduleSchema,
    patchSchema: VaccinationSchedulePatchSchema,
    listInclude: { items: { orderBy: { sortOrder: 'asc' } } },
    auditType: 'vaccination_schedule',
  },
  'supplier-category-templates': {
    delegate: 'supplierCategoryTemplate',
    createSchema: SupplierTemplateSchema,
    patchSchema: SupplierTemplatePatchSchema,
    listInclude: { items: { orderBy: { sortOrder: 'asc' } } },
    auditType: 'supplier_category_template',
  },
};

function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

export async function buildPlatformCatalogueModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  const ParamsSchema = z.object({ entity: z.string(), id: z.string().uuid().optional() });

  function resolveEntity(request: any, reply: any): { entity: string; def: EntityDef } | null {
    const { entity } = ParamsSchema.parse(request.params);
    const def = ENTITIES[entity];
    if (!def) {
      reply.status(404).send({
        error: 'UNKNOWN_ENTITY',
        message: `Catalogue entity must be one of: ${Object.keys(ENTITIES).join(', ')}`,
      });
      return null;
    }
    return { entity, def };
  }

  /** Split nested `items` out of the payload for schedule/template entities. */
  async function writeWithItems(entity: string, data: any, id?: string) {
    const { items, ...fields } = data;

    if (entity === 'vaccination-schedules') {
      return prisma.$transaction(async (tx: any) => {
        const row = id
          ? await tx.vaccinationSchedule.update({ where: { id }, data: fields })
          : await tx.vaccinationSchedule.create({ data: fields });
        if (items !== undefined) {
          await tx.vaccinationScheduleItem.deleteMany({ where: { scheduleId: row.id } });
          if (items.length) {
            await tx.vaccinationScheduleItem.createMany({
              data: items.map((it: any) => ({ ...it, scheduleId: row.id })),
            });
          }
        }
        return tx.vaccinationSchedule.findUnique({
          where: { id: row.id },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    }

    if (entity === 'supplier-category-templates') {
      return prisma.$transaction(async (tx: any) => {
        const row = id
          ? await tx.supplierCategoryTemplate.update({ where: { id }, data: fields })
          : await tx.supplierCategoryTemplate.create({ data: fields });
        if (items !== undefined) {
          await tx.supplierCategoryTemplateItem.deleteMany({ where: { templateId: row.id } });
          if (items.length) {
            await tx.supplierCategoryTemplateItem.createMany({
              data: items.map((it: any) => ({ ...it, templateId: row.id })),
            });
          }
        }
        return tx.supplierCategoryTemplate.findUnique({
          where: { id: row.id },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    }

    const delegate = (prisma as any)[ENTITIES[entity].delegate];
    return id
      ? delegate.update({ where: { id }, data: fields })
      : delegate.create({ data: fields });
  }

  // ── GET /catalogue/:entity ──
  app.get('/catalogue/:entity', { preHandler: [requireStaff()] }, async (request, reply) => {
    const resolved = resolveEntity(request, reply);
    if (!resolved) return;
    const { entity, def } = resolved;
    const rows = await (prisma as any)[def.delegate].findMany({
      include: def.listInclude,
      orderBy: entity === 'performance-targets' ? [{ breedId: 'asc' }, { ageDays: 'asc' }] : { name: 'asc' },
    });
    return { items: rows, count: rows.length };
  });

  // ── POST /catalogue/:entity ──
  app.post('/catalogue/:entity', { preHandler: [requireStaff('catalogue.write')] }, async (request, reply) => {
    const resolved = resolveEntity(request, reply);
    if (!resolved) return;
    const { entity, def } = resolved;

    let body;
    try {
      body = def.createSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    let row;
    try {
      row = await writeWithItems(entity, body);
    } catch (err: any) {
      // Unique violations (duplicate disease name, breed name, (breedId,
      // ageDays) pair, schedule name, template category) → 409.
      if (err?.code === 'P2002') return reply.status(409).send({ error: 'ALREADY_EXISTS' });
      throw err;
    }

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: `catalogue.${def.auditType}.create`,
      targetType: def.auditType,
      targetId: row.id,
      after: row,
      ...auditCtx(request),
    });
    return reply.status(201).send({ item: row });
  });

  // ── PATCH /catalogue/:entity/:id ──
  app.patch('/catalogue/:entity/:id', { preHandler: [requireStaff('catalogue.write')] }, async (request, reply) => {
    const resolved = resolveEntity(request, reply);
    if (!resolved) return;
    const { entity, def } = resolved;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    let body;
    try {
      body = def.patchSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const existing = await (prisma as any)[def.delegate].findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });

    let row;
    try {
      row = await writeWithItems(entity, body, id);
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.status(409).send({ error: 'ALREADY_EXISTS' });
      if (err?.code === 'P2025') return reply.status(404).send({ error: 'NOT_FOUND' });
      throw err;
    }

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: `catalogue.${def.auditType}.update`,
      targetType: def.auditType,
      targetId: id,
      before: existing,
      after: row,
      ...auditCtx(request),
    });
    return { item: row };
  });

  // ── DELETE /catalogue/:entity/:id ──
  app.delete('/catalogue/:entity/:id', { preHandler: [requireStaff('catalogue.write')] }, async (request, reply) => {
    const resolved = resolveEntity(request, reply);
    if (!resolved) return;
    const { def } = resolved;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const existing = await (prisma as any)[def.delegate].findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' });
    await (prisma as any)[def.delegate].delete({ where: { id } });

    const actor = (request as any).staffUser;
    await writePlatformAudit(prisma, {
      actorStaffId: actor.staffId,
      actorRole: actor.role,
      action: `catalogue.${def.auditType}.delete`,
      targetType: def.auditType,
      targetId: id,
      before: existing,
      ...auditCtx(request),
    });
    return { deleted: true, id };
  });
}
