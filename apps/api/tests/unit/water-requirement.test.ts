import { describe, it, expect } from 'vitest';
import {
  computeDailyWater,
  computeVaccineMixVolume,
  isWaterRoute,
  WATER_FEED_RATIO_MIN,
  WATER_FEED_RATIO_MAX,
  BASE_TEMP_C,
  WATER_PCT_PER_DEG_C,
  VACCINE_WINDOW_HOURS,
} from '../../src/core/water-requirement.service.js';

describe('water-requirement.service', () => {
  it('exports the agreed constants', () => {
    expect(WATER_FEED_RATIO_MIN).toBe(1.6);
    expect(WATER_FEED_RATIO_MAX).toBe(1.8);
    expect(BASE_TEMP_C).toBe(21);
    expect(WATER_PCT_PER_DEG_C).toBe(0.065);
    expect(VACCINE_WINDOW_HOURS).toBe(2);
  });

  it('computes the feed-ratio bounds at the base temperature (21°C)', () => {
    // 0.1 kg feed/bird × 1000 birds → 160–180 L at 21°C (no heat uplift)
    const w = computeDailyWater({ targetFeedKgPerBird: 0.1, birdsAlive: 1000, ambientTempC: 21 });
    expect(w.minLitres).toBeCloseTo(160, 5);
    expect(w.maxLitres).toBeCloseTo(180, 5);
    // Per-bird figures are rounded to 1 decimal like the totals
    expect(w.perBirdMinLitres).toBe(0.2);
    expect(w.perBirdMaxLitres).toBe(0.2);
  });

  it('applies +6.5% per °C above 21 to the max bound (25°C → ×1.26)', () => {
    const w = computeDailyWater({ targetFeedKgPerBird: 0.1, birdsAlive: 1000, ambientTempC: 25 });
    expect(w.minLitres).toBeCloseTo(160, 5);
    expect(w.maxLitres).toBeCloseTo(180 * 1.26, 1);
  });

  it('does not cool below the base bound under 21°C', () => {
    const w = computeDailyWater({ targetFeedKgPerBird: 0.1, birdsAlive: 1000, ambientTempC: 15 });
    expect(w.maxLitres).toBeCloseTo(180, 5);
  });

  it('returns zero for zero birds', () => {
    const w = computeDailyWater({ targetFeedKgPerBird: 0.1, birdsAlive: 0, ambientTempC: 25 });
    expect(w.minLitres).toBe(0);
    expect(w.maxLitres).toBe(0);
  });

  it('vaccine mix volume = daily × 2/24, field rule = displayDay × birds / 1000', () => {
    const daily = computeDailyWater({ targetFeedKgPerBird: 0.1, birdsAlive: 1000, ambientTempC: 21 });
    const mix = computeVaccineMixVolume({ daily, ageDays: 13, birdsAlive: 1000 });
    expect(mix.minLitres).toBeCloseTo(160 * (2 / 24), 1);
    expect(mix.maxLitres).toBeCloseTo(180 * (2 / 24), 1);
    // displayDay = ageDays + 1 = 14 → 14 × 1000 / 1000 = 14 L
    expect(mix.fieldRuleLitres).toBe(14);
  });

  it('isWaterRoute matches drinking-water administration methods', () => {
    expect(isWaterRoute('Drinking water')).toBe(true);
    expect(isWaterRoute('drinking water')).toBe(true);
    expect(isWaterRoute('Water (2h window)')).toBe(true);
    expect(isWaterRoute('Eye drop')).toBe(false);
    expect(isWaterRoute('Subcutaneous injection')).toBe(false);
    expect(isWaterRoute(null)).toBe(false);
    expect(isWaterRoute(undefined)).toBe(false);
  });
});
