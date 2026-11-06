import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addSpend,
  createPlan,
  cycleFor,
  ensureSeed,
  previewCloseDay,
  updateActivePlan,
} from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { addDays, todayISO, vetToday } from '@/lib/dates';
import { buildAllCycles, monthView } from '@/lib/period';
import { shouldNudge } from '@/components/ui/BackupPrompt';

const store = new Map<string, string>();
const today = todayISO();
/** A month that started 5 days ago, so days 1..5 are past and today is day 6 (start day pinned: the default would be the 1st). */
const start = addDays(today, -5);
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30, periodStartDay: Number(start.slice(8)) };
const logOn = async (iso: string, amount: number) => addSpend((await cycleFor(getDB()))!, { amount, label: 'x', category: 'Food' }, new Date(), undefined, iso);

describe('derived months (E-4)', () => {
  beforeEach(async () => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    await openUserDB(`guards-${Math.random()}`);
    await ensureSeed();
  });

  it('redoing onboarding never creates a second month or drops earlier spends', async () => {
    await createPlan(plan, start);
    await logOn(addDays(today, -1), 500);
    await createPlan(plan, today); // onboarding redone mid-month
    const db = getDB();
    const all = buildAllCycles(await db.plans.toArray(), await db.transactions.toArray(), today);
    expect(all.filter((c) => c.currentDay <= c.totalDays)).toHaveLength(1);
    const c = (await cycleFor(db))!;
    expect(c.startDate).toBe(start);
    expect(c.pool).toBe(c.planAmount - 500);
    expect(db.tables.map((x) => x.name)).not.toContain('cycles'); // nothing stored about the month
  });

  it('editing the plan mid-month keeps what earlier days used and re-spreads the rest', async () => {
    await createPlan(plan, start);
    await logOn(addDays(today, -2), 1000);
    await updateActivePlan({ ...plan, income: 90000 });
    const c = (await cycleFor(getDB()))!;
    expect(c.planAmount).toBe(50000);
    expect(c.pool).toBe(49000);
    expect(c.currentDay).toBe(6);
    expect((await getDB().plans.toArray()).filter((p) => p.deletedAt == null)).toHaveLength(1); // same month: edited in place
  });

  it('a plan change in a later month adds a version, so the earlier month keeps its own plan', async () => {
    const db = getDB();
    await createPlan(plan, addDays(today, -40));
    await db.plans.toCollection().modify({ periodStartDay: Number(addDays(today, -40).slice(8)) });
    await updateActivePlan({ ...plan, income: 100000 });
    const plans = (await db.plans.toArray()).filter((p) => p.deletedAt == null);
    expect(plans).toHaveLength(2);
    const [now, before] = buildAllCycles(plans, [], today);
    expect(now.planAmount).toBe(60000);
    expect(before.planAmount).toBe(40000);
  });

  it('amounts are stored non-negative and the month length stays within 1..31', async () => {
    await createPlan({ ...plan, income: -5, monthLength: 900 }, today);
    const p = (await getDB().plans.toArray())[0];
    expect(p.income).toBe(0);
    expect(p.monthLength).toBe(31);
  });

  it('"wrap up today" is a recap: it shows tomorrow\'s amount and writes nothing', async () => {
    await createPlan(plan, start);
    await logOn(today, 700);
    const before = (await cycleFor(getDB()))!;
    const r = (await previewCloseDay())!;
    expect(r.record.spent).toBe(700);
    expect(r.state.pool).toBe(before.pool - 700);
    expect(await previewCloseDay()).toMatchObject({ record: { spent: 700 } }); // can be opened again, same answer
    expect((await cycleFor(getDB()))!).toEqual(before);
  });

  it('vetToday accepts normal days, ignores a clock going back, and confirms a stable far date later', () => {
    const t0 = 1_000_000;
    expect(vetToday(null, '2026-10-05', t0)).toEqual({ use: true, next: { date: '2026-10-05' } });
    expect(vetToday({ date: '2026-10-05' }, '2026-10-06', t0).use).toBe(true);
    expect(vetToday({ date: '2026-10-05' }, '2026-10-01', t0)).toMatchObject({ use: true, next: { date: '2026-10-05' } });
    const first = vetToday({ date: '2026-10-05' }, '2030-01-01', t0);
    expect(first.use).toBe(false);
    expect(vetToday(first.next, '2030-01-01', t0 + 60_000).use).toBe(false);
    expect(vetToday(first.next, '2030-01-01', t0 + 11 * 60_000)).toMatchObject({ use: true, next: { date: '2030-01-01' } });
    expect(vetToday(first.next, '2026-10-06', t0 + 60_000)).toMatchObject({ use: true, next: { date: '2026-10-06' } });
  });

  it('backup prompt: guests only, from the 4th spend, and not while snoozed', () => {
    const D = 24 * 60 * 60 * 1000;
    const t = 100 * D;
    expect(shouldNudge(true, 3, 0, t)).toBe(false);
    expect(shouldNudge(true, 4, 0, t)).toBe(true);
    expect(shouldNudge(true, 9, t + D, t)).toBe(false);
    expect(shouldNudge(true, 9, t - 1, t)).toBe(true);
    expect(shouldNudge(false, 9, 0, t)).toBe(false);
  });
});

describe('migrating the reported account (2026-11-06)', () => {
  it('a v10 database (one closed Oct 30 cycle + four deleted restarts) upgrades to calendar months with every spend counted, and the cycle tables are gone', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 6, 12));
    try {
      const uid = `reported-${Math.random().toString(36).slice(2)}`;
      // the database exactly as v10 left it
      const old = new Dexie(`stash-${uid}`);
      old.version(10).stores({
        users: 'userId, username, updatedAt',
        meta: 'id',
        plans: 'id, updatedAt, localRev',
        cycles: 'id, startDate, updatedAt, localRev',
        transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, categoryId, eventId, updatedAt, localRev',
        dayRows: '[cycleId+day], cycleId',
        cats: 'id, name, updatedAt, baseId, localRev',
        evts: 'id, name, updatedAt, localRev',
        syncBase: 'key',
      });
      await old.open();
      const cyc = (id: string, startDate: string, currentDay: number, deletedAt: number | null) => ({
        id, updatedAt: 1, startDate, totalDays: 30, planAmount: 40000, currentDay, pool: 0, fromSavingsTotal: 0,
        leftoverMoved: false, estimatedDays: [], deletedAt,
      });
      await old.table('cycles').bulkAdd([
        cyc('0abcaa5c', '2026-10-30', 31, null), // force-closed by a redone onboarding
        cyc('1f01354d', '2026-11-01', 6, 1), cyc('b3a1acf6', '2026-11-06', 1, 1),
        cyc('afd1ef4b', '2026-11-06', 1, 1), cyc('231f1077', '2026-11-06', 1, 1),
      ]);
      await old.table('plans').add({ id: 'p', updatedAt: 1, income: 60000, bills: 20000, savings: 0, monthLength: 30, createdAt: new Date(2026, 10, 1, 23, 44).getTime() });
      const t = (id: string, txnDate: string, amount: number) => ({
        id, updatedAt: 1, cycleId: '0abcaa5c', txnDate, amount, type: 'Other', categoryId: 'other', subtype: null, label: 'Sort later',
        event: null, eventId: null, payment: null, note: null, fromSavings: false, adjustsPool: true, isEstimate: false, hour: 0, createdAt: 1,
      });
      await old.table('transactions').bulkAdd([t('a', '2026-11-01', 2555), t('b', '2026-11-03', 50000), t('c', '2026-11-05', 2555), t('d', '2026-11-18', 2555)]);
      old.close();

      const db = await openUserDB(uid); // runs the v11 upgrade
      await ensureSeed();
      const tables = db.tables.map((x) => x.name);
      expect(tables).not.toContain('cycles');
      expect(tables).not.toContain('dayRows');
      const p = (await db.plans.get('p'))!;
      expect(p.effectiveFrom).toBe('2026-10-30'); // budgeting began with the first old cycle
      expect(p.periodStartDay).toBe(1); // calendar months
      const c = (await cycleFor(db))!;
      expect([c.monthStart, c.monthEnd]).toEqual(['2026-11-01', '2026-11-30']);
      expect(c.startDate).toBe('2026-11-01');
      expect(c.totalDays).toBe(30);
      expect(c.currentDay).toBe(6); // 6 Nov
      expect(buildAllCycles(await db.plans.toArray(), await db.transactions.toArray(), '2026-11-06').map((x) => x.startDate)).toEqual(['2026-11-01', '2026-10-30']);
      // 40,000 - (2,555 + 50,000 + 2,555 on past days) - 2,555 logged ahead for Nov 18
      expect(c.pool).toBe(40000 - 2555 - 50000 - 2555 - 2555);
      expect(await db.transactions.count()).toBe(4); // nothing lost
      // the upgrade must not re-stamp every transaction as "unsynced" (that would re-upload the whole history)
      expect((await db.transactions.get('a'))!.localRev).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the whole month can be logged into (calendar months, start day 1)', () => {
  beforeEach(async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 12)); // 20 Nov 2026
    await openUserDB(`month-${Math.random()}`);
    await ensureSeed();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a first plan made mid-month defaults to calendar months: budget from today, strip covers 1..30', async () => {
    await createPlan({ ...plan, periodStartDay: undefined }, '2026-11-20');
    const c = (await cycleFor(getDB()))!;
    expect([c.monthStart, c.monthEnd, c.monthDays]).toEqual(['2026-11-01', '2026-11-30', 30]);
    expect([c.startDate, c.totalDays, c.currentDay]).toEqual(['2026-11-20', 11, 1]);
    expect((await getDB().plans.toArray())[0].periodStartDay).toBe(1);
  });

  it('logging on a day before you started pulls tracking back, counts in the pool and does not trigger "didn\'t get logged"', async () => {
    await createPlan({ ...plan, periodStartDay: 1 }, '2026-11-20');
    const month = monthView((await cycleFor(getDB()))!);
    const e = await addSpend(month, { amount: 700, label: 'Lunch', category: 'Food' }, new Date(), 5); // 5 Nov
    expect(e.date).toBe('2026-11-05');
    const db = getDB();
    expect((await db.plans.toArray())[0].effectiveFrom).toBe('2026-11-05');
    const c = (await cycleFor(db))!;
    expect(c.startDate).toBe('2026-11-05');
    expect(c.pool).toBe(c.planAmount - 700);
    expect(c.days.find((d) => d.day === 1)?.spent).toBe(700);
    // days 6..19 were never tracked: they count as nothing spent, nothing is asked
    // the strip's numbering is unaffected by where tracking starts
    expect(monthView(c).currentDay).toBe(20);
  });

  it('a later back-fill that is not earlier than tracking changes nothing about the start', async () => {
    await createPlan({ ...plan, periodStartDay: 1 }, '2026-11-10');
    await addSpend(monthView((await cycleFor(getDB()))!), { amount: 50, label: 'x', category: 'Food' }, new Date(), 15);
    expect((await cycleFor(getDB()))!.startDate).toBe('2026-11-10');
  });

  it('a date in an earlier month never moves tracking back; it stays a plain record', async () => {
    await createPlan({ ...plan, periodStartDay: 1 }, '2026-11-20');
    await addSpend(monthView((await cycleFor(getDB()))!), { amount: 90, label: 'x', category: 'Food' }, new Date(), undefined, '2026-10-15');
    expect((await cycleFor(getDB()))!.startDate).toBe('2026-11-20');
    expect(await getDB().transactions.where('txnDate').equals('2026-10-15').count()).toBe(1);
  });
});
