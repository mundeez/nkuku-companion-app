import type { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

export interface MonthlyOverheadInput {
  yearMonth: string;
  category: string;
  description?: string;
  amountZmw: number;
  contractType: string;
  createdBy: string;
}

export class OverheadAllocationService {
  constructor(private prisma: PrismaClient) {}

  async createMonthlyOverhead(input: MonthlyOverheadInput) {
    return this.prisma.monthlyOverhead.create({
      data: {
        yearMonth: input.yearMonth,
        category: input.category as any,
        description: input.description ?? null,
        amountZmw: new Decimal(input.amountZmw),
        contractType: input.contractType,
        createdBy: input.createdBy,
      },
    });
  }

  async deleteMonthlyOverhead(id: string, userId: string) {
    const overhead = await this.prisma.monthlyOverhead.findFirst({
      where: { id, createdBy: userId },
    });
    if (!overhead) return null;

    // Clean up any generated financial records for this month
    await this.prisma.financialRecord.deleteMany({
      where: {
        sourceTable: 'overhead_allocations',
        isSystemGenerated: true,
        recordDate: {
          gte: new Date(`${overhead.yearMonth}-01`),
          lt: this.nextMonthFirstDay(overhead.yearMonth),
        },
      },
    });

    await this.prisma.flockOverheadAllocation.deleteMany({
      where: { monthlyOverheadId: id },
    });

    return this.prisma.monthlyOverhead.delete({ where: { id } });
  }

  async listMonthlyOverheads(userId: string) {
    return this.prisma.monthlyOverhead.findMany({
      where: { createdBy: userId },
      orderBy: { yearMonth: 'desc' },
    });
  }

  async allocateOverheadForMonth(yearMonth: string, userId: string) {
    const overheads = await this.prisma.monthlyOverhead.findMany({
      where: { yearMonth, createdBy: userId },
    });

    const results = [];
    for (const overhead of overheads) {
      const result = await this.allocateSingleOverhead(overhead, userId);
      results.push(result);
    }
    return results;
  }

  private async allocateSingleOverhead(overhead: any, userId: string) {
    const [year, month] = overhead.yearMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // last day of month
    const daysInMonth = monthEnd.getDate();

    // Find all flocks that were active during this month
    const flocks = await this.prisma.broilerFlock.findMany({
      where: {
        createdBy: userId,
        startDate: { lte: monthEnd },
        OR: [
          { soldDate: null },
          { soldDate: { gte: monthStart } },
        ],
      },
    });

    if (flocks.length === 0) {
      return { overheadId: overhead.id, allocated: 0, flocks: 0 };
    }

    // Calculate active days for each flock in this month
    let totalActiveDays = 0;
    const flockAllocations = flocks.map((flock) => {
      const start = flock.startDate > monthStart ? flock.startDate : monthStart;
      const end = flock.soldDate && flock.soldDate < monthEnd
        ? flock.soldDate
        : monthEnd;
      const daysActive = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      totalActiveDays += daysActive;
      return { flockId: flock.id, daysActive };
    });

    if (totalActiveDays === 0) {
      return { overheadId: overhead.id, allocated: 0, flocks: 0 };
    }

    // Delete previous allocations for this overhead
    await this.prisma.financialRecord.deleteMany({
      where: {
        sourceTable: 'overhead_allocations',
        isSystemGenerated: true,
        category: overhead.category,
        recordDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    await this.prisma.flockOverheadAllocation.deleteMany({
      where: { monthlyOverheadId: overhead.id },
    });

    const totalAmount = new Decimal(overhead.amountZmw);
    const allocatedRecords = [];

    for (const { flockId, daysActive } of flockAllocations) {
      if (daysActive <= 0) continue;

      const ratio = new Decimal(daysActive).div(totalActiveDays);
      const allocatedAmount = totalAmount.mul(ratio);

      // Create allocation audit record
      await this.prisma.flockOverheadAllocation.create({
        data: {
          monthlyOverheadId: overhead.id,
          flockId,
          allocationDate: monthEnd,
          daysActiveInMonth: daysActive,
          totalActiveFlockDays: totalActiveDays,
          allocatedAmount,
        },
      });

      // Create financial record
      const record = await this.prisma.financialRecord.create({
        data: {
          flockId,
          sourceTable: 'overhead_allocations',
          recordDate: monthEnd,
          category: overhead.category,
          description: `Overhead allocation — ${overhead.description || overhead.category} — ${overhead.yearMonth}`,
          amountZmw: allocatedAmount,
          isIncome: false,
          isSystemGenerated: true,
          notes: `Distributed proportionally: ${daysActive} days / ${totalActiveDays} total days`,
        },
      });
      allocatedRecords.push(record);
    }

    return {
      overheadId: overhead.id,
      allocated: allocatedRecords.length,
      totalActiveDays,
      totalAmount: totalAmount.toNumber(),
    };
  }

  private nextMonthFirstDay(yearMonth: string): Date {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 1);
  }
}
