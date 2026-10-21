// ── LENCO (Broadpay) ADAPTER ─────────────────────────────
// Zambia-first provider: mobile-money collections (MTN/Airtel/Zamtel push
// prompts) and card collections. ZMW orgs route here when configured.
//
// Docs: https://lenco-api.readme.io/v2.0
// Base: https://api.lenco.co/access/v2
//
// Flow for mobile money: POST /collections/mobile-money → status
// 'pay-offline' (customer gets a USSD prompt on their phone) → poll
// GET /collections/status/:reference or webhook until successful/failed.
// There is no hosted redirect for momo — CheckoutResult.paymentLink stays
// empty and CheckoutResult.message carries the instruction.
//
// Mock mode (LENCO_SECRET_KEY unset) mirrors the Flutterwave mock: checkout
// "succeeds" instantly and verify auto-confirms.

import type { PaymentProvider } from './types.js';

const BASE_URL = process.env.LENCO_BASE_URL || 'https://api.lenco.co/access/v2';
const SECRET_KEY = process.env.LENCO_SECRET_KEY || '';
const IS_MOCK = !SECRET_KEY;

const VALID_OPERATORS = new Set(['mtn', 'airtel', 'zamtel']);

export const lencoProvider: PaymentProvider = {
  name: 'lenco',
  isMock: IS_MOCK,

  async initiateCheckout(params) {
    const { txRef, amount, currency, customerPhone, momoOperator, customerEmail } = params;

    if (IS_MOCK) {
      console.log(`[Lenco MOCK] Checkout: txRef=${txRef}, amount=${amount} ${currency}`);
      return { success: true, txRef, message: 'Mock checkout (no LENCO_SECRET_KEY configured)' };
    }

    const operator = momoOperator?.toLowerCase();
    if (!customerPhone || !operator || !VALID_OPERATORS.has(operator)) {
      return {
        success: false,
        txRef,
        message: 'Mobile-money payments via Lenco require a phone number and operator (mtn|airtel|zamtel)',
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/collections/mobile-money`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          reference: txRef,
          phone: customerPhone,
          operator,
          country: 'zm',
          bearer: 'merchant',
        }),
      });
      const data: any = await res.json();

      if (data.status && data.data) {
        const st = data.data.status;
        return {
          success: true,
          txRef,
          message:
            st === 'pay-offline'
              ? 'A payment prompt was sent to your phone — approve it to complete payment.'
              : `Collection initiated (${st})`,
        };
      }
      return { success: false, txRef, message: data.message || 'Lenco collection failed to initiate' };
    } catch (err: any) {
      return { success: false, txRef, message: `Lenco API error: ${err.message}` };
    }
  },

  async verifyTransaction(txRef) {
    if (IS_MOCK) {
      console.log(`[Lenco MOCK] Verify: ${txRef}`);
      return { success: true, status: 'success', amount: 0, currency: 'ZMW', txRef, message: 'Mock verification (auto-success)' };
    }

    try {
      const res = await fetch(`${BASE_URL}/collections/status/${encodeURIComponent(txRef)}`, {
        headers: { Authorization: `Bearer ${SECRET_KEY}` },
      });
      const data: any = await res.json();
      const c = data?.data;
      if (!data.status || !c) {
        return { success: false, status: 'failed', amount: 0, currency: 'ZMW', txRef, message: data.message || 'Collection not found' };
      }
      const ok = c.status === 'successful';
      return {
        success: ok,
        status: ok ? 'success' : c.status, // 'pending' | 'pay-offline' | 'failed'
        amount: Number(c.amount) || 0,
        currency: c.currency || 'ZMW',
        txRef: c.reference || txRef,
        providerTxRef: c.lencoReference,
        message: c.reasonForFailure || data.message,
      };
    } catch (err: any) {
      return { success: false, status: 'failed', amount: 0, currency: 'ZMW', txRef, message: `Lenco API error: ${err.message}` };
    }
  },

  // Lenco webhook authenticity is confirmed by requerying the collection
  // status endpoint — treat every inbound webhook as a hint, not proof.
  verifyWebhookSignature: () => 'requery',
};
