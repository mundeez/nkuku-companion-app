import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/routes.js';
import { requirePlatformAdmin } from '../../core/billing/feature-gate.js';
import { getBrandingConfig, validateLicenseDb } from '../../core/branding/branding.config.js';

export async function buildAdminOpsModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── Branding config (public, no auth) ──────
  // Returns only public branding fields. License details are NOT exposed
  // to unauthenticated callers — the /branding endpoint is used by the
  // login screen before authentication.
  app.get('/branding', async () => {
    const config = getBrandingConfig();
    return {
      appName: config.appName,
      tagline: config.tagline,
      primaryColor: config.primaryColor,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      supportEmail: config.supportEmail,
      supportPhone: config.supportPhone,
      websiteUrl: config.websiteUrl,
      isWhiteLabel: config.isWhiteLabel,
    };
  });

  // ── License status (auth + platform admin) ──
  app.get('/license', { preHandler: [authenticate, requirePlatformAdmin] }, async () => {
    const config = getBrandingConfig();
    const license = await validateLicenseDb(prisma);
    // Also check if this license is registered in the DB
    let dbLicense: any = null;
    try {
      dbLicense = config.licenseKey
        ? await prisma.license.findUnique({ where: { licenseKey: config.licenseKey } })
        : null;
    } catch { /* table may not exist yet */ }
    return {
      licensedTo: config.licensedTo,
      licenseValid: license.valid,
      licenseExpiry: config.licenseExpiry,
      reason: license.reason,
      dbRegistered: !!dbLicense,
      dbStatus: dbLicense?.status ?? null,
      dbExpiresAt: dbLicense?.expiresAt ?? null,
    };
  });

  // ── Dashboard metrics ───────────────────────
  app.get('/metrics', { preHandler: [authenticate, requirePlatformAdmin] }, async () => {
    const [
      organizations,
      activeSubscriptions,
      pastDueSubscriptions,
      suspendedSubscriptions,
      cancelledSubscriptions,
      paidInvoices,
      users,
      activeFlocks,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'past_due' } }),
      prisma.subscription.count({ where: { status: 'suspended' } }),
      prisma.subscription.count({ where: { status: 'cancelled' } }),
      prisma.invoice.findMany({
        where: { status: 'paid' },
        select: { amountPaid: true, currency: true, paidAt: true },
      }),
      prisma.user.count(),
      prisma.broilerFlock.count({ where: { status: 'active' } }),
    ]);

    // MRR: sum of active subscription amounts (monthly equivalent)
    const activeSubs = await prisma.subscription.findMany({
      where: { status: 'active' },
      select: { planCode: true, billingCycle: true, currentPeriodStart: true },
    });

    // Revenue from paid invoices
    const revenueByCurrency = new Map<string, number>();
    for (const inv of paidInvoices) {
      const cur = inv.currency || 'ZMW';
      revenueByCurrency.set(cur, (revenueByCurrency.get(cur) || 0) + Number(inv.amountPaid));
    }

    // Plan distribution
    const planCounts = new Map<string, number>();
    for (const sub of activeSubs) {
      planCounts.set(sub.planCode, (planCounts.get(sub.planCode) || 0) + 1);
    }
    const planDistribution = Array.from(planCounts.entries())
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count);

    // Recent organizations (last 10)
    const recentOrganizations = await prisma.organization.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        planCode: true,
        country: true,
        createdAt: true,
        _count: { select: { members: true, flocks: true } },
      },
    });

    return {
      totals: {
        organizations,
        users,
        activeFlocks,
        activeSubscriptions,
        pastDueSubscriptions,
        suspendedSubscriptions,
        cancelledSubscriptions,
      },
      revenueByCurrency: Array.from(revenueByCurrency.entries()).map(([currency, amount]) => ({
        currency,
        amount: Number(amount.toFixed(2)),
      })),
      planDistribution,
      recentOrganizations: recentOrganizations.map((o: any) => ({
        id: o.id,
        name: o.name,
        planCode: o.planCode,
        country: o.country,
        createdAt: o.createdAt,
        userCount: o._count?.members ?? 0,
        flockCount: o._count?.flocks ?? 0,
      })),
    };
  });

  // ── List all organizations (tenants) ───────
  app.get('/organizations', { preHandler: [authenticate, requirePlatformAdmin] }, async (request) => {
    const query = (request.query as any) ?? {};
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
    const search = query.search as string | undefined;

    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { planCode: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          planCode: true,
          country: true,
          currency: true,
          createdAt: true,
          _count: { select: { members: true, flocks: true } },
          subscriptions: {
            where: { status: { in: ['active', 'past_due', 'suspended'] } },
            select: { status: true, planCode: true, billingCycle: true, currentPeriodEnd: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      items: orgs.map((o: any) => ({
        id: o.id,
        name: o.name,
        planCode: o.planCode,
        country: o.country,
        currency: o.currency,
        createdAt: o.createdAt,
        userCount: o._count?.members ?? 0,
        flockCount: o._count?.flocks ?? 0,
        subscription: o.subscriptions?.[0] ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  // ── Organization detail ─────────────────────
  app.get('/organizations/:id', { preHandler: [authenticate, requirePlatformAdmin] }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true, flocks: true, subscriptions: true, invoices: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, planCode: true, status: true, billingCycle: true, currentPeriodStart: true, currentPeriodEnd: true },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, status: true, amountDue: true, amountPaid: true, currency: true, createdAt: true, paidAt: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, email: true, isPlatformAdmin: true, createdAt: true },
            },
          },
          take: 20,
        },
      },
    });

    if (!org) {
      return { error: 'NOT_FOUND' };
    }

    return org;
  });

  // ── Failed payments (past_due + suspended) ─
  app.get('/failed-payments', { preHandler: [authenticate, requirePlatformAdmin] }, async () => {
    const subs = await prisma.subscription.findMany({
      where: { status: { in: ['past_due', 'suspended'] } },
      include: {
        organization: {
          select: { id: true, name: true, planCode: true, country: true },
        },
        invoices: {
          where: { status: { in: ['open', 'uncollectible'] } },
          select: { id: true, amountDue: true, currency: true, createdAt: true, status: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      items: subs.map((s: any) => ({
        subscriptionId: s.id,
        status: s.status,
        planCode: s.planCode,
        organization: s.organization,
        currentPeriodEnd: s.currentPeriodEnd,
        invoices: s.invoices,
      })),
      count: subs.length,
    };
  });

  // ── Audit log viewer ────────────────────────
  app.get('/audit-logs', { preHandler: [authenticate, requirePlatformAdmin] }, async (request) => {
    const query = (request.query as any) ?? {};
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
    const organizationId = query.organizationId as string | undefined;
    const action = query.action as string | undefined;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          entityType: true,
          entityId: true,
          action: true,
          ipAddress: true,
          occurredAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });
}
