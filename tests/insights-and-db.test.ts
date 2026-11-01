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
  updateActivePlan,
  mergeAccidentalCycle,
} from '@/db/queries';
import { getDB } from '@/db/schema';
import { toEntry } from '@/db/queries';
import { buildCalendar, buildMonthCalendar, compactINR, dayTotals, dayTotalsByDate, searchEntries } from '@/lib/history';
import { sumItems } from '@/lib/budget';
import { dateOfDay, todayISO } from '@/lib/dates';

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
    let cycle = (await db.cycles.orderBy('startDate').last())!;
    expect(cycle.currentDay).toBe(1);

    const e1 = await addSpend(cycle, { amount: 200, label: 'Chai' });
    expect(e1.day).toBe(1);
    expect(e1.category).toBe('Food');

    const res = await closeCurrentDay(cycle.id!);
    expect(res?.state.currentDay).toBe(2);

    cycle = (await db.cycles.orderBy('startDate').last())!;
    const e2 = await addSpend(cycle, { amount: 150, label: 'Auto' });
    expect(e2.day).toBe(2);

    await removeEntry(e2.id);
    expect((await db.transactions.get(e2.id))?.deletedAt).toBeTruthy();
  });

  it('handles category and subcategory editing safely', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;
    const e = await addSpend(cycle, { amount: 100, label: 'Chai' });

    const food = (await db.cats.where('name').equals('Food').first())!;
    await removeSubcategory(food.id!, 'Chai & snacks');
    expect((await db.transactions.get(e.id))?.subtype).toBeNull();
    expect((await db.transactions.get(e.id))?.type).toBe('Food');

    await removeCategory(food.id!);
    expect((await db.transactions.get(e.id))?.type).toBe('Other');

    expect(await addCategory('Pets')).toBeNull();
    const pets = (await db.cats.where('name').equals('Pets').first())!;
    expect(await addSubcategory(pets.id!, 'Vet')).toBeNull();
  });

  it('syncs calendar and applies catch-up', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-20');
    const gap = await syncCalendar('2026-10-23');
    expect(gap?.gap).toEqual({ from: 1, to: 3 });

    await applyCatchUp(gap!.cycleId, 900, gap!.gap);
    const db = getDB();
    const cycle = (await db.cycles.get(gap!.cycleId))!;
    expect(cycle.currentDay).toBe(4);
    const est = await db.transactions.where('cycleId').equals(cycle.id).toArray();
    expect(est).toHaveLength(3);
    expect(est.every((x) => x.isEstimate)).toBe(true);
  });

  it('fills sample month and exports CSV', async () => {
    await fillSample(new Date(2026, 9, 27, 12, 0));
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;
    expect(cycle.currentDay).toBe(SAMPLE_DAYS + 1);
    const csv = await exportCSV();
    expect(csv.split('\n').length).toBeGreaterThan(20);
    const events = await db.evts.toArray();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('creates events with custom text and tagged categories, logs event spends, and computes event analytics', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;

    expect(await addEvent('Goa Trip', ['Travel', 'Food', 'Fun'], '4 days with college friends')).toBeNull();
    expect(await addEvent('goa trip', ['Food'])).toBe('That one already exists.');

    const ev = (await db.evts.where('name').equals('Goa Trip').first())!;
    expect(ev.note).toBe('4 days with college friends');
    expect(ev.categories).toEqual(['Travel', 'Food', 'Fun']);

    await toggleEventCategory(ev.id!, 'Shopping');
    expect((await db.evts.get(ev.id!))?.categories).toContain('Shopping');
    await toggleEventCategory(ev.id!, 'Fun');
    expect((await db.evts.get(ev.id!))?.categories).not.toContain('Fun');

    await updateEventNote(ev.id!, 'Updated trip note');
    expect((await db.evts.get(ev.id!))?.note).toBe('Updated trip note');

    const e1 = await addSpend(cycle, { amount: 1200, label: 'Flight cab', category: 'Travel', event: 'Goa Trip' });
    const e2 = await addSpend(cycle, { amount: 800, label: 'Beach dinner', category: 'Food', event: 'Goa Trip' });
    await addSpend(cycle, { amount: 100, label: 'Chai', category: 'Food' });

    const allEntries = (await db.transactions.toArray()).map((t) => toEntry(t, cycle));
    const allEvents = await db.evts.toArray();
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
    expect((await db.evts.get(ev.id!))?.deletedAt).toBeTruthy();
    expect((await db.transactions.get(e1.id))?.event).toBeNull();
    expect((await db.transactions.get(e1.id))?.type).toBe('Travel');
    expect((await db.transactions.get(e2.id))?.type).toBe('Food');
  });

  it('tags every spend with the active event until it ends', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-27');
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;

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
    expect(await db.evts.count()).toBe(1);
    expect((await db.meta.get('main'))?.activeEvent).toBe('Goa trip');

    // Removing the active event also stops logging into it
    const ev = (await db.evts.toArray())[0];
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
    const plan = (await db.plans.toCollection().last())!;
    expect(plan.bills).toBe(15500);
    expect(plan.billItems).toEqual(billItems);
    expect(plan.savingsItems).toEqual(savingsItems);

    const cycle = (await db.cycles.orderBy('startDate').last())!;
    await addSpend(cycle, { amount: 250, label: 'Lunch', category: 'Food', payment: 'UPI' });
    await addSpend(cycle, { amount: 1200, label: 'Groceries', category: 'Home', payment: 'Card' });
    await addSpend(cycle, { amount: 40, label: 'Chai', category: 'Food', payment: 'Cash' });
    expect((await db.meta.get('main'))?.lastPayment).toBe('Cash');

    const entries = (await db.transactions.toArray()).map((t) => toEntry(t, cycle));
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
    const cycles = await db.cycles.toArray();
    expect(searchEntries(entries, cycles, 'Card')).toHaveLength(1);
    expect(searchEntries(entries, cycles, '1200')[0].entries[0].label).toBe('Groceries');
    expect(searchEntries(entries, cycles, 'food cash')[0].entries[0].label).toBe('Chai');
  });

  it('logs optional spend notes and edits existing spends while keeping closed day and pool in sync', async () => {
    await ensureSeed();
    await createPlanAndCycle({ income: 50000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-10-09');
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;

    const e = await addSpend(cycle, {
      amount: 300,
      label: 'Lunch',
      category: 'Food',
      payment: 'UPI',
      note: 'Team lunch at Indiranagar',
    });
    expect(e.note).toBe('Team lunch at Indiranagar');

    await closeCurrentDay(cycle.id!);
    const closedBefore = (await db.dayRows.get([cycle.id!, 1]))!;
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

    const closedAfter = (await db.dayRows.get([cycle.id!, 1]))!;
    expect(closedAfter.spent).toBe(450);

    // Adding a forgotten transaction directly to Day 1 from History with adjustPool: true updates Day 1's spent total and pool
    const cycleBeforeBackdate = (await db.cycles.get(cycle.id!))!;
    const backdated = await addSpend(
      cycleBeforeBackdate,
      { amount: 150, label: 'Auto', category: 'Travel', payment: 'UPI', adjustPool: true },
      new Date(),
      1,
    );
    expect(backdated.day).toBe(1);
    expect(backdated.date).toBe('2026-10-09');
    expect(backdated.adjustsPool).toBe(true);
    const closedAfterBackdate = (await db.dayRows.get([cycle.id!, 1]))!;
    expect(closedAfterBackdate.spent).toBe(600);
    const cycleAfterBackdate = (await db.cycles.get(cycle.id!))!;
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
    expect((await db.dayRows.get([cycle.id!, 1]))?.spent).toBe(800);
    expect((await db.cycles.get(cycle.id!))?.pool).toBe(cycleAfterBackdate.pool);

    // Day 2 entries should strictly be empty and not contain any Day 1 transactions
    const day2Entries = await db.transactions.where('[cycleId+txnDate]').equals([cycle.id, dateOfDay(cycle.startDate, 2)]).toArray();
    expect(day2Entries).toHaveLength(0);

    const cycles = await db.cycles.toArray();
    const allEntries = (await db.transactions.toArray()).map((t) => toEntry(t, cycle));
    expect(allEntries.every((e) => Boolean(e.date))).toBe(true);
    expect(searchEntries(allEntries, cycles, 'Updated lunch')).toHaveLength(1);
  });

  it('edits plan without resetting current day, adjusting remaining pool and distributing differences to remaining days', async () => {
    await ensureSeed();
    // Start with 50,000 income, 15,000 bills, 5,000 savings => 30,000 pool, 30 days => 1,000 / day
    await createPlanAndCycle({ income: 50000, bills: 15000, savings: 5000, monthLength: 30 }, '2026-10-01');
    const db = getDB();
    let cycle = (await db.cycles.orderBy('startDate').last())!;
    expect(cycle.currentDay).toBe(1);
    expect(cycle.pool).toBe(30000);
    expect(cycle.planAmount).toBe(30000);

    // Day 1: spend 1,200 (200 over) and close day
    await addSpend(cycle, { amount: 1200, label: 'Day 1 Grocery' });
    await closeCurrentDay(cycle.id!);

    // Day 2: spend 800 (200 under) and close day
    cycle = (await db.cycles.get(cycle.id!))!;
    expect(cycle.currentDay).toBe(2);
    await addSpend(cycle, { amount: 800, label: 'Day 2 Fuel' });
    await closeCurrentDay(cycle.id!);

    // Day 3: now on Day 3. Total spent in closed days 1 and 2 = 1,200 + 800 = 2,000.
    cycle = (await db.cycles.get(cycle.id!))!;
    expect(cycle.currentDay).toBe(3);
    expect(cycle.pool).toBe(28000); // 30,000 - 2,000 = 28,000
    // Remaining days = 30 - 3 + 1 = 28 days.
    // Daily allowance for Day 3 = 28,000 / 28 = 1,000 / day.

    // User edits the plan mid-cycle:
    // Income increases to 65,000, bills 15,000, savings 10,000 => new moneyToLiveOn = 40,000 (+10,000 increase)
    await updateActivePlan({
      income: 65000,
      bills: 15000,
      savings: 10000,
      monthLength: 30,
    });

    const updatedCycle = (await db.cycles.get(cycle.id!))!;
    // CRITICAL REQUIREMENT 1: Does NOT restart day back to Day 1
    expect(updatedCycle.currentDay).toBe(3);
    expect(updatedCycle.startDate).toBe('2026-10-01');
    expect(updatedCycle.totalDays).toBe(30);

    // CRITICAL REQUIREMENT 2: Plan amount updated to 40,000
    expect(updatedCycle.planAmount).toBe(40000);

    // CRITICAL REQUIREMENT 3: Previous day spending (2,000) is deducted from new money to live on (40,000)
    // New remaining pool = 40,000 - 2,000 = 38,000
    expect(updatedCycle.pool).toBe(38000);

    // The remaining 28 days each get 38,000 / 28 = ~1,357 / day (+357 / day from the +10,000 increase)
    const remainingDays = updatedCycle.totalDays - updatedCycle.currentDay + 1;
    expect(remainingDays).toBe(28);
    const newAllowance = updatedCycle.pool / remainingDays;
    expect(Math.round(newAllowance)).toBe(1357);

    // History and closed days 1 and 2 records remain completely intact
    const day1 = (await db.dayRows.get([cycle.id!, 1]))!;
    const day2 = (await db.dayRows.get([cycle.id!, 2]))!;
    expect(day1.spent).toBe(1200);
    expect(day2.spent).toBe(800);
  });

  it('merges an accidentally restarted cycle back into original month, re-attaching logs and restoring correct timeline', async () => {
    await ensureSeed();
    // 1. Original month started on 2026-10-01 (Day 1..30)
    await createPlanAndCycle({ income: 50000, bills: 20000, savings: 0, monthLength: 30 }, '2026-10-01');
    const db = getDB();
    const cycle1 = (await db.cycles.orderBy('startDate').last())!;

    // Log spend on Day 1 (1,000) and close it
    await addSpend(cycle1, { amount: 1000, label: 'Groceries' }, new Date(), 1);
    await closeCurrentDay(cycle1.id!);

    // Log spend on Day 2 (500)
    await addSpend(cycle1, { amount: 500, label: 'Snacks' }, new Date(), 2);

    // 2. Accidental restart happened earlier (e.g. user clicked "Edit my plan" before the fix, creating cycle2 on todayISO())
    await createPlanAndCycle({ income: 60000, bills: 20000, savings: 0, monthLength: 30 }, todayISO());
    const cycle2 = (await db.cycles.orderBy('startDate').last())!;
    expect(cycle2.id).not.toBe(cycle1.id);
    expect((await db.cycles.toArray()).length).toBe(2);

    // Log a spend in cycle2 (350)
    const e2 = await addSpend(cycle2, { amount: 350, label: 'Coffee' });
    expect(e2.cycleId).toBe(cycle2.id);

    // 3. Perform recovery merge
    const result = await mergeAccidentalCycle();
    expect(result.success).toBe(true);

    // 4. Verify only Cycle 1 exists now
    const remainingCycles = (await db.cycles.toArray()).filter((c) => c.deletedAt == null);
    expect(remainingCycles).toHaveLength(1);
    expect(remainingCycles[0].id).toBe(cycle1.id);
    expect(remainingCycles[0].startDate).toBe('2026-10-01');

    // 5. Verify the spend from cycle2 was moved to cycle1
    const movedEntry = await db.transactions.get(e2.id);
    expect(movedEntry?.cycleId).toBe(cycle1.id);

    // 6. Pool is derived: 40,000 - 1,000 (day 1) - 500 (day 2, now a closed day) = 38,500
    expect(remainingCycles[0].planAmount).toBe(40000);
    expect(remainingCycles[0].pool).toBe(38500);
  });

  it('buildMonthCalendar generates a full Mon-Sun grid with correct cycle day and active status', () => {
    const cycle = {
      id: '1',
      startDate: '2026-10-10',
      totalDays: 30,
      planAmount: 30000,
      currentDay: 5,
      pool: 26000,
      fromSavingsTotal: 0,
      leftoverMoved: false,
    };

    const weeks = buildMonthCalendar(2026, 10, cycle, '2026-10-14');
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    // Each week has 7 days (Mon-Sun)
    expect(weeks[0].length).toBe(7);

    // 2026-10-01 is Thursday, so Monday of first week is 2026-09-28
    expect(weeks[0][0].iso).toBe('2026-09-28');
    expect(weeks[0][0].isCurrentMonth).toBe(false);

    // Find 2026-10-10 (Cycle Start / Day 1)
    const day10 = weeks.flat().find((c) => c.iso === '2026-10-10');
    expect(day10).toBeDefined();
    expect(day10?.dayInCycle).toBe(1);
    expect(day10?.isWithinActiveCycle).toBe(true);

    // Find 2026-10-14 (Today / Day 5)
    const day14 = weeks.flat().find((c) => c.iso === '2026-10-14');
    expect(day14?.isToday).toBe(true);
    expect(day14?.dayInCycle).toBe(5);

    // Day before cycle: 2026-10-09
    const day9 = weeks.flat().find((c) => c.iso === '2026-10-09');
    expect(day9?.isWithinActiveCycle).toBe(false);
    expect(day9?.dayInCycle).toBeNull();
  });

  it('dayTotalsByDate accurately aggregates spending per calendar date', () => {
    const entries = [
      { id: '1', cycleId: '1', day: 5, date: '2026-10-15', amount: 300, label: 'Coffee', category: 'Food', subcategory: null, hour: 10, createdAt: 1, fromSavings: false, isEstimate: false },
      { id: '2', cycleId: '1', day: 5, date: '2026-10-15', amount: 200, label: 'Snack', category: 'Food', subcategory: null, hour: 11, createdAt: 2, fromSavings: false, isEstimate: false },
      { id: '3', cycleId: '1', day: 5, date: '2026-10-15', amount: 500, label: 'Gift', category: 'Shopping', subcategory: null, hour: 12, createdAt: 3, fromSavings: true, isEstimate: false },
      { id: '4', cycleId: '1', day: 6, date: '2026-10-16', amount: 150, label: 'Metro', category: 'Travel', subcategory: null, hour: 9, createdAt: 4, fromSavings: false, isEstimate: false },
    ];

    const totals = dayTotalsByDate(entries);
    const day15 = totals.get('2026-10-15');
    expect(day15?.spent).toBe(500);
    expect(day15?.fromSavings).toBe(500);
    expect(day15?.count).toBe(3);

    const day16 = totals.get('2026-10-16');
    expect(day16?.spent).toBe(150);
    expect(day16?.fromSavings).toBe(0);
    expect(day16?.count).toBe(1);
  });

  it('allows logging spends on dates outside active 30-day cycle without deducting from active cycle pool', async () => {
    await ensureSeed();
    // Active cycle starts on 2026-10-01 for 30 days (covers 2026-10-01 to 2026-10-30)
    await createPlanAndCycle({ income: 50000, bills: 20000, savings: 0, monthLength: 30 }, '2026-10-01');
    const db = getDB();
    const cycle = (await db.cycles.orderBy('startDate').last())!;
    const initialPool = cycle.pool; // 30,000

    // 1. Log an older spend on a historical date outside the active cycle range (e.g. 2026-08-15)
    const oldEntry = await addSpend(
      cycle,
      { amount: 1500, label: 'August Doctor Checkup', category: 'Health' },
      new Date(),
      undefined,
      '2026-08-15',
    );

    expect(oldEntry.date).toBe('2026-08-15');
    expect(oldEntry.amount).toBe(1500);
    expect(oldEntry.adjustsPool).toBe(false);

    // Active cycle pool must NOT be touched
    const cycleAfterOldSpend = (await db.cycles.get(cycle.id!))!;
    expect(cycleAfterOldSpend.pool).toBe(initialPool);

    // Day rows for active cycle must not have an entry for August 15
    const daysInActiveCycle = await db.dayRows.where('cycleId').equals(cycle.id!).toArray();
    expect(daysInActiveCycle).toHaveLength(0);

    // 2. Advance cycle to Day 10 so Day 5 is a past day in the active cycle
    await db.cycles.update(cycle.id!, { currentDay: 10 });
    const freshCycle = (await db.cycles.get(cycle.id!))!;

    // Log a spend on Day 5 (within active cycle range: 2026-10-05) with adjustPool: true
    const cycleEntry = await addSpend(
      freshCycle,
      { amount: 500, label: 'Groceries', category: 'Home', adjustPool: true },
      new Date(),
      undefined,
      '2026-10-05',
    );

    expect(cycleEntry.date).toBe('2026-10-05');
    expect(cycleEntry.day).toBe(5); // 2026-10-05 is Day 5 of cycle starting 2026-10-01
    expect(cycleEntry.adjustsPool).toBe(true);

    // Active cycle day 5 row is created / updated
    const day5Row = await db.dayRows.get([cycle.id!, 5]);
    expect(day5Row).toBeDefined();
    expect(day5Row?.spent).toBe(500);

    // Active cycle pool is deducted by 500
    const finalCycle = (await db.cycles.get(cycle.id!))!;
    expect(finalCycle.pool).toBe(initialPool - 500);
  });
});
