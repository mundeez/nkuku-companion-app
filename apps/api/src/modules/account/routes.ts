/**
 * Account management module — self-service endpoints for the authenticated
 * user to manage their own account:
 *
 *  - GET    /me              — get current profile + linked accounts
 *  - PATCH  /me              — update name
 *  - POST   /me/phone        — initiate phone linking (sends OTP)
 *  - POST   /me/phone/verify — verify OTP and link phone
 *  - DELETE /me/phone        — unlink phone
 *  - POST   /me/email/verify — send email verification link
 *  - GET    /me/email/verify — verify email from token (query param)
 *  - POST   /me/password     — change password (requires current password)
 *  - POST   /password/reset  — request password reset (public, by email/phone)
 *  - POST   /password/reset/confirm — set new password with reset token
 *  - GET    /me/social       — list linked social accounts
 *  - DELETE /me/social/:provider — unlink a social provider
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createAndSendOtp,
  verifyOtp,
  normalizePhone,
  maskPhone,
} from '../../core/security/otp.service.js';
import { sendVerificationEmail } from '../../core/security/email.service.js';
import { authenticate } from '../auth/routes.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const EMAIL_VERIFICATION_EXPIRES = '30m';
const PASSWORD_RESET_EXPIRES = '30m';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const LinkPhoneSchema = z.object({
  phone: z.string().min(8).max(20),
});

const VerifyPhoneSchema = z.object({
  phone: z.string().min(8).max(20),
  otp: z.string().length(6),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

const RequestPasswordResetSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),
}).refine(
  (data) => data.email || data.phone,
  { message: 'Email or phone is required' },
);

const ConfirmPasswordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

const VerifyEmailQuerySchema = z.object({
  token: z.string().min(1),
});

export async function buildAccountModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const redis = (app as any).redis;

  // ── GET /me — current user profile + linked accounts ──
  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const userId = (request as any).authUser.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
    if (!user) return { error: 'NOT_FOUND' };

    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        providerEmail: true,
        providerName: true,
        createdAt: true,
      },
    });

    return {
      ...user,
      phoneVerified: !!user.phoneVerifiedAt,
      emailVerified: !!user.emailVerifiedAt,
      socialAccounts,
    };
  });

  // ── PATCH /me — update profile ──
  app.patch('/me', { preHandler: [authenticate] }, async (request, _reply) => {
    const userId = (request as any).authUser.userId;
    const data = UpdateProfileSchema.parse(request.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
      select: { id: true, email: true, phone: true, name: true, role: true },
    });
    return updated;
  });

  // ── POST /me/phone — initiate phone linking (sends OTP) ──
  app.post('/me/phone', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const { phone } = LinkPhoneSchema.parse(request.body);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return reply.status(400).send({ error: 'INVALID_PHONE', message: 'Invalid phone number format' });
    }

    // Check if phone is already in use by another user
    const existing = await prisma.user.findUnique({ where: { phone: normalized } });
    if (existing && existing.id !== userId) {
      return reply.status(409).send({ error: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already linked to another account' });
    }

    // Send OTP for phone verification
    const result = await createAndSendOtp(prisma, normalized, 'new_device', userId, redis);
    if (!result.success) {
      return reply.status(429).send({ error: 'RATE_LIMITED', message: result.message });
    }

    return {
      success: true,
      message: `OTP sent to ${maskPhone(normalized)}`,
      maskedPhone: maskPhone(normalized),
    };
  });

  // ── POST /me/phone/verify — verify OTP and link phone ──
  app.post('/me/phone/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const { phone, otp } = VerifyPhoneSchema.parse(request.body);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return reply.status(400).send({ error: 'INVALID_PHONE', message: 'Invalid phone number format' });
    }

    // Verify the OTP
    const valid = await verifyOtp(prisma, normalized, otp, 'new_device');
    if (!valid) {
      return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_OTP', message: 'Invalid or expired OTP code' });
    }

    // Check phone not taken by another user
    const existing = await prisma.user.findUnique({ where: { phone: normalized } });
    if (existing && existing.id !== userId) {
      return reply.status(409).send({ error: 'PHONE_ALREADY_REGISTERED', message: 'This phone number is already linked to another account' });
    }

    // Link the phone
    await prisma.user.update({
      where: { id: userId },
      data: { phone: normalized, phoneVerifiedAt: new Date() },
    });

    return { success: true, message: 'Phone number verified and linked' };
  });

  // ── DELETE /me/phone — unlink phone ──
  app.delete('/me/phone', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (!user.phone) return reply.status(400).send({ error: 'NO_PHONE', message: 'No phone number linked' });

    // Prevent unlinking if user has no email and no social accounts (would lock them out)
    const socialCount = await prisma.socialAccount.count({ where: { userId } });
    if (!user.email && socialCount === 0 && !user.passwordHash) {
      return reply.status(400).send({
        error: 'CANNOT_REMOVE_LAST_IDENTIFIER',
        message: 'You must have at least one way to log in (email, phone, or social account)',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { phone: null, phoneVerifiedAt: null },
    });

    return { success: true, message: 'Phone number unlinked' };
  });

  // ── POST /me/email/verify — send email verification link ──
  app.post('/me/email/verify', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (!user.email) return reply.status(400).send({ error: 'NO_EMAIL', message: 'No email address on account' });
    if (user.emailVerifiedAt) return reply.status(400).send({ error: 'ALREADY_VERIFIED', message: 'Email already verified' });

    // Rate limit: 1 verification email per 60 seconds
    if (redis) {
      const key = `email_verify_rl:${userId}`;
      const exists = await redis.exists(key);
      if (exists) {
        return reply.status(429).send({ error: 'RATE_LIMITED', message: 'Please wait 60 seconds before requesting another verification email' });
      }
      await redis.setex(key, 60, '1');
    }

    const token = jwt.sign(
      { userId, email: user.email, action: 'verify_email' },
      JWT_SECRET,
      { expiresIn: EMAIL_VERIFICATION_EXPIRES },
    );

    const result = await sendVerificationEmail(user.email, token, 'verify_email');
    if (!result.success) {
      return reply.status(500).send({ error: 'EMAIL_SEND_FAILED', message: result.message });
    }

    return {
      success: true,
      message: 'Verification email sent',
      ...(result.devToken ? { devToken: result.devToken, devUrl: result.devUrl } : {}),
    };
  });

  // ── GET /me/email/verify — verify email from token ──
  app.get('/me/email/verify', async (request, reply) => {
    const { token } = VerifyEmailQuerySchema.parse(request.query);

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_TOKEN', message: 'Verification link is invalid or expired' });
    }

    if (decoded.action !== 'verify_email') {
      return reply.status(400).send({ error: 'INVALID_TOKEN', message: 'Invalid token type' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    if (user.email !== decoded.email) {
      return reply.status(400).send({ error: 'EMAIL_MISMATCH', message: 'Email address has changed since this link was issued' });
    }
    if (user.emailVerifiedAt) {
      return { success: true, message: 'Email already verified' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });

    return { success: true, message: 'Email verified successfully' };
  });

  // ── POST /me/password — change password (requires current password) ──
  app.post('/me/password', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Social-only users may not have a password — they can set one
    if (user.passwordHash) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Password updated' };
  });

  // ── POST /password/reset — request password reset (public) ──
  app.post('/password/reset', async (request, reply) => {
    const { email, phone } = RequestPasswordResetSchema.parse(request.body);

    let user: any = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized) {
        user = await prisma.user.findUnique({ where: { phone: normalized } });
      }
    }

    // Don't reveal whether the account exists
    if (!user) {
      return { success: true, message: 'If an account exists with that email/phone, a reset link has been sent' };
    }

    if (!user.email) {
      // Phone-only users can't reset via email — would need OTP flow (future)
      return { success: true, message: 'If an account exists with that email/phone, a reset link has been sent' };
    }

    // Rate limit: 1 reset email per 60 seconds
    if (redis) {
      const key = `pw_reset_rl:${user.id}`;
      const exists = await redis.exists(key);
      if (exists) {
        return reply.status(429).send({ error: 'RATE_LIMITED', message: 'Please wait 60 seconds before requesting another reset' });
      }
      await redis.setex(key, 60, '1');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, action: 'reset_password' },
      JWT_SECRET,
      { expiresIn: PASSWORD_RESET_EXPIRES },
    );

    const result = await sendVerificationEmail(user.email, token, 'reset_password');
    if (!result.success) {
      return reply.status(500).send({ error: 'EMAIL_SEND_FAILED', message: result.message });
    }

    return {
      success: true,
      message: 'If an account exists with that email/phone, a reset link has been sent',
      ...(result.devToken ? { devToken: result.devToken, devUrl: result.devUrl } : {}),
    };
  });

  // ── POST /password/reset/confirm — set new password with reset token ──
  app.post('/password/reset/confirm', async (request, reply) => {
    const { token, newPassword } = ConfirmPasswordResetSchema.parse(request.body);

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return reply.status(400).send({ error: 'INVALID_OR_EXPIRED_TOKEN', message: 'Reset link is invalid or expired' });
    }

    if (decoded.action !== 'reset_password') {
      return reply.status(400).send({ error: 'INVALID_TOKEN', message: 'Invalid token type' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { success: true, message: 'Password reset successfully' };
  });

  // ── GET /me/social — list linked social accounts ──
  app.get('/me/social', { preHandler: [authenticate] }, async (request) => {
    const userId = (request as any).authUser.userId;
    const accounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerName: true,
        createdAt: true,
      },
    });
    return accounts;
  });

  // ── DELETE /me/social/:provider — unlink a social provider ──
  app.delete('/me/social/:provider', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).authUser.userId;
    const { provider } = z.object({
      provider: z.enum(['google', 'facebook', 'apple', 'microsoft']),
    }).parse(request.params);

    const account = await prisma.socialAccount.findFirst({
      where: { userId, provider },
    });
    if (!account) return reply.status(404).send({ error: 'NOT_FOUND', message: 'No linked account for this provider' });

    // Prevent unlinking if it would lock the user out
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const otherSocialCount = await prisma.socialAccount.count({
      where: { userId, NOT: { id: account.id } },
    });
    if (!user!.email && !user!.phone && otherSocialCount === 0 && !user!.passwordHash) {
      return reply.status(400).send({
        error: 'CANNOT_REMOVE_LAST_IDENTIFIER',
        message: 'You must have at least one way to log in (email, phone, or social account)',
      });
    }

    await prisma.socialAccount.delete({ where: { id: account.id } });
    return { success: true, message: `${provider} account unlinked` };
  });
}
