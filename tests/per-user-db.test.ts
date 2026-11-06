import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlan } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { LegacyStashDB } from '@/db/legacy';
import { splitLegacyDB } from '@/db/migrate';
import { cycleFor } from '@/db/queries';
import { addDays, todayISO } from '@/lib/dates';

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
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 250, label: 'Lunch', category: 'Food', subcategory: 'Lunch' });
    expect(await getDB().transactions.count()).toBe(1);

    await openUserDB('default'); // log out
    expect(await getDB().transactions.count()).toBe(0);
    await openUserDB('uid-b');
    expect(await getDB().transactions.count()).toBe(0);
    expect(await getDB().plans.count()).toBe(0);

    await openUserDB('uid-a');
    expect(await getDB().transactions.count()).toBe(1);
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
    const legacy = new LegacyStashDB('stash');
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
    expect((await guest.transactions.toArray()).map((e) => e.id).sort()).toEqual(['e1', 'e3']);
    expect((await guest.meta.get('main'))?.migratedFrom).toBe('stash');

    const legacy = new LegacyStashDB('stash');
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
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 90, label: 'Tea', category: 'Food', subcategory: null });

    const r = await claimGuestData('uid-new');
    expect(r.claimed).toBe(true);
    expect(await getDB().transactions.count()).toBe(1);

    // non-empty target is skipped
    await openUserDB('default');
    expect((await claimGuestData('uid-new')).claimed).toBe(false);

    // plain login (no claim call) leaves an account empty
    await openUserDB('uid-old');
    expect(await getDB().transactions.count()).toBe(0);
  });
});

describe('day rows are derived from transactions', () => {
  it('many spends on one past day sum into its day row and the pool; removing one gives it back', async () => {
    const { removeEntry } = await import('@/db/queries');
    await openUserDB('uid-rollup');
    await createPlan({ ...plan, periodStartDay: Number(addDays(todayISO(), -5).slice(8)) }, addDays(todayISO(), -5)); // month starts 5 days ago, so yesterday is always in it
    const cycle = (await cycleFor(getDB()))!;
    const yesterday = addDays(todayISO(), -1);
    const ids: string[] = [];
    for (let i = 1; i <= 25; i++) {
      ids.push((await addSpend(cycle, { amount: i, label: 'x', category: 'Food' }, new Date(), undefined, yesterday)).id);
    }
    const day = cycle.currentDay - 1;
    let c = (await cycleFor(getDB()))!;
    expect(c.days.find((d) => d.day === day)?.spent).toBe(325);
    expect(c.pool).toBe(cycle.pool - 325);
    await removeEntry(ids[24]);
    c = (await cycleFor(getDB()))!;
    expect(c.days.find((d) => d.day === day)?.spent).toBe(300);
    expect(c.pool).toBe(cycle.pool - 300);
  });
});

describe('layered categories', () => {
  it('a new user stores no category rows; changes store only the difference', async () => {
    const { ensureSeed, loadCategories, addCategory, addSubcategory, removeSubcategory, removeCategory } = await import('@/db/queries');
    await Dexie.delete('stash-cat-a');
    await openUserDB('cat-a');
    await ensureSeed();
    expect(await getDB().cats.count()).toBe(0);
    const base = await loadCategories();
    expect(base.map((c) => c.name)).toEqual(['Food', 'Travel', 'Home', 'Bills', 'Health', 'Shopping', 'Fun', 'Other']);

    const food = base.find((c) => c.name === 'Food')!;
    await addSubcategory(food.id, 'Biryani');
    await removeSubcategory(food.id, 'Lunch');
    await addCategory('Pets');
    await removeCategory(base.find((c) => c.name === 'Fun')!.id);

    const rows = await getDB().cats.toArray();
    expect(rows).toHaveLength(3); // Food override, Fun removal, Pets
    const after = await loadCategories();
    expect(after.find((c) => c.name === 'Food')!.subcategories).toContain('Biryani');
    expect(after.find((c) => c.name === 'Food')!.subcategories).not.toContain('Lunch');
    expect(after.some((c) => c.name === 'Fun')).toBe(false);
    expect(after.map((c) => c.name).slice(-2)).toEqual(['Pets', 'Other']);

    // another user is unaffected and has no rows
    await openUserDB('cat-b');
    await ensureSeed();
    expect(await getDB().cats.count()).toBe(0);
    expect((await loadCategories()).find((c) => c.name === 'Food')!.subcategories).toContain('Lunch');
  });

  it('v7 upgrade turns full category copies into overrides', async () => {
    const { StashDB } = await import('@/db/schema');
    const name = 'v6-cats-test';
    await Dexie.delete(name);
    const v6 = new Dexie(name);
    v6.version(6).stores({
      users: 'userId, username, updatedAt',
      meta: 'id',
      plans: 'id, updatedAt',
      cycles: 'id, startDate, updatedAt',
      transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, updatedAt',
      dayRows: '[cycleId+day], cycleId',
      cats: 'id, name, updatedAt',
      evts: 'id, name, updatedAt',
    });
    await v6.open();
    const row = (id: string, n: string, subs: string[], extra: object = {}) => ({
      id, updatedAt: 1, name: n, sortOrder: 0, isSystem: false, subcategories: subs, ...extra,
    });
    await v6.table('cats').bulkAdd([
      row('1', 'Food', ['Chai & snacks', 'Breakfast', 'Lunch', 'Dinner', 'Delivery']), // unchanged
      row('2', 'Travel', ['Auto', 'Metro', 'Cab', 'Fuel', 'Flight']), // added Flight
      row('3', 'Home', ['Groceries'], {}), // removed Household
      row('4', 'Fun', ['Movies', 'Outings'], { deletedAt: 5 }), // user removed
      row('5', 'Pets', ['Vet']), // user created
    ]);
    v6.close();
    const db = new StashDB(name);
    await db.open();
    const rows = await db.cats.toArray();
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['1'].deletedAt).toBeTruthy();
    expect(byId['2']).toMatchObject({ baseId: 'travel', subAdded: ['Flight'], subRemoved: [] });
    expect(byId['3']).toMatchObject({ baseId: 'home', subRemoved: ['Household'] });
    expect(byId['4']).toMatchObject({ baseId: 'fun' });
    expect(byId['5']).toMatchObject({ baseId: null, subcategories: ['Vet'] });
    db.close();
  });
});

describe('spend lands on the date it was logged for', () => {
  it('every target date (inside, before and after the cycle) is stored and indexed under that exact date', async () => {
    const { ensureSeed } = await import('@/db/queries');
    await openUserDB('date-user');
    await ensureSeed();
    await createPlan(plan, '2026-10-20');
    const c = (await cycleFor(getDB()))!;
    const cases: [string, number][] = [
      ['2026-10-20', 11], ['2026-10-25', 22], ['2026-11-05', 33], ['2026-09-30', 44], ['2026-11-30', 55],
    ];
    for (const [d, a] of cases) {
      await addSpend(c, { amount: a, label: 'x', category: 'Food' }, new Date(2026, 10, 2, 23, 59), undefined, d);
    }
    for (const [d, a] of cases) {
      const rows = await getDB().transactions.where('txnDate').equals(d).toArray();
      expect(rows.map((r) => r.amount)).toEqual([a]);
    }
    const inRange = await getDB().transactions.where('txnDate').between('2026-10-20', '2026-11-05', true, true).toArray();
    expect(inRange.reduce((s, r) => s + r.amount, 0)).toBe(11 + 22 + 33);
  });
});
