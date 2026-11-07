import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlan, cycleFor, ensureSeed, loadSnapshot } from '@/db/queries';
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
});
