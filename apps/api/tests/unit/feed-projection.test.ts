import { describe, it, expect } from 'vitest';
import { calculateItemsRequired } from '../../src/core/calculation-engine';

/**
 * Unit tests for the per-flock feed projection calculation logic.
 *
 * The projection endpoint (broiler-flocks/:id/feed-projection) computes, for
 * each feed stage:
 *   birdsAliveAtStageStart = initialCount − mortalityBeforeStage
 *   bagsRequired = ceil(birdsAlive × intakePerBirdKg / unitSizeKg)
 *
 * These tests validate the underlying calculateItemsRequired function with
 * the bird counts that the projection logic would pass in, including the
 * mortality-adjusted scenarios.
 */
describe('Feed projection: bags required per stage', () => {
  // NUTRI FEED baseline stages (50kg bags)
  const stages = [
    { stageName: 'Starter',   unitSizeKg: 50, intakePerBirdKg: 0.8, dayRangeStart: 0 },
    { stageName: 'Grower',    unitSizeKg: 50, intakePerBirdKg: 1.2, dayRangeStart: 11 },
    { stageName: 'Finisher',  unitSizeKg: 50, intakePerBirdKg: 1.5, dayRangeStart: 25 },
  ];

  it('computes bags required for 1000 birds with no mortality', () => {
    const initialCount = 1000;
    const mortalityBeforeStage = 0;

    // Starter: 1000 × 0.8 / 50 = 16
    const starter = calculateItemsRequired(initialCount - mortalityBeforeStage, stages[0].intakePerBirdKg, stages[0].unitSizeKg);
    expect(starter.itemsRoundedUp).toBe(16);

    // Grower: 1000 × 1.2 / 50 = 24
    const grower = calculateItemsRequired(initialCount - mortalityBeforeStage, stages[1].intakePerBirdKg, stages[1].unitSizeKg);
    expect(grower.itemsRoundedUp).toBe(24);

    // Finisher: 1000 × 1.5 / 50 = 30
    const finisher = calculateItemsRequired(initialCount - mortalityBeforeStage, stages[2].intakePerBirdKg, stages[2].unitSizeKg);
    expect(finisher.itemsRoundedUp).toBe(30);
  });

  it('reduces bags required when mortality occurs before a stage', () => {
    const initialCount = 1000;
    // 50 birds died before Grower stage (day 11)
    const mortalityBeforeGrower = 50;
    const birdsAliveAtGrower = initialCount - mortalityBeforeGrower; // 950

    // Grower: 950 × 1.2 / 50 = 22.8 → 23
    const grower = calculateItemsRequired(birdsAliveAtGrower, stages[1].intakePerBirdKg, stages[1].unitSizeKg);
    expect(grower.itemsRoundedUp).toBe(23);

    // Starter still uses full 1000 (mortality hadn't happened yet)
    const starter = calculateItemsRequired(initialCount, stages[0].intakePerBirdKg, stages[0].unitSizeKg);
    expect(starter.itemsRoundedUp).toBe(16);
  });

  it('handles heavy mortality reducing birds to near zero', () => {
    const initialCount = 1000;
    const mortalityBeforeFinisher = 990;
    const birdsAliveAtFinisher = initialCount - mortalityBeforeFinisher; // 10

    // Finisher: 10 × 1.5 / 50 = 0.3 → 1
    const finisher = calculateItemsRequired(birdsAliveAtFinisher, stages[2].intakePerBirdKg, stages[2].unitSizeKg);
    expect(finisher.itemsRoundedUp).toBe(1);
  });

  it('bags remaining = required − purchased (complete scenario)', () => {
    const bagsRequired = 16;
    const bagsPurchased = 16;
    const bagsRemaining = bagsRequired - bagsPurchased;
    expect(bagsRemaining).toBe(0);
    expect(bagsPurchased >= bagsRequired).toBe(true); // complete
  });

  it('bags remaining = required − purchased (partial scenario)', () => {
    const bagsRequired = 24;
    const bagsPurchased = 10;
    const bagsRemaining = bagsRequired - bagsPurchased;
    expect(bagsRemaining).toBe(14);
    expect(bagsPurchased > 0 && bagsPurchased < bagsRequired).toBe(true); // partial
  });

  it('bags remaining = required − purchased (not started scenario)', () => {
    const bagsRequired = 30;
    const bagsPurchased = 0;
    const bagsRemaining = bagsRequired - bagsPurchased;
    expect(bagsRemaining).toBe(30);
    expect(bagsPurchased).toBe(0); // not started
  });

  it('handles 25kg bag size variant', () => {
    // 1000 × 0.8 / 25 = 32
    const result = calculateItemsRequired(1000, 0.8, 25);
    expect(result.itemsRoundedUp).toBe(32);
  });

  it('rounds up fractional bags correctly for projection', () => {
    // 750 × 1.2 / 50 = 18 → 18 (exact)
    const exact = calculateItemsRequired(750, 1.2, 50);
    expect(exact.itemsRoundedUp).toBe(18);

    // 751 × 1.2 / 50 = 18.024 → 19
    const fractional = calculateItemsRequired(751, 1.2, 50);
    expect(fractional.itemsRoundedUp).toBe(19);
  });
});
