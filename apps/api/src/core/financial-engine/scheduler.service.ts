import type { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

export interface ScheduledReportInput {
  name: string;
  reportType: string;
  frequency: string;
  scope: string;
  scopeId?: string;
  recipients: string[];
  format: string;
  isActive?: boolean;
  createdBy: string;
}

export class SchedulerService {
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(private prisma: PrismaClient) {}

  async createSchedule(input: ScheduledReportInput) {
    const nextRun = this.calculateNextRun(input.frequency);
    const report = await this.prisma.scheduledReport.create({
      data: {
        name: input.name,
        reportType: input.reportType as any,
        frequency: input.frequency as any,
        scope: input.scope as any,
        scopeId: input.scopeId ?? null,
        recipients: input.recipients as any,
        format: input.format as any,
        isActive: input.isActive ?? true,
        nextRunAt: nextRun,
        createdBy: input.createdBy,
      },
    });
    return report;
  }

  async updateSchedule(id: string, input: Partial<ScheduledReportInput>) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.reportType !== undefined) data.reportType = input.reportType;
    if (input.frequency !== undefined) {
      data.frequency = input.frequency;
      data.nextRunAt = this.calculateNextRun(input.frequency);
    }
    if (input.scope !== undefined) data.scope = input.scope;
    if (input.scopeId !== undefined) data.scopeId = input.scopeId;
    if (input.recipients !== undefined) data.recipients = input.recipients as any;
    if (input.format !== undefined) data.format = input.format;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.scheduledReport.update({ where: { id }, data });
  }

  async deleteSchedule(id: string) {
    this.stopTask(id);
    await this.prisma.scheduledReport.delete({ where: { id } });
  }

  async listSchedules(userId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      include: { executions: { orderBy: { executedAt: 'desc' }, take: 5 } },
    });
  }

  async getExecutions(scheduledReportId: string) {
    return this.prisma.reportExecution.findMany({
      where: { scheduledReportId },
      orderBy: { executedAt: 'desc' },
    });
  }

  private calculateNextRun(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'quarterly':
        return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 1);
      default:
        return now;
    }
  }

  startCron() {
    // Check every hour for reports that need to run
    cron.schedule('0 * * * *', async () => {
      const now = new Date();
      const due = await this.prisma.scheduledReport.findMany({
        where: { isActive: true, nextRunAt: { lte: now } },
      });
      for (const report of due) {
        await this.executeReport(report.id);
      }
    });
  }

  private async executeReport(scheduledReportId: string) {
    try {
      await this.prisma.reportExecution.create({
        data: {
          scheduledReportId,
          status: 'running',
        },
      });

      // Update next run time
      const report = await this.prisma.scheduledReport.findUnique({
        where: { id: scheduledReportId },
      });
      if (report) {
        await this.prisma.scheduledReport.update({
          where: { id: scheduledReportId },
          data: {
            lastRunAt: new Date(),
            nextRunAt: this.calculateNextRun(report.frequency),
          },
        });
      }

      await this.prisma.reportExecution.create({
        data: {
          scheduledReportId,
          status: 'success',
        },
      });
    } catch (err: any) {
      await this.prisma.reportExecution.create({
        data: {
          scheduledReportId,
          status: 'failed',
          errorMessage: err.message,
        },
      });
    }
  }

  stopTask(id: string) {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }
}
