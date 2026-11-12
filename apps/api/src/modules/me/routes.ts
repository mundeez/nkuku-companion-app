// ── TENANT "ME" MODULE (/api/v1/me) ──────────────────────
// P4: per-caller endpoints that don't belong to a domain module.
//   GET /flags → evaluated feature-flag map for the caller's org.
// This route group is on the suspended-org read-only-lock allowlist.

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/routes.js';
import { getOrganizationId } from '../../core/tenancy/scope.js';
import { getEffectivePlanCode } from '../../core/billing/billing.service.js';
import { listForOrg } from '../../core/feature-flags/flag.service.js';

export async function buildMeModule(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /api/v1/me/flags — { "<flagKey>": bool, ... } for the caller's org.
  // Evaluated against the org's EFFECTIVE plan code (TenantOverride-aware)
  // so a comp'd org sees the comp'd plan's flag set.
  app.get('/flags', { preHandler: [authenticate] }, async (request) => {
    const organizationId = getOrganizationId(request);
    const planCode = await getEffectivePlanCode(prisma, organizationId);
    const flags = await listForOrg(prisma, organizationId, planCode);
    return { flags };
  });
}
