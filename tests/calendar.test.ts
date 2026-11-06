import { describe, expect, it } from 'vitest';
import { pickerMonth, shiftMonth } from '@/lib/calendar';

const o = { min: '2026-11-01', max: '2026-11-20', today: '2026-11-20' };

describe('date picker month', () => {
  it('lays November 2026 out Monday-first (1 Nov is a Sunday) with null padding', () => {
    const m = pickerMonth('2026-11-20', { ...o, selected: '2026-11-20' });
    expect(m.title).toBe('November 2026');
    expect(m.weeks.every((w) => w.length === 7)).toBe(true);
    expect(m.weeks[0].slice(0, 6).every((c) => c === null)).toBe(true); // six blanks before Sunday
    expect(m.weeks[0][6]?.iso).toBe('2026-11-01');
    expect(m.weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('only min..max can be picked; the chosen day starts a band that runs to today', () => {
    const m = pickerMonth('2026-11-20', { ...o, selected: '2026-11-15' });
    const cells = m.weeks.flat().filter((c) => c !== null);
    const by = (iso: string) => cells.find((c) => c!.iso === iso)!;
    expect(by('2026-11-01').disabled).toBe(false);
    expect(by('2026-11-20').disabled).toBe(false);
    expect(by('2026-11-21').disabled).toBe(true);
    expect(by('2026-11-15').selected).toBe(true);
    expect(cells.filter((c) => c!.inRange).map((c) => c!.day)).toEqual([16, 17, 18, 19, 20]);
    expect(by('2026-11-20').today).toBe(true);
  });

  it('selecting today leaves no band', () => {
    const m = pickerMonth('2026-11-20', { ...o, selected: '2026-11-20' });
    expect(m.weeks.flat().some((c) => c?.inRange)).toBe(false);
  });

  it('month navigation is limited to the allowed range', () => {
    expect(pickerMonth('2026-11-20', { ...o, selected: '2026-11-20' })).toMatchObject({ hasPrev: false, hasNext: false });
    const wide = { min: '2026-09-15', max: '2026-11-20', today: '2026-11-20' };
    expect(pickerMonth('2026-10-10', { ...wide, selected: '2026-10-10' })).toMatchObject({ hasPrev: true, hasNext: true });
    expect(pickerMonth('2026-09-10', { ...wide, selected: '2026-09-20' }).hasPrev).toBe(false);
    expect(pickerMonth('2026-09-10', { ...wide, selected: '2026-09-20' }).weeks.flat().find((c) => c?.iso === '2026-09-14')?.disabled).toBe(true);
  });

  it('shiftMonth steps over short and long months and the year end', () => {
    expect(shiftMonth('2026-01-01', 1)).toBe('2026-02-01');
    expect(shiftMonth('2026-02-01', 1)).toBe('2026-03-01');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2027-01-01', -1)).toBe('2026-12-01');
    expect(shiftMonth('2026-03-01', -1)).toBe('2026-02-01');
  });
});
