import { describe, it, expect } from 'vitest';
import { displayDayOf, getHatchDayConvention } from '../../src/core/day-convention.js';

describe('displayDayOf', () => {
  it('day1 (default): hatch day displays as Day 1', () => {
    expect(displayDayOf(0, 'day1')).toBe(1);
    expect(displayDayOf(20, 'day1')).toBe(21);
  });

  it('day0: hatch day displays as Day 0 (raw elapsed)', () => {
    expect(displayDayOf(0, 'day0')).toBe(0);
    expect(displayDayOf(20, 'day0')).toBe(20);
  });

  it('unknown/null convention falls back to day1', () => {
    expect(displayDayOf(7, null)).toBe(8);
    expect(displayDayOf(7, undefined)).toBe(8);
    expect(displayDayOf(7, 'bogus')).toBe(8);
  });
});

describe('getHatchDayConvention', () => {
  const fakePrisma = (value: string | null | undefined) => ({
    organization: {
      findUnique: async () => (value === null ? null : { hatchDayConvention: value }),
    },
  });

  it('returns the stored convention', async () => {
    expect(await getHatchDayConvention(fakePrisma('day0') as any, 'org1')).toBe('day0');
    expect(await getHatchDayConvention(fakePrisma('day1') as any, 'org1')).toBe('day1');
  });

  it('defaults to day1 when org missing or field unset', async () => {
    expect(await getHatchDayConvention(fakePrisma(null) as any, 'org1')).toBe('day1');
    expect(await getHatchDayConvention(fakePrisma(undefined) as any, 'org1')).toBe('day1');
  });
});
