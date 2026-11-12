// Display convention for flock day numbers.
//
// Internal `ageDays` is always 0-based elapsed days (hatch day = 0). The
// org-level `hatchDayConvention` setting only controls what the user sees:
//   'day1' (default): hatch day displays as Day 1 — displayDay = ageDays + 1
//   'day0':           hatch day displays as Day 0 — displayDay = ageDays
// All business logic (performance targets, schedules, FCR) stays 0-based.

export type HatchDayConvention = 'day0' | 'day1';

export function displayDayOf(ageDays: number, convention: string | null | undefined): number {
  return convention === 'day0' ? ageDays : ageDays + 1;
}

export async function getHatchDayConvention(
  prisma: any,
  organizationId: string,
): Promise<HatchDayConvention> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { hatchDayConvention: true },
  });
  return (org?.hatchDayConvention as HatchDayConvention) ?? 'day1';
}
