import { describe, it, expect } from 'vitest';
import {
  calculateItemsRequired,
  calculateStageSubtotal,
  calculateBatchProjection,
} from '../../src/core/calculation-engine';

describe('calculateItemsRequired', () => {
  it('calculates exact bags and rounds up for NUTRI FEED Starter', () => {
    // 1000 birds × 0.8 kg intake = 800 kg total / 50 kg bag = 16 bags exactly
    const result = calculateItemsRequired(1000, 0.8, 50);
    expect(result.itemsRaw).toBe('16');
    expect(result.itemsRoundedUp).toBe(16);
    expect(result.error).toBeNull();
  });

  it('rounds up fractional bags (e.g. 16.2 → 17)', () => {
    // 1200 birds × 0.8 kg = 960 / 50 = 19.2 → 20
    const result = calculateItemsRequired(1200, 0.8, 50);
    expect(result.itemsRaw).toBe('19.2');
    expect(result.itemsRoundedUp).toBe(20);
  });

  it('returns error for zero bird count', () => {
    const result = calculateItemsRequired(0, 0.8, 50);
    expect(result.error).toBe('BIRD_COUNT_MUST_BE_POSITIVE');
  });

  it('returns error for zero intake', () => {
    const result = calculateItemsRequired(1000, 0, 50);
    expect(result.error).toBe('INVALID_INTAKE_OR_UNIT');
  });

  it('handles DOC (unit size 1 kg, intake 1 kg) → exact bird count', () => {
    const result = calculateItemsRequired(1000, 1.0, 1);
    expect(result.itemsRaw).toBe('1000');
    expect(result.itemsRoundedUp).toBe(1000);
  });

  it('handles NOVATEK Pre-starter (1000 × 0.2 / 50 = 4)', () => {
    const result = calculateItemsRequired(1000, 0.2, 50);
    expect(result.itemsRaw).toBe('4');
    expect(result.itemsRoundedUp).toBe(4);
  });
});

describe('calculateStageSubtotal', () => {
  it('computes subtotal for NUTRI FEED Starter (16 bags × 785)', () => {
    const result = calculateStageSubtotal(785, 16);
    expect(result.subtotalZmw).toBe('12560.00');
  });

  it('computes subtotal for DOC (1000 × 18)', () => {
    const result = calculateStageSubtotal(18, 1000);
    expect(result.subtotalZmw).toBe('18000.00');
  });
});

describe('calculateBatchProjection', () => {
  const nutriFeedStages = [
    { stageName: 'Starter', stageType: 'feed' as const, unitSizeKg: 50, unitPriceZmw: 785, intakePerBirdKg: 0.8 },
    { stageName: 'Grower', stageType: 'feed' as const, unitSizeKg: 50, unitPriceZmw: 750, intakePerBirdKg: 1.2 },
    { stageName: 'Finisher', stageType: 'feed' as const, unitSizeKg: 50, unitPriceZmw: 730, intakePerBirdKg: 1.5 },
    { stageName: 'Day-old Chicks', stageType: 'chick' as const, unitSizeKg: 1, unitPriceZmw: 18, intakePerBirdKg: 1.0 },
  ];

  it('matches spreadsheet for 1000 birds, 140 ZMW sale price, 5% mortality, no overhead', () => {
    // Feed: Starter 16 bags = 12560; Grower 24 bags = 18000; Finisher 30 bags = 21900
    // Chick: 1000 × 18 = 18000
    // Total = 70460
    // Revenue: 1000 × 0.95 × 140 = 133000
    // Gross Profit: 133000 - 70460 = 62540
    const result = calculateBatchProjection(
      1000,
      nutriFeedStages,
      140,
      0.05,
      [],
    );
    expect(result.birdCount).toBe(1000);
    expect(result.effectiveBirdCount).toBe('950.00');
    expect(result.totalFeedCost).toBe('52460.00');
    expect(result.totalChickCost).toBe('18000.00');
    expect(result.totalExpenses).toBe('70460.00');
    expect(result.projectedRevenue).toBe('133000.00');
    expect(result.grossProfit).toBe('62540.00');
    expect(result.netProfit).toBe('62540.00');
  });

  it('handles overhead costs correctly', () => {
    const result = calculateBatchProjection(
      1000,
      nutriFeedStages,
      140,
      0.05,
      [5000, 3000], // medication + labour
    );
    expect(result.totalOverheadCost).toBe('8000.00');
    expect(result.totalExpenses).toBe('78460.00');
    expect(result.netProfit).toBe('54540.00');
  });

  it('throws for zero bird count', () => {
    expect(() =>
      calculateBatchProjection(0, nutriFeedStages, 140, 0.05, [])
    ).toThrow('BIRD_COUNT_MUST_BE_POSITIVE');
  });

  it('throws for empty feed stages', () => {
    expect(() =>
      calculateBatchProjection(1000, [], 140, 0.05, [])
    ).toThrow('FEED_STAGES_REQUIRED');
  });
});

