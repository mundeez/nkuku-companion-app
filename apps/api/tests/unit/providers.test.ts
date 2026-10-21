import { describe, it, expect } from 'vitest';
import { getProvider, providerForCurrency, allProvidersMock } from '../../src/core/billing/providers/index.js';

// NOTE: no provider credentials are set in test envs, so every provider is in
// mock mode and currency routing falls back to flutterwave — which is exactly
// the behaviour under test.

describe('Payment provider abstraction', () => {
  it('falls back to flutterwave for ZMW when lenco is unconfigured', () => {
    expect(providerForCurrency('ZMW').name).toBe('flutterwave');
    expect(providerForCurrency('zmw').name).toBe('flutterwave');
  });

  it('falls back to flutterwave for BWP when dpo is unconfigured', () => {
    expect(providerForCurrency('BWP').name).toBe('flutterwave');
  });

  it('routes unknown currencies to flutterwave', () => {
    expect(providerForCurrency('USD').name).toBe('flutterwave');
    expect(providerForCurrency('').name).toBe('flutterwave');
    expect(providerForCurrency(null).name).toBe('flutterwave');
  });

  it('resolves adapters by name', () => {
    expect(getProvider('flutterwave').name).toBe('flutterwave');
    expect(getProvider('lenco').name).toBe('lenco');
    expect(getProvider('dpo').name).toBe('dpo');
  });

  it('falls back to flutterwave for null/unknown provider names', () => {
    expect(getProvider(null).name).toBe('flutterwave');
    expect(getProvider('paytm').name).toBe('flutterwave');
  });

  it('reports mock mode with no credentials configured', () => {
    expect(allProvidersMock).toBe(true);
  });
});

describe('Provider checkout (mock mode)', () => {
  const args = {
    organizationId: 'org-1',
    planCode: 'grower',
    billingCycle: 'monthly',
    amount: 100,
    currency: 'ZMW',
    customerEmail: 'a@b.c',
    txRef: 'INV-1-org-1-1',
    invoiceNumber: 'INV-1',
  } as any;

  it('flutterwave mock returns a payment link', async () => {
    const r = await getProvider('flutterwave').initiateCheckout(args);
    expect(r.success).toBe(true);
    expect(r.txRef).toBe(args.txRef);
    expect(r.paymentLink).toBeTruthy();
  });

  it('lenco mock collection succeeds', async () => {
    const r = await getProvider('lenco').initiateCheckout({ ...args, customerPhone: '+260977123456', momoOperator: 'mtn' });
    expect(r.success).toBe(true);
  });

  it('dpo mock returns a hosted payment link', async () => {
    const r = await getProvider('dpo').initiateCheckout(args);
    expect(r.success).toBe(true);
    expect(r.paymentLink).toBeTruthy();
  });
});

describe('Provider verification (mock mode)', () => {
  it.each(['flutterwave', 'lenco', 'dpo'] as const)('%s verifies as successful', async (name) => {
    const r = await getProvider(name).verifyTransaction('X-1-2-3');
    expect(r.success).toBe(true);
    expect(r.txRef).toBe('X-1-2-3');
  });
});
