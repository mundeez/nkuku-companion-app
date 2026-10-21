// ── PROVIDER REGISTRY ────────────────────────────────────
// Resolves which payment provider handles a checkout/invoice, routed by
// organization currency:
//   ZMW → lenco (if LENCO_SECRET_KEY) else flutterwave
//   BWP → dpo   (if DPO_COMPANY_TOKEN) else flutterwave
//   else → flutterwave (existing integration, widest coverage)
// Unconfigured providers fall back to flutterwave so an org is never
// stranded without a way to pay. Mock mode is per-provider.

import { flutterwaveProvider } from './flutterwave.js';
import { lencoProvider } from './lenco.js';
import { dpoProvider } from './dpo.js';
import type { PaymentProvider } from './types.js';

const PROVIDERS: Record<string, PaymentProvider> = {
  flutterwave: flutterwaveProvider,
  lenco: lencoProvider,
  dpo: dpoProvider,
};

export function getProvider(name: string | null | undefined): PaymentProvider {
  return PROVIDERS[name || 'flutterwave'] || flutterwaveProvider;
}

export function providerForCurrency(currency: string | null | undefined): PaymentProvider {
  switch ((currency || 'ZMW').toUpperCase()) {
    case 'ZMW':
      return lencoProvider.isMock ? flutterwaveProvider : lencoProvider;
    case 'BWP':
      return dpoProvider.isMock ? flutterwaveProvider : dpoProvider;
    default:
      return flutterwaveProvider;
  }
}

/** True only when ALL configured-routing would land on a mock provider —
 * i.e. nothing real is wired up. Gates the dev/mock-pay endpoint. */
export const allProvidersMock =
  flutterwaveProvider.isMock && lencoProvider.isMock && dpoProvider.isMock;

export { flutterwaveProvider, lencoProvider, dpoProvider };
export type { PaymentProvider, CheckoutParams, CheckoutResult, VerifyResult } from './types.js';
