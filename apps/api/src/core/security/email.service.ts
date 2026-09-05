/**
 * Email service — sends transactional emails via nodemailer SMTP.
 *
 * In development, email sending can be disabled (EMAIL_DISABLED=true) — the
 * email content is logged to the server console instead, which is useful
 * for testing. The verification/reset token is also returned for dev use.
 *
 * SMTP is configured via standard env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Nkuku Companion <no-reply@nkuku.app>';
const EMAIL_DISABLED = process.env.EMAIL_DISABLED === 'true';
const TEST_MODE = process.env.TEST_MODE === 'true';
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:30000';

export { EMAIL_DISABLED };

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter && !EMAIL_DISABLED && SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter!;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  /** When EMAIL_DISABLED=true, the token is returned here for dev/testing. */
  devToken?: string;
  devUrl?: string;
}

/**
 * Send a verification or password-reset email.
 * @param to Recipient email
 * @param token The JWT token to embed in the link
 * @param type "verify_email" | "reset_password"
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  type: 'verify_email' | 'reset_password',
): Promise<SendEmailResult> {
  const path = type === 'verify_email' ? '/verify-email' : '/reset-password';
  const url = `${WEB_BASE_URL}${path}?token=${token}`;
  const subject =
    type === 'verify_email'
      ? 'Verify your email — Nkuku Companion'
      : 'Reset your password — Nkuku Companion';
  const html =
    type === 'verify_email'
      ? `<p>Welcome to Nkuku Companion!</p>
         <p>Please verify your email address by clicking the link below:</p>
         <p><a href="${url}">Verify Email</a></p>
         <p>Or copy this link: ${url}</p>
         <p>This link expires in 30 minutes. If you didn't create an account, you can safely ignore this email.</p>
         <p>— Nkuku Companion Team</p>`
      : `<p>You requested a password reset for your Nkuku Companion account.</p>
         <p>Click the link below to set a new password:</p>
         <p><a href="${url}">Reset Password</a></p>
         <p>Or copy this link: ${url}</p>
         <p>This link expires in 30 minutes. If you didn't request a reset, you can safely ignore this email.</p>
         <p>— Nuku Companion Team</p>`;

  if (EMAIL_DISABLED || !SMTP_HOST) {
    const msg = `[EMAIL DISABLED] To: ${to} | Subject: ${subject} | URL: ${url}`;
    console.log(msg);
    return { success: true, message: 'Email logged (EMAIL_DISABLED=true)', devToken: token, devUrl: url };
  }

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    return {
      success: true,
      message: 'Email sent',
      ...(TEST_MODE ? { devToken: token, devUrl: url } : {}),
    };
  } catch (err: any) {
    console.error('Email send failed:', err.message);
    // In TEST_MODE, return the dev token even on SMTP failure so integration
    // tests can complete the verification round-trip without a deliverable
    // recipient address (test fixtures use @example.com which real SMTP
    // servers correctly reject). Production (no TEST_MODE) still fails closed.
    if (TEST_MODE) {
      return {
        success: true,
        message: `Email send failed (test mode): ${err.message}`,
        devToken: token,
        devUrl: url,
      };
    }
    return { success: false, message: `Email send failed: ${err.message}` };
  }
}

/**
 * Send an organization invite email.
 * @param to Recipient email
 * @param inviteUrl The full URL for accepting the invite
 * @param orgName The organization name
 * @param inviterName The name of the person sending the invite
 */
export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string,
): Promise<SendEmailResult> {
  const subject = `You're invited to join ${orgName} on Nkuku Companion`;
  const html = `
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Nkuku Companion.</p>
    <p>Click the link below to accept your invitation and create your account:</p>
    <p><a href="${inviteUrl}">Accept Invitation</a></p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>This invitation expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.</p>
    <p>— Nkuku Companion Team</p>`;

  if (EMAIL_DISABLED || !SMTP_HOST) {
    const msg = `[EMAIL DISABLED] To: ${to} | Subject: ${subject} | URL: ${inviteUrl}`;
    console.log(msg);
    return { success: true, message: 'Email logged (EMAIL_DISABLED=true)', devUrl: inviteUrl };
  }

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
    return {
      success: true,
      message: 'Invite email sent',
      ...(TEST_MODE ? { devUrl: inviteUrl } : {}),
    };
  } catch (err: any) {
    console.error('Invite email send failed:', err.message);
    if (TEST_MODE) {
      return {
        success: true,
        message: `Invite email send failed (test mode): ${err.message}`,
        devUrl: inviteUrl,
      };
    }
    return { success: false, message: `Email send failed: ${err.message}` };
  }
}
