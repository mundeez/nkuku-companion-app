import type { PrismaClient, AuditAction } from '@prisma/client';

export interface AuditEntry {
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

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
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

  async query(filters: AuditQuery, userId: string) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
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
