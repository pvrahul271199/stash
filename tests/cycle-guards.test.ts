import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, closeCurrentDay, createPlanAndCycle, ensureSeed, syncCalendar, updateActivePlan } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { vetToday } from '@/lib/dates';

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };

describe('client guards that mirror the server constraints', () => {
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

  it('starting a new cycle ends any still-open one, so only one cycle is active', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const first = (await getDB().cycles.toArray())[0];
    await addSpend(first, { amount: 500, label: 'Tea', category: 'Food' });
    await createPlanAndCycle(plan, '2026-10-10'); // onboarding redone mid-month
    const all = await getDB().cycles.toArray();
    const open = all.filter((c) => c.currentDay <= c.totalDays);
    expect(all).toHaveLength(2);
    expect(open).toHaveLength(1);
    expect(open[0].startDate).toBe('2026-10-10');
    const old = all.find((c) => c.startDate === '2026-10-01')!;
    expect(old.currentDay).toBe(old.totalDays + 1);
    // the old cycle's pool is re-derived from its spends, not left stale
    expect(old.pool).toBe(old.planAmount - 500);
  });

  it('shortening the month never puts current_day beyond total_days', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    await getDB().cycles.update(c.id, { currentDay: 10 });
    await updateActivePlan({ ...plan, monthLength: 5 });
    const after = (await getDB().cycles.get(c.id))!;
    expect(after.totalDays).toBe(10);
    expect(after.currentDay).toBeLessThanOrEqual(after.totalDays + 1);
  });

  it('keeps total_days within 1..366 and amounts non-negative', async () => {
    await createPlanAndCycle({ ...plan, income: -5, monthLength: 900 }, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    const p = (await getDB().plans.toArray())[0];
    expect(c.totalDays).toBeLessThanOrEqual(366);
    expect(p.income).toBe(0);
  });

  it('M3: a day cannot be closed before it has begun', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    await addSpend(c, { amount: 10, label: 'x', category: 'Food', date: '2026-10-01' } as never);
    expect(await closeCurrentDay(c.id, '2026-10-01')).not.toBeNull(); // day 1 on day 1
    expect(await closeCurrentDay(c.id, '2026-10-01')).toBeNull(); // day 2 has not begun
    expect(await closeCurrentDay(c.id, '2026-09-20')).toBeNull(); // clock set back
    expect((await getDB().cycles.get(c.id))!.currentDay).toBe(2);
    expect(await closeCurrentDay(c.id, '2026-10-02')).not.toBeNull();
  });

  it('M3: a date jumped far into the future is not believed at once', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    await syncCalendar('2026-10-01'); // remembers the date
    await addSpend(c, { amount: 10, label: 'x', category: 'Food' });
    await syncCalendar('2031-01-01'); // clock jumped five years
    expect((await getDB().cycles.get(c.id))!.currentDay).toBe(1);
  });

  it('M3: vetToday accepts normal days, ignores a clock going back, and confirms a stable far date later', () => {
    const t0 = 1_000_000;
    expect(vetToday(null, '2026-10-05', t0)).toEqual({ use: true, next: { date: '2026-10-05' } });
    expect(vetToday({ date: '2026-10-05' }, '2026-10-06', t0).use).toBe(true);
    expect(vetToday({ date: '2026-10-05' }, '2026-10-01', t0)).toMatchObject({ use: true, next: { date: '2026-10-05' } });
    const first = vetToday({ date: '2026-10-05' }, '2030-01-01', t0);
    expect(first.use).toBe(false);
    expect(vetToday(first.next, '2030-01-01', t0 + 60_000).use).toBe(false);
    expect(vetToday(first.next, '2030-01-01', t0 + 11 * 60_000)).toMatchObject({ use: true, next: { date: '2030-01-01' } });
    expect(vetToday(first.next, '2026-10-06', t0 + 60_000)).toMatchObject({ use: true, next: { date: '2026-10-06' } }); // clock fixed
  });
});
