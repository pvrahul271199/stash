import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlanAndCycle, ensureSeed, updateActivePlan } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';

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
});
