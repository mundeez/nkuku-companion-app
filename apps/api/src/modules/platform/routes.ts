// ── PLATFORM MODULE (/api/v1/platform) ───────────────────
// Staff-only surface for the super admin console (P1: identity &
// security foundation). Tenant tokens are rejected — staff authenticate
// with a separate JWT audience ('platform') minted by staff-auth.service.
// Tenant ops / impersonation / console actions land in P2/P3.
//
// Every route is behind the IP allowlist onRequest hook (defence in
// depth with the nginx admin host rule). Auth endpoints reuse the
// tenant authRateLimit (per-IP sliding window).

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { authRateLimit } from '../../core/security/rate-limiter.js';
import {
  requireStaff,
  requireReauth,
  signStaffAccessToken,
  signStaffTicket,
  verifyStaffTicket,
  hashPassword,
  verifyPassword,
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpSecret,
  totpKeyuri,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  createStaffSession,
  rotateStaffSession,
  revokeStaffSession,
  revokeAllStaffSessions,
  setStaffCookies,
  clearStaffCookies,
  getClientIp,
  getDeviceLabel,
  STAFF_REFRESH_COOKIE,
  TOTP_ENROLL_TICKET_TTL,
  TOTP_VERIFY_TICKET_TTL,
  BOOTSTRAP_TICKET_TTL,
} from '../../core/staff-auth/staff-auth.service.js';
import { permissionsForRole } from '../../core/staff-auth/permissions.js';
import { writePlatformAudit } from '../../core/staff-auth/audit.service.js';
import { platformIpAllowlist } from '../../core/staff-auth/ip-allowlist.js';
import { sendStaffInviteEmail } from '../../core/security/email.service.js';
import { PLATFORM_CONSOLE_BASE_URL } from '../../core/staff-auth/bootstrap.js';
import { buildPlatformTenantsModule } from './tenants.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const TotpCodeSchema = z.object({
  ticket: z.string().min(1).optional(),
  code: z.string().min(6).max(20), // 6-digit TOTP or XXXX-XXXX recovery code
});

const ReauthSchema = z
  .object({
    password: z.string().min(1).optional(),
    totp: z.string().min(6).max(20).optional(),
  })
  .refine((d) => d.password || d.totp, { message: 'Provide password or totp' });

const BootstrapSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['super_admin', 'support', 'finance', 'content_editor', 'marketing', 'auditor']),
});

const RoleSchema = z.object({
  role: z.enum(['super_admin', 'support', 'finance', 'content_editor', 'marketing', 'auditor']),
});

function publicStaff(s: any) {
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role,
    isActive: s.isActive,
    totpEnrolled: !!s.totpEnabledAt,
    lastLoginAt: s.lastLoginAt,
    createdAt: s.createdAt,
  };
}

/** Extract a step ticket from Bearer header or body field. */
function ticketFrom(request: any, body?: any): string | null {
  const auth = request.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return body?.ticket ?? null;
}

function auditCtx(request: any) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers?.['user-agent'] ?? null,
    requestId: (request as any).id ?? null,
  };
}

export async function buildPlatformModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // IP allowlist applies to every /api/v1/platform/* route.
  app.addHook('onRequest', platformIpAllowlist);

  // ── POST /auth/login ───────────────────────────────────
  // Step 1: email + password. Always returns a ticket — either for TOTP
  // verification (enrolled) or forced TOTP enrolment (first login).
  app.post('/auth/login', { preHandler: [authRateLimit] }, async (request, reply) => {
    let body;
    try {
      body = LoginSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const staff = await prisma.staffUser.findUnique({ where: { email: body.email.toLowerCase() } });
    const passwordOk = staff ? await verifyPassword(body.password, staff.passwordHash) : false;
    if (!staff || !staff.isActive || !staff.passwordHash || !passwordOk) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    if (!staff.totpEnabledAt) {
      return reply.status(200).send({
        requiresTotpEnrollment: true,
        ticket: signStaffTicket(staff.id, 'totp_enroll', TOTP_ENROLL_TICKET_TTL),
      });
    }

    return reply.status(200).send({
      requiresTotp: true,
      ticket: signStaffTicket(staff.id, 'totp_verify', TOTP_VERIFY_TICKET_TTL),
    });
  });

  // ── POST /auth/totp/verify ─────────────────────────────
  // Step 2 (enrolled staff): TOTP code OR a single-use recovery code.
  app.post('/auth/totp/verify', { preHandler: [authRateLimit] }, async (request, reply) => {
    let body;
    try {
      body = TotpCodeSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const ticket = verifyStaffTicket(ticketFrom(request, body), 'totp_verify');
    if (!ticket) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_TICKET' });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: ticket.staffId } });
    if (!staff || !staff.isActive || !staff.totpEnabledAt || !staff.totpSecretEnc) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    let usedRecoveryCode = false;
    const secret = decryptTotpSecret(staff.totpSecretEnc);
    const totpOk = secret ? verifyTotpCode(secret, body.code) : false;

    if (!totpOk) {
      // Try recovery code (single-use, hashed).
      const recovery = await prisma.staffRecoveryCode.findFirst({
        where: { staffUserId: staff.id, codeHash: hashRecoveryCode(body.code), usedAt: null },
      });
      if (!recovery) {
        return reply.status(401).send({ error: 'INVALID_TOTP_CODE' });
      }
      await prisma.staffRecoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() },
      });
      usedRecoveryCode = true;
    }

    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const { refreshToken } = await createStaffSession(prisma, staff.id, {
      deviceLabel: getDeviceLabel(request),
      ip: getClientIp(request),
      userAgent: request.headers['user-agent'],
    });
    // A fresh password+TOTP login counts as a fresh re-auth.
    const accessToken = signStaffAccessToken(staff, Date.now());
    setStaffCookies(reply, accessToken, refreshToken);

    await writePlatformAudit(prisma, {
      actorStaffId: staff.id,
      actorRole: staff.role,
      action: 'auth.login',
      targetType: 'staff_user',
      targetId: staff.id,
      reason: usedRecoveryCode ? 'Recovery code used' : null,
      ...auditCtx(request),
    });

    return reply.status(200).send({
      accessToken,
      refreshToken,
      user: { ...publicStaff(staff), permissions: permissionsForRole(staff.role) },
    });
  });

  // ── POST /auth/totp/enroll ─────────────────────────────
  // First-time TOTP enrolment (only while totpEnabledAt is null).
  // Issues the secret + otpauth URL; confirm via /auth/totp/confirm.
  app.post('/auth/totp/enroll', { preHandler: [authRateLimit] }, async (request, reply) => {
    const ticket = verifyStaffTicket(ticketFrom(request, request.body), 'totp_enroll');
    if (!ticket) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_TICKET' });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: ticket.staffId } });
    if (!staff || !staff.isActive) {
      return reply.status(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    if (staff.totpEnabledAt) {
      return reply.status(400).send({ error: 'TOTP_ALREADY_ENROLLED' });
    }

    const secret = generateTotpSecret();
    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { totpSecretEnc: encryptTotpSecret(secret) },
    });

    const otpauthUrl = totpKeyuri(staff.email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return reply.status(200).send({ secret, otpauthUrl, qrDataUrl });
  });

  // ── POST /auth/totp/confirm ────────────────────────────
  // Confirms enrolment: verifies the first code, enables TOTP, issues
  // recovery codes (shown once) and logs the staff member in.
  app.post('/auth/totp/confirm', { preHandler: [authRateLimit] }, async (request, reply) => {
    let body;
    try {
      body = TotpCodeSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const ticket = verifyStaffTicket(ticketFrom(request, body), 'totp_enroll');
    if (!ticket) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_TICKET' });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: ticket.staffId } });
    if (!staff || !staff.isActive || !staff.totpSecretEnc) {
      return reply.status(400).send({ error: 'NO_PENDING_ENROLLMENT' });
    }
    if (staff.totpEnabledAt) {
      return reply.status(400).send({ error: 'TOTP_ALREADY_ENROLLED' });
    }

    const secret = decryptTotpSecret(staff.totpSecretEnc);
    if (!secret || !verifyTotpCode(secret, body.code)) {
      return reply.status(401).send({ error: 'INVALID_TOTP_CODE' });
    }

    const { plain: recoveryCodes, hashes } = generateRecoveryCodes();
    await prisma.$transaction([
      prisma.staffRecoveryCode.deleteMany({ where: { staffUserId: staff.id } }),
      prisma.staffRecoveryCode.createMany({
        data: hashes.map((codeHash) => ({ staffUserId: staff.id, codeHash })),
      }),
      prisma.staffUser.update({
        where: { id: staff.id },
        data: { totpEnabledAt: new Date(), lastLoginAt: new Date() },
      }),
    ]);

    const { refreshToken } = await createStaffSession(prisma, staff.id, {
      deviceLabel: getDeviceLabel(request),
      ip: getClientIp(request),
      userAgent: request.headers['user-agent'],
    });
    const accessToken = signStaffAccessToken(staff, Date.now());
    setStaffCookies(reply, accessToken, refreshToken);

    await writePlatformAudit(prisma, {
      actorStaffId: staff.id,
      actorRole: staff.role,
      action: 'auth.totp_enrolled',
      targetType: 'staff_user',
      targetId: staff.id,
      after: { totpEnrolled: true },
      ...auditCtx(request),
    });

    return reply.status(200).send({
      accessToken,
      refreshToken,
      recoveryCodes, // shown exactly once — store safely
      user: { ...publicStaff({ ...staff, totpEnabledAt: new Date() }), permissions: permissionsForRole(staff.role) },
    });
  });

  // ── POST /auth/bootstrap ───────────────────────────────
  // Accepts the one-time bootstrap token from a staff invite and sets the
  // initial password. Returns a TOTP enrolment ticket to continue setup.
  app.post('/auth/bootstrap', { preHandler: [authRateLimit] }, async (request, reply) => {
    let body;
    try {
      body = BootstrapSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    const ticket = verifyStaffTicket(body.token, 'staff_bootstrap');
    if (!ticket) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: ticket.staffId } });
    if (!staff || !staff.isActive) {
      return reply.status(401).send({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    }
    // One-time: invited staff have an empty password hash; once a real
    // password is set the bootstrap token becomes useless.
    if (staff.passwordHash) {
      return reply.status(400).send({ error: 'BOOTSTRAP_ALREADY_COMPLETED' });
    }

    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { passwordHash: await hashPassword(body.password) },
    });

    await writePlatformAudit(prisma, {
      actorStaffId: staff.id,
      actorRole: staff.role,
      action: 'auth.bootstrap',
      targetType: 'staff_user',
      targetId: staff.id,
      ...auditCtx(request),
    });

    return reply.status(200).send({
      requiresTotpEnrollment: true,
      ticket: signStaffTicket(staff.id, 'totp_enroll', TOTP_ENROLL_TICKET_TTL),
    });
  });

  // ── POST /auth/refresh ─────────────────────────────────
  app.post('/auth/refresh', async (request, reply) => {
    const bodyToken = (request.body as any)?.refreshToken;
    const cookieToken = (request as any).cookies?.[STAFF_REFRESH_COOKIE];
    const refreshTokenValue = bodyToken || cookieToken;
    if (!refreshTokenValue) {
      return reply.status(400).send({ error: 'MISSING_REFRESH_TOKEN' });
    }

    const rotated = await rotateStaffSession(prisma, refreshTokenValue);
    if (!rotated) {
      return reply.status(401).send({ error: 'INVALID_REFRESH_TOKEN' });
    }

    // Carry a still-fresh reauthAt forward from the outgoing access token
    // so a refresh doesn't wipe a recent re-auth (expired tokens decoded,
    // not verified — we only read the timestamp claim).
    let reauthAt: number | undefined;
    const auth = request.headers.authorization;
    const oldAccess =
      (auth?.startsWith('Bearer ') ? auth.slice(7) : null) ??
      (request as any).cookies?.['nkuku_staff_token'];
    if (oldAccess) {
      const decoded = jwt.decode(oldAccess) as any;
      if (typeof decoded?.reauthAt === 'number') reauthAt = decoded.reauthAt;
    }

    const accessToken = signStaffAccessToken(rotated.staffUser, reauthAt);
    setStaffCookies(reply, accessToken, rotated.refreshToken);
    return { accessToken, refreshToken: rotated.refreshToken };
  });

  // ── POST /auth/logout ──────────────────────────────────
  app.post('/auth/logout', async (request, reply) => {
    const refreshTokenValue =
      (request.body as any)?.refreshToken ?? (request as any).cookies?.[STAFF_REFRESH_COOKIE];
    if (refreshTokenValue) {
      await revokeStaffSession(prisma, refreshTokenValue);
    }
    clearStaffCookies(reply);
    return { success: true };
  });

  // ── GET /auth/me ───────────────────────────────────────
  app.get('/auth/me', { preHandler: [requireStaff()] }, async (request) => {
    const claims = (request as any).staffUser;
    const staff = await prisma.staffUser.findUnique({ where: { id: claims.staffId } });
    if (!staff) return { user: null };
    return {
      user: { ...publicStaff(staff), permissions: permissionsForRole(staff.role) },
      reauthAt: claims.reauthAt ?? null,
    };
  });

  // ── POST /auth/reauth ──────────────────────────────────
  // Re-verify identity (password OR TOTP) and re-mint the access token
  // with reauthAt=now. Required before dangerous actions (plan §3).
  app.post(
    '/auth/reauth',
    { preHandler: [authRateLimit, requireStaff()] },
    async (request, reply) => {
      let body;
      try {
        body = ReauthSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }

      const claims = (request as any).staffUser;
      const staff = await prisma.staffUser.findUnique({ where: { id: claims.staffId } });
      if (!staff || !staff.isActive) {
        return reply.status(401).send({ error: 'ACCOUNT_DISABLED' });
      }

      let verified = false;
      if (body.password) {
        verified = await verifyPassword(body.password, staff.passwordHash);
      } else if (body.totp) {
        const secret = staff.totpSecretEnc ? decryptTotpSecret(staff.totpSecretEnc) : null;
        verified = secret ? verifyTotpCode(secret, body.totp) : false;
      }
      if (!verified) {
        return reply.status(401).send({ error: 'REAUTH_FAILED' });
      }

      const reauthAt = Date.now();
      const accessToken = signStaffAccessToken(staff, reauthAt);
      reply.setCookie('nkuku_staff_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 15 * 60,
      });

      await writePlatformAudit(prisma, {
        actorStaffId: staff.id,
        actorRole: staff.role,
        action: 'auth.reauth',
        targetType: 'staff_user',
        targetId: staff.id,
        ...auditCtx(request),
      });

      return { accessToken, reauthAt };
    },
  );

  // ══════════════════════════════════════════════════════
  // STAFF MANAGEMENT — permission staff.manage (super_admin only per
  // the §3 matrix); mutations additionally require fresh re-auth.
  // ══════════════════════════════════════════════════════

  // ── GET /staff ─────────────────────────────────────────
  app.get('/staff', { preHandler: [requireStaff('staff.manage')] }, async () => {
    const staff = await prisma.staffUser.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return { items: staff.map(publicStaff), count: staff.length };
  });

  // ── POST /staff/invite ─────────────────────────────────
  // Creates a StaffUser with an empty password hash + emails a one-time
  // bootstrap link (accepted via POST /auth/bootstrap).
  app.post(
    '/staff/invite',
    { preHandler: [requireStaff('staff.manage'), requireReauth()] },
    async (request, reply) => {
      let body;
      try {
        body = InviteSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }

      const actor = (request as any).staffUser;
      const email = body.email.toLowerCase();
      const existing = await prisma.staffUser.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'EMAIL_ALREADY_EXISTS' });
      }

      const staff = await prisma.staffUser.create({
        data: {
          email,
          name: body.name,
          passwordHash: '', // set via bootstrap link
          role: body.role,
          createdById: actor.staffId,
        },
      });

      const bootstrapToken = signStaffTicket(staff.id, 'staff_bootstrap', BOOTSTRAP_TICKET_TTL);
      const inviteUrl = `${PLATFORM_CONSOLE_BASE_URL}/set-password?token=${bootstrapToken}`;
      const emailResult = await sendStaffInviteEmail(email, inviteUrl, body.name, actor.email);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'staff.invite',
        targetType: 'staff_user',
        targetId: staff.id,
        after: { email: staff.email, name: staff.name, role: staff.role },
        ...auditCtx(request),
      });

      return reply.status(201).send({
        staff: publicStaff(staff),
        emailSent: emailResult.success,
        // Returned only in dev/test (EMAIL_DISABLED or TEST_MODE).
        devInviteUrl: emailResult.devUrl,
      });
    },
  );

  // ── POST /staff/:id/disable ────────────────────────────
  // Refuses self-disable and disabling the last active super_admin.
  app.post(
    '/staff/:id/disable',
    { preHandler: [requireStaff('staff.manage'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const actor = (request as any).staffUser;

      const target = await prisma.staffUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      if (target.id === actor.staffId) {
        return reply.status(422).send({ error: 'SELF_DISABLE', message: 'You cannot disable your own account' });
      }
      if (target.role === 'super_admin' && target.isActive) {
        const activeSuperAdmins = await prisma.staffUser.count({
          where: { role: 'super_admin', isActive: true },
        });
        if (activeSuperAdmins <= 1) {
          return reply.status(422).send({
            error: 'LAST_SUPER_ADMIN',
            message: 'Cannot disable the last active super_admin',
          });
        }
      }
      if (!target.isActive) {
        return reply.status(422).send({ error: 'ALREADY_DISABLED' });
      }

      const updated = await prisma.staffUser.update({
        where: { id: target.id },
        data: { isActive: false },
      });
      await revokeAllStaffSessions(prisma, target.id);

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'staff.disable',
        targetType: 'staff_user',
        targetId: target.id,
        before: { isActive: target.isActive },
        after: { isActive: updated.isActive },
        ...auditCtx(request),
      });

      return { staff: publicStaff(updated) };
    },
  );

  // ── POST /staff/:id/role ───────────────────────────────
  // Change a staff member's role. Demoting the last active super_admin
  // is refused (same LAST_SUPER_ADMIN guard as disable).
  app.post(
    '/staff/:id/role',
    { preHandler: [requireStaff('staff.manage'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      let body;
      try {
        body = RoleSchema.parse(request.body);
      } catch (err: any) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
      }
      const actor = (request as any).staffUser;

      const target = await prisma.staffUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      if (target.role === 'super_admin' && body.role !== 'super_admin' && target.isActive) {
        const activeSuperAdmins = await prisma.staffUser.count({
          where: { role: 'super_admin', isActive: true },
        });
        if (activeSuperAdmins <= 1) {
          return reply.status(422).send({
            error: 'LAST_SUPER_ADMIN',
            message: 'Cannot demote the last active super_admin',
          });
        }
      }

      const updated = await prisma.staffUser.update({
        where: { id: target.id },
        data: { role: body.role },
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'staff.role_change',
        targetType: 'staff_user',
        targetId: target.id,
        before: { role: target.role },
        after: { role: updated.role },
        ...auditCtx(request),
      });

      return { staff: publicStaff(updated) };
    },
  );

  // ── POST /staff/:id/reset-totp ─────────────────────────
  // Clears TOTP enrolment + recovery codes and revokes sessions so the
  // target re-enrols on next login. If the TARGET is a super_admin, the
  // actor must be a DIFFERENT super_admin (two-person break-glass rule).
  app.post(
    '/staff/:id/reset-totp',
    { preHandler: [requireStaff('staff.manage'), requireReauth()] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const actor = (request as any).staffUser;

      const target = await prisma.staffUser.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      if (target.role === 'super_admin' && target.id === actor.staffId) {
        return reply.status(422).send({
          error: 'SECOND_ADMIN_REQUIRED',
          message: 'Resetting a super_admin TOTP requires a different super_admin',
        });
      }

      const updated = await prisma.$transaction(async (tx: any) => {
        const u = await tx.staffUser.update({
          where: { id: target.id },
          data: { totpSecretEnc: null, totpEnabledAt: null },
        });
        await tx.staffRecoveryCode.deleteMany({ where: { staffUserId: target.id } });
        await tx.staffSession.updateMany({
          where: { staffUserId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return u;
      });

      await writePlatformAudit(prisma, {
        actorStaffId: actor.staffId,
        actorRole: actor.role,
        action: 'staff.totp_reset',
        targetType: 'staff_user',
        targetId: target.id,
        before: { totpEnrolled: !!target.totpEnabledAt },
        after: { totpEnrolled: !!updated.totpEnabledAt },
        ...auditCtx(request),
      });

      return { staff: publicStaff(updated) };
    },
  );

  // ── P2: tenant ops (tenants / impersonation / audit events) ──
  // Registered inside this module's encapsulated scope so the IP allowlist
  // onRequest hook above covers these routes too.
  await app.register(buildPlatformTenantsModule);
}
