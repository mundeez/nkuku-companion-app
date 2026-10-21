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

  async runDaily(organizationId: string, _config: RecalculationConfig): Promise<void> {
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // 1. Re-allocate overheads for the current month
    await this.overheads.allocateOverheadForMonth(yearMonth, organizationId);

    // 2. Harvest projection auto-generation DISABLED
    // Projections are no longer auto-created as financial records.
  }

  async runDailyForAllOrganizations(config: RecalculationConfig): Promise<void> {
    const organizations = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const org of organizations) {
      try {
        await this.runDaily(org.id, config);
      } catch (err: any) {
        console.error(`[DailyRecalc] Failed for organization ${org.id}:`, err.message);
      }
    }
  }
}
