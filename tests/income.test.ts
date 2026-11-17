import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addIncome, allCycles, createPlan, cycleFor, ensureSeed, previewCloseDay, removeIncome } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { todayAllowance } from '@/lib/budget';
import { incomeBetween, incomeEffects, incomeLabel, validateIncome } from '@/lib/income';
import { MAPPERS } from '@/lib/sync';

const inc = (amount: number, date: string, deletedAt: number | null = null) => ({ amount, date, deletedAt });

describe('income maths (lib/income.ts)', () => {
  it('turns live incomes into positive dated credits and skips tombstones', () => {
    expect(incomeEffects([inc(8000, '2026-11-10'), inc(500, '2026-11-11', 9)])).toEqual([{ date: '2026-11-10', amount: 8000 }]);
  });
  it('sums a date range inclusively', () => {
    const list = [inc(100, '2026-11-01'), inc(200, '2026-11-30'), inc(400, '2026-12-01'), inc(800, '2026-11-15', 1)];
    expect(incomeBetween(list, '2026-11-01', '2026-11-30')).toBe(300);
  });
  it('validates the amount; no type is needed', () => {
    expect(validateIncome({ amount: 0 })).toBe('Enter an amount first');
    expect(validateIncome({ amount: 10, source: 'x'.repeat(80) })).toMatch(/under/);
    expect(validateIncome({ amount: 10 })).toBeNull();
  });
  it('label: the note first, then the stored type, then "Income"', () => {
    expect(incomeLabel({ note: ' Diwali bonus ', source: 'Income' })).toBe('Diwali bonus');
    expect(incomeLabel({ note: null, source: 'Bonus' })).toBe('Bonus');
    expect(incomeLabel({ note: '', source: ' ' })).toBe('Income');
  });
  it('syncs: local -> remote -> local round trip keeps every field', () => {
    const i = { id: 'a', updatedAt: 5, deletedAt: null, amount: 8000, source: 'Bonus', date: '2026-11-10', event: 'Diwali', payment: 'UPI', note: 'n', createdAt: 4 };
    const back = MAPPERS.incomes.toLocal({ ...MAPPERS.incomes.toRemote(i), user_id: 'u' } as never);
    expect(back).toEqual(i);
  });
});

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };
const FROM = '2026-11-01';
const TODAY = '2026-11-20';

describe('extra income and the budget', () => {
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
  async function fixed(uid: string) {
    await openUserDB(uid);
    await ensureSeed();
    await createPlan(plan, FROM);
    return (await cycleFor(getDB(), TODAY, TODAY))!;
  }
  const now = async () => (await cycleFor(getDB(), TODAY, TODAY))!;

  it('income today raises the pool by its amount and every remaining day gets more', async () => {
    const base = await fixed('inc-1');
    await addIncome(base, { amount: 9000, source: 'Bonus' }, undefined, TODAY);
    const after = await now();
    expect(after.pool).toBe(base.pool + 9000);
    expect(todayAllowance(after)).toBeGreaterThan(todayAllowance(base));
    expect(after.planAmount).toBe(base.planAmount); // the plan itself is not edited
  });

  it('income is not spending: today\'s spend and the days stay put', async () => {
    const base = await fixed('inc-2');
    await addIncome(base, { amount: 9000, source: 'Gift' }, undefined, TODAY);
    expect((await previewCloseDay(TODAY))!.record.spent).toBe(0);
    expect((await now()).fromSavingsTotal).toBe(0);
  });

  it('income on a past day lifts the pool too', async () => {
    const base = await fixed('inc-3');
    await addIncome(base, { amount: 3000, source: 'Freelance' }, undefined, '2026-11-05');
    expect((await now()).pool).toBe(base.pool + 3000);
  });

  it('income in another month only changes that month', async () => {
    const base = await fixed('inc-4');
    await addIncome(base, { amount: 3000, source: 'Refund' }, undefined, '2026-12-03');
    expect((await now()).pool).toBe(base.pool);
    expect((await allCycles(getDB(), TODAY)).length).toBe(1);
  });

  it('removing an income takes the money back out', async () => {
    const base = await fixed('inc-5');
    const i = await addIncome(base, { amount: 4000, source: 'Other' }, undefined, TODAY);
    expect((await now()).pool).toBe(base.pool + 4000);
    await removeIncome(i.id);
    expect((await now()).pool).toBe(base.pool);
    expect((await getDB().incomes.get(i.id))!.deletedAt).not.toBeNull();
  });

  it('rejects an invalid income and writes nothing', async () => {
    const base = await fixed('inc-6');
    await expect(addIncome(base, { amount: 0 })).rejects.toThrow('Enter an amount first');
    expect(await getDB().incomes.count()).toBe(0);
  });
});
