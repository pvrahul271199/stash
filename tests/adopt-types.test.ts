import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adoptUsedTypes, addSpend, createPlan, cycleFor, ensureSeed, loadCategories } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';

const store = new Map<string, string>();

describe('adoptUsedTypes', () => {
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

  it('adds a type that spends carry but the category list lacks, once', async () => {
    await openUserDB('adopt-a');
    await ensureSeed();
    await createPlan({ income: 80000, bills: 20000, savings: 10000, monthLength: 30 }, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    // an old spend with a custom type the list never had
    await addSpend(cycle, { amount: 500, label: 'Fuel stop', category: 'Travel', subcategory: 'Highway toll' });
    const before = (await loadCategories()).find((c) => c.name === 'Travel')!;
    expect(before.subcategories).not.toContain('Highway toll');
    expect(await adoptUsedTypes()).toBe(1);
    const after = (await loadCategories()).find((c) => c.name === 'Travel')!;
    expect(after.subcategories).toContain('Highway toll');
    expect(await adoptUsedTypes()).toBe(0);
  });
});
