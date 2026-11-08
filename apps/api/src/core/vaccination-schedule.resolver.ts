import type { PrismaClient } from '@prisma/client';

type FlockForSchedule = {
  vaccinationScheduleId?: string | null;
  organizationId: string;
  breed?: { name?: string | null } | null;
};

// Resolves which vaccination schedule applies to a flock.
// Precedence: explicit per-flock choice → org default → breed default
// ('Ross 308 Zambia Schedule' for Ross 308, else 'Standard Broiler Schedule').
export async function resolveVaccinationSchedule(
  prisma: PrismaClient,
  flock: FlockForSchedule,
) {
  if (flock.vaccinationScheduleId) {
    const schedule = await prisma.vaccinationSchedule.findUnique({
      where: { id: flock.vaccinationScheduleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (schedule) return schedule;
  }

  const org = await prisma.organization.findUnique({
    where: { id: flock.organizationId },
    select: { defaultVaccinationScheduleId: true },
  });
  if (org?.defaultVaccinationScheduleId) {
    const schedule = await prisma.vaccinationSchedule.findUnique({
      where: { id: org.defaultVaccinationScheduleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (schedule) return schedule;
  }

  const scheduleName = flock.breed?.name === 'Ross 308'
    ? 'Ross 308 Zambia Schedule'
    : 'Standard Broiler Schedule';
  return prisma.vaccinationSchedule.findFirst({
    where: { name: scheduleName },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
}
