import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from '@/lib/uuid';
import { CALC_VERSION, addSpend, createPlanAndCycle, ensureSeed, rebuildStaleCaches } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';

describe('uuidv7', () => {
  it('is a valid v7 uuid carrying the timestamp', () => {
    const t = Date.UTC(2026, 10, 2, 12, 0, 0);
    const id = uuidv7(t);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(t);
  });

  it('sorts in creation order, even within one millisecond', () => {
    const t = Date.now() + 10_000;
    const ids = Array.from({ length: 5000 }, () => uuidv7(t));
    expect(new Set(ids).size).toBe(5000);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('calc_version', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  });

  it('stamps caches, and a stale or missing stamp is rebuilt at startup', async () => {
    await openUserDB(`calc-${Math.random()}`);
    await ensureSeed();
    await createPlanAndCycle({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    await addSpend(c, { amount: 300, label: 'Tea', category: 'Food' });
    expect((await getDB().cycles.get(c.id))!.calcVersion).toBe(CALC_VERSION);
    expect(await rebuildStaleCaches()).toBe(0);

    // simulate caches written by an older logic version
    await getDB().cycles.update(c.id, { calcVersion: CALC_VERSION - 1, pool: 1 });
    await getDB().dayRows.clear();
    expect(await rebuildStaleCaches()).toBe(1);
    const fixed = (await getDB().cycles.get(c.id))!;
    expect(fixed.calcVersion).toBe(CALC_VERSION);
    expect(fixed.pool).toBe(c.planAmount); // open-day spend isn't deducted until the day closes
  });

  it('new transactions get time-ordered ids', async () => {
    await openUserDB(`calc-${Math.random()}`);
    await ensureSeed();
    await createPlanAndCycle({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, '2026-10-01');
    const c = (await getDB().cycles.toArray())[0];
    const a = await addSpend(c, { amount: 1, label: 'a', category: 'Food' });
    const b = await addSpend(c, { amount: 2, label: 'b', category: 'Food' });
    expect(a.id[14]).toBe('7');
    expect(a.id < b.id).toBe(true);
  });
});
