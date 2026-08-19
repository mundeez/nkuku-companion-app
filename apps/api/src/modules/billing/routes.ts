import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { SELF_SERVE_PLANS, getPlan, type PlanCode } from '../../core/billing/plans.js';
import {
  getSubscriptionInfo,
  subscribeToPlan,
  cancelSubscription,
  processPaymentEvent,
  verifyPaymentRedirect,
} from '../../core/billing/billing.service.js';
import { verifyWebhookSignature, isMockMode } from '../../core/billing/flutterwave.service.js';
import { getPlanLimitsForOrg, shouldShowAds } from '../../core/billing/feature-gate.js';
import { ADDONS, hasActiveAddon, subscribeToAddon, cancelAddon, type AddonCode } from '../../core/billing/addons.js';

const SubscribeSchema = z.object({
  planCode: z.enum(['free', 'grower', 'business']),
  billingCycle: z.enum(['monthly', 'cycle_3mo', 'annual']).default('monthly'),
  redirectUrl: z.string().url().optional(),
});

const VerifyPaymentSchema = z.object({
  txRef: z.string().min(1),
  txnId: z.string().optional(),
  status: z.string().optional(),
});

// Validates a caller-supplied redirectUrl is same-origin or from an
// explicitly allowed origin, to prevent the post-checkout redirect from
// being used as an open redirect (Flutterwave sends the user back to this
// URL with invoice/tx details in the query string). Shared by both plan
// and add-on checkout flows. Returns an error message if invalid, or null.
function validateRedirectUrl(redirectUrl: string | undefined): string | null {
  if (!redirectUrl) return null;
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, ''));
  const webBaseUrl = (process.env.WEB_BASE_URL || 'http://localhost:30000').replace(/\/$/, '');
  const allowedRedirects = [webBaseUrl, ...allowedOrigins].filter(Boolean);
  const isAllowed = allowedRedirects.some((origin) => redirectUrl.startsWith(origin + '/') || redirectUrl === origin);
  return isAllowed ? null : 'Redirect URL must be same-origin or from an allowed domain';
}

export async function buildBillingModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── GET /plans — list all self-serve plans with pricing ──
  app.get('/plans', async () => {
    return {
      plans: SELF_SERVE_PLANS.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        pricing: p.pricing,
        limits: p.limits,
        isSelfServe: p.isSelfServe,
      })),
    };
  });

  // ── GET /subscription — current subscription + plan limits + usage ──
  app.get('/subscription', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const [info, limits, adsShown, adsRemoved] = await Promise.all([
      getSubscriptionInfo(prisma, organizationId),
      getPlanLimitsForOrg(prisma, organizationId),
      shouldShowAds(prisma, organizationId),
      hasActiveAddon(prisma, organizationId, 'remove_ads_addon'),
    ]);
    return { ...info, ...limits, adsShown, addons: { remove_ads_addon: adsRemoved } };
  });

  // ── GET /addons — list available add-ons ──
  app.get('/addons', async () => {
    return { addons: Object.values(ADDONS) };
  });

  // ── POST /addons/:code/subscribe — purchase an add-on ──
  app.post('/addons/:code/subscribe', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const _authUser = (request as any).authUser;
    const { code } = z.object({ code: z.enum(['remove_ads_addon']) }).parse(request.params);
    const { redirectUrl } = z.object({ redirectUrl: z.string().url().optional() }).parse(request.body ?? {});

    const user = await prisma.user.findUnique({ where: { id: _authUser.userId } });
    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    const redirectError = validateRedirectUrl(redirectUrl);
    if (redirectError) {
      return reply.status(400).send({ error: 'INVALID_REDIRECT_URL', message: redirectError });
    }
    const resolvedRedirect = redirectUrl || `${process.env.WEB_BASE_URL || 'http://localhost:30000'}/billing/callback`;

    try {
      const result = await subscribeToAddon(prisma, {
        organizationId,
        addonCode: code as AddonCode,
        customerEmail: user.email || '',
        customerName: user.name || undefined,
        customerPhone: user.phone || undefined,
        redirectUrl: resolvedRedirect,
      });
      return reply.status(200).send({
        subscription: result.subscription,
        invoice: result.invoice,
        checkout: result.checkout
          ? { success: result.checkout.success, paymentLink: result.checkout.paymentLink, txRef: result.checkout.txRef, message: result.checkout.message }
          : null,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'ADDON_SUBSCRIBE_FAILED' });
    }
  });

  // ── POST /addons/:code/cancel — cancel an add-on ──
  app.post('/addons/:code/cancel', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { code } = z.object({ code: z.enum(['remove_ads_addon']) }).parse(request.params);
    try {
      const result = await cancelAddon(prisma, organizationId, code as AddonCode);
      return { success: true, subscription: result };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'ADDON_CANCEL_FAILED' });
    }
  });

  // ── POST /subscribe — subscribe to a plan (or change plans) ──
  app.post('/subscribe', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const _authUser = (request as any).authUser;

    let body;
    try {
      body = SubscribeSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    // Get user email for Flutterwave customer
    const user = await prisma.user.findUnique({ where: { id: _authUser.userId } });
    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    // Get org for currency
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return reply.status(404).send({ error: 'ORG_NOT_FOUND' });

    const plan = getPlan(body.planCode as PlanCode);
    if (!plan) return reply.status(400).send({ error: 'INVALID_PLAN' });
    if (!plan.isSelfServe) return reply.status(400).send({ error: 'PLAN_NOT_SELF_SERVE' });

    const redirectUrl = body.redirectUrl || `${process.env.WEB_BASE_URL || 'http://localhost:30000'}/billing/callback`;

    const redirectError = validateRedirectUrl(body.redirectUrl);
    if (redirectError) {
      return reply.status(400).send({ error: 'INVALID_REDIRECT_URL', message: redirectError });
    }

    try {
      const result = await subscribeToPlan(prisma, {
        organizationId,
        planCode: body.planCode as PlanCode,
        billingCycle: body.billingCycle,
        customerEmail: user.email || '',
        customerName: user.name || undefined,
        customerPhone: user.phone || undefined,
        redirectUrl,
      });

      return reply.status(200).send({
        subscription: result.subscription,
        invoice: result.invoice,
        checkout: result.checkout
          ? {
              success: result.checkout.success,
              paymentLink: result.checkout.paymentLink,
              txRef: result.checkout.txRef,
              message: result.checkout.message,
            }
          : null,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'SUBSCRIPTION_FAILED' });
    }
  });

  // ── POST /cancel — cancel subscription (downgrade to free) ──
  app.post('/cancel', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    try {
      const result = await cancelSubscription(prisma, organizationId);
      return { success: true, subscription: result, message: 'Subscription cancelled. You have been moved to the Free plan.' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'CANCEL_FAILED' });
    }
  });

  // ── GET /invoices — list invoices for the organization ──
  app.get('/invoices', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        planCode: true,
        billingCycle: true,
        amountDue: true,
        amountPaid: true,
        currency: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        paidAt: true,
        paymentLink: true,
        createdAt: true,
      },
    });
    return invoices;
  });

  // ── GET /invoices/:id — get a single invoice with payment events ──
  app.get('/invoices/:id', { preHandler: [authenticate, requireRole('owner', 'manager')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        paymentEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) return reply.status(404).send({ error: 'NOT_FOUND' });
    return invoice;
  });

  // ── POST /verify-payment — verify a payment after redirect ──
  app.post('/verify-payment', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const body = VerifyPaymentSchema.parse(request.body);
    const result = await verifyPaymentRedirect(prisma, { ...body, organizationId });
    return reply.status(result.success ? 200 : 400).send(result);
  });

  // ── POST /webhook — Flutterwave webhook (public, verified by signature) ──
  // This endpoint is NOT behind authenticate — it's verified by the
  // Flutterwave webhook hash header instead.
  app.post('/webhook', async (request, reply) => {
    const signature = request.headers['verif-hash'] as string;

    if (!verifyWebhookSignature(signature)) {
      return reply.status(401).send({ error: 'INVALID_SIGNATURE' });
    }

    const body = request.body as any;
    if (!body || !body.event) {
      return reply.status(400).send({ error: 'INVALID_WEBHOOK' });
    }

    // Only process charge completion events
    if (body.event !== 'charge.completed') {
      return reply.status(200).send({ success: true, message: `Ignored event: ${body.event}` });
    }

    // Flutterwave webhook payload structure:
    // { event: "charge.completed", data: { tx_ref, id, amount, currency, status, ... } }
    const data = body.data || {};
    const txRef = data.tx_ref;

    if (!txRef) {
      return reply.status(400).send({ error: 'NO_TX_REF' });
    }

    // Process the payment event (webhook is not org-scoped — it comes from Flutterwave)
    const result = await processPaymentEvent(prisma, {
      txRef,
      txnId: data.id?.toString(),
      rawPayload: body,
    });

    // Flutterwave expects a 200 response
    return reply.status(200).send({ success: result.success, message: result.message });
  });

  // ── GET /dev/mock-pay — dev-only endpoint to simulate a successful payment ──
  // Only available when FLUTTERWAVE_SECRET_KEY is not set (mock mode)
  app.get('/dev/mock-pay', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    if (!isMockMode) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }

    const organizationId = getOrganizationId(request);
    const { txRef } = request.query as any;
    if (!txRef) return reply.status(400).send({ error: 'MISSING_TX_REF' });

    // Org-scoped to prevent IDOR — can only mock-pay invoices for your own org
    const result = await processPaymentEvent(prisma, { txRef, organizationId });
    return reply.status(result.success ? 200 : 400).send(result);
  });
}
