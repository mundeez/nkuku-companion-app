// ── PLATFORM STAFF BOOTSTRAP ─────────────────────────────
// On API start, if there are zero StaffUser rows, create the initial
// super_admin account (PLATFORM_SUPER_ADMIN_EMAIL, default
// admin@zeendeefood.solutions) with a random one-time password logged
// ONCE to stderr (and mailed when SMTP is configured). totpEnabledAt is
// left null so the first login is forced through TOTP enrolment.
// Idempotent: does nothing once any staff row exists.

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { hashPassword } from './staff-auth.service.js';
import { sendStaffInviteEmail } from '../security/email.service.js';

export const DEFAULT_PLATFORM_ADMIN_EMAIL = 'admin@zeendeefood.solutions';
export const PLATFORM_CONSOLE_BASE_URL =
  process.env.PLATFORM_CONSOLE_BASE_URL || 'https://admin.nkuku.zeendeefood.solutions';

interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export async function bootstrapPlatformStaff(
  prisma: PrismaClient,
  log: Logger = console,
): Promise<void> {
  try {
    const count = await prisma.staffUser.count();
    if (count > 0) return;

    const email = (process.env.PLATFORM_SUPER_ADMIN_EMAIL || DEFAULT_PLATFORM_ADMIN_EMAIL)
      .trim()
      .toLowerCase();

    // One-time bootstrap password — the only copy is printed here (and
    // mailed when SMTP is configured). It is never stored plaintext.
    const oneTimePassword = `${crypto.randomBytes(12).toString('base64url')}Aa1!`;

    const staff = await prisma.staffUser.create({
      data: {
        email,
        name: 'Platform Administrator',
        passwordHash: await hashPassword(oneTimePassword),
        role: 'super_admin',
        totpEnabledAt: null, // forces TOTP enrolment on first login
      },
    });

    // stderr write — intentional one-time credential output, not a leak.
    console.error(
      `[BOOTSTRAP] Created platform super_admin "${email}" (${staff.id}).\n` +
        `[BOOTSTRAP] One-time password: ${oneTimePassword}\n` +
        '[BOOTSTRAP] Change it after first login and complete TOTP enrolment. This is the only time it is shown.',
    );
    log.warn(`[Bootstrap] Platform super_admin created for ${email} — one-time password printed to stderr`);

    // Best-effort email with a link to the console (SMTP may be unset).
    try {
      await sendStaffInviteEmail(
        email,
        `${PLATFORM_CONSOLE_BASE_URL}/login`,
        'Platform Administrator',
        'Nkuku bootstrap',
      );
    } catch {
      /* email is best-effort — password was already logged */
    }
  } catch (err: any) {
    // Never block API startup on bootstrap failure.
    log.error(`[Bootstrap] Platform staff bootstrap failed: ${err?.message}`);
  }
}
