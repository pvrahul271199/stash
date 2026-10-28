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
  eventTotals,
  fromSavingsTotal,
  mostFrequent,
  paymentTotals,
  projectTotal,
  summarize,
  timeBuckets,
  weekdayDetail,
  weekdayStats,
} from '@/lib/insights';
import { categoryRamp } from '@/theme/tokens';
import {
  addCategory,
  addEvent,
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
  removeEvent,
  removeSubcategory,
  startEvent,
  endEvent,
  syncCalendar,
  toggleEventCategory,
  updateEntry,
  updateEventNote,
} from '@/db/queries';
import { getDB } from '@/db/schema';
import { buildCalendar, compactINR, dayTotals, searchEntries } from '@/lib/history';
import { sumItems } from '@/lib/budget';

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
    const events = await db.events.toArray();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('creates events with custom text and tagged categories, logs event spends, and computes event analytics', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycle.orderBy('id').last())!;

    expect(await addEvent('Goa Trip', ['Travel', 'Food', 'Fun'], '4 days with college friends')).toBeNull();
    expect(await addEvent('goa trip', ['Food'])).toBe('That one already exists.');

    const ev = (await db.events.where('name').equals('Goa Trip').first())!;
    expect(ev.note).toBe('4 days with college friends');
    expect(ev.categories).toEqual(['Travel', 'Food', 'Fun']);

    await toggleEventCategory(ev.id!, 'Shopping');
    expect((await db.events.get(ev.id!))?.categories).toContain('Shopping');
    await toggleEventCategory(ev.id!, 'Fun');
    expect((await db.events.get(ev.id!))?.categories).not.toContain('Fun');

    await updateEventNote(ev.id!, 'Updated trip note');
    expect((await db.events.get(ev.id!))?.note).toBe('Updated trip note');

    const e1 = await addSpend(cycle, { amount: 1200, label: 'Flight cab', category: 'Travel', event: 'Goa Trip' });
    const e2 = await addSpend(cycle, { amount: 800, label: 'Beach dinner', category: 'Food', event: 'Goa Trip' });
    await addSpend(cycle, { amount: 100, label: 'Chai', category: 'Food' });

    const allEntries = await db.entries.toArray();
    const allEvents = await db.events.toArray();
    const totals = eventTotals(allEntries, allEvents, null);
    expect(totals).toHaveLength(1);
    expect(totals[0].name).toBe('Goa Trip');
    expect(totals[0].note).toBe('Updated trip note');
    expect(totals[0].total).toBe(2000);
    expect(totals[0].count).toBe(2);
    expect(totals[0].categories).toEqual([
      { name: 'Travel', total: 1200, count: 1 },
      { name: 'Food', total: 800, count: 1 },
      { name: 'Shopping', total: 0, count: 0 },
    ]);

    // Focused category filters event breakdown too
    const foodOnly = eventTotals(allEntries, allEvents, 'Food');
    expect(foodOnly[0].total).toBe(800);

    // Removing the event keeps the spends and their categories, clearing only the event tag
    await removeEvent(ev.id!);
    expect(await db.events.get(ev.id!)).toBeUndefined();
    expect((await db.entries.get(e1.id))?.event).toBeNull();
    expect((await db.entries.get(e1.id))?.category).toBe('Travel');
    expect((await db.entries.get(e2.id))?.category).toBe('Food');
  });

  it('tags every spend with the active event until it ends', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycle.orderBy('id').last())!;

    expect(await startEvent('Goa trip', 'With friends')).toBeNull();
    expect((await db.meta.get('main'))?.activeEvent).toBe('Goa trip');
    const a = await addSpend(cycle, { amount: 500, label: 'Cab', category: 'Travel' });
    const b = await addSpend(cycle, { amount: 300, label: 'Lunch' });
    expect(a.event).toBe('Goa trip');
    expect(b.event).toBe('Goa trip');

    await endEvent();
    const c = await addSpend(cycle, { amount: 20, label: 'Chai' });
    expect(c.event).toBeNull();

    // Starting with the same name (any case) resumes the existing event instead of duplicating it
    expect(await startEvent('goa TRIP')).toBeNull();
    expect(await db.events.count()).toBe(1);
    expect((await db.meta.get('main'))?.activeEvent).toBe('Goa trip');

    // Removing the active event also stops logging into it
    const ev = (await db.events.toArray())[0];
    await removeEvent(ev.id!);
    expect((await db.meta.get('main'))?.activeEvent).toBeNull();
  });

  it('tracks payment modes (UPI, Card, Cash), itemised bills/savings, and history calendar + search', async () => {
    await ensureSeed();
    const billItems = [
      { name: 'Rent', amount: 12000 },
      { name: 'Health EMI', amount: 3500 },
    ];
    const savingsItems = [{ name: 'Mutual fund SIP', amount: 5000 }];
    await createPlanAndCycle(
      {
        income: 50000,
        bills: sumItems(billItems),
        savings: sumItems(savingsItems),
        monthLength: 30,
        billItems,
        savingsItems,
      },
      '2026-10-09',
    );
    const db = getDB();
    const plan = (await db.plan.orderBy('id').last())!;
    expect(plan.bills).toBe(15500);
    expect(plan.billItems).toEqual(billItems);
    expect(plan.savingsItems).toEqual(savingsItems);

    const cycle = (await db.cycle.orderBy('id').last())!;
    await addSpend(cycle, { amount: 250, label: 'Lunch', category: 'Food', payment: 'UPI' });
    await addSpend(cycle, { amount: 1200, label: 'Groceries', category: 'Home', payment: 'Card' });
    await addSpend(cycle, { amount: 40, label: 'Chai', category: 'Food', payment: 'Cash' });
    expect((await db.meta.get('main'))?.lastPayment).toBe('Cash');

    const entries = await db.entries.toArray();
    const pm = paymentTotals(entries, null);
    expect(pm.map((p) => p.name)).toEqual(['Card', 'UPI', 'Cash']);
    expect(pm[0].total).toBe(1200);

    // Calendar grid & dayTotals
    const weeks = buildCalendar(cycle.startDate, cycle.totalDays);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const dt = dayTotals(entries);
    expect(dt.get(1)?.spent).toBe(1490);
    expect(compactINR(420)).toBe('₹420');
    expect(compactINR(1490)).toBe('₹1.5k');

    // Search across cycles
    const cycles = await db.cycle.toArray();
    expect(searchEntries(entries, cycles, 'Card')).toHaveLength(1);
    expect(searchEntries(entries, cycles, '1200')[0].entries[0].label).toBe('Groceries');
    expect(searchEntries(entries, cycles, 'food cash')[0].entries[0].label).toBe('Chai');
  });

  it('logs optional spend notes and edits existing spends while keeping closed day and pool in sync', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-09');
    const db = getDB();
    const cycle = (await db.cycle.orderBy('id').last())!;

    const e = await addSpend(cycle, {
      amount: 300,
      label: 'Lunch',
      category: 'Food',
      payment: 'UPI',
      note: 'Team lunch at Indiranagar',
    });
    expect(e.note).toBe('Team lunch at Indiranagar');

    await closeCurrentDay(cycle.id!);
    const closedBefore = (await db.days.get([cycle.id!, 1]))!;
    expect(closedBefore.spent).toBe(300);

    // Edit amount from 300 -> 450, payment -> Card, note -> Updated note
    const edited = await updateEntry(e.id, {
      amount: 450,
      payment: 'Card',
      note: 'Updated lunch note',
    });
    expect(edited?.amount).toBe(450);
    expect(edited?.payment).toBe('Card');
    expect(edited?.note).toBe('Updated lunch note');

    const closedAfter = (await db.days.get([cycle.id!, 1]))!;
    expect(closedAfter.spent).toBe(450);

    // Adding a forgotten transaction directly to Day 1 from History with adjustPool: true updates Day 1's spent total and pool
    const cycleBeforeBackdate = (await db.cycle.get(cycle.id!))!;
    const backdated = await addSpend(
      cycleBeforeBackdate,
      { amount: 150, label: 'Auto', category: 'Travel', payment: 'UPI', adjustPool: true },
      new Date(),
      1,
    );
    expect(backdated.day).toBe(1);
    expect(backdated.date).toBe('2026-10-09');
    expect(backdated.adjustsPool).toBe(true);
    const closedAfterBackdate = (await db.days.get([cycle.id!, 1]))!;
    expect(closedAfterBackdate.spent).toBe(600);
    const cycleAfterBackdate = (await db.cycle.get(cycle.id!))!;
    expect(cycleAfterBackdate.pool).toBe(cycleBeforeBackdate.pool - 150);

    // Adding a transaction to Day 1 with adjustPool: false updates Day 1's spent total WITHOUT changing the remaining month pool
    const backdatedNoAdjust = await addSpend(
      cycleAfterBackdate,
      { amount: 200, label: 'Dinner', category: 'Food', payment: 'Cash', adjustPool: false },
      new Date(),
      1,
    );
    expect(backdatedNoAdjust.day).toBe(1);
    expect(backdatedNoAdjust.date).toBe('2026-10-09');
    expect(backdatedNoAdjust.adjustsPool).toBe(false);
    expect((await db.days.get([cycle.id!, 1]))?.spent).toBe(800);
    expect((await db.cycle.get(cycle.id!))?.pool).toBe(cycleAfterBackdate.pool);

    // Day 2 entries should strictly be empty and not contain any Day 1 transactions
    const day2Entries = await db.entries.where('[cycleId+day]').equals([cycle.id!, 2]).toArray();
    expect(day2Entries).toHaveLength(0);

    const cycles = await db.cycle.toArray();
    const allEntries = await db.entries.toArray();
    expect(allEntries.every((e) => Boolean(e.date))).toBe(true);
    expect(searchEntries(allEntries, cycles, 'Updated lunch')).toHaveLength(1);
  });
});
