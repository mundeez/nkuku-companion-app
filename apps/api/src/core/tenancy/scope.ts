// ── MULTI-TENANCY SCOPING HELPERS ────────────────────────
// Central helpers for enforcing per-organization data isolation across API
// modules. Most tenant-scoped tables carry their own `organizationId`
// column and can filter/write directly. Child records of a flock (growth,
// feed, water, mortality, vaccination, medication, environmental records,
// tasks, financial records, alerts) do NOT carry organizationId themselves
// — they are scoped transitively through their parent BroilerFlock, so
// callers must verify the flock belongs to the caller's organization
// before reading/writing child records. Use `assertFlockInOrganization`
// for that.

export function getOrganizationId(request: any): string {
  const authUser = request.authUser;
  if (!authUser?.organizationId) {
    throw Object.assign(new Error('MISSING_ORGANIZATION_CONTEXT'), { statusCode: 401 });
  }
  return authUser.organizationId;
}

export class NotFoundInOrganizationError extends Error {
  statusCode = 404;
  constructor(entity: string) {
    super(`${entity}_NOT_FOUND`);
  }
}

// Confirms a flock belongs to the given organization. Returns the flock if
// so; throws NotFoundInOrganizationError otherwise (deliberately the same
// error shape as "flock doesn't exist" — cross-tenant records should be
// invisible, not distinguishable as "exists but forbidden").
export async function assertFlockInOrganization(prisma: any, flockId: string, organizationId: string) {
  const flock = await prisma.broilerFlock.findFirst({
    where: { id: flockId, organizationId },
  });
  if (!flock) {
    throw new NotFoundInOrganizationError('FLOCK');
  }
  return flock;
}

// Returns the list of flock IDs belonging to an organization — useful for
// scoping "list all X across my flocks" queries with a single extra query
// instead of a join on every child table.
export async function getOrganizationFlockIds(prisma: any, organizationId: string): Promise<string[]> {
  const flocks = await prisma.broilerFlock.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return flocks.map((f: any) => f.id);
}
