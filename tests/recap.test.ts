import { describe, expect, it } from 'vitest';
import { buildRecap, recapStory, type RecapEntry } from '@/lib/recap';

// November 2026: 1 Nov is a Sunday. A finished 30-day month.
const cycle = { startDate: '2026-11-01', totalDays: 30, currentDay: 31, planAmount: 30000, pool: 0, fromSavingsTotal: 0 };
const e = (day: number, amount: number, category: string, label = category, over: Partial<RecapEntry> = {}): RecapEntry => ({
  day,
  date: `2026-11-${String(day).padStart(2, '0')}`,
  amount,
  label,
  category,
  subcategory: null,
  event: null,
  payment: null,
  note: null,
  fromSavings: false,
  isEstimate: false,
  hour: 12,
  ...over,
});

describe('month recap', () => {
  const entries = [
    e(2, 400, 'Food', 'Chai'),
    e(3, 300, 'Food', 'Chai'),
    e(9, 400, 'Food', 'Chai'),
    e(5, 9000, 'Rent', 'Rent'),
    e(9, 1200, 'Shopping', 'Shoes'),
    e(14, 600, 'Transport'),
    e(20, 250, 'Fun'),
    e(21, 80, 'Other'),
    e(22, 5000, 'Travel', 'Flight', { event: 'Goa Trip' }),
    e(23, 3000, 'Travel', 'Hotel', { fromSavings: true, event: 'Goa Trip' }),
  ];
  const r = buildRecap(cycle, [], entries);

  it('totals only what was spent from the daily money (savings-funded spends are not spent)', () => {
    expect(r.totalSpent).toBe(400 + 300 + 400 + 9000 + 1200 + 600 + 250 + 80 + 5000);
    expect(r.avgPerDay).toBeCloseTo(r.totalSpent / 30);
  });

  it('keeps the top four categories and folds the rest into Other, biggest first', () => {
    expect(r.categories.map((c) => c.name)).toEqual(['Rent', 'Travel', 'Shopping', 'Food', 'Other']);
    expect(r.categories[4].total).toBe(600 + 250 + 80);
    expect(r.categories.reduce((s, c) => s + c.total, 0)).toBe(r.totalSpent);
  });

  it('finds the busiest day, biggest spend, frequent label and event', () => {
    expect(r.busiestDay).toEqual({ date: '2026-11-05', total: 9000 });
    expect(r.biggest).toMatchObject({ label: 'Rent', amount: 9000, date: '2026-11-05' });
    expect(r.frequent).toMatchObject({ label: 'Chai', count: 3, total: 1100 });
    expect(r.topEvent).toEqual({ name: 'Goa Trip', total: 5000 }); // the savings-funded hotel is not in the total
  });

  it('counts no-spend days', () => {
    // days with a spend: 2, 3, 5, 9, 14, 20, 21, 22, 23 (23 is savings only = no daily spend)
    expect(r.noSpendDays).toBe(30 - 8);
  });

  it('handles an empty month', () => {
    const none = buildRecap(cycle, [], []);
    expect(none).toMatchObject({ totalSpent: 0, avgPerDay: 0, categories: [], busiestDay: null, biggest: null, topEvent: null, frequent: null });
    expect(none.noSpendDays).toBe(30);
  });

  it('tells the month in one honest sentence', () => {
    expect(recapStory(30000, 12000)).toBe('You spent 60% of your spending money and kept the rest.');
    expect(recapStory(30000, 3000)).toContain('90%');
    expect(recapStory(30000, 0)).toBe('You used every bit of your spending money.');
    expect(recapStory(30000, -1500)).toContain('over');
  });
});
