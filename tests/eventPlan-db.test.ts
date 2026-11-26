import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addEventItem, addSpend, createOccasion, createPlan, cycleFor, ensureSeed, getEventPlan, payEventItem, removeEntry,
  removeEvent, removeEventItem, renameEvent, unpayEventItem, updateEntry, updateEventItem,
} from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { spentToday, todayAllowance } from '@/lib/budget';
import { MAX_ITEMS } from '@/lib/eventPlan';
import { MAPPERS } from '@/lib/sync';

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let n = 0;

async function setup() {
  await openUserDB(`occasion-${++n}`);
  await ensureSeed();
  await createPlan(plan, `${iso(new Date()).slice(0, 8)}01`);
  return (await cycleFor(getDB()))!;
}
const fresh = async () => (await cycleFor(getDB()))!;
/** Today's counted spend and the pool, the two numbers a payment may or may not move. */
async function money() {
  const c = await fresh();
  const t = (await getDB().transactions.toArray()).filter((x) => x.deletedAt == null && x.txnDate === iso(new Date()));
  return { pool: c.pool, allowance: todayAllowance(c), spent: spentToday(t.map((x) => ({ amount: x.amount, fromSavings: x.fromSavings }))) };
}

describe('occasions (event checklist) in the database', () => {
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

  it('creates an event with items and does NOT turn it on', async () => {
    await setup();
    const r = await createOccasion("Ammu's birthday", [{ name: 'Decoration', planned: 3000 }, { name: 'Food', planned: 6500 }]);
    expect(r.error).toBeNull();
    const p = (await getEventPlan(r.id!))!;
    expect(p.items.map((x) => x.item.name)).toEqual(['Decoration', 'Food']);
    expect(p.totals).toMatchObject({ count: 2, doneCount: 0, planned: 9500, paid: 0, toGo: 9500 });
    expect((await getDB().meta.get('main'))?.activeEvent ?? null).toBeNull();
  });

  it('refuses a duplicate event name, a bad item and a name that is too long', async () => {
    await setup();
    await createOccasion('Party', []);
    expect((await createOccasion('party', [])).error).toMatch(/already/);
    expect((await createOccasion('Trip', [{ name: 'Tickets', planned: 0 }])).error).toMatch(/above 0/);
    expect((await createOccasion('Trip', [{ name: 'A', planned: 5 }, { name: 'a', planned: 5 }])).error).toMatch(/already/);
    expect((await createOccasion('x'.repeat(40), [])).error).toMatch(/characters/);
    expect((await getDB().evts.toArray()).filter((e) => e.deletedAt == null)).toHaveLength(1); // nothing half-created
  });

  it('adds, edits and removes items; caps the list', async () => {
    await setup();
    const { id } = await createOccasion('Wedding', [{ name: 'Hall', planned: 100 }]);
    expect(await addEventItem(id!, 'Cake', 50)).toBeNull();
    expect(await addEventItem(id!, 'cake', 50)).toMatch(/already/);
    const p = (await getEventPlan(id!))!;
    const cake = p.items.find((x) => x.item.name === 'Cake')!.item;
    expect(await updateEventItem(id!, cake.id, { planned: 75.5 })).toBeNull();
    expect((await getEventPlan(id!))!.totals.planned).toBe(175.5);
    expect(await removeEventItem(id!, cake.id)).toBeNull();
    expect((await getEventPlan(id!))!.items).toHaveLength(1);
    for (let i = 0; i < MAX_ITEMS - 1; i++) expect(await addEventItem(id!, `Item ${i}`, 1)).toBeNull();
    expect(await addEventItem(id!, 'One too many', 1)).toMatch(/up to/);
  });

  it('paying from the daily budget logs a tagged spend and lowers today; the plan alone changed nothing', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const before = await money();
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    expect(await payEventItem(cycle, id!, itemId, { amount: 650, fromSavings: false })).toBeNull();
    const p = (await getEventPlan(id!))!;
    expect(p.items[0].state).toEqual({ paid: true, actual: 650, fromSavings: false });
    expect(p.totals).toMatchObject({ paid: 650, toGo: 0, variance: 50, doneCount: 1 });
    const t = (await getDB().transactions.get(p.items[0].item.txnId!))!;
    expect(t).toMatchObject({ label: 'Food', amount: 650, event: 'Party', eventId: id, fromSavings: false });
    const after = await money();
    expect(after.spent).toBe(before.spent + 650);
    expect(after.pool).toBe(before.pool); // today's own spend lowers "left today", not the pool
  });

  it('paying from savings never touches the daily amount', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Hall', planned: 6000 }]);
    const before = await money();
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    expect(await payEventItem(cycle, id!, itemId, { amount: 6000, fromSavings: true })).toBeNull();
    expect(await money()).toEqual(before);
    const p = (await getEventPlan(id!))!;
    expect(p.totals).toMatchObject({ paid: 6000, fromSavings: 6000 });
  });

  it('cannot pay twice, with a bad amount, or for a missing item/event', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    expect(await payEventItem(cycle, id!, itemId, { amount: 0, fromSavings: false })).toMatch(/above 0/);
    expect(await payEventItem(cycle, id!, itemId, { amount: 1.005, fromSavings: false })).toMatch(/2 decimals/);
    expect(await payEventItem(cycle, id!, 'nope', { amount: 5, fromSavings: false })).toMatch(/gone/);
    expect(await payEventItem(cycle, 'nope', itemId, { amount: 5, fromSavings: false })).toMatch(/gone/);
    expect(await payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false })).toBeNull();
    expect(await payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false })).toMatch(/already paid/);
    expect((await getDB().transactions.toArray()).filter((t) => t.deletedAt == null && t.label === 'Food')).toHaveLength(1);
  });

  it('two taps at once pay only once', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    const r = await Promise.all([
      payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false }),
      payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false }),
    ]);
    expect(r.filter((x) => x === null)).toHaveLength(1);
    expect((await getDB().transactions.toArray()).filter((t) => t.deletedAt == null && t.label === 'Food')).toHaveLength(1);
  });

  it('editing the spend in History moves the actual; deleting it unticks the item', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    await payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false });
    const txnId = (await getEventPlan(id!))!.items[0].item.txnId!;
    await updateEntry(txnId, { amount: 700 });
    expect((await getEventPlan(id!))!.items[0].state.actual).toBe(700);
    expect(await removeEntry(txnId)).toBe('removed');
    const p = (await getEventPlan(id!))!;
    expect(p.items[0].state.paid).toBe(false);
    expect(p.totals).toMatchObject({ paid: 0, toGo: 600 });
    // and it can be paid again
    expect(await payEventItem(await fresh(), id!, itemId, { amount: 600, fromSavings: false })).toBeNull();
    expect((await getEventPlan(id!))!.items[0].state.paid).toBe(true);
  });

  it('unticking removes the spend and the pool is back; a paid item cannot be removed first', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    const before = await money();
    await payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false });
    expect(await removeEventItem(id!, itemId)).toMatch(/Untick/);
    expect(await unpayEventItem(id!, itemId)).toBeNull();
    expect(await unpayEventItem(id!, itemId)).toBeNull(); // idempotent
    expect(await money()).toEqual(before);
    const p = (await getEventPlan(id!))!;
    expect(p.items[0].item.txnId).toBeNull();
    expect(await removeEventItem(id!, itemId)).toBeNull();
  });

  it('renaming the event keeps items and links; removing it keeps the spends (untagged)', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const itemId = (await getEventPlan(id!))!.items[0].item.id;
    await payEventItem(cycle, id!, itemId, { amount: 600, fromSavings: false });
    expect(await renameEvent(id!, 'Birthday')).toBeNull();
    expect((await getEventPlan(id!))!.items[0].state.paid).toBe(true);
    const txnId = (await getEventPlan(id!))!.items[0].item.txnId!;
    await removeEvent(id!);
    expect(await getEventPlan(id!)).toBeNull();
    const t = (await getDB().transactions.get(txnId))!;
    expect(t.deletedAt ?? null).toBeNull();
    expect(t).toMatchObject({ amount: 600, event: null, eventId: null });
  });

  it('a spend logged into the event by hand is not an item', async () => {
    const cycle = await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    await addSpend(cycle, { amount: 90, label: 'Snacks', event: 'Party' });
    const p = (await getEventPlan(id!))!;
    expect(p.totals).toMatchObject({ paid: 0, doneCount: 0 });
  });

  it('sync mappers carry items and survive bad server data', async () => {
    await setup();
    const { id } = await createOccasion('Party', [{ name: 'Food', planned: 600 }]);
    const ev = (await getDB().evts.get(id!))!;
    const remote = MAPPERS.events.toRemote(ev) as Record<string, unknown>;
    expect(remote.items).toEqual(ev.items);
    const back = MAPPERS.events.toLocal({ ...remote, client_updated_at: 1, deleted_at: null, created_at: 1, categories: [] } as never);
    expect(back.items).toEqual(ev.items);
    const junk = MAPPERS.events.toLocal({ ...remote, items: 'oops', client_updated_at: 1, deleted_at: null, created_at: 1, categories: [] } as never);
    expect(junk.items).toEqual([]);
    const nul = MAPPERS.events.toLocal({ ...remote, items: null, client_updated_at: 1, deleted_at: null, created_at: 1, categories: [] } as never);
    expect(nul.items).toEqual([]);
  });

  it('an old event row with no items field reads as an empty list', async () => {
    await setup();
    const db = getDB();
    await db.evts.add({ id: 'legacy', updatedAt: 1, name: 'Old', note: null, categories: [], createdAt: 1 });
    expect(await getEventPlan('legacy')).toMatchObject({ items: [], totals: { count: 0 } });
    expect(await addEventItem('legacy', 'First', 10)).toBeNull();
  });
});
