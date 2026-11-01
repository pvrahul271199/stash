import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlanAndCycle } from '@/db/queries';
import { StashDB, getDB, openUserDB } from '@/db/schema';
import { splitLegacyDB } from '@/db/migrate';

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };

describe('per-user databases', () => {
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

  it('user A logs a spend, logs out, user B sees nothing; A gets it back', async () => {
    await openUserDB('uid-a');
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycle.toArray())[0];
    await addSpend(cycle, { amount: 250, label: 'Lunch', category: 'Food', subcategory: 'Lunch' });
    expect(await getDB().entries.count()).toBe(1);

    await openUserDB('default'); // log out
    expect(await getDB().entries.count()).toBe(0);
    await openUserDB('uid-b');
    expect(await getDB().entries.count()).toBe(0);
    expect(await getDB().cycle.count()).toBe(0);

    await openUserDB('uid-a');
    expect(await getDB().entries.count()).toBe(1);
  });
});

describe('legacy shared DB split', () => {
  beforeEach(async () => {
    store.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    await Dexie.delete('stash');
    await Dexie.delete('stash-default');
    await Dexie.delete('stash-legacy-b3RoZXI=');
  });

  async function seedLegacy() {
    const legacy = new StashDB('stash');
    await legacy.open();
    const entry = (id: string, cycleId: number, userId?: string) => ({
      id, cycleId, day: 1, date: '2026-10-01', amount: 10, label: 'x', category: 'Food', subcategory: null,
      fromSavings: false, isEstimate: false, hour: 9, createdAt: 1, userId,
    });
    await legacy.meta.put({ id: 'main', lastUsedLabel: null, schemaVersion: 4, activeUserId: 'cmFodWw=' });
    await legacy.cycle.bulkAdd([
      { id: 1, userId: 'cmFodWw=', startDate: '2026-10-01', totalDays: 30, planAmount: 100, currentDay: 2, pool: 90, fromSavingsTotal: 0, leftoverMoved: false },
      { id: 2, userId: 'b3RoZXI=', startDate: '2026-10-01', totalDays: 30, planAmount: 100, currentDay: 1, pool: 100, fromSavingsTotal: 0, leftoverMoved: false },
    ]);
    await legacy.entries.bulkAdd([entry('e1', 1, 'cmFodWw='), entry('e2', 2, 'b3RoZXI='), entry('e3', 1)]);
    legacy.close();
  }

  it('no legacy DB: nothing happens and the flag is set', async () => {
    const r = await splitLegacyDB();
    expect(r.skipped).toBe(true);
    expect(store.get('stash:legacy-split')).toBe('1');
  });

  it('buckets active-user and ownerless rows to guest, others to dormant legacy DBs, legacy untouched', async () => {
    await seedLegacy();
    const r = await splitLegacyDB();
    expect(r.targets['stash-default'].entries).toBe(2);
    expect(r.targets['stash-legacy-b3RoZXI='].entries).toBe(1);

    const guest = await openUserDB('default');
    expect((await guest.entries.toArray()).map((e) => e.id).sort()).toEqual(['e1', 'e3']);
    expect((await guest.meta.get('main'))?.migratedFrom).toBe('stash');

    const legacy = new StashDB('stash');
    expect(await legacy.entries.count()).toBe(3);
    legacy.close();
  });

  it('rerun is skipped', async () => {
    await seedLegacy();
    await splitLegacyDB();
    const again = await splitLegacyDB();
    expect(again.skipped).toBe(true);
  });
});

describe('claim guest data', () => {
  it('signup claims guest data into an empty account; login-style open does not', async () => {
    const { claimGuestData } = await import('@/db/claim');
    await Dexie.delete('stash-default');
    await Dexie.delete('stash-uid-new');
    await Dexie.delete('stash-uid-old');
    await openUserDB('default');
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycle.toArray())[0];
    await addSpend(cycle, { amount: 90, label: 'Tea', category: 'Food', subcategory: null });

    const r = await claimGuestData('uid-new');
    expect(r.claimed).toBe(true);
    expect(await getDB().entries.count()).toBe(1);

    // non-empty target is skipped
    await openUserDB('default');
    expect((await claimGuestData('uid-new')).claimed).toBe(false);

    // plain login (no claim call) leaves an account empty
    await openUserDB('uid-old');
    expect(await getDB().entries.count()).toBe(0);
  });
});
