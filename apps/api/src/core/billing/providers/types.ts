// ── PAYMENT PROVIDER ABSTRACTION ─────────────────────────
// One interface, three adapters: flutterwave (existing), lenco (ZMW mobile
// money), dpo (BWP + card tokenisation). Each adapter runs in "mock" mode
// when its API keys are absent so dev and CI need no merchant accounts.

export interface CheckoutParams {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  /** Mobile-money operator for push collections (lenco): mtn|airtel|zamtel */
  momoOperator?: string;
  redirectUrl: string;
  meta?: Record<string, string>;
}

export interface CheckoutResult {
  success: boolean;
  /** Hosted redirect URL — absent for push collections (mobile money). */
  paymentLink?: string;
  txRef: string;
  /** Provider-side transaction token/reference, when issued at checkout. */
  providerTxRef?: string;
  /** Human-readable instruction when there's no redirect (e.g. USSD prompt). */
  message?: string;
}

export interface VerifyResult {
  success: boolean;
  status: string; // 'success' | 'failed' | 'pending' | 'pay-offline' | provider-specific
  amount: number;
  currency: string;
  txRef: string;
  providerTxRef?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly name: 'flutterwave' | 'lenco' | 'dpo';
  readonly isMock: boolean;
  initiateCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyTransaction(txRef: string, txnId?: string): Promise<VerifyResult>;
  /**
   * Authenticate an inbound webhook. Providers without reliable signatures
   * should return 'requery' — the caller then confirms via verifyTransaction.
   */
  verifyWebhookSignature(signature: string | undefined, payload?: unknown): boolean | 'requery';
}
