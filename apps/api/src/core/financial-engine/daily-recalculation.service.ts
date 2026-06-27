import type { PrismaClient } from '@prisma/client';
import { OverheadAllocationService } from './overhead-allocation.service.js';
import { HarvestProjectionService } from './harvest-projection.service.js';

export interface RecalculationConfig {
  marketPricePerKg: number;
}

export class DailyRecalculationService {
  private overheads: OverheadAllocationService;
  private projections: HarvestProjectionService;

  constructor(private prisma: PrismaClient) {
    this.overheads = new OverheadAllocationService(prisma);
    this.projections = new HarvestProjectionService(prisma);
  }

  async runDaily(userId: string, config: RecalculationConfig): Promise<void> {
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // 1. Re-allocate overheads for the current month
    await this.overheads.allocateOverheadForMonth(yearMonth, userId);

    // 2. Refresh harvest projections for active flocks
    await this.projections.refreshProjections({
      marketPricePerKg: config.marketPricePerKg,
      userId,
    });
  }

  async runDailyForAllUsers(config: RecalculationConfig): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.runDaily(user.id, config);
      } catch (err: any) {
        console.error(`[DailyRecalc] Failed for user ${user.id}:`, err.message);
      }
    }
  }
}
