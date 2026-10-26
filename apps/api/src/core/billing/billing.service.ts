// ── BILLING SERVICE ──────────────────────────────────────
// Core business logic for subscriptions, invoices, and payment processing.
// Orchestrates between the plan definitions, Prisma models, and the
// Flutterwave payment provider abstraction.

import type { PrismaClient } from '@prisma/client';
import { PLANS, getPlan, getPlanPrice, type PlanCode } from './plans.js';
import { getAddon, getAddonPrice, type AddonCode } from './addons.js';
import { generateTxRef, verifyWebhookSignature, isMockMode } from './flutterwave.service.js';
import { getProvider, providerForCurrency, allProvidersMock } from './providers/index.js';
import { sendBillingReminderEmail } from '../security/email.service.js';

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
    const _cancelled = await prisma.subscription.findFirst({
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
  /** Mobile-money operator for push collections (lenco): mtn|airtel|zamtel */
  momoOperator?: string;
  redirectUrl: string;
}): Promise<{ subscription: any; invoice: any; checkout: any }> {
  const { organizationId, planCode, billingCycle, customerEmail, customerName, customerPhone, momoOperator, redirectUrl } = params;

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

  // Pick the provider for this org's currency. Lenco (ZMW) needs a phone +
  // momo operator for push collection — fall back to flutterwave's hosted
  // checkout when those aren't supplied.
  let provider = providerForCurrency(currency);
  if (provider.name === 'lenco' && (!customerPhone || !momoOperator)) {
    provider = getProvider('flutterwave');
  }

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
      provider: provider.name,
      providerRef: txRef,
    },
  });

  // Initiate checkout
  const checkout = await provider.initiateCheckout({
    txRef,
    amount,
    currency,
    customerEmail,
    customerName,
    customerPhone,
    momoOperator,
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

  // Verify with the provider that owns this invoice
  const provider = getProvider(invoice.provider);
  const verification = await provider.verifyTransaction(txRef, txnId);

  // Cross-check: the verified tx_ref must match the invoice's providerRef
  if (verification.txRef && verification.txRef !== txRef) {
    return { success: false, invoice, message: 'Transaction reference mismatch' };
  }

  // Record the payment event
  await prisma.paymentEvent.create({
    data: {
      invoiceId: invoice.id,
      provider: provider.name,
      providerRef: txRef,
      providerTxnId: verification.providerTxRef || txnId || null,
      amount: verification.amount || invoice.amountDue,
      currency: invoice.currency,
      status: verification.status,
      rawPayload: rawPayload || null,
    },
  });

  if (verification.success) {
    // Verify the payment amount matches the invoice amount (unless mock mode, where amount is 0)
    if (!provider.isMock && verification.amount > 0) {
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
          provider: provider.name,
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
  remindersSent: number;
}> {
  const now = new Date();
  let invoicesGenerated = 0;
  let subscriptionsSuspended = 0;
  let trialsExpired = 0;
  let remindersSent_ = 0;

  // 1. Expire trials — move trialing subscriptions with past trialEndsAt to past_due
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: 'trialing',
      trialEndsAt: { lt: now },
      organization: { isDemo: false, deletedAt: null },
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
      organization: { isDemo: false, deletedAt: null },
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
      organization: { isDemo: false, deletedAt: null },
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
    const provider = providerForCurrency(org.currency);

    const invoice = await prisma.invoice.create({
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
        provider: provider.name,
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

    // Initiate a checkout for the renewal invoice so the dunning emails can
    // carry a working payment link instead of a dead invoice.
    const contact = await getOrgBillingContact(prisma, org.id);
    if (contact?.email) {
      const checkout = await provider.initiateCheckout({
        txRef,
        amount,
        currency: org.currency,
        customerEmail: contact.email,
        customerName: contact.name,
        customerPhone: contact.phone,
        redirectUrl: `${process.env.WEB_BASE_URL || 'http://localhost:30000'}/billing/callback?invoice_id=${invoice.id}`,
        meta: { invoice_id: invoice.id, organization_id: org.id, plan_code: sub.planCode, billing_cycle: sub.billingCycle },
      });
      if (checkout.success && checkout.paymentLink) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { paymentLink: checkout.paymentLink } });
      }
    }

    invoicesGenerated++;
  }

  // 4. Dunning — remind on open invoices at T-7, T-1 (before due) and
  // T+1, T+5 (past due). remindersSent is a bitmask so each sends once.
  const openInvoices = await prisma.invoice.findMany({
    where: { status: 'open', organization: { isDemo: false, deletedAt: null } },
  });
  const DAY = 86_400_000;
  for (const inv of openInvoices) {
    const daysUntilDue = (inv.dueDate.getTime() - now.getTime()) / DAY;
    let bit = 0;
    let kind: 'upcoming' | 'due_tomorrow' | 'overdue' | 'final' | null = null;
    if (daysUntilDue <= 7 && daysUntilDue > 1 && !(inv.remindersSent & 1)) { bit = 1; kind = 'upcoming'; }
    else if (daysUntilDue <= 1 && daysUntilDue > -1 && !(inv.remindersSent & 2)) { bit = 2; kind = 'due_tomorrow'; }
    else if (daysUntilDue <= -1 && daysUntilDue > -5 && !(inv.remindersSent & 4)) { bit = 4; kind = 'overdue'; }
    else if (daysUntilDue <= -5 && !(inv.remindersSent & 8)) { bit = 8; kind = 'final'; }
    if (!bit || !kind) continue;

    const contact = await getOrgBillingContact(prisma, inv.organizationId);
    if (!contact?.email) continue;
    await sendBillingReminderEmail(contact.email, {
      invoiceNumber: inv.invoiceNumber,
      amountDue: Number(inv.amountDue),
      currency: inv.currency,
      dueDate: inv.dueDate,
      daysOverdue: Math.max(0, Math.ceil(-daysUntilDue)),
      paymentLink: inv.paymentLink,
      kind,
    });
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { remindersSent: inv.remindersSent | bit, lastReminderAt: now },
    });
    remindersSent_++;
  }

  return { invoicesGenerated, subscriptionsSuspended, trialsExpired, remindersSent: remindersSent_ };
}

/** Primary billing contact: the org owner's user record. */
async function getOrgBillingContact(prisma: PrismaClient, organizationId: string) {
  const member = await prisma.organizationMember.findFirst({
    where: { organizationId, role: 'owner' },
    include: { user: true },
  });
  if (!member?.user) return null;
  return {
    email: member.user.email,
    name: member.user.name || undefined,
    phone: member.user.phone || undefined,
  };
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
