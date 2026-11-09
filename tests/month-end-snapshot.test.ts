import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlan, cycleFor, dismissMonthSummary, ensureSeed, loadSnapshot } from '@/db/queries';
import { monthEnd } from '@/lib/budget';
import { getDB, openUserDB } from '@/db/schema';

const store = new Map<string, string>();

describe('month-end summary for a guest who logged the whole month', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it('offers last month on the first days of the next month, with the right numbers', async () => {
    await openUserDB('stash-default');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-10-01');
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    for (const d of [3, 10, 20, 31]) await addSpend(oct, { amount: 1000, label: 'Lunch', category: 'Food' }, new Date(2026, 9, d, 12), undefined, `2026-10-${String(d).padStart(2, '0')}`);
    const snap = await loadSnapshot(getDB(), '2026-11-01');
    expect(snap.cycle?.monthStart).toBe('2026-11-01');
    expect(snap.previous?.monthStart).toBe('2026-10-01');
    expect(snap.previousSeen).toBe(false);
    const m = monthEnd(snap.plan!, snap.previous!.planAmount, snap.previous!);
    expect(m.spentOnDaily).toBe(4000);
    expect(m.leftOver).toBe(32000 - 4000);
  });

  it('offers every finished month not yet seen, oldest first, on any day of a later month', async () => {
    await openUserDB('stash-default-2');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-09-01');
    const sep = (await cycleFor(getDB(), '2026-09-15', '2026-09-15'))!;
    await addSpend(sep, { amount: 500, label: 'a', category: 'Food' }, new Date(2026, 8, 5, 12), undefined, '2026-09-05');
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 700, label: 'b', category: 'Food' }, new Date(2026, 9, 6, 12), undefined, '2026-10-06');
    expect((await loadSnapshot(getDB(), '2026-11-20')).pending).toEqual([]); // nobody closed a last day yet (e.g. a fresh login)
    await getDB().meta.update('main', { closedThrough: '2026-10-31' });
    const snap = await loadSnapshot(getDB(), '2026-11-20'); // well past day 3
    expect(snap.pending.map((c) => c.monthStart)).toEqual(['2026-09-01', '2026-10-01']);
    await dismissMonthSummary(snap.pending[0].id);
    expect((await loadSnapshot(getDB(), '2026-11-20')).pending.map((c) => c.monthStart)).toEqual(['2026-10-01']);
  });

  it('also offers an earlier month that only exists because of backdated spends', async () => {
    await openUserDB('stash-default-3');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 0, savings: 0, monthLength: 30 }, '2026-11-03');
    const nov = (await cycleFor(getDB(), '2026-11-10', '2026-11-10'))!;
    await addSpend(nov, { amount: 900, label: 'old', category: 'Food' }, new Date(2026, 9, 20, 12), undefined, '2026-10-20');
    await getDB().meta.update('main', { closedThrough: '2026-11-09' });
    const snap = await loadSnapshot(getDB(), '2026-11-10');
    expect(snap.pending.map((c) => c.monthStart)).toEqual(['2026-10-01']);
  });
});
