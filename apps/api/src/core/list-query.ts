// ── SHARED LIST-QUERY HELPERS (M-1) ──────────────────────
// Standardises list endpoints on: q (free-text search), limit, offset,
// sortBy, sortDir, fromDate, toDate. All params optional — omitting them
// preserves each endpoint's previous response shape, so existing web and
// mobile clients are unaffected until they opt in (M-2/M-3).
//
// Search uses Prisma `contains` + `insensitive` (ILIKE %q%), which the
// pg_trgm GIN indexes from migration 20261021180000_list_search_trgm
// accelerate.

import { z } from 'zod';

export const ListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.string().max(50).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ListQuery = z.infer<typeof ListQuerySchema>;

/**
 * Build an OR clause matching `q` (case-insensitive substring) against any
 * of the given field paths. Supports one-level relations via dot notation:
 *   ['name', 'breed.name'] → OR: [{name:{contains}}, {breed:{is:{name:{contains}}}}]
 */
export function searchWhere(q: string | undefined, fields: string[]): Record<string, unknown>[] | undefined {
  if (!q) return undefined;
  const or = fields.map((path) => {
    const cond = { contains: q, mode: 'insensitive' as const };
    if (!path.includes('.')) return { [path]: cond };
    const [rel, field] = path.split('.', 2);
    return { [rel]: { is: { [field]: cond } } };
  });
  return or;
}

/**
 * Apply a date range to `where[field]` (inclusive from / to end-of-day).
 */
export function dateRange(
  where: Record<string, any>,
  field: string,
  fromDate?: string,
  toDate?: string,
): void {
  if (!fromDate && !toDate) return;
  const range: { gte?: Date; lt?: Date } = {};
  if (fromDate) range.gte = new Date(`${fromDate}T00:00:00.000Z`);
  if (toDate) range.lt = new Date(`${toDate}T23:59:59.999Z`);
  where[field] = { ...(where[field] || {}), ...range };
}

/**
 * Resolve a safe orderBy: only fields on the allowlist are sortable.
 * `fallback` preserves the endpoint's previous default ordering.
 */
export function orderBy(
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc' | undefined,
  allowed: string[],
  fallback: any,
): any {
  if (!sortBy || !allowed.includes(sortBy)) return fallback;
  const dir = sortDir || 'asc';
  if (sortBy.includes('.')) {
    const [rel, field] = sortBy.split('.', 2);
    return { [rel]: { [field]: dir } };
  }
  return { [sortBy]: dir };
}
