/**
 * Email service — sends transactional emails via nodemailer SMTP.
 *
 * In development, email sending can be disabled (EMAIL_DISABLED=true) — the
 * email content is logged to the server console instead, which is useful
 * for testing. The verification/reset token is also returned for dev use.
 *
 * SMTP is configured via standard env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Every exported send*Email funnels through deliver() (P3), which writes a
 * comms_log row for EVERY attempt — including EMAIL_DISABLED runs (status
 * 'sent', providerRef null, i.e. "accepted/logged"). Callers may pass a
 * trailing `ctx` ({ organizationId, userId, sentByStaffId }) so the log
 * row is attributable; signatures stay backward compatible (ctx optional).
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { logComms, type CommsCtx } from '../comms/comms.service.js';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Nkuku Companion <no-reply@nkuku.app>';
const EMAIL_DISABLED = process.env.EMAIL_DISABLED === 'true';
const TEST_MODE = process.env.TEST_MODE === 'true';
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:30000';

export { EMAIL_DISABLED };
export type { CommsCtx } from '../comms/comms.service.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
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

/** Escape user-controlled text interpolated into an HTML body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface DeliverOptions {
  to: string;
  subject: string;
  html: string;
  /** Template name recorded on the comms row (e.g. 'verify_email'). */
  template: string;
  ctx?: CommsCtx | null;
  /** Result returned when email is disabled/not configured (logged instead). */
  disabledResult: () => SendEmailResult;
  /** Result returned on successful SMTP send (TEST_MODE extras belong here). */
  sentResult?: () => SendEmailResult;
  /** Optional TEST_MODE rescue: returned instead of failure on SMTP error. */
  testModeRescue?: (err: any) => SendEmailResult;
}

/**
 * Single delivery path for every outbound email. Writes the comms_log row
 * for all three outcomes: disabled/logged → 'sent', SMTP ok → 'sent' (with
 * provider message id), SMTP error → 'failed'.
 */
async function deliver(opts: DeliverOptions): Promise<SendEmailResult> {
  const { to, subject, html, template, ctx } = opts;
  const logBase = {
    channel: 'email' as const,
    toAddr: to,
    subject,
    body: html,
    template,
    organizationId: ctx?.organizationId ?? null,
    userId: ctx?.userId ?? null,
    sentByStaffId: ctx?.sentByStaffId ?? null,
    resendOfId: ctx?.resendOfId ?? null,
  };

  if (EMAIL_DISABLED || !SMTP_HOST) {
    console.log(`[EMAIL DISABLED] To: ${to} | Subject: ${subject}`);
    await logComms({ ...logBase, status: 'sent' });
    return opts.disabledResult();
  }

  try {
    const t = getTransporter();
    const info: any = await t.sendMail({ from: SMTP_FROM, to, subject, html });
    await logComms({
      ...logBase,
      status: 'sent',
      providerRef: info?.messageId != null ? String(info.messageId).slice(0, 200) : null,
    });
    return opts.sentResult ? opts.sentResult() : { success: true, message: 'Email sent' };
  } catch (err: any) {
    console.error(`Email send failed (${template}):`, err.message);
    await logComms({ ...logBase, status: 'failed', error: `Email send failed: ${err.message}` });
    if (TEST_MODE && opts.testModeRescue) {
      return opts.testModeRescue(err);
    }
    return { success: false, message: `Email send failed: ${err.message}` };
  }
}

/**
 * Re-deliver a previously logged email verbatim (platform comms resend).
 * `ctx.resendOfId` links the new comms row to the original.
 */
export async function deliverEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { template?: string | null; ctx?: CommsCtx },
): Promise<SendEmailResult> {
  return deliver({
    to,
    subject,
    html,
    template: opts?.template ?? 'resend',
    ctx: opts?.ctx,
    disabledResult: () => ({ success: true, message: 'Email logged (EMAIL_DISABLED=true)' }),
  });
}

/**
 * Send a verification or password-reset email.
 * @param to Recipient email
 * @param token The JWT token to embed in the link
 * @param type "verify_email" | "reset_password"
 * @param ctx Optional comms attribution (org/user/staff) for the log row
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  type: 'verify_email' | 'reset_password',
  ctx?: CommsCtx,
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

  return deliver({
    to,
    subject,
    html,
    template: type, // 'verify_email' | 'reset_password'
    ctx,
    disabledResult: () => ({
      success: true,
      message: 'Email logged (EMAIL_DISABLED=true)',
      devToken: token,
      devUrl: url,
    }),
    sentResult: () => ({
      success: true,
      message: 'Email sent',
      ...(TEST_MODE ? { devToken: token, devUrl: url } : {}),
    }),
    // In TEST_MODE, return the dev token even on SMTP failure so integration
    // tests can complete the verification round-trip without a deliverable
    // recipient address (test fixtures use @example.com which real SMTP
    // servers correctly reject). Production (no TEST_MODE) still fails closed.
    testModeRescue: (err) => ({
      success: true,
      message: `Email send failed (test mode): ${err.message}`,
      devToken: token,
      devUrl: url,
    }),
  });
}

/**
 * Send an organization invite email.
 * @param to Recipient email
 * @param inviteUrl The full URL for accepting the invite
 * @param orgName The organization name
 * @param inviterName The name of the person sending the invite
 * @param ctx Optional comms attribution ({ organizationId }) for the log row
 */
export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  orgName: string,
  inviterName: string,
  ctx?: CommsCtx,
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

  return deliver({
    to,
    subject,
    html,
    template: 'org_invite',
    ctx,
    disabledResult: () => ({
      success: true,
      message: 'Email logged (EMAIL_DISABLED=true)',
      devUrl: inviteUrl,
    }),
    sentResult: () => ({
      success: true,
      message: 'Invite email sent',
      ...(TEST_MODE ? { devUrl: inviteUrl } : {}),
    }),
    testModeRescue: (err) => ({
      success: true,
      message: `Invite email send failed (test mode): ${err.message}`,
      devUrl: inviteUrl,
    }),
  });
}

/**
 * Send a platform staff invite / bootstrap email for the admin console.
 * Separate from the tenant organization invite — staff accounts live on
 * the platform console host, not the tenant web app.
 * @param to Recipient email
 * @param inviteUrl Full URL the staff member opens to set their password
 * @param staffName Display name of the invited staff member
 * @param inviterName Name of the staff member who sent the invite
 * @param ctx Optional comms attribution ({ sentByStaffId }) for the log row
 */
export async function sendStaffInviteEmail(
  to: string,
  inviteUrl: string,
  staffName: string,
  inviterName: string,
  ctx?: CommsCtx,
): Promise<SendEmailResult> {
  const subject = `You've been granted Nkuku platform staff access`;
  const html = `
    <p>Hi ${staffName},</p>
    <p><strong>${inviterName}</strong> has created a staff account for you on the Nkuku platform console.</p>
    <p>Open the link below to set your password. You will then be asked to enrol two-factor authentication (TOTP) — this is mandatory for all staff.</p>
    <p><a href="${inviteUrl}">Set your password</a></p>
    <p>Or copy this link: ${inviteUrl}</p>
    <p>This link expires in 7 days. If you weren't expecting this, contact your platform administrator.</p>
    <p>— Nkuku Platform</p>`;

  return deliver({
    to,
    subject,
    html,
    template: 'staff_invite',
    ctx,
    disabledResult: () => ({
      success: true,
      message: 'Email logged (EMAIL_DISABLED=true)',
      devUrl: inviteUrl,
    }),
    sentResult: () => ({
      success: true,
      message: 'Staff invite email sent',
      ...(TEST_MODE ? { devUrl: inviteUrl } : {}),
    }),
    testModeRescue: (err) => ({
      success: true,
      message: `Staff invite email send failed (test mode): ${err.message}`,
      devUrl: inviteUrl,
    }),
  });
}

/**
 * Send an organization deletion notice email.
 * @param to Recipient email
 * @param orgName Name of the organization scheduled for deletion
 * @param purgeAfter Date the org's data will be permanently erased
 * @param ctx Optional comms attribution ({ organizationId, userId })
 */
export async function sendOrganizationDeletionEmail(
  to: string,
  orgName: string,
  purgeAfter: Date,
  ctx?: CommsCtx,
): Promise<SendEmailResult> {
  const purgeStr = purgeAfter.toISOString().slice(0, 10);
  const subject = `${orgName} is scheduled for deletion — Nkuku Companion`;
  const html = `
    <p>You (or another owner) requested deletion of the organization <strong>${orgName}</strong>.</p>
    <p>The organization has been deactivated and all its data will be <strong>permanently erased on ${purgeStr}</strong>.</p>
    <p>If this was a mistake, reply to this email before that date and we can restore it. After ${purgeStr} the data cannot be recovered.</p>
    <p>— Nkuku Companion Team</p>`;

  return deliver({
    to,
    subject,
    html,
    template: 'org_deletion',
    ctx,
    disabledResult: () => ({ success: true, message: 'Email logged (EMAIL_DISABLED=true)' }),
    sentResult: () => ({ success: true, message: 'Deletion notice sent' }),
    // No TEST_MODE rescue — the original intentionally reported failure.
  });
}

export async function sendBillingReminderEmail(
  to: string,
  params: {
    invoiceNumber: string;
    amountDue: number;
    currency: string;
    dueDate: Date;
    daysOverdue: number;
    paymentLink?: string | null;
    kind: 'upcoming' | 'due_tomorrow' | 'overdue' | 'final';
  },
  ctx?: CommsCtx,
): Promise<SendEmailResult> {
  const { invoiceNumber, amountDue, currency, dueDate, daysOverdue, paymentLink, kind } = params;
  const amount = `${currency} ${amountDue.toFixed(2)}`;
  const dueStr = dueDate.toISOString().slice(0, 10);
  const payUrl = paymentLink || `${WEB_BASE_URL}/billing`;

  const lines: Record<typeof kind, [string, string]> = {
    upcoming: [
      `Invoice ${invoiceNumber} due ${dueStr} — Nkuku Companion`,
      `<p>A reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is due on <strong>${dueStr}</strong>.</p>`,
    ],
    due_tomorrow: [
      `Invoice ${invoiceNumber} is due tomorrow — Nkuku Companion`,
      `<p>Invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is due tomorrow (<strong>${dueStr}</strong>). Please pay to keep your plan active.</p>`,
    ],
    overdue: [
      `Payment overdue — invoice ${invoiceNumber} — Nkuku Companion`,
      `<p>Invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> was due on <strong>${dueStr}</strong> (${daysOverdue} day(s) overdue). Your plan will be suspended if it remains unpaid.</p>`,
    ],
    final: [
      `Final notice — invoice ${invoiceNumber} — Nkuku Companion`,
      `<p><strong>Final reminder:</strong> invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is ${daysOverdue} days overdue. Your subscription will be suspended and downgraded to the free plan shortly.</p>`,
    ],
  };
  const [subject, intro] = lines[kind];
  const html = `${intro}
    <p><a href="${payUrl}">Pay now</a></p>
    <p>Or open your billing page: ${WEB_BASE_URL}/billing</p>
    <p>— Nkuku Companion Team</p>`;

  return deliver({
    to,
    subject,
    html,
    template: `billing_reminder_${kind}`.slice(0, 60),
    ctx,
    disabledResult: () => ({
      success: true,
      message: 'Email logged (EMAIL_DISABLED=true)',
      devUrl: payUrl,
    }),
    sentResult: () => ({ success: true, message: 'Reminder email sent' }),
  });
}

/**
 * Email a ticket requester that staff replied (P3 support inbox).
 * Template 'ticket_reply'. Internal notes must NOT go through here —
 * callers only invoke this for public staff replies.
 */
export async function sendTicketReplyEmail(
  to: string,
  params: { ticketSubject: string; replyBody: string; staffName?: string | null },
  ctx?: CommsCtx,
): Promise<SendEmailResult> {
  const subject = `Re: ${params.ticketSubject} — Nkuku Support`.slice(0, 300);
  const staffName = escapeHtml(params.staffName || 'Nkuku Support');
  const html = `
    <p>Hi,</p>
    <p><strong>${staffName}</strong> replied to your support ticket <strong>${escapeHtml(params.ticketSubject)}</strong>:</p>
    <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;">${escapeHtml(params.replyBody).replace(/\n/g, '<br>')}</blockquote>
    <p>You can reply from the support section of the app.</p>
    <p>— Nkuku Support</p>`;

  return deliver({
    to,
    subject,
    html,
    template: 'ticket_reply',
    ctx,
    disabledResult: () => ({ success: true, message: 'Email logged (EMAIL_DISABLED=true)' }),
    sentResult: () => ({ success: true, message: 'Ticket reply email sent' }),
  });
}
