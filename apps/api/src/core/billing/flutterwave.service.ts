// ── FLUTTERWAVE PAYMENT INTEGRATION ──────────────────────
// Abstraction over Flutterwave's API for initiating and verifying payments.
// When FLUTTERWAVE_SECRET_KEY is not set (dev mode), the service operates
// in a "mock" mode that returns fake checkout URLs and auto-verifies as
// successful — enabling full end-to-end billing testing without a real
// merchant account.
//
// API docs: https://developer.flutterwave.com/reference
// Dashboard: https://dashboard.flutterwave.com

import crypto from 'crypto';

const BASE_URL = 'https://api.flutterwave.com/v3';
const SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
const WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH || '';
const IS_MOCK = !SECRET_KEY;

export interface CheckoutResult {
  success: boolean;
  paymentLink?: string;
  txRef: string;
  message?: string;
}

export interface VerifyResult {
  success: boolean;
  status: string; // "success" | "failed" | "pending" | "cancelled"
  amount: number;
  currency: string;
  txRef: string;
  flwTxRef?: string;
  message?: string;
}

/**
 * Initiate a checkout session with Flutterwave.
 * Returns a payment link the user can be redirected to.
 */
export async function initiateCheckout(params: {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redirectUrl: string;
  meta?: Record<string, string>;
}): Promise<CheckoutResult> {
  const { txRef, amount, currency, customerEmail, customerName, customerPhone, redirectUrl, meta } = params;

  if (IS_MOCK) {
    // Dev mode — return a fake payment link
    console.log(`[Flutterwave MOCK] Checkout initiated: txRef=${txRef}, amount=${amount} ${currency}, email=${customerEmail}`);
    return {
      success: true,
      paymentLink: `${redirectUrl}?tx_ref=${txRef}&mock=true`,
      txRef,
      message: 'Mock checkout (no Flutterwave secret key configured)',
    };
  }

  try {
    const body: any = {
      tx_ref: txRef,
      amount,
      currency,
      customer: {
        email: customerEmail,
        ...(customerName ? { name: customerName } : {}),
        ...(customerPhone ? { phonenumber: customerPhone } : {}),
      },
      redirect_url: redirectUrl,
      payment_options: 'card,mobilemoney,ussd',
      meta: meta || {},
    };

    const response = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await response.json();

    if (data.status === 'success' && data.data?.link) {
      return { success: true, paymentLink: data.data.link, txRef };
    }

    return { success: false, txRef, message: data.message || 'Failed to initiate checkout' };
  } catch (err: any) {
    return { success: false, txRef, message: `Flutterwave API error: ${err.message}` };
  }
}

/**
 * Verify a transaction by its tx_ref or transaction ID.
 * Used both for redirect verification and webhook processing.
 */
export async function verifyTransaction(txRef: string, txnId?: string): Promise<VerifyResult> {
  if (IS_MOCK) {
    // Dev mode — auto-verify as successful
    console.log(`[Flutterwave MOCK] Verify transaction: txRef=${txRef}`);
    return {
      success: true,
      status: 'success',
      amount: 0, // amount is checked against invoice in the billing service
      currency: 'ZMW',
      txRef,
      message: 'Mock verification (auto-success)',
    };
  }

  try {
    const url = txnId
      ? `${BASE_URL}/transactions/${txnId}/verify`
      : `${BASE_URL}/transactions/verify_by_reference?tx_ref=${txRef}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SECRET_KEY}` },
    });

    const data: any = await response.json();

    if (data.status === 'success' && data.data) {
      const tx = data.data;
      return {
        success: tx.status === 'successful',
        status: tx.status === 'successful' ? 'success' : tx.status,
        amount: tx.amount,
        currency: tx.currency,
        txRef: tx.tx_ref || txRef,
        flwTxRef: tx.flw_ref || tx.id?.toString(),
        message: data.message,
      };
    }

    return {
      success: false,
      status: 'failed',
      amount: 0,
      currency: 'ZMW',
      txRef,
      message: data.message || 'Verification failed',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      amount: 0,
      currency: 'ZMW',
      txRef,
      message: `Flutterwave API error: ${err.message}`,
    };
  }
}

/**
 * Verify the webhook signature from Flutterwave.
 * Flutterwave sends a header `verif-hash` which must match the secret hash
 * configured in the dashboard.
 *
 * In mock mode (no SECRET_KEY), webhooks are accepted without a hash since
 * the dev mock-pay endpoint is the primary payment path. In production mode,
 * a valid WEBHOOK_HASH is REQUIRED — if it's not configured, all webhooks
 * are rejected to prevent unauthorized payment manipulation.
 */
export function verifyWebhookSignature(signature: string): boolean {
  if (IS_MOCK) {
    // Dev/mock mode — accept all webhooks (no real payments to protect)
    return true;
  }
  if (!WEBHOOK_HASH) {
    // Production mode but no hash configured — fail closed
    return false;
  }
  // Constant-time comparison to prevent timing leaks
  if (signature.length !== WEBHOOK_HASH.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(WEBHOOK_HASH));
}

/**
 * Generate a unique transaction reference.
 */
export function generateTxRef(prefix: string = 'nkuku'): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

export const isMockMode = IS_MOCK;
