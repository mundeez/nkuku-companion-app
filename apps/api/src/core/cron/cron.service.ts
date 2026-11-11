// ── CRON RUN REGISTRY ────────────────────────────────────
// P3 (PLAN-super-admin-console.md §6): every platform cron job is
// registered in main.ts's `cronJobs` registry ({ name, schedule, run,
// maxAgeSec }) and executed through executeCronJob(), which writes a
// cron_runs row ('running' → 'success'/'failed') and pages staff on
// failure. The registry is attached to the Fastify app so the ops
// endpoint (POST /api/v1/platform/ops/cron/:name/run) and the health
// endpoint (freshness via last run + maxAgeSec) share the same list.

import type { PrismaClient } from '@prisma/client';
import { notifyStaff } from '../comms/staff-notify.js';

export interface CronJobDef {
  /** Stable job name — used by /ops/cron/:name/run and cron_runs.name. */
  name: string;
  /** node-cron schedule expression. */
  schedule: string;
  /** Job body. Throw to mark the run failed (and alert staff). */
  run: () => Promise<unknown>;
  /**
   * Freshness budget for the health panel: a successful run older than
   * this many seconds marks the job 'stale' (amber). Daily jobs ≈ 26 h,
   * hourly jobs ≈ 2 h.
   */
  maxAgeSec: number;
}

/** Serialize a job result into a small, JSONB-safe meta blob. */
function resultMeta(result: unknown): any {
  if (result === undefined || result === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(result));
  } catch {
    return { summary: String(result).slice(0, 500) };
  }
}

/**
 * Execute one registry job with CronRun bookkeeping. Never throws —
 * failures are recorded on the row, logged, and reported via notifyStaff
 * (fire-and-forget ntfy → platform-ops topic).
 */
export async function executeCronJob(prisma: PrismaClient, job: CronJobDef): Promise<void> {
  let runId: string | null = null;
  try {
    const rec = await prisma.cronRun.create({
      data: { name: job.name, status: 'running', startedAt: new Date() },
    });
    runId = rec.id;
  } catch (err: any) {
    // A DB outage shouldn't block the job itself; the run just isn't
    // recorded (the job's own logging still fires).
    console.error(`[Cron] Failed to record start of '${job.name}': ${err?.message}`);
  }

  const finish = async (data: any) => {
    if (!runId) return;
    try {
      await prisma.cronRun.update({ where: { id: runId }, data });
    } catch (err: any) {
      console.error(`[Cron] Failed to record finish of '${job.name}': ${err?.message}`);
    }
  };

  try {
    const result = await job.run();
    await finish({ finishedAt: new Date(), status: 'success', meta: resultMeta(result) });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await finish({ finishedAt: new Date(), status: 'failed', error: message.slice(0, 4000) });
    console.error(`[Cron] Job '${job.name}' failed: ${message}`);
    notifyStaff(`Cron job failed: ${job.name}`, message, 4, ['warning', 'cron']);
  }
}
