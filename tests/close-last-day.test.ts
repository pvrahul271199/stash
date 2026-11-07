import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addSpend, closeToday, createPlan, cycleFor, loadSnapshot } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { setClosedThrough, todayISO } from '@/lib/dates';

describe('closing the last day of a month', () => {
  afterEach(() => {
    setClosedThrough(null);
    vi.useRealTimers();
  });

  it('puts that month in the month-end list at once, with its numbers', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 10)); // 1 Oct
    await openUserDB('close-last');
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-10-01');
    vi.setSystemTime(new Date(2026, 9, 12, 10));
    await addSpend((await cycleFor(getDB()))!, { amount: 4000, label: 'x', category: 'Food' });
    vi.setSystemTime(new Date(2026, 9, 31, 22)); // last evening of October
    expect((await loadSnapshot(getDB(), todayISO())).pending).toHaveLength(0);
    await closeToday();
    expect(todayISO()).toBe('2026-11-01');
    const snap = await loadSnapshot(getDB(), todayISO());
    expect(snap.cycle?.startDate).toBe('2026-11-01');
    expect(snap.pending.map((c) => c.startDate)).toEqual(['2026-10-01']);
    expect(snap.pending[0].pool).toBe(28000);
  });
});
