/**
 * OTP service — generates, stores, verifies, and sends one-time passwords.
 *
 * Codes are 6-digit numeric strings, hashed with SHA-256 before storage so
 * a database compromise doesn't reveal live codes. Each code expires after
 * 5 minutes and can only be used once. Rate limiting is enforced at the
 * route level (max 1 send per 60s per phone number).
 */

import crypto from 'crypto';
import { sendOtpSms, SMS_DISABLED } from './sms.service.js';

const OTP_TTL_MINUTES = 5;
const OTP_LENGTH = 6;

/** Generate a random 6-digit OTP code. */
export function generateOtpCode(): string {
  // Use crypto.randomInt for uniform distribution (no modulo bias)
  const code = crypto.randomInt(0, 999999);
  return code.toString().padStart(OTP_LENGTH, '0');
}

/** Hash an OTP code with SHA-256 for secure storage. */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Create and persist an OTP code for a phone number, then send it via SMS.
 * Returns the OTP code only when SMS_DISABLED=true (for dev/testing).
 */
export async function createAndSendOtp(
  prisma: any,
  phone: string,
  purpose: 'signup' | 'login' | 'new_device',
  userId?: string,
  redis?: any,
): Promise<{ success: boolean; message: string; devCode?: string }> {
  const code = generateOtpCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Persist the hashed code
  const otpRecord = await prisma.otpCode.create({
    data: {
      userId: userId || null,
      phone,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  // In dev mode (SMS_DISABLED), store the code in Redis for the dev endpoint
  if (SMS_DISABLED && redis) {
    await redis.setex(`dev:otp:${phone}:${otpRecord.id}`, OTP_TTL_MINUTES * 60, code);
  }

  // Send via SMS
  const smsResult = await sendOtpSms(phone, code);
  if (!smsResult.success) {
    return { success: false, message: smsResult.message };
  }

  return {
    success: true,
    message: 'OTP sent',
    // In dev mode (SMS_DISABLED), the SMS service logs the code to console.
    // We don't return it in the API response for security — the developer
    // reads it from the server logs or the dev endpoint.
  };
}

/**
 * Verify an OTP code against the most recent unused, non-expired code for
 * the given phone number and purpose. Marks the code as used on success.
 *
 * @returns true if the code is valid, false otherwise.
 */
export async function verifyOtp(
  prisma: any,
  phone: string,
  code: string,
  purpose: string,
): Promise<boolean> {
  const codeHash = hashCode(code);
  const now = new Date();

  // Find the most recent unused, non-expired code for this phone+purpose
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const expectedHash = otpRecord.codeHash;
  const providedHash = codeHash;
  if (expectedHash.length !== providedHash.length) {
    return false;
  }
  let match = true;
  for (let i = 0; i < expectedHash.length; i++) {
    if (expectedHash[i] !== providedHash[i]) {
      match = false;
    }
  }
  if (!match) {
    return false;
  }

  // Mark as used
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { usedAt: now },
  });

  return true;
}

/**
 * Check if an OTP was recently sent for this phone number (within the
 * rate-limit window). Used to prevent OTP flooding.
 */
export async function wasOtpRecentlySent(
  prisma: any,
  phone: string,
  purpose: string,
  withinSeconds = 60,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinSeconds * 1000);
  const recent = await prisma.otpCode.findFirst({
    where: {
      phone,
      purpose,
      createdAt: { gt: cutoff },
    },
  });
  return !!recent;
}

/**
 * Normalize a phone number to E.164 format (no leading +).
 * Accepts inputs like "+260970000000", "260970000000", "0970000000" (with country code).
 * If no country code is provided, defaults to Zambia (260).
 */
export function normalizePhone(input: string, defaultCountryCode = '260'): string {
  let phone = input.trim();
  // Remove leading +
  if (phone.startsWith('+')) phone = phone.slice(1);
  // Remove spaces and dashes
  phone = phone.replace(/[\s-]/g, '');
  // If starts with 00, strip it (international prefix)
  if (phone.startsWith('00')) phone = phone.slice(2);
  // If it starts with 0 and has no country code, prepend default country code
  if (phone.startsWith('0')) {
    phone = defaultCountryCode + phone.slice(1);
  }
  // Validate: should be all digits, 10-15 digits
  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error(`Invalid phone number: ${input}`);
  }
  return phone;
}

/**
 * Mask a phone number for display, e.g. "260970***000".
 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-3);
}
