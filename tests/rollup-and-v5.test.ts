import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { closeDay, dayOfTxn, rollupCycle, todayAllowance } from '@/lib/budget';
import { StashDB } from '@/db/schema';

const cyc = { startDate: '2026-10-01', totalDays: 10, planAmount: 1000, currentDay: 1 };
const tx = (txnDate: string, amount: number, extra: object = {}) => ({
  txnDate, amount, fromSavings: false, adjustsPool: true, ...extra,
});

describe('rollupCycle', () => {
  it('dayOfTxn derives 1-based day, 0 outside the cycle', () => {
    expect(dayOfTxn(cyc, '2026-10-01')).toBe(1);
    expect(dayOfTxn(cyc, '2026-10-10')).toBe(10);
    expect(dayOfTxn(cyc, '2026-10-11')).toBe(0);
    expect(dayOfTxn(cyc, '2026-09-30')).toBe(0);
  });

  it('matches a closeDay replay', () => {
    let s = { currentDay: 1, totalDays: 10, pool: 1000, fromSavingsTotal: 0 };
    const spends = [60, 250, 0];
    const expectedAllowances: number[] = [];
    for (const sp of spends) {
      expectedAllowances.push(todayAllowance(s));
      s = closeDay(s, sp).state;
    }
    const r = rollupCycle({ ...cyc, currentDay: 4 }, [tx('2026-10-01', 60), tx('2026-10-02', 250)]);
    expect(r.pool).toBe(s.pool);
    expect(r.days.map((d) => d.allowanceAtStart)).toEqual(expectedAllowances);
    expect(r.days.map((d) => d.spent)).toEqual([60, 250, 0]);
  });

  it('many transactions on one day sum correctly', () => {
    const many = Array.from({ length: 50 }, (_, i) => tx('2026-10-02', i + 1));
    const r = rollupCycle({ ...cyc, currentDay: 3 }, many);
    expect(r.days[1].spent).toBe(1275);
    expect(r.pool).toBe(1000 - 1275);
  });

  it('fromSavings never touches the pool; adjustsPool:false counts in the day row only', () => {
    const r = rollupCycle({ ...cyc, currentDay: 2 }, [
      tx('2026-10-01', 100, { fromSavings: true }),
      tx('2026-10-01', 40, { adjustsPool: false }),
      tx('2026-10-01', 10),
    ]);
    expect(r.fromSavingsTotal).toBe(100);
    expect(r.pool).toBe(990);
    expect(r.days[0].spent).toBe(50);
  });

  it('ignores tombstones, open days and out-of-range dates; add then remove restores state', () => {
    const base = rollupCycle({ ...cyc, currentDay: 3 }, []);
    const added = [tx('2026-10-01', 70)];
    expect(rollupCycle({ ...cyc, currentDay: 3 }, added).pool).toBe(930);
    expect(rollupCycle({ ...cyc, currentDay: 3 }, [{ ...added[0], deletedAt: 1 }])).toEqual(base);
    // day-5 spend is ahead of today (spread over remaining days); the out-of-range date is ignored
    expect(rollupCycle({ ...cyc, currentDay: 2 }, [tx('2026-10-05', 99), tx('2027-01-01', 5)]).pool).toBe(901);
  });

  it('marks estimated days and allows negative pool', () => {
    const r = rollupCycle({ ...cyc, currentDay: 3, estimatedDays: [2] }, [tx('2026-10-01', 1500)]);
    expect(r.days.map((d) => d.status)).toEqual(['closed', 'estimated']);
    expect(r.pool).toBe(-500);
  });
});

describe('Dexie v4 -> v5 migration', () => {
  it('upgrades a v4 DB in place: uuid ids, backfilled dates, detached spends; stored cycles end up as plan dates and are dropped', async () => {
    const name = 'mig-v4-test';
    await Dexie.delete(name);
    const v4 = new Dexie(name);
    v4.version(4).stores({
      users: 'userId, username, updatedAt',
      plan: '++id, userId, createdAt',
      cycle: '++id, userId, startDate',
      days: '[cycleId+day], cycleId, userId',
      entries: 'id, userId, cycleId, date, [cycleId+date], [userId+cycleId], [cycleId+day], [cycleId+createdAt], category, event, payment, createdAt',
      categories: '++id, userId, name, sortOrder',
      events: '++id, userId, name, createdAt',
      meta: 'id',
    });
    await v4.open();
    const e = (id: string, cycleId: number, day: number, amount: number, extra: object = {}) => ({
      id, cycleId, day, amount, label: 'x', category: 'Food', subcategory: 'Lunch',
      fromSavings: false, isEstimate: false, hour: 9, createdAt: 5, ...extra,
    });
    await v4.table('plan').add({ income: 2000, bills: 500, savings: 500, monthLength: 10, createdAt: 1 });
    await v4.table('cycle').add({
      startDate: '2026-10-01', totalDays: 10, planAmount: 1000, currentDay: 3, pool: 777, fromSavingsTotal: 0, leftoverMoved: false,
    });
    await v4.table('days').bulkAdd([
      { cycleId: 1, day: 1, allowanceAtStart: 100, spent: 60, status: 'closed' },
      { cycleId: 1, day: 2, allowanceAtStart: 104, spent: 250, status: 'estimated' },
    ]);
    await v4.table('entries').bulkAdd([
      e('a', 1, 1, 60), // no date: backfilled from day
      e('b', 1, 2, 250, { date: '2026-10-02' }),
      e('c', 99, 1, 10, { date: '2026-10-01' }), // orphan cycle
    ]);
    await v4.table('categories').add({ name: 'Food', sortOrder: 0, isSystem: false, subcategories: ['Lunch'] });
    v4.close();

    const db = new StashDB(name);
    await db.open();
    const [plans, txns, cats] = await Promise.all([db.plans.toArray(), db.transactions.toArray(), db.cats.toArray()]);
    expect(plans).toHaveLength(1);
    expect(plans[0].effectiveFrom).toBe('2026-10-01'); // carried over from the stored cycle before it was dropped
    expect(plans[0].periodStartDay).toBe(1); // calendar months
    expect(txns).toHaveLength(3);
    expect(txns.find((t) => t.id === 'a')?.txnDate).toBe('2026-10-01');
    expect(txns.find((t) => t.id === 'a')?.type).toBe('Food');
    expect(cats[0].name).toBe('Food');
    const meta = await db.meta.get('main');
    expect((meta?.migrationReport as { pools: { legacyPool: number }[] }).pools[0].legacyPool).toBe(777);
    // v4 tables are dropped by v6, stored cycles / day rows by v11
    const tables = db.tables.map((t) => t.name);
    expect(tables).not.toContain('entries');
    expect(tables).not.toContain('cycles');
    expect(tables).not.toContain('dayRows');
    // the derived month sees the same spends
    const { buildAllCycles } = await import('@/lib/period');
    const [oct] = buildAllCycles(plans, txns, '2026-10-05');
    // the orphan spend 'c' (10, dated 1 Oct, no cycle) now counts too: months are by date, not by a stored link
    expect([oct.startDate, oct.pool]).toEqual(['2026-10-01', 1000 - 60 - 250 - 10]);
    db.close();
  });
});

describe('spread over remaining days', () => {
  const c = { startDate: '2026-10-01', totalDays: 30, planAmount: 30000, currentDay: 5 };
  it('an upcoming-day spend lowers the pool now; a past-day spend does too; "no" leaves it alone', () => {
    const base = rollupCycle(c, []);
    expect(base.pool).toBe(30000);
    // 2500 on day 10 (future), spread: 25 days left (day 5..30 = 26 incl. today) 
    const future = rollupCycle(c, [{ txnDate: '2026-10-10', amount: 2500, fromSavings: false, adjustsPool: true }]);
    expect(future.pool).toBe(27500);
    const noAdjust = rollupCycle(c, [{ txnDate: '2026-10-10', amount: 2500, fromSavings: false, adjustsPool: false }]);
    expect(noAdjust.pool).toBe(30000);
    const past = rollupCycle(c, [{ txnDate: '2026-10-02', amount: 2500, fromSavings: false, adjustsPool: true }]);
    expect(past.pool).toBe(27500);
    // today's own spends never touch the pool
    expect(rollupCycle(c, [{ txnDate: '2026-10-05', amount: 700, fromSavings: false, adjustsPool: true }]).pool).toBe(30000);
  });
});
