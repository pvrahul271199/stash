import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addSpend, createPlan, cycleFor } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { buildAllCycles, trackingWithSpends } from '@/lib/period';

const plan = { id: 'p', income: 80000, bills: 25000, savings: 15000, monthLength: 30, effectiveFrom: '2026-11-06', periodStartDay: 1, updatedAt: 1, createdAt: 1 } as never;
const spend = (txnDate: string) => ({ txnDate, amount: 100, deletedAt: null, isEstimate: false, fromSavings: false, adjustsPool: true }) as never;

describe('spends from before the month tracking started', () => {
  it('give that month its own cycle', () => {
    const all = buildAllCycles([plan], [spend('2026-10-20'), spend('2026-11-07')], '2026-11-08');
    expect(all.map((c) => c.startDate)).toEqual(['2026-11-06', '2026-10-20']); // November's budget start is untouched
  });
  it('are capped at 12 months back', () => {
    expect(trackingWithSpends([plan], '2019-01-05')).toBe('2025-11-01');
    expect(trackingWithSpends([plan], '2026-11-02')).toBe('2026-11-02');
  });
  it('are found for real by cycleFor after logging on a date in the previous month', async () => {
    await openUserDB('earlier-a');
    await createPlan({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, '2026-11-06');
    const cycle = (await cycleFor(getDB(), '2026-11-08', '2026-11-08'))!;
    await addSpend(cycle, { amount: 250, label: 'Lunch', category: 'Food', subcategory: 'Lunch' }, new Date(2026, 10, 8), undefined, '2026-10-20');
    const oct = await cycleFor(getDB(), '2026-10-25', '2026-11-08');
    expect(oct?.startDate).toBe('2026-10-20');
    expect(oct?.days.some((d) => d.spent > 0)).toBe(true);
  });
});
