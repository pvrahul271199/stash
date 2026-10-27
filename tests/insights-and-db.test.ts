import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { validateName } from '@/lib/categories';
import { buildCSV } from '@/lib/csv';
import { generateSampleSpends, SAMPLE_DAYS } from '@/lib/sample';
import {
  biggestSpends,
  bucketDetail,
  bucketOfHour,
  buildDays,
  categoryColorMap,
  categoryTotals,
  cumulative,
  fromSavingsTotal,
  mostFrequent,
  projectTotal,
  summarize,
  timeBuckets,
  weekdayDetail,
  weekdayStats,
} from '@/lib/insights';
import { categoryRamp } from '@/theme/tokens';
import {
  addCategory,
  addSpend,
  addSubcategory,
  applyCatchUp,
  closeCurrentDay,
  createPlanAndCycle,
  deleteAllData,
  ensureSeed,
  exportCSV,
  fillSample,
  removeCategory,
  removeEntry,
  removeSubcategory,
  syncCalendar,
} from '@/db/queries';
import { getDB } from '@/db/schema';

describe('validateName', () => {
  it('blocks empty, duplicate (case-insensitive), and >24 char names', () => {
    expect(validateName('   ', ['Food'])).toBe('Give it a name first.');
    expect(validateName('food', ['Food'])).toBe('That one already exists.');
    expect(validateName('a'.repeat(25), [])).toContain('24 characters');
    expect(validateName('Pets', ['Food'])).toBeNull();
  });
});

describe('buildCSV', () => {
  it('formats CSV and escapes quotes/commas', () => {
    const csv = buildCSV([
      {
        date: '2026-10-27',
        day: 1,
        amount: 200,
        label: 'Chai, snacks',
        category: 'Food',
        type: 'Chai & snacks',
        fromSavings: false,
        estimate: false,
      },
    ]);
    expect(csv).toContain('Date,Day,Amount (INR),Label,Category,Type,From savings,Estimate');
    expect(csv).toContain('2026-10-27,1,200,"Chai, snacks",Food,Chai & snacks,no,no');
  });
});

describe('sample generator', () => {
  it('is deterministic and includes special days', () => {
    const a = generateSampleSpends('2026-10-09', SAMPLE_DAYS, 42);
    const b = generateSampleSpends('2026-10-09', SAMPLE_DAYS, 42);
    expect(a).toEqual(b);
    expect(a.some((s) => s.day === 3 && s.label === 'Recharge' && s.amount === 299)).toBe(true);
    expect(a.some((s) => s.day === 9 && s.label === 'Medicine' && s.amount === 360)).toBe(true);
    expect(a.some((s) => s.day === 12 && s.label === 'Clothes' && s.amount === 2400 && s.fromSavings)).toBe(true);
    expect(a.some((s) => s.day === 15 && s.label === 'Cab')).toBe(true);
  });
});

describe('insights calculations', () => {
  const cycle = {
    startDate: '2026-10-09',
    totalDays: 30,
    planAmount: 22000,
    currentDay: 4,
    pool: 20500,
    fromSavingsTotal: 2400,
  };
  const rows = [
    { day: 1, allowanceAtStart: 733, spent: 500, status: 'closed' as const },
    { day: 2, allowanceAtStart: 741, spent: 400, status: 'closed' as const },
    { day: 3, allowanceAtStart: 753, spent: 600, status: 'closed' as const },
  ];
  const entries = [
    { day: 1, amount: 20, label: 'Chai', category: 'Food', subcategory: 'Chai & snacks', fromSavings: false, isEstimate: false, hour: 8 },
    { day: 1, amount: 480, label: 'Lunch', category: 'Food', subcategory: 'Lunch', fromSavings: false, isEstimate: false, hour: 13 },
    { day: 2, amount: 20, label: 'Chai', category: 'Food', subcategory: 'Chai & snacks', fromSavings: false, isEstimate: false, hour: 17 },
    { day: 2, amount: 380, label: 'Auto', category: 'Travel', subcategory: 'Auto', fromSavings: false, isEstimate: false, hour: 9 },
    { day: 3, amount: 600, label: 'Dinner', category: 'Food', subcategory: 'Dinner', fromSavings: false, isEstimate: false, hour: 21 },
    { day: 3, amount: 2400, label: 'Clothes', category: 'Shopping', subcategory: 'Clothes', fromSavings: true, isEstimate: false, hour: 15 },
  ];

  it('builds days, category totals, colors, weekday and time buckets', () => {
    const days = buildDays(cycle, rows, entries, null);
    expect(days).toHaveLength(30);
    expect(days[0].spent).toBe(500);
    expect(days[2].fromSavings).toBe(2400);

    const focusedDays = buildDays(cycle, rows, entries, 'Travel');
    expect(focusedDays[0].spent).toBe(0);
    expect(focusedDays[1].spent).toBe(380);

    const colors = categoryColorMap(entries, ['Food', 'Travel', 'Shopping'], categoryRamp);
    expect(colors.Food).toBe(categoryRamp[0]);
    expect(colors.Travel).toBe(categoryRamp[1]);

    const totals = categoryTotals(entries);
    expect(totals[0].name).toBe('Food');
    expect(totals[0].total).toBe(1120);

    const wd = weekdayStats(days, cycle.startDate);
    expect(wd.closedCount).toBe(3);
    expect(weekdayDetail(wd.stats[0], wd.usual)).toBeTruthy();

    expect(bucketOfHour(8)).toBe('morning');
    expect(bucketOfHour(13)).toBe('afternoon');
    expect(bucketOfHour(17)).toBe('evening');
    expect(bucketOfHour(22)).toBe('night');

    const tb = timeBuckets(entries, null);
    expect(tb.find((b) => b.id === 'morning')?.total).toBe(400);
    expect(bucketDetail(tb[0])).toContain('Mostly');

    const mf = mostFrequent(entries, null);
    expect(mf).toEqual({ label: 'Chai', count: 2, total: 40 });
    expect(fromSavingsTotal(entries, null)).toBe(2400);
    expect(biggestSpends(entries, null)[0].amount).toBe(2400);

    const sum = summarize(cycle, days);
    expect(sum.spentSoFar).toBe(1500);
    expect(sum.closedDays).toBe(3);
    expect(cumulative(days)).toHaveLength(4);
    expect(projectTotal(days, 30)?.endValue).toBeGreaterThan(1500);
  });
});

describe('database queries', () => {
  beforeEach(async () => {
    await deleteAllData();
  });

  it('seeds categories, logs spends, closes day, and attributes post-close spends to next day', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    let cycle = (await db.cycle.orderBy('id').last())!;
    expect(cycle.currentDay).toBe(1);

    const e1 = await addSpend(cycle, { amount: 200, label: 'Chai' });
    expect(e1.day).toBe(1);
    expect(e1.category).toBe('Food');

    const res = await closeCurrentDay(cycle.id!);
    expect(res?.state.currentDay).toBe(2);

    cycle = (await db.cycle.orderBy('id').last())!;
    const e2 = await addSpend(cycle, { amount: 150, label: 'Auto' });
    expect(e2.day).toBe(2);

    await removeEntry(e2.id);
    expect(await db.entries.get(e2.id)).toBeUndefined();
  });

  it('handles category and subcategory editing safely', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycle.orderBy('id').last())!;
    const e = await addSpend(cycle, { amount: 100, label: 'Chai' });

    const food = (await db.categories.where('name').equals('Food').first())!;
    await removeSubcategory(food.id!, 'Chai & snacks');
    expect((await db.entries.get(e.id))?.subcategory).toBeNull();
    expect((await db.entries.get(e.id))?.category).toBe('Food');

    await removeCategory(food.id!);
    expect((await db.entries.get(e.id))?.category).toBe('Other');

    expect(await addCategory('Pets')).toBeNull();
    const pets = (await db.categories.where('name').equals('Pets').first())!;
    expect(await addSubcategory(pets.id!, 'Vet')).toBeNull();
  });

  it('syncs calendar and applies catch-up', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-20');
    const gap = await syncCalendar('2026-10-23');
    expect(gap?.gap).toEqual({ from: 1, to: 3 });

    await applyCatchUp(gap!.cycleId, 900, gap!.gap);
    const db = getDB();
    const cycle = (await db.cycle.get(gap!.cycleId))!;
    expect(cycle.currentDay).toBe(4);
    const est = await db.entries.where('cycleId').equals(cycle.id!).toArray();
    expect(est).toHaveLength(3);
    expect(est.every((x) => x.isEstimate)).toBe(true);
  });

  it('fills sample month and exports CSV', async () => {
    await fillSample(new Date(2026, 9, 27, 12, 0));
    const db = getDB();
    const cycle = (await db.cycle.orderBy('id').last())!;
    expect(cycle.currentDay).toBe(SAMPLE_DAYS + 1);
    const csv = await exportCSV();
    expect(csv.split('\n').length).toBeGreaterThan(20);
  });
});
