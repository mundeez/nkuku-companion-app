// ── PLATFORM COMMS LOG ───────────────────────────────────
// One row per attempted outbound platform message (P3, super-admin
// console). Every channel funnels through logComms(): 'email' today —
// written by email.service's deliver() — 'sms' and 'push' are reserved
// for the Kannel path and FCM.
//
// The Prisma handle is injected once at boot (initComms in main.ts) so
// low-level services (email, future SMS) stay importable without
// constructing a second client. Logging must NEVER break a send:
// failures are caught and logged to stderr.
//
// Rows outlive tenants: organizationId/userId/sentByStaffId are SetNull
// FKs, same audit-survival rule as platform_audit_events.

import type { PrismaClient } from '@prisma/client';

export type CommsChannel = 'email' | 'sms' | 'push';
export type CommsStatus = 'sent' | 'failed' | 'bounced';

export interface CommsLogInput {
  channel: CommsChannel;
  toAddr: string;
  subject?: string | null;
  /** Rendered message body — stored so console resend can re-deliver verbatim. */
  body?: string | null;
  /** Template name the caller used, e.g. 'verify_email', 'ticket_reply'. */
  template?: string | null;
  providerRef?: string | null;
  status: CommsStatus;
  error?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  sentByStaffId?: string | null;
  resendOfId?: string | null;
}

/**
 * Optional context threaded through send*Email calls so the comms row can
 * be attributed to a tenant/user/staff actor when resolvable. All fields
 * optional — callers pass what they have, nothing more.
 */
export interface CommsCtx {
  organizationId?: string | null;
  userId?: string | null;
  sentByStaffId?: string | null;
  resendOfId?: string | null;
}

let prismaClient: PrismaClient | null = null;

/** Wire the shared PrismaClient. Called once from main.ts at boot. */
export function initComms(prisma: PrismaClient): void {
  prismaClient = prisma;
}

/**
 * Append a comms-log row. Never throws — a dropped log row is preferable
 * to a failed delivery, and the failure itself is observable in logs.
 */
export async function logComms(input: CommsLogInput): Promise<void> {
  if (!prismaClient) return;
  try {
    await prismaClient.commsLog.create({
      data: {
        channel: input.channel.slice(0, 10),
        toAddr: input.toAddr.slice(0, 320),
        subject: input.subject?.slice(0, 300) ?? null,
        body: input.body ?? null,
        template: input.template?.slice(0, 60) ?? null,
        providerRef: input.providerRef?.slice(0, 200) ?? null,
        status: input.status.slice(0, 12),
        error: input.error ?? null,
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        sentByStaffId: input.sentByStaffId ?? null,
        resendOfId: input.resendOfId ?? null,
      },
    });
  } catch (err: any) {
    console.error(`[CommsLog] Failed to write ${input.channel} row: ${err?.message}`);
  }
}
