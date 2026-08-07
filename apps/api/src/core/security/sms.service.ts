/**
 * SMS service — sends SMS via the Deez-Kannel gateway's HTTP sendsms interface.
 *
 * Kannel's sendsms endpoint accepts GET requests with username/password auth
 * and returns 202 on success. Both the nkuku API and kannel containers are on
 * the `shared-net` Docker network, so the API reaches kannel at
 * `http://deez-kannel:13013/cgi-bin/sendsms`.
 *
 * In development, SMS sending can be disabled (SMS_DISABLED=true) — the OTP
 * code is logged to the server console instead, which is useful for testing.
 */

const KANNEL_SEND_URL =
  process.env.KANNEL_SEND_URL || 'http://deez-kannel:13013/cgi-bin/sendsms';
const KANNEL_SENDSMS_USER = process.env.KANNEL_SENDSMS_USER || 'admin';
const KANNEL_SENDSMS_PASS = process.env.KANNEL_SENDSMS_PASS || '';
const KANNEL_SENDER = process.env.KANNEL_SENDER || 'Nkuku';
const SMS_DISABLED = process.env.SMS_DISABLED === 'true';
export { SMS_DISABLED };

export interface SendSmsResult {
  success: boolean;
  message: string;
  /** When SMS_DISABLED=true, the OTP code is returned here for dev/testing. */
  devCode?: string;
}

/**
 * Send an SMS message to a recipient.
 * @param to Phone number in E.164 format (no leading +), e.g. "260970000000"
 * @param text Message text (max 160 chars for single SMS)
 */
export async function sendSms(to: string, text: string): Promise<SendSmsResult> {
  if (SMS_DISABLED) {
    // Dev mode: log the message instead of sending it
    console.log(`[SMS DISABLED] To: ${to}, Text: ${text}`);
    return { success: true, message: 'SMS disabled — message logged to console' };
  }

  if (!KANNEL_SENDSMS_PASS) {
    console.error('[SMS] KANNEL_SENDSMS_PASS not configured — cannot send SMS');
    return { success: false, message: 'SMS gateway not configured' };
  }

  const params = new URLSearchParams({
    username: KANNEL_SENDSMS_USER,
    password: KANNEL_SENDSMS_PASS,
    to,
    text,
    from: KANNEL_SENDER,
    dlr_mask: '31',
    coding: '0',
  });

  const url = `${KANNEL_SEND_URL}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const body = await res.text();
    if (res.status === 202) {
      return { success: true, message: body.trim() };
    }
    console.error(`[SMS] Kannel returned ${res.status}: ${body}`);
    return { success: false, message: `Kannel error: ${res.status}` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[SMS] Request timed out');
      return { success: false, message: 'SMS gateway timeout' };
    }
    console.error('[SMS] Send failed:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Send an OTP code to a phone number.
 * The message is formatted as: "Your Nkuku verification code is: 123456"
 */
export async function sendOtpSms(to: string, code: string): Promise<SendSmsResult> {
  const text = `Your Nkuku verification code is: ${code}. Do not share this code with anyone.`;
  return sendSms(to, text);
}
