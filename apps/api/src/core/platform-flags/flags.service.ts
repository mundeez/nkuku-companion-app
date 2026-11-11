// ── PLATFORM FLAGS ───────────────────────────────────────
// Generic key→JSON settings store (platform_flags table, P3). Currently
// holds 'maintenance_mode'; P4 feature flags reuse this table.
//
// getMaintenanceMode() is hit on EVERY authenticated tenant request, so
// the flag value is cached in-process for MAINTENANCE_CACHE_MS (10 s per
// the P3 spec). setPlatformFlag() clears the local cache so a toggle
// takes effect immediately on this instance.

import type { PrismaClient } from '@prisma/client';

export const MAINTENANCE_FLAG_KEY = 'maintenance_mode';
const MAINTENANCE_CACHE_MS = 10_000;

export interface MaintenanceMode {
  enabled: boolean;
  message: string | null;
  by?: string | null;
  at?: string | null;
}

let maintenanceCache: { at: number; value: MaintenanceMode } | null = null;

/** Read a platform flag row. Returns the parsed JSON value or null. */
export async function getPlatformFlag<T = any>(
  prisma: PrismaClient,
  key: string,
): Promise<T | null> {
  const row = await prisma.platformFlag.findUnique({ where: { key } });
  return (row?.value as T) ?? null;
}

/** Upsert a platform flag row and invalidate the local maintenance cache. */
export async function setPlatformFlag(
  prisma: PrismaClient,
  key: string,
  value: unknown,
  updatedByStaffId?: string | null,
): Promise<void> {
  await prisma.platformFlag.upsert({
    where: { key },
    create: { key, value: value as any, updatedByStaffId: updatedByStaffId ?? null },
    update: { value: value as any, updatedByStaffId: updatedByStaffId ?? null },
  });
  if (key === MAINTENANCE_FLAG_KEY) invalidateMaintenanceCache();
}

/** Drop the in-process maintenance cache (toggled via /ops/maintenance). */
export function invalidateMaintenanceCache(): void {
  maintenanceCache = null;
}

/**
 * Maintenance-mode state with a 10 s in-process cache. Fail-open: a DB
 * error reading the flag disables maintenance rather than 503-ing every
 * tenant request because the flag table hiccuped.
 */
export async function getMaintenanceMode(prisma: PrismaClient): Promise<MaintenanceMode> {
  if (maintenanceCache && Date.now() - maintenanceCache.at < MAINTENANCE_CACHE_MS) {
    return maintenanceCache.value;
  }
  let value: MaintenanceMode = { enabled: false, message: null };
  try {
    const raw = await getPlatformFlag<any>(prisma, MAINTENANCE_FLAG_KEY);
    if (raw && typeof raw === 'object' && raw.enabled === true) {
      value = {
        enabled: true,
        message: typeof raw.message === 'string' ? raw.message : null,
        by: raw.by ?? null,
        at: raw.at ?? null,
      };
    }
  } catch {
    // Fail open — treat a flag-store error as "not in maintenance".
    value = { enabled: false, message: null };
  }
  maintenanceCache = { at: Date.now(), value };
  return value;
}
