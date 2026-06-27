import type { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

export interface ProjectionInput {
  marketPricePerKg: number;
  userId: string;
}

export class HarvestProjectionService {
  constructor(private prisma: PrismaClient) {}

  async refreshProjections(input: ProjectionInput): Promise<void> {
    const { marketPricePerKg, userId } = input;

    // Delete all existing projections for this user
    await this.prisma.financialRecord.deleteMany({
      where: {
        flock: { createdBy: userId },
        isProjection: true,
        isSystemGenerated: true,
        sourceTable: 'harvest_projections',
      },
    });

    // Find all active flocks for this user
    const activeFlocks = await this.prisma.broilerFlock.findMany({
      where: { createdBy: userId, status: 'active' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const flock of activeFlocks) {
      const currentCount = flock.currentCount ?? 0;
      const targetWeight = Number(flock.targetWeight ?? 2.5);

      if (currentCount <= 0 || targetWeight <= 0) continue;

      const projectedRevenue = new Decimal(currentCount).mul(targetWeight).mul(marketPricePerKg);

      await this.prisma.financialRecord.create({
        data: {
          flockId: flock.id,
          sourceTable: 'harvest_projections',
          recordDate: today,
          category: 'sales',
          description: `Projected harvest revenue — ${flock.name} (${currentCount} birds × ${targetWeight}kg × ZMW ${marketPricePerKg})`,
          amountZmw: projectedRevenue,
          isIncome: true,
          isSystemGenerated: true,
          isProjection: true,
          notes: 'Auto-generated daily harvest projection',
        },
      });
    }
  }

  async getProjections(userId: string) {
    return this.prisma.financialRecord.findMany({
      where: {
        flock: { createdBy: userId },
        isProjection: true,
      },
      include: { flock: { select: { name: true, currentCount: true, targetWeight: true } } },
      orderBy: { recordDate: 'desc' },
    });
  }
}
