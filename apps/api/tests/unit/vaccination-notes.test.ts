import { describe, it, expect } from 'vitest';
import { buildVaccinationDayNotes } from '../../src/core/vaccination-notes.js';

const items = [
  { vaccineName: "Marek's", vaccineType: 'MD', adminMethod: 'Injection (hatchery)', ageDays: 0 },
  { vaccineName: 'IBD (Gumboro) Intermediate', vaccineType: 'IBD', adminMethod: 'Drinking water', ageDays: 9, notes: 'Suspend chlorination.' },
  { vaccineName: 'ND+IB LaSota', vaccineType: 'ND/IB', adminMethod: 'Eye drop', ageDays: 13 },
];

const entriesFor = (d: number) =>
  items.filter((i) => i.ageDays === d).map((i) => ({
    vaccineName: i.vaccineName,
    notes: i.notes ?? '',
    isWaterRoute: /water/i.test(i.adminMethod),
    vaccineWater: null,
  }));

describe('buildVaccinationDayNotes', () => {
  it('produces no pre/post notes for D0 hatchery items', () => {
    expect(buildVaccinationDayNotes(items, -2, [])).toBe('');
    expect(buildVaccinationDayNotes(items, -1, [])).toBe('');
    expect(buildVaccinationDayNotes(items, 1, [])).toBe('');
  });

  it('water-route D9 item yields notes on d=7, 8, 9, 10', () => {
    expect(buildVaccinationDayNotes(items, 7, entriesFor(7))).toContain('Suspend water chlorination');
    expect(buildVaccinationDayNotes(items, 8, entriesFor(8))).toContain('vitamins/electrolytes for 24h before');
    expect(buildVaccinationDayNotes(items, 8, entriesFor(8))).toContain('skim milk 2 g/L');
    const d9 = buildVaccinationDayNotes(items, 9, entriesFor(9));
    expect(d9).toContain('VACCINATION DAY');
    expect(d9).toContain('IBD');
    const d10 = buildVaccinationDayNotes(items, 10, entriesFor(10));
    expect(d10).toContain('POST-VACCINATION');
    expect(d10).toContain('bursal reaction');
    expect(buildVaccinationDayNotes(items, 11, entriesFor(11))).toBe('');
  });

  it('non-water D13 item yields notes on d=12, 13, 14 but no chlorination note on d=11', () => {
    const d11 = buildVaccinationDayNotes(items, 11, entriesFor(11));
    expect(d11).not.toContain('chlorination');
    const d12 = buildVaccinationDayNotes(items, 12, entriesFor(12));
    expect(d12).toContain('vitamins/electrolytes for 24h before');
    expect(d12).not.toContain('skim milk');
    expect(buildVaccinationDayNotes(items, 13, entriesFor(13))).toContain('VACCINATION DAY');
    const d14 = buildVaccinationDayNotes(items, 14, entriesFor(14));
    expect(d14).toContain('POST-VACCINATION');
    expect(d14).toContain('respiratory signs');
    expect(d14).not.toContain('bursal reaction');
  });

  it('orders vaccination-day text before pre/post on the same day', () => {
    // D9 is also ageDays-1 of a hypothetical D10 item — combine into one list
    const combined = [...items, { vaccineName: 'ND booster', vaccineType: 'ND', adminMethod: 'Drinking water', ageDays: 10 }];
    const notes = buildVaccinationDayNotes(combined, 9, entriesFor(9).concat([{ vaccineName: 'x', notes: '', isWaterRoute: false, vaccineWater: null }]));
    expect(notes.indexOf('VACCINATION DAY')).toBeLessThan(notes.indexOf('PRE-VACCINATION'));
    // d=10 is IBD's post day (and ND booster's vaccination day); d=11 is ND booster's post day
    const post10 = buildVaccinationDayNotes(combined, 10, entriesFor(10));
    expect(post10).toContain('POST-VACCINATION (IBD');
    expect(post10).not.toContain('POST-VACCINATION (ND booster');
    const post11 = buildVaccinationDayNotes(combined, 11, entriesFor(11));
    expect(post11).not.toContain('POST-VACCINATION (IBD');
    expect(post11).toContain('POST-VACCINATION (ND booster');
  });

  it('ND post-text branches on ND/IB vs IBD/Gumboro names', () => {
    const nd = [{ vaccineName: 'ND LaSota', adminMethod: 'Eye drop', ageDays: 5 }];
    const ibd = [{ vaccineName: 'Gumboro D78', adminMethod: 'Drinking water', ageDays: 5 }];
    expect(buildVaccinationDayNotes(nd, 6, [])).toContain('respiratory signs');
    expect(buildVaccinationDayNotes(ibd, 6, [])).toContain('bursal reaction');
  });
});
