import { describe, expect, it } from 'vitest';
import {
  MAX_AMOUNT, MAX_ITEMS, defaultPlanName, parseQuickItem, MAX_ITEM_NAME, addItem, itemState, normalizeItems, payEffect, planTotals, removeItem,
  setItemTxn, updateItem, validateAmount, validateItem, type EventItem, type ItemTxn,
} from '@/lib/eventPlan';

const item = (id: string, name: string, planned: number, txnId: string | null = null): EventItem => ({ id, name, planned, txnId, createdAt: 1 });
const txns = (o: Record<string, ItemTxn>) => new Map(Object.entries(o));

describe('validateItem / validateAmount', () => {
  it('needs a name, a sane length and a positive amount', () => {
    expect(validateItem('', 100, [])).toMatch(/name/);
    expect(validateItem('   ', 100, [])).toMatch(/name/);
    expect(validateItem('x'.repeat(MAX_ITEM_NAME + 1), 100, [])).toMatch(/characters/);
    expect(validateItem('Cake', 0, [])).toBeNull(); // 0 = amount not known yet
    expect(validateItem('Cake', -5, [])).toMatch(/above 0/);
    expect(validateItem('Cake', NaN, [])).toMatch(/above 0/);
    expect(validateItem('Cake', Infinity, [])).toMatch(/above 0/);
    expect(validateItem('Cake', 1500, [])).toBeNull();
  });
  it('rejects a duplicate name (case-insensitive) and a full list', () => {
    expect(validateItem(' cake ', 10, ['Cake'])).toMatch(/already/);
    expect(validateItem('New', 10, [], MAX_ITEMS)).toMatch(/up to/);
  });
  it('limits decimals and size', () => {
    expect(validateAmount(10.5)).toBeNull();
    expect(validateAmount(10.555)).toMatch(/2 decimals/);
    expect(validateAmount(MAX_AMOUNT)).toBeNull();
    expect(validateAmount(MAX_AMOUNT + 1)).toMatch(/too large/);
  });
});

describe('itemState / planTotals', () => {
  const items = [item('a', 'Hall', 6000, 't1'), item('b', 'Decoration', 3000, 't2'), item('c', 'Cake', 1500, 't3'), item('d', 'Food', 6500)];
  const t = txns({
    t1: { amount: 6000, fromSavings: true },
    t2: { amount: 3500, fromSavings: false },
    t3: { amount: 1200, fromSavings: false, deletedAt: 5 }, // deleted in History: back to unpaid
  });
  it('is paid only while the linked spend is alive', () => {
    expect(itemState(items[0], t)).toEqual({ paid: true, actual: 6000, fromSavings: true });
    expect(itemState(items[2], t).paid).toBe(false); // deleted txn
    expect(itemState(items[3], t).paid).toBe(false); // no link
    expect(itemState(item('z', 'Gone', 10, 'missing'), t).paid).toBe(false); // txn not found (not synced yet)
  });
  it('an item with no amount yet has nothing to be over or under', () => {
    const xs = [item('a', 'A', 0, 'x'), item('b', 'B', 100, 'y'), item('c', 'C', 0)];
    const t = new Map([['x', { amount: 80, fromSavings: false }], ['y', { amount: 120, fromSavings: false }]]);
    expect(planTotals(xs, t)).toMatchObject({ paid: 200, planned: 100, toGo: 0, variance: 20, doneCount: 2 });
  });

  it('totals planned, paid, to go, variance and savings', () => {
    expect(planTotals(items, t)).toEqual({
      count: 4, doneCount: 2, planned: 17000, paid: 9500, toGo: 8000, variance: 500, fromSavings: 6000,
    });
  });
  it('an empty list is all zeros', () => {
    expect(planTotals([], t)).toEqual({ count: 0, doneCount: 0, planned: 0, paid: 0, toGo: 0, variance: 0, fromSavings: 0 });
  });
  it('sums without float drift', () => {
    const xs = [item('a', 'A', 0.1, 'x'), item('b', 'B', 0.2, 'y')];
    const r = planTotals(xs, txns({ x: { amount: 0.1, fromSavings: false }, y: { amount: 0.2, fromSavings: false } }));
    expect(r.paid).toBe(0.3);
    expect(r.planned).toBe(0.3);
    expect(r.variance).toBe(0);
  });
});

describe('list edits', () => {
  it('adds and trims; more than 2 decimals is refused', () => {
    const r = addItem([], '  Food ', 6500.5, 'i1', 9);
    expect(r.error).toBeNull();
    expect(r.items).toEqual([{ id: 'i1', name: 'Food', planned: 6500.5, txnId: null, createdAt: 9 }]);
    expect(addItem([], 'Food', 6500.005, 'i1', 9).error).toMatch(/2 decimals/);
  });
  it('refuses a duplicate or a bad amount', () => {
    const base = [item('a', 'Food', 100)];
    expect(addItem(base, 'food', 100, 'b', 1).error).toMatch(/already/);
    expect(addItem(base, 'Cake', -1, 'b', 1).error).toMatch(/above 0/);
    expect(addItem(base, 'Cake', 0, 'b', 1).error).toBeNull(); // amount can be added later
  });
  it('edits name and plan; renaming to its own name is fine; a clash is not', () => {
    const base = [item('a', 'Food', 100), item('b', 'Cake', 50)];
    expect(updateItem(base, 'a', { name: 'Food', planned: 200 }).items?.[0].planned).toBe(200);
    expect(updateItem(base, 'a', { name: 'cake' }).error).toMatch(/already/);
    expect(updateItem(base, 'nope', { planned: 1 }).error).toMatch(/gone/);
  });
  it('can edit a full list (the cap only blocks adding)', () => {
    const full = Array.from({ length: MAX_ITEMS }, (_, i) => item(`i${i}`, `Item ${i}`, 10));
    expect(updateItem(full, 'i0', { planned: 20 }).error).toBeNull();
    expect(addItem(full, 'One more', 10, 'x', 1).error).toMatch(/up to/);
  });
  it('refuses to remove a paid item, allows an unpaid or one whose spend was deleted', () => {
    const base = [item('a', 'Hall', 100, 't1'), item('b', 'Cake', 50), item('c', 'Food', 70, 't2')];
    const t = txns({ t1: { amount: 100, fromSavings: false }, t2: { amount: 70, fromSavings: false, deletedAt: 1 } });
    expect(removeItem(base, 'a', t).error).toMatch(/Untick/);
    expect(removeItem(base, 'b', t).items?.map((i) => i.id)).toEqual(['a', 'c']);
    expect(removeItem(base, 'c', t).items?.map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('links and unlinks a spend', () => {
    const base = [item('a', 'Hall', 100)];
    expect(setItemTxn(base, 'a', 't9')[0].txnId).toBe('t9');
    expect(setItemTxn(setItemTxn(base, 'a', 't9'), 'a', null)[0].txnId).toBeNull();
  });
});

describe('normalizeItems (data from the server)', () => {
  it('turns garbage into an empty list and never throws', () => {
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems('x')).toEqual([]);
    expect(normalizeItems({})).toEqual([]);
    expect(normalizeItems([1, null, 'a', []])).toEqual([]);
  });
  it('drops malformed items and fixes duplicates', () => {
    const out = normalizeItems([
      { id: 'a', name: 'Hall', planned: 100, txnId: 't1', createdAt: 1 },
      { id: 'a', name: 'Dup id', planned: 5 },
      { id: 'b', name: '', planned: 5 },
      { id: 'c', name: 'Neg', planned: -1 },
      { id: 'd', name: 'Str', planned: '9' },
      { id: 'e', name: 'Same txn', planned: 7, txnId: 't1' },
      { id: 'f', name: '  Trim  ', planned: 1.234 },
    ]);
    expect(out.map((i) => i.id)).toEqual(['a', 'e', 'f']);
    expect(out[1].txnId).toBeNull(); // second claim on t1 is dropped
    expect(out[2]).toMatchObject({ name: 'Trim', planned: 1.23 });
  });
  it('clamps the list length and long names', () => {
    const many = Array.from({ length: MAX_ITEMS + 20 }, (_, i) => ({ id: `i${i}`, name: 'n'.repeat(80), planned: 1 }));
    const out = normalizeItems(many);
    expect(out).toHaveLength(MAX_ITEMS);
    expect(out[0].name).toHaveLength(MAX_ITEM_NAME);
  });
});

describe('payEffect (same rules as the Today screen)', () => {
  const base = { pool: 8800, daysLeft: 11, spentToday: 0 };
  it('a daily-budget payment makes today negative and spreads the rest', () => {
    const r = payEffect({ ...base, amount: 6500, fromSavings: false });
    expect(r).toEqual({ leftToday: -5700, tomorrow: 230, changes: true });
  });
  it('savings leave both numbers alone (tomorrow is what it would be anyway: 8800 over 10 days)', () => {
    const r = payEffect({ ...base, amount: 6500, fromSavings: true });
    expect(r).toEqual({ leftToday: 800, tomorrow: 880, changes: false });
  });
  it('counts what was already spent today', () => {
    expect(payEffect({ ...base, spentToday: 300, amount: 200, fromSavings: false }).leftToday).toBe(300);
  });
  it('on the last day there is no tomorrow', () => {
    expect(payEffect({ pool: 500, daysLeft: 1, spentToday: 0, amount: 200, fromSavings: false })).toEqual({ leftToday: 300, tomorrow: null, changes: true });
  });
  it('a bad day count never divides by zero', () => {
    expect(Number.isFinite(payEffect({ pool: 100, daysLeft: 0, spentToday: 0, amount: 10, fromSavings: false }).leftToday)).toBe(true);
  });
});

describe('parseQuickItem / defaultPlanName', () => {
  it('reads "name amount", "name ₹amount" and "amount name"', () => {
    expect(parseQuickItem('Milk 60')).toEqual({ name: 'Milk', planned: 60 });
    expect(parseQuickItem('  Return   gifts 1500')).toEqual({ name: 'Return gifts', planned: 1500 });
    expect(parseQuickItem('Cake ₹900.50')).toEqual({ name: 'Cake', planned: 900.5 });
    expect(parseQuickItem('₹120 plates')).toEqual({ name: 'plates', planned: 120 });
    expect(parseQuickItem('Cake900')).toEqual({ name: 'Cake', planned: 900 });
  });
  it('no amount means amount later; digits alone stay a name', () => {
    expect(parseQuickItem('Candles')).toEqual({ name: 'Candles', planned: 0 });
    expect(parseQuickItem('7')).toEqual({ name: '7', planned: 0 });
    expect(parseQuickItem('   ')).toBeNull();
  });
  it('names an unnamed plan by its date', () => {
    expect(defaultPlanName('2026-11-26')).toBe('Plan · 26 Nov');
  });
});

describe('rough-book list (qty, no prices)', () => {
  it('parseQuickQty reads a quantity at either end', async () => {
    const { parseQuickQty } = await import('@/lib/eventPlan');
    expect(parseQuickQty('Milk 2')).toEqual({ name: 'Milk', qty: '2' });
    expect(parseQuickQty('Milk x2')).toEqual({ name: 'Milk', qty: '2' });
    expect(parseQuickQty('Rice 5 kg')).toEqual({ name: 'Rice', qty: '5 kg' });
    expect(parseQuickQty('2 kg rice')).toEqual({ name: 'rice', qty: '2 kg' });
    expect(parseQuickQty('Candles')).toEqual({ name: 'Candles', qty: '' });
    expect(parseQuickQty('7')).toEqual({ name: '7', qty: '' });
    expect(parseQuickQty('  ')).toBeNull();
  });

  it('a ticked item counts as bought with nothing logged; unticking clears it', async () => {
    const { addItem, setItemBought, itemState, normalizeItems } = await import('@/lib/eventPlan');
    const r = addItem([], 'Milk', 0, 'a', 1, '2');
    const items = r.items!;
    expect(items[0].qty).toBe('2');
    const ticked = setItemBought(items, 'a', true);
    expect(itemState(ticked[0], new Map())).toEqual({ paid: true, actual: null, fromSavings: false });
    expect(normalizeItems(ticked)[0].bought).toBe(true);
    expect(itemState(setItemBought(ticked, 'a', false)[0], new Map()).paid).toBe(false);
  });
});

describe('shared picture', () => {
  it('qtyLabel and planText', async () => {
    const { qtyLabel } = await import('@/lib/eventPlan');
    const { planText } = await import('@/lib/planImage');
    expect(qtyLabel('2')).toBe('× 2');
    expect(qtyLabel('500 g')).toBe('500 g');
    const d = { title: 'Market', dateText: 'Sun', rows: [{ name: 'Milk', qty: '2', price: 60, bought: true }, { name: 'Eggs', qty: '', price: 0, bought: false }], planned: 60, spent: 60, toGo: 0, money: (n: number) => `₹${n}` };
    expect(planText(d, { strike: true })).toBe('*Market*\nSun\n\n✅ ~Milk~  × 2  –  ₹60\n⬜ Eggs\n\nPlanned: ₹60\nSpent so far: ₹60\nStill to buy: ₹0\n\n– Chelav');
    expect(planText(d, { strike: false })).toContain('✅ Milk  × 2');
  });
});
