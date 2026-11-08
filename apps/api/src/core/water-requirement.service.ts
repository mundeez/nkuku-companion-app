// Daily drinking-water requirement estimates for broiler flocks.
// min = feedKg/bird × 1.6 × birds (at BASE_TEMP_C)
// max = feedKg/bird × 1.8 × birds × (1 + 0.065 × max(0, ambientTempC − 21))

export const WATER_FEED_RATIO_MIN = 1.6;
export const WATER_FEED_RATIO_MAX = 1.8;
export const BASE_TEMP_C = 21;
export const WATER_PCT_PER_DEG_C = 0.065;
export const VACCINE_WINDOW_HOURS = 2;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeDailyWater({
  targetFeedKgPerBird,
  birdsAlive,
  ambientTempC,
}: {
  targetFeedKgPerBird: number;
  birdsAlive: number;
  ambientTempC: number;
}) {
  const heatFactor = 1 + WATER_PCT_PER_DEG_C * Math.max(0, ambientTempC - BASE_TEMP_C);
  const perBirdMin = targetFeedKgPerBird * WATER_FEED_RATIO_MIN;
  const perBirdMax = targetFeedKgPerBird * WATER_FEED_RATIO_MAX * heatFactor;
  return {
    minLitres: round1(perBirdMin * birdsAlive),
    maxLitres: round1(perBirdMax * birdsAlive),
    perBirdMinLitres: round1(perBirdMin),
    perBirdMaxLitres: round1(perBirdMax),
    ambientTempC,
  };
}

// Vaccine mixing volume for drinking-water administration:
// primary = the flock's daily range scaled to the 2-hour consumption window;
// secondary "field rule" = displayDay × birdsAlive / 1000 litres.
export function computeVaccineMixVolume({
  daily,
  ageDays,
  birdsAlive,
}: {
  daily: { minLitres: number; maxLitres: number };
  ageDays: number;
  birdsAlive: number;
}) {
  const windowFraction = VACCINE_WINDOW_HOURS / 24;
  return {
    minLitres: round1(daily.minLitres * windowFraction),
    maxLitres: round1(daily.maxLitres * windowFraction),
    fieldRuleLitres: round1(((ageDays + 1) * birdsAlive) / 1000),
  };
}

export function isWaterRoute(adminMethod: string | null | undefined): boolean {
  if (!adminMethod) return false;
  return /water/i.test(adminMethod);
}
