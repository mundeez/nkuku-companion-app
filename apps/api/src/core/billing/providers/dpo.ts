// ── DPO PAY ADAPTER ──────────────────────────────────────
// DPO Pay (ex-3G Direct Pay): XML API over a single endpoint. Covers
// Botswana (and Zambia) with hosted card checkout + mobile money, and is
// the only provider offering real card tokenisation for recurring charges.
//
// Docs: https://docs.dpopay.com/dpo-pay-by-network/reference
// Endpoint: POST https://secure.3gdirectpay.com/API/v6/ (XML in/out)
//
// Flow: createToken → redirect customer to the hosted checkout
// (https://secure.3gdirectpay.com/payv2.php?ID=<TransToken>) → BackURL
// callback → verifyToken to confirm.
//
// Mock mode when DPO_COMPANY_TOKEN is unset.

import type { PaymentProvider } from './types.js';

const BASE_URL = process.env.DPO_BASE_URL || 'https://secure.3gdirectpay.com/API/v6/';
const COMPANY_TOKEN = process.env.DPO_COMPANY_TOKEN || '';
const SERVICE_TYPE = process.env.DPO_SERVICE_TYPE || '3854'; // generic service type
const IS_MOCK = !COMPANY_TOKEN;

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

/** Minimal XML field extractor — DPO responses are small and flat. */
function xget(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m?.[1];
}

async function postApi(xml: string): Promise<string> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/xml' },
    body: xml,
  });
  return res.text();
}

export const dpoProvider: PaymentProvider = {
  name: 'dpo',
  isMock: IS_MOCK,

  async initiateCheckout(params) {
    const { txRef, amount, currency, customerEmail, customerName, customerPhone, redirectUrl, meta } = params;

    if (IS_MOCK) {
      console.log(`[DPO MOCK] Checkout: txRef=${txRef}, amount=${amount} ${currency}`);
      return { success: true, paymentLink: `${redirectUrl}?tx_ref=${txRef}&mock=true`, txRef, message: 'Mock checkout (no DPO_COMPANY_TOKEN configured)' };
    }

    const [firstName, ...rest] = (customerName || customerEmail.split('@')[0]).split(' ');
    const lastName = rest.join(' ') || firstName;
    const desc = meta?.plan_code ? `Nkuku ${meta.plan_code} subscription` : 'Nkuku subscription';

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(COMPANY_TOKEN)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${xmlEscape(currency)}</PaymentCurrency>
    <CompanyRef>${xmlEscape(txRef)}</CompanyRef>
    <RedirectURL>${xmlEscape(redirectUrl)}</RedirectURL>
    <BackURL>${xmlEscape(process.env.DPO_BACK_URL || redirectUrl)}</BackURL>
    <CompanyRefUnique>0</CompanyRefUnique>
    <PTL>5</PTL>
    <customerFirstName>${xmlEscape(firstName)}</customerFirstName>
    <customerLastName>${xmlEscape(lastName)}</customerLastName>
    <customerEmail>${xmlEscape(customerEmail)}</customerEmail>
    ${customerPhone ? `<customerPhone>${xmlEscape(customerPhone)}</customerPhone>` : ''}
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${xmlEscape(SERVICE_TYPE)}</ServiceType>
      <ServiceDescription>${xmlEscape(desc)}</ServiceDescription>
      <ServiceDate>${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

    try {
      const out = await postApi(xml);
      const result = xget(out, 'Result'); // '000' = success
      if (result === '000') {
        const token = xget(out, 'TransToken')!;
        return {
          success: true,
          paymentLink: `https://secure.3gdirectpay.com/payv2.php?ID=${token}`,
          txRef,
          providerTxRef: token,
        };
      }
      return { success: false, txRef, message: `DPO createToken failed: ${xget(out, 'ResultExplanation') || result || 'unknown'}` };
    } catch (err: any) {
      return { success: false, txRef, message: `DPO API error: ${err.message}` };
    }
  },

  async verifyTransaction(txRef) {
    if (IS_MOCK) {
      console.log(`[DPO MOCK] Verify: ${txRef}`);
      return { success: true, status: 'success', amount: 0, currency: 'BWP', txRef, message: 'Mock verification (auto-success)' };
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(COMPANY_TOKEN)}</CompanyToken>
  <Request>verifyToken</Request>
  <CompanyRef>${xmlEscape(txRef)}</CompanyRef>
</API3G>`;

    try {
      const out = await postApi(xml);
      const result = xget(out, 'Result'); // '000' paid, '001' auth, '900' not paid
      const ok = result === '000';
      return {
        success: ok,
        status: ok ? 'success' : 'failed',
        amount: Number(xget(out, 'TransactionAmount')) || 0,
        currency: xget(out, 'TransactionCurrency') || 'BWP',
        txRef: xget(out, 'CompanyRef') || txRef,
        providerTxRef: xget(out, 'TransactionToken'),
        message: xget(out, 'ResultExplanation'),
      };
    } catch (err: any) {
      return { success: false, status: 'failed', amount: 0, currency: 'BWP', txRef, message: `DPO API error: ${err.message}` };
    }
  },

  // DPO BackURL callbacks carry no signature — confirm by requerying verifyToken.
  verifyWebhookSignature: () => 'requery',
};
