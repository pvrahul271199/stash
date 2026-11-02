import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCategory, addEvent, addSpend, createPlanAndCycle, ensureSeed, exportCSV, loadLinkNames, removeCategory, removeEvent,
  renameCategory, renameEvent, startEvent, toEntry, updateEntry,
} from '@/db/queries';
import { getDB, openUserDB, StashDB } from '@/db/schema';

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };

async function setup(uid: string) {
  await openUserDB(uid);
  await ensureSeed();
  await createPlanAndCycle(plan, '2026-10-01');
  return (await getDB().cycles.toArray())[0];
}

describe('transactions link to categories and events by id', () => {
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

  it('addSpend stores category and event ids next to the name snapshots', async () => {
    const cycle = await setup('links-a');
    await addEvent('Goa trip');
    const ev = (await getDB().evts.toArray())[0];
    const e = await addSpend(cycle, { amount: 100, label: 'Lunch', category: 'food', event: 'goa TRIP' });
    const t = (await getDB().transactions.get(e.id))!;
    expect(t.categoryId).toBe('food');
    expect(t.type).toBe('Food'); // canonical name, not the typed casing
    expect(t.eventId).toBe(ev.id);
    expect(t.event).toBe('Goa trip');
  });

  it('renaming a category keeps history attached without rewriting transactions', async () => {
    const cycle = await setup('links-b');
    await addCategory('Pets');
    const cat = (await getDB().cats.toArray()).find((c) => c.name === 'Pets')!;
    const e = await addSpend(cycle, { amount: 300, label: 'Kibble', category: 'Pets' });
    const before = (await getDB().transactions.get(e.id))!;
    expect(before.categoryId).toBe(cat.id);

    expect(await renameCategory(cat.id, 'Animals')).toBeNull();

    const after = (await getDB().transactions.get(e.id))!;
    expect(after.updatedAt).toBe(before.updatedAt); // transaction row untouched
    expect(toEntry(after, undefined, await loadLinkNames()).category).toBe('Animals');
    expect((await exportCSV()).includes('Animals')).toBe(true);

    // removing it by its new name moves the history to Other
    await removeCategory(cat.id);
    expect((await getDB().transactions.get(e.id))!.categoryId).toBe('other');
  });

  it('rejects renaming onto an existing name (case-insensitive) and renaming built-ins', async () => {
    await setup('links-c');
    await addCategory('Pets');
    const pets = (await getDB().cats.toArray()).find((c) => c.name === 'Pets')!;
    expect(await renameCategory(pets.id, 'food')).toBe('That one already exists.');
    expect(await renameCategory('food', 'Meals')).toMatch(/can't be renamed/);
    expect(await addCategory('PETS')).toBe('That one already exists.');
  });

  it('renaming an event follows by id and updates the active event', async () => {
    const cycle = await setup('links-d');
    await startEvent('Diwali');
    const ev = (await getDB().evts.toArray())[0];
    const e = await addSpend(cycle, { amount: 50, label: 'Sweets', category: 'Food' });
    expect((await getDB().transactions.get(e.id))!.eventId).toBe(ev.id);

    expect(await renameEvent(ev.id, 'Festival')).toBeNull();
    expect((await getDB().meta.get('main'))!.activeEvent).toBe('Festival');
    const t = (await getDB().transactions.get(e.id))!;
    expect(toEntry(t, undefined, await loadLinkNames()).event).toBe('Festival');

    await removeEvent(ev.id);
    const gone = (await getDB().transactions.get(e.id))!;
    expect(gone.eventId).toBeNull();
    expect(gone.event).toBeNull();
  });

  it('updateEntry re-links category and event', async () => {
    const cycle = await setup('links-e');
    await addEvent('Trip');
    const ev = (await getDB().evts.toArray())[0];
    const e = await addSpend(cycle, { amount: 80, label: 'Cab', category: 'Travel', event: null });
    const u = (await updateEntry(e.id, { category: 'fun', event: 'trip' }))!;
    const t = (await getDB().transactions.get(u.id))!;
    expect(t.categoryId).toBe('fun');
    expect(t.eventId).toBe(ev.id);
  });
});

describe('v8 migration', () => {
  it('backfills ids from the old name links, case-insensitively', async () => {
    const name = 'stash-migrate-links';
    const old = new Dexie(name);
    old.version(7).stores({
      transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, updatedAt',
      cats: 'id, name, updatedAt, baseId',
      evts: 'id, name, updatedAt',
    });
    await old.open();
    const base = {
      cycleId: null, txnDate: '2026-10-01', amount: 5, subtype: null, label: '', payment: null, note: null,
      fromSavings: false, adjustsPool: true, isEstimate: false, hour: 0, createdAt: 1, updatedAt: 1,
    };
    await old.table('evts').add({ id: 'ev-1', name: 'Goa', note: null, categories: [], createdAt: 1, updatedAt: 1 });
    await old.table('cats').add({
      id: 'cat-1', name: 'Pets', sortOrder: 0, isSystem: false, subcategories: [], baseId: null, subAdded: [], subRemoved: [], updatedAt: 1,
    });
    await old.table('transactions').bulkAdd([
      { ...base, id: 't1', type: 'food', event: 'goa' },
      { ...base, id: 't2', type: 'Pets', event: null },
      { ...base, id: 't3', type: 'Mystery', event: 'Unknown' },
    ]);
    old.close();

    const db = new StashDB(name);
    await db.open();
    const t = Object.fromEntries((await db.transactions.toArray()).map((x) => [x.id, x]));
    expect(t.t1).toMatchObject({ categoryId: 'food', eventId: 'ev-1' });
    expect(t.t2).toMatchObject({ categoryId: 'cat-1', eventId: null });
    expect(t.t3).toMatchObject({ categoryId: null, eventId: null, type: 'Mystery', event: 'Unknown' });
    db.close();
  });
});
