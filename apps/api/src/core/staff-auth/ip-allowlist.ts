// ── PLATFORM IP ALLOWLIST ────────────────────────────────
// Defence-in-depth for /api/v1/platform/* (nginx also restricts the
// admin host — plan §4). PLATFORM_ALLOWED_CIDRS is a comma-separated
// list of IPv4 CIDRs or exact IPs (IPv6 exact match supported).
// Empty/unset = allow all, with a warning logged once (dev convenience;
// production deployments SHOULD configure it).
//
// Approved escape hatch (plan §8): when PLATFORM_ALLOWLIST_BYPASS_TOTP
// =true, a request carrying a valid staff JWT whose role is super_admin
// may pass from a non-allowlisted IP. EVERY such bypass is recorded as
// a PlatformAuditEvent ('security.allowlist_bypass').

import { getClientIp, tryDecodeStaffToken, STAFF_ACCESS_COOKIE } from './staff-auth.service.js';
import { writePlatformAudit } from './audit.service.js';

const rawCidrs = process.env.PLATFORM_ALLOWED_CIDRS ?? '';
const BYPASS_ENABLED = process.env.PLATFORM_ALLOWLIST_BYPASS_TOTP === 'true';

let warnedEmpty = false;

// ── CIDR matching ────────────────────────────────────────
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const octet = Number(p);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n >>> 0;
}

/** Normalise ::ffff:a.b.c.d mapped addresses to plain IPv4. */
function normalizeIp(ip: string): string {
  const v4mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return v4mapped ? v4mapped[1] : ip;
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const target = normalizeIp(ip.trim());
  const rule = cidr.trim();
  if (!target || !rule) return false;

  const slash = rule.indexOf('/');
  if (slash === -1) {
    // Exact match (works for IPv6 literals too)
    return target.toLowerCase() === rule.toLowerCase();
  }

  const base = rule.slice(0, slash);
  const bits = Number.parseInt(rule.slice(slash + 1), 10);
  const baseInt = ipv4ToInt(base);
  const targetInt = ipv4ToInt(target);
  if (baseInt === null || targetInt === null) return false;
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (baseInt & mask) === (targetInt & mask);
}

export function ipInAllowlist(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => ipMatchesCidr(ip, c));
}

/**
 * Fastify onRequest hook — register inside the /api/v1/platform module
 * scope so it only applies to platform routes.
 */
export async function platformIpAllowlist(request: any, reply: any) {
  const cidrs = rawCidrs
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (cidrs.length === 0) {
    if (!warnedEmpty) {
      warnedEmpty = true;
      request.log?.warn?.(
        '[PlatformAllowlist] PLATFORM_ALLOWED_CIDRS is empty — allowing all IPs. Set it in production.',
      );
    }
    return;
  }

  const ip = getClientIp(request);
  if (ipInAllowlist(ip, cidrs)) return;

  // ── Break-glass escape hatch ──
  // A valid super_admin staff token (TOTP-enrolled account by definition —
  // tokens are only minted after TOTP verification) may bypass. Audited.
  if (BYPASS_ENABLED) {
    const auth = request.headers.authorization;
    const token = auth?.startsWith('Bearer ')
      ? auth.slice(7)
      : request.cookies?.[STAFF_ACCESS_COOKIE];
    const claims = tryDecodeStaffToken(token);
    if (claims?.role === 'super_admin') {
      const prisma = request.server?.prisma ?? reply.server?.prisma;
      if (prisma) {
        // Confirm the account is still active before honouring bypass.
        const staff = await prisma.staffUser.findUnique({ where: { id: claims.staffId } });
        if (staff?.isActive) {
          await writePlatformAudit(prisma, {
            actorStaffId: claims.staffId,
            actorRole: 'super_admin',
            action: 'security.allowlist_bypass',
            targetType: 'security',
            targetId: request.url,
            reason: `Non-allowlisted IP ${ip} bypassed via PLATFORM_ALLOWLIST_BYPASS_TOTP`,
            ip,
            userAgent: request.headers?.['user-agent'] ?? null,
            requestId: request.id ?? null,
          });
          request.staffAllowlistBypassed = true;
          return;
        }
      }
    }
  }

  return reply.status(403).send({
    error: 'IP_NOT_ALLOWLISTED',
    message: 'This IP address is not allowed to access the platform console',
  });
}
