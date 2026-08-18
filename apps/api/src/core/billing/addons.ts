// ── BILLING ADD-ONS ──────────────────────────────────────
// Small recurring add-ons that stack on top of an org's existing plan
// subscription without changing its tier/limits. Modeled as a second,
// independent `Subscription` row (same table, same Flutterwave checkout
// flow) rather than a new billing subsystem — see docs/ADVERTISING_PLAN.md.

import type { PrismaClient } from '@prisma/client';
import {
  initiateCheckout,
  generateTxRef,
} from './flutterwave.service.js';

export type AddonCode = 'remove_ads_addon';

// Mirrors the plan trial window in billing.service.ts (kept as a separate
// constant to avoid a circular import — billing.service.ts imports from
// this file, not the other way around). Add-on subscriptions granted on
// checkout must expire on their own if never paid — see runDailyBillingCron
// in billing.service.ts, which sweeps *any* 'trialing' Subscription row
// (plan or add-on) past its trialEndsAt into 'past_due', then 'suspended'.
const ADDON_TRIAL_DAYS = 3;

export interface AddonPricing {
  monthly: { ZMW: number; BWP: number; USD: number };
}

export interface Addon {
  code: AddonCode;
  name: string;
  description: string;
  pricing: AddonPricing;
  // Add-ons only make sense for orgs on a plan that would otherwise show ads.
  eligiblePlans: string[];
}

export const ADDONS: Record<AddonCode, Addon> = {
  remove_ads_addon: {
    code: 'remove_ads_addon',
    name: 'Remove Ads',
    description: 'Remove all advertising from your Free plan without upgrading tiers.',
    pricing: {
      monthly: { ZMW: 40, BWP: 15, USD: 2 },
    },
    eligiblePlans: ['free'],
  },
};

export function getAddon(code: string): Addon | undefined {
  return ADDONS[code as AddonCode];
}

export function getAddonPrice(addonCode: AddonCode, currency: string): number {
  const addon = ADDONS[addonCode];
  if (!addon) return 0;
  const curr = currency as keyof typeof addon.pricing.monthly;
  return addon.pricing.monthly[curr] ?? addon.pricing.monthly.USD;
}

/**
 * Whether the organization currently holds an active instance of the given
 * add-on (a second, independent Subscription row with planCode = addon code).
 */
export async function hasActiveAddon(
  prisma: PrismaClient,
  organizationId: string,
  addonCode: AddonCode,
): Promise<boolean> {
  const sub = await prisma.subscription.findFirst({
    where: {
      organizationId,
      planCode: addonCode,
      status: { in: ['trialing', 'active'] },
    },
  });
  return !!sub;
}

/**
 * Subscribe an organization to an add-on. Creates a second, independent
 * `Subscription` row (planCode = addon code) alongside the org's real plan
 * subscription — never touches `Organization.planCode` or the main plan
 * subscription row. Reuses the existing Flutterwave checkout flow.
 */
export async function subscribeToAddon(prisma: PrismaClient, params: {
  organizationId: string;
  addonCode: AddonCode;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redirectUrl: string;
}): Promise<{ subscription: any; invoice: any; checkout: any }> {
  const { organizationId, addonCode, customerEmail, customerName, customerPhone, redirectUrl } = params;

  const addon = getAddon(addonCode);
  if (!addon) throw new Error('INVALID_ADDON');

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  if (!addon.eligiblePlans.includes(org.planCode)) throw new Error('ADDON_NOT_ELIGIBLE_FOR_PLAN');

  const currency = org.currency || 'ZMW';
  const amount = getAddonPrice(addonCode, currency);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const existing = await prisma.subscription.findFirst({
    where: { organizationId, planCode: addonCode, status: { in: ['trialing', 'active', 'past_due'] } },
    orderBy: { createdAt: 'desc' },
  });

  const trialEndsAt = new Date(periodStart.getTime() + ADDON_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const sub = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: 'trialing', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, trialEndsAt },
      })
    : await prisma.subscription.create({
        data: {
          organizationId,
          planCode: addonCode,
          billingCycle: 'monthly',
          status: 'trialing',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          trialEndsAt,
        },
      });

  const invoiceNumber = generateAddonInvoiceNumber();
  const txRef = generateTxRef();

  const invoice = await prisma.invoice.create({
    data: {
      organizationId,
      subscriptionId: sub.id,
      invoiceNumber,
      planCode: addonCode,
      billingCycle: 'monthly',
      amountDue: amount,
      amountPaid: 0,
      currency,
      status: 'open',
      periodStart,
      periodEnd,
      dueDate: new Date(periodStart.getTime() + 3 * 24 * 60 * 60 * 1000),
      providerRef: txRef,
    },
  });

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
      plan_code: addonCode,
      billing_cycle: 'monthly',
    },
  });

  if (checkout.success && checkout.paymentLink) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paymentLink: checkout.paymentLink } });
  }

  return { subscription: sub, invoice, checkout };
}

/**
 * Cancel an active add-on subscription for an organization.
 */
export async function cancelAddon(prisma: PrismaClient, organizationId: string, addonCode: AddonCode): Promise<any> {
  const sub = await prisma.subscription.findFirst({
    where: { organizationId, planCode: addonCode, status: { in: ['trialing', 'active', 'past_due'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) throw new Error('ADDON_NOT_ACTIVE');

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { canceledAt: new Date(), status: 'cancelled' },
  });
  await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, status: 'open' }, data: { status: 'void' } });
  return updated;
}

function generateAddonInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ADN-${year}${month}-${random}`;
}
