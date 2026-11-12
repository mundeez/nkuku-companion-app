import { isWaterRoute } from './water-requirement.service.js';
import { displayDayOf } from './day-convention.js';

type ScheduleItemLike = {
  vaccineName: string;
  adminMethod?: string | null;
  ageDays: number;
  notes?: string | null;
};

type VaccineEntryLike = {
  vaccineName: string;
  notes?: string | null;
  isWaterRoute?: boolean;
  vaccineWater?: { minLitres: number; maxLitres: number; fieldRuleLitres: number } | null;
};

const isIbd = (name: string) => /IBD|Gumboro|bursa/i.test(name);
const isNdIb = (name: string) => /ND|Newcastle|Bronchitis|\bIB\b/i.test(name);

// Builds the health-support note for calendar day `d` from the resolved
// schedule. Returns '' when nothing vaccine-related applies that day so the
// caller can fall back to stress-pack/weekly/generic text.
// Priority within a day: VACCINATION DAY text, then pre-, then post-notes.
export function buildVaccinationDayNotes(
  scheduleItems: ScheduleItemLike[],
  d: number,
  vaccineEntries: VaccineEntryLike[] = [],
  convention: string = 'day1',
): string {
  const parts: string[] = [];

  // VACCINATION DAY — items administered on this day
  for (const v of vaccineEntries) {
    const mix = v.isWaterRoute && v.vaccineWater
      ? ` Mix in ~${v.vaccineWater.minLitres}–${v.vaccineWater.maxLitres} L (field rule ~${v.vaccineWater.fieldRuleLitres} L).`
      : '';
    parts.push(`${v.vaccineName} — VACCINATION DAY. ${v.notes ?? ''}${mix}`);
  }

  // PRE/POST — derived from every farm-administered item (ageDays > 0)
  for (const item of scheduleItems) {
    if (item.ageDays <= 0) continue; // hatchery D0 — no on-farm pre/post
    const displayDay = displayDayOf(item.ageDays, convention);
    const waterRoute = isWaterRoute(item.adminMethod);

    if (d === item.ageDays - 2 && waterRoute) {
      parts.push(`PRE-VACCINATION (Day ${displayDay} ${item.vaccineName}): Suspend water chlorination from today (48h before).`);
    }
    if (d === item.ageDays - 1) {
      parts.push(`PRE-VACCINATION (Day ${displayDay} ${item.vaccineName}): Administer vitamins/electrolytes for 24h before.${waterRoute ? ' Prepare skim milk 2 g/L stabiliser. Plan 1–2 h water withdrawal tomorrow.' : ''}`);
    }
    if (d === item.ageDays + 1) {
      // IBD/Gumboro is checked first: "IBD" would otherwise match the IB test.
      const extra = isIbd(item.vaccineName)
        ? ' and bursal reaction'
        : isNdIb(item.vaccineName)
          ? ' and respiratory signs (snicking, rales)'
          : '';
      parts.push(`POST-VACCINATION (${item.vaccineName}): Vitamins/electrolytes for 24h. Monitor for vaccine reaction${extra}.`);
    }
  }

  return parts.join(' ');
}
