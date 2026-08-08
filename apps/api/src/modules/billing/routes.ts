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
  getOrCreateSubscription,
} from '../../core/billing/billing.service.js';
import { verifyWebhookSignature, isMockMode } from '../../core/billing/flutterwave.service.js';
import { getPlanLimitsForOrg } from '../../core/billing/feature-gate.js';

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
    const [info, limits] = await Promise.all([
      getSubscriptionInfo(prisma, organizationId),
      getPlanLimitsForOrg(prisma, organizationId),
    ]);
    return { ...info, ...limits };
  });

  // ── POST /subscribe — subscribe to a plan (or change plans) ──
  app.post('/subscribe', { preHandler: [authenticate, requireRole('owner')] }, async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const authUser = (request as any).authUser;

    let body;
    try {
      body = SubscribeSchema.parse(request.body);
    } catch (err: any) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: err.errors?.[0]?.message || 'Invalid request' });
    }

    // Get user email for Flutterwave customer
    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' });

    // Get org for currency
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return reply.status(404).send({ error: 'ORG_NOT_FOUND' });

    const plan = getPlan(body.planCode as PlanCode);
    if (!plan) return reply.status(400).send({ error: 'INVALID_PLAN' });
    if (!plan.isSelfServe) return reply.status(400).send({ error: 'PLAN_NOT_SELF_SERVE' });

    const redirectUrl = body.redirectUrl || `${process.env.WEB_BASE_URL || 'http://localhost:30000'}/billing/callback`;

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
    const body = VerifyPaymentSchema.parse(request.body);
    const result = await verifyPaymentRedirect(prisma, body);
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

    // Flutterwave webhook payload structure:
    // { event: "charge.completed", data: { tx_ref, id, amount, currency, status, ... } }
    const data = body.data || {};
    const txRef = data.tx_ref;

    if (!txRef) {
      return reply.status(400).send({ error: 'NO_TX_REF' });
    }

    // Process the payment event
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

    const result = await processPaymentEvent(prisma, { txRef });
    return reply.status(result.success ? 200 : 400).send(result);
  });
}
