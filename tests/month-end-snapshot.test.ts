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

  it('offers a month only if the user logged on its last day, once it has turned over', async () => {
    await openUserDB('stash-default-2');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-09-01');
    const sep = (await cycleFor(getDB(), '2026-09-15', '2026-09-15'))!;
    await addSpend(sep, { amount: 500, label: 'a', category: 'Food' }, new Date(2026, 8, 5, 12), undefined, '2026-09-05'); // not the last day (30 Sep)
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 700, label: 'b', category: 'Food' }, new Date(2026, 9, 31, 12), undefined, '2026-10-31'); // last day of Oct
    const snap = await loadSnapshot(getDB(), '2026-11-20'); // any day of a later month, no "close the day" needed
    expect(snap.pending.map((c) => c.monthStart)).toEqual(['2026-10-01']);
    expect(snap.pending[0].pool).toBe(32000 - 700);
    await dismissMonthSummary(snap.pending[0].id);
    expect((await loadSnapshot(getDB(), '2026-11-20')).pending).toEqual([]);
  });

  it('does not offer the month while it is still running', async () => {
    await openUserDB('stash-default-3');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-10-01');
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 700, label: 'b', category: 'Food' }, new Date(2026, 9, 31, 12), undefined, '2026-10-31');
    expect((await loadSnapshot(getDB(), '2026-10-31')).pending).toEqual([]); // still October
    expect((await loadSnapshot(getDB(), '2026-11-01')).pending).toHaveLength(1);
  });

  it('still offers the recap when the whole month was spent (nothing left is a recap too)', async () => {
    await openUserDB('stash-default-4');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-10-01');
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 40000, label: 'big', category: 'Shopping' }, new Date(2026, 9, 31, 12), undefined, '2026-10-31');
    const snap = await loadSnapshot(getDB(), '2026-11-02');
    expect(snap.pending).toHaveLength(1);
    expect(monthEnd(snap.plan!, snap.pending[0].planAmount, snap.pending[0]).leftOver).toBe(0);
  });

  it('only ever pushes last month at the user, never older months', async () => {
    await openUserDB('stash-default-5');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 30 }, '2026-09-01');
    const sep = (await cycleFor(getDB(), '2026-09-15', '2026-09-15'))!;
    await addSpend(sep, { amount: 500, label: 'a', category: 'Food' }, new Date(2026, 8, 30, 12), undefined, '2026-09-30'); // last day of Sep
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 700, label: 'b', category: 'Food' }, new Date(2026, 9, 31, 12), undefined, '2026-10-31'); // last day of Oct
    const snap = await loadSnapshot(getDB(), '2026-11-10');
    expect(snap.pending.map((c) => c.monthStart)).toEqual(['2026-10-01']); // September is only in History
  });

  it('remembers a seen recap in a synced row, so it does not come back without the old per-device list', async () => {
    await openUserDB('stash-default-6');
    await ensureSeed();
    await createPlan({ income: 60000, bills: 18000, savings: 10000, monthLength: 31 }, '2026-10-01');
    const oct = (await cycleFor(getDB(), '2026-10-15', '2026-10-15'))!;
    await addSpend(oct, { amount: 700, label: 'b', category: 'Food' }, new Date(2026, 9, 31, 12), undefined, '2026-10-31');
    const id = (await loadSnapshot(getDB(), '2026-11-02')).pending[0].id;
    await dismissMonthSummary(id);
    await dismissMonthSummary(id); // idempotent: one row
    const rows = await getDB().monthRecaps.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].monthId).toBe(id);
    expect(rows[0].localRev).toBeGreaterThan(0); // stamped, so it syncs
    await getDB().meta.update('main', { monthSummarySeen: [] }); // what a fresh login looks like for the old list
    const snap = await loadSnapshot(getDB(), '2026-11-02');
    expect(snap.pending).toEqual([]);
    expect(snap.previousSeen).toBe(true);
  });
});
