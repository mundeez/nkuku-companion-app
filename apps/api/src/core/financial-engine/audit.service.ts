import type { PrismaClient, AuditAction, Prisma } from '@prisma/client';

export interface AuditEntry {
  organizationId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  periodId?: string;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  constructor(private prisma: PrismaClient) {}

  // If `tx` is provided, the audit row is written within that transaction
  // client, ensuring atomicity with the mutation it audits.
  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        previousState: entry.previousState ?? null,
        newState: entry.newState ?? null,
        ipAddress: entry.ipAddress ?? null,
        periodId: entry.periodId ?? null,
      },
    });
  }

  async query(filters: AuditQuery, organizationId: string) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.startDate || filters.endDate) {
      where.occurredAt = {};
      if (filters.startDate) where.occurredAt.gte = filters.startDate;
      if (filters.endDate) where.occurredAt.lte = filters.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
