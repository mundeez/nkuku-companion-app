// ── BILLING SERVICE ──────────────────────────────────────
// Core business logic for subscriptions, invoices, and payment processing.
// Orchestrates between the plan definitions, Prisma models, and the
// Flutterwave payment provider abstraction.

import type { PrismaClient } from '@prisma/client';
import { PLANS, getPlan, getPlanPrice, type PlanCode } from './plans.js';
import { getAddon, getAddonPrice, type AddonCode } from './addons.js';
import {
  initiateCheckout,
  verifyTransaction,
  generateTxRef,
  verifyWebhookSignature,
  isMockMode,
} from './flutterwave.service.js';

const TRIAL_DAYS = 14;
const GRACE_PERIOD_DAYS = 7; // past_due → suspended after 7 days
const INVOICE_DUE_DAYS = 3; // invoice due 3 days after generation

export interface SubscriptionInfo {
  planCode: string;
  planName: string;
  billingCycle: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  limits: any;
}

/**
 * Get or create the active subscription for an organization.
 * Every org should have exactly one subscription. If none exists (legacy
 * org from before billing), create a free-tier one.
 */
export async function getOrCreateSubscription(prisma: PrismaClient, organizationId: string) {
  // IMPORTANT: only consider real plan-tier subscriptions here, never
  // add-ons (e.g. "remove_ads_addon" — see core/billing/addons.ts). An org
  // can hold two independent Subscription rows at once (its plan + an
  // add-on); picking the most recently created one regardless of type
  // would let an add-on purchase silently masquerade as the org's plan.
  let sub = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ['trialing', 'active', 'past_due'] }, planCode: { in: Object.keys(PLANS) } },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    // Check for any cancelled subscription (to avoid creating duplicates)
    const cancelled = await prisma.subscription.findFirst({
      where: { organizationId, status: 'cancelled' },
      orderBy: { createdAt: 'desc' },
    });

    // Create a new free-tier subscription
    sub = await prisma.subscription.create({
      data: {
        organizationId,
        planCode: 'free',
        billingCycle: 'monthly',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });
  }

  return sub;
}

/**
 * Get the effective plan code for an organization (from subscription or org default).
 */
export async function getEffectivePlanCode(prisma: PrismaClient, organizationId: string): Promise<PlanCode> {
  const sub = await getOrCreateSubscription(prisma, organizationId);
  // If suspended, downgrade to free
  if (sub.status === 'suspended') return 'free';
  return sub.planCode as PlanCode;
}

/**
 * Get subscription info for display.
 */
export async function getSubscriptionInfo(prisma: PrismaClient, organizationId: string): Promise<SubscriptionInfo> {
  const sub = await getOrCreateSubscription(prisma, organizationId);
  const plan = getPlan(sub.planCode);
  return {
    planCode: sub.planCode,
    planName: plan?.name || sub.planCode,
    billingCycle: sub.billingCycle,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() || null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
    trialEndsAt: sub.trialEndsAt?.toISOString() || null,
    canceledAt: sub.canceledAt?.toISOString() || null,
    limits: plan?.limits || {},
  };
}

/**
 * Subscribe an organization to a plan (or change plans).
 * Creates an invoice and initiates Flutterwave checkout.
 */
export async function subscribeToPlan(prisma: PrismaClient, params: {
  organizationId: string;
  planCode: PlanCode;
  billingCycle: 'monthly' | 'cycle_3mo' | 'annual';
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redirectUrl: string;
}): Promise<{ subscription: any; invoice: any; checkout: any }> {
  const { organizationId, planCode, billingCycle, customerEmail, customerName, customerPhone, redirectUrl } = params;

  const plan = getPlan(planCode);
  if (!plan) throw new Error('INVALID_PLAN');
  if (!plan.isSelfServe) throw new Error('PLAN_NOT_SELF_SERVE');

  // Get the org to determine currency
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const currency = org.currency || 'ZMW';

  const amount = getPlanPrice(planCode, billingCycle, currency);

  // Free plan — no checkout needed
  if (amount === 0) {
    const sub = await updateSubscription(prisma, organizationId, {
      planCode,
      billingCycle,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: computePeriodEnd(new Date(), billingCycle),
    });
    // Update org's planCode
    await prisma.organization.update({ where: { id: organizationId }, data: { planCode } });
    return { subscription: sub, invoice: null, checkout: null };
    }

  // Paid plan — create invoice + checkout
  const periodStart = new Date();
  const periodEnd = computePeriodEnd(periodStart, billingCycle);

  const sub = await updateSubscription(prisma, organizationId, {
    planCode,
    billingCycle,
    status: 'trialing',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEndsAt: addDays(periodStart, TRIAL_DAYS),
  });

  // Generate invoice
  const invoiceNumber = generateInvoiceNumber();
  const txRef = generateTxRef();

  const invoice = await prisma.invoice.create({
    data: {
      organizationId,
      subscriptionId: sub.id,
      invoiceNumber,
      planCode,
      billingCycle,
      amountDue: amount,
      amountPaid: 0,
      currency,
      status: 'open',
      periodStart,
      periodEnd,
      dueDate: addDays(periodStart, INVOICE_DUE_DAYS),
      providerRef: txRef,
    },
  });

  // Initiate checkout
  const checkout = await initiateCheckout({
    txRef,
    amount,
    currency,
    customerEmail,
    customerName,
    customerPhone,
    redirectUrl: `${redirectUrl}?invoice_id=${invoice.id}`,
    meta: {
      invoice_id: invoice.id,
      organization_id: organizationId,
      plan_code: planCode,
      billing_cycle: billingCycle,
    },
  });

  if (checkout.success && checkout.paymentLink) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paymentLink: checkout.paymentLink },
    });
  }

  return { subscription: sub, invoice, checkout };
}

/**
 * Cancel a subscription (downgrade to free at end of current period).
 * Voids any open invoices to prevent re-activation via stale payment links.
 */
export async function cancelSubscription(prisma: PrismaClient, organizationId: string): Promise<any> {
  const sub = await getOrCreateSubscription(prisma, organizationId);
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { canceledAt: new Date(), status: 'cancelled' },
  });
  // Void any open invoices for this subscription to prevent re-activation
  await prisma.invoice.updateMany({
    where: { subscriptionId: sub.id, status: 'open' },
    data: { status: 'void' },
  });
  // Downgrade org to free
  await prisma.organization.update({ where: { id: organizationId }, data: { planCode: 'free' } });
  // Create a new free subscription for the next period
  await prisma.subscription.create({
    data: {
      organizationId,
      planCode: 'free',
      billingCycle: 'monthly',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1),
    },
  });
  return updated;
}

/**
 * Process a payment webhook/event.
 * Verifies the transaction with Flutterwave, records the payment event,
 * and updates the invoice + subscription status.
 *
 * Security checks:
 * - The verified tx_ref must match the invoice's providerRef
 * - The verified amount and currency must match the invoice
 * - Idempotency: if the invoice is already paid, returns success without
 *   creating a duplicate payment event or re-activating the subscription
 * - Optional organizationId check prevents IDOR (cross-org payment manipulation)
 */
export async function processPaymentEvent(prisma: PrismaClient, params: {
  txRef: string;
  txnId?: string;
  rawPayload?: any;
  organizationId?: string; // when provided, verifies the invoice belongs to this org
}): Promise<{ success: boolean; invoice?: any; message: string }> {
  const { txRef, txnId, rawPayload, organizationId } = params;

  // Find the invoice by providerRef
  const invoice = await prisma.invoice.findFirst({
    where: { providerRef: txRef },
  });

  if (!invoice) {
    return { success: false, message: 'Invoice not found for tx_ref' };
  }

  // IDOR protection: if organizationId is provided, verify ownership
  if (organizationId && invoice.organizationId !== organizationId) {
    return { success: false, message: 'Invoice does not belong to this organization' };
  }

  // Idempotency: if invoice is already paid, don't process again
  if (invoice.status === 'paid') {
    return { success: true, invoice, message: 'Invoice already paid' };
  }

  // Verify with Flutterwave
  const verification = await verifyTransaction(txRef, txnId);

  // Cross-check: the verified tx_ref must match the invoice's providerRef
  if (verification.txRef && verification.txRef !== txRef) {
    return { success: false, invoice, message: 'Transaction reference mismatch' };
  }

  // Record the payment event
  await prisma.paymentEvent.create({
    data: {
      invoiceId: invoice.id,
      provider: 'flutterwave',
      providerRef: txRef,
      providerTxnId: verification.flwTxRef || txnId || null,
      amount: verification.amount || invoice.amountDue,
      currency: invoice.currency,
      status: verification.status,
      rawPayload: rawPayload || null,
    },
  });

  if (verification.success) {
    // Verify the payment amount matches the invoice amount (unless mock mode, where amount is 0)
    if (!isMockMode && verification.amount > 0) {
      const invoiceAmount = Number(invoice.amountDue);
      if (Math.abs(verification.amount - invoiceAmount) > 0.01) {
        return { success: false, invoice, message: `Amount mismatch: expected ${invoiceAmount}, got ${verification.amount}` };
      }
      if (verification.currency && verification.currency !== invoice.currency) {
        return { success: false, invoice, message: `Currency mismatch: expected ${invoice.currency}, got ${verification.currency}` };
      }
    }

    // Payment successful — mark invoice as paid
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paid',
        amountPaid: invoice.amountDue,
        paidAt: new Date(),
      },
    });

    // Activate the subscription (only if it belongs to the same org and is not cancelled)
    const sub = await prisma.subscription.findUnique({ where: { id: invoice.subscriptionId } });
    if (sub && sub.status !== 'cancelled') {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'active',
          provider: 'flutterwave',
          providerRef: txRef,
          currentPeriodStart: invoice.periodStart,
          currentPeriodEnd: invoice.periodEnd,
        },
      });
      // Update org planCode — only for real plan tiers, never for add-ons
      // (e.g. "remove_ads_addon" stacks on top of the org's existing plan
      // via a second Subscription row; see core/billing/addons.ts).
      if (getPlan(invoice.planCode)) {
        await prisma.organization.update({
          where: { id: invoice.organizationId },
          data: { planCode: invoice.planCode },
        });
      }
    }

    return { success: true, invoice, message: 'Payment processed successfully' };
  }

  // Payment failed — mark subscription as past_due
  const sub = await prisma.subscription.findUnique({ where: { id: invoice.subscriptionId } });
  if (sub && sub.status === 'trialing') {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'past_due' },
    });
  }

  return { success: false, invoice, message: verification.message || 'Payment verification failed' };
}

/**
 * Verify a payment after redirect (user returns from Flutterwave checkout).
 */
export async function verifyPaymentRedirect(prisma: PrismaClient, params: {
  txRef: string;
  txnId?: string;
  status?: string; // query param from Flutterwave redirect
  organizationId?: string; // org-scoping for IDOR protection
}): Promise<{ success: boolean; invoice?: any; message: string }> {
  // If status is "cancelled" from the redirect, don't verify
  if (params.status === 'cancelled') {
    return { success: false, message: 'Payment was cancelled' };
  }

  return processPaymentEvent(prisma, params);
}

/**
 * Daily cron: check for expired subscriptions, past_due grace periods,
 * and generate recurring invoices for active paid subscriptions.
 */
export async function runDailyBillingCron(prisma: PrismaClient): Promise<{
  invoicesGenerated: number;
  subscriptionsSuspended: number;
  trialsExpired: number;
}> {
  const now = new Date();
  let invoicesGenerated = 0;
  let subscriptionsSuspended = 0;
  let trialsExpired = 0;

  // 1. Expire trials — move trialing subscriptions with past trialEndsAt to past_due
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trialEndsAt: { lt: now },
    },
  });
  for (const sub of expiredTrials) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'past_due' },
    });
    trialsExpired++;
  }

  // 2. Suspend past_due subscriptions past the grace period
  const pastDue = await prisma.subscription.findMany({
    where: {
      status: 'past_due',
      updatedAt: { lt: addDays(now, -GRACE_PERIOD_DAYS) },
    },
  });
  for (const sub of pastDue) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'suspended' },
    });
    // Downgrade org to free — only applies to real plan subscriptions.
    // An add-on (e.g. remove_ads_addon) lapsing must not touch the org's
    // actual plan tier.
    if (getPlan(sub.planCode)) {
      await prisma.organization.update({
        where: { id: sub.organizationId },
        data: { planCode: 'free' },
      });
    }
    subscriptionsSuspended++;
  }

  // 3. Generate recurring invoices for active paid subscriptions (plans and
  // add-ons alike) whose period has ended.
  const activeSubs = await prisma.subscription.findMany({
    where: {
      status: 'active',
      planCode: { not: 'free' },
      currentPeriodEnd: { lt: now },
    },
  });
  for (const sub of activeSubs) {
    const org = await prisma.organization.findUnique({ where: { id: sub.organizationId } });
    if (!org) continue;

    // Check if there's already an open invoice for the next period
    const periodStart = sub.currentPeriodEnd || now;
    const periodEnd = computePeriodEnd(periodStart, sub.billingCycle as any);
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        subscriptionId: sub.id,
        periodStart,
      },
    });
    if (existingInvoice) continue; // already generated

    const plan = getPlan(sub.planCode);
    const addon = plan ? undefined : getAddon(sub.planCode);
    if (!plan && !addon) continue; // unknown planCode — skip rather than bill 0

    const amount = plan
      ? getPlanPrice(sub.planCode as PlanCode, sub.billingCycle as any, org.currency)
      : getAddonPrice(sub.planCode as AddonCode, org.currency);
    const txRef = generateTxRef();
    const invoiceNumber = generateInvoiceNumber();

    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        subscriptionId: sub.id,
        invoiceNumber,
        planCode: sub.planCode,
        billingCycle: sub.billingCycle as any,
        amountDue: amount,
        amountPaid: 0,
        currency: org.currency,
        status: 'open',
        periodStart,
        periodEnd,
        dueDate: addDays(now, INVOICE_DUE_DAYS),
        providerRef: txRef,
      },
    });

    // Extend the subscription period (give them access while invoice is open)
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    invoicesGenerated++;
  }

  return { invoicesGenerated, subscriptionsSuspended, trialsExpired };
}

// ── Helpers ──

async function updateSubscription(prisma: PrismaClient, organizationId: string, data: any) {
  // Same add-on exclusion as getOrCreateSubscription above — this helper
  // backs subscribeToPlan/cancelSubscription and must never touch an
  // add-on's Subscription row.
  const existing = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ['trialing', 'active', 'past_due', 'suspended'] }, planCode: { in: Object.keys(PLANS) } },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.subscription.update({ where: { id: existing.id }, data });
  }

  return prisma.subscription.create({
    data: { organizationId, ...data },
  });
}

function computePeriodEnd(start: Date, cycle: 'monthly' | 'cycle_3mo' | 'annual'): Date {
  switch (cycle) {
    case 'monthly': return addMonths(start, 1);
    case 'cycle_3mo': return addMonths(start, 3);
    case 'annual': return addMonths(start, 12);
    default: return addMonths(start, 1);
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

export { verifyWebhookSignature, isMockMode };
