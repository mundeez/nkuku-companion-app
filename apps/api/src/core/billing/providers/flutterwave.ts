// Flutterwave adapter — wraps the existing flutterwave.service.ts
// implementation behind the PaymentProvider interface.

import {
  initiateCheckout,
  verifyTransaction,
  verifyWebhookSignature,
  isMockMode,
} from '../flutterwave.service.js';
import type { PaymentProvider } from './types.js';

export const flutterwaveProvider: PaymentProvider = {
  name: 'flutterwave',
  isMock: isMockMode,
  initiateCheckout: (params) => initiateCheckout(params),
  verifyTransaction: (txRef, txnId) => verifyTransaction(txRef, txnId),
  verifyWebhookSignature: (signature) => verifyWebhookSignature(signature || ''),
};
