import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSeed, leftoverTotals } from '@/db/queries';
import { MAPPERS } from '@/lib/sync';
import { getDB, openUserDB } from '@/db/schema';

const store = new Map<string, string>();

describe('leftovers moved to savings', () => {
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

  it('sums the savings already moved in earlier months, one row per month', async () => {
    await openUserDB('leftover-a');
    await ensureSeed();
    const now = Date.now();
    await getDB().leftovers.bulkAdd([
      { id: 'a', monthId: 'p:2026-09-01:30', amount: 4200, createdAt: now, updatedAt: now },
      { id: 'b', monthId: 'p:2026-10-01:31', amount: 800, createdAt: now, updatedAt: now },
    ]);
    const rows = await getDB().leftovers.toArray();
    expect(leftoverTotals(rows)).toMatchObject({ total: 5000, months: 2 });
    expect(leftoverTotals(rows).byMonth[0].monthId).toBe('p:2026-10-01:31');
  });

  it('keeps the newest row when two devices moved the same month, and skips deleted ones', () => {
    const t = leftoverTotals([
      { monthId: 'm1', amount: 100, updatedAt: 1 },
      { monthId: 'm1', amount: 300, updatedAt: 2 },
      { monthId: 'm2', amount: 50, updatedAt: 1, deletedAt: 5 },
    ]);
    expect(t).toMatchObject({ total: 300, months: 1, byMonth: [{ monthId: 'm1', amount: 300 }] });
  });

  it('maps to the server table and back', () => {
    const m = MAPPERS.leftover_savings;
    const remote = m.toRemote({ id: 'a', updatedAt: 7, monthId: 'm1', amount: 42, createdAt: 3 });
    expect(remote).toMatchObject({ id: 'a', client_updated_at: 7, month_id: 'm1', amount: 42, created_at: 3 });
    expect(m.toLocal({ ...remote, user_id: 'u' } as never)).toMatchObject({ id: 'a', monthId: 'm1', amount: 42 });
  });
});
