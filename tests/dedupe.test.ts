import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDB, openUserDB } from '@/db/schema';
import {
  addSpend,
  createPlan,
  dedupeCategories,
  ensureSeed,
  loadCategories,
} from '@/db/queries';
import { todayISO } from '@/lib/dates';
import { cycleFor } from '@/db/queries';

let n = 0;
const plan = { income: 50000, bills: 20000, savings: 0, monthLength: 30 };
const cat = (id: string, name: string, updatedAt: number, subcategories: string[] = []) => ({
  id, updatedAt, name, sortOrder: 0, isSystem: false, subcategories, baseId: null, subAdded: [], subRemoved: [],
});

describe('duplicate categories', () => {
  beforeEach(async () => {
    n++;
    await openUserDB(`dedupe-${n}`);
    await ensureSeed();
  });

  it('a user row copying a default is folded into the default; its spends follow and extra subcategories are kept', async () => {
    const db = getDB();
    await createPlan(plan, todayISO());
    await db.cats.add(cat('copy-food', 'food', 1, ['Lunch', 'Tiffin']));
    const cycle = (await cycleFor(db))!;
    const e = await addSpend(cycle, { amount: 120, label: 'x', category: 'food' });
    await db.transactions.update(e.id, { categoryId: 'copy-food' });

    expect((await loadCategories()).filter((c) => c.name.toLowerCase() === 'food')).toHaveLength(1); // display never doubles
    expect(await dedupeCategories()).toBe(1);
    expect((await db.cats.get('copy-food'))!.deletedAt).not.toBeNull(); // tombstoned, so the repair syncs
    expect((await db.transactions.get(e.id))!.categoryId).toBe('food');
    const food = (await loadCategories()).find((c) => c.id === 'food')!;
    expect(food.subcategories).toContain('Tiffin');
    expect(await dedupeCategories()).toBe(0); // idempotent
  });

  it('two user rows with the same name keep the older one', async () => {
    const db = getDB();
    await db.cats.bulkAdd([cat('gym-old', 'Gym', 1), cat('gym-new', 'gym', 2)]);
    expect(await dedupeCategories()).toBe(1);
    expect((await db.cats.get('gym-old'))!.deletedAt ?? null).toBeNull();
    expect((await loadCategories()).filter((c) => c.name.toLowerCase() === 'gym').map((c) => c.id)).toEqual(['gym-old']);
  });
});
