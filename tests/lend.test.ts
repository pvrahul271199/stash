import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLoan, addSpend, addSubcategory, allCycles, createPlan, cycleFor, dateTotalsBetween, ensureSeed, loadCategories,
  loadLinkNames, previewCloseDay, recordRepayment, removeEntry, reopenLoan, setLoanDue, toEntry,
  undoLastRepayment, updateEntry, writeOffLoan,
} from '@/db/queries';
import { getDB, openUserDB, type Loan } from '@/db/schema';
import { rollupCycle, spentToday, todayAllowance } from '@/lib/budget';
import { buildCycle, periodFor } from '@/lib/period';
import { MAPPERS } from '@/lib/sync';
import { addDays } from '@/lib/dates';
import {
  closedLoans, dueFromChoice, dueText, loanName, loanStatus, openLoans, remaining, summarize, validateLoan,
  loanEffects, writtenOffAmount, type LoanLike,
} from '@/lib/lend';

const loan = (over: Partial<LoanLike & { createdAt: number }> = {}): LoanLike & { createdAt: number } => ({
  amount: 5000, dueDate: null, repayments: [], writtenOff: false, createdAt: 1, ...over,
});
const pay = (amount: number, date = '2026-11-10') => ({ id: `r${amount}${date}`, amount, date });

describe('lend maths (lib/lend.ts)', () => {
  it('remaining = amount minus repayments, never negative; written off owes nothing', () => {
    expect(remaining(loan())).toBe(5000);
    expect(remaining(loan({ repayments: [pay(2000), pay(1000)] }))).toBe(2000);
    expect(remaining(loan({ repayments: [pay(6000)] }))).toBe(0);
    expect(remaining(loan({ writtenOff: true }))).toBe(0);
  });

  it('status: settled, overdue, soon (7 days), later, and no date counts as later', () => {
    const today = '2026-11-16';
    expect(loanStatus(loan({ repayments: [pay(5000)] }), today)).toBe('settled');
    expect(loanStatus(loan({ dueDate: '2026-11-15' }), today)).toBe('overdue');
    expect(loanStatus(loan({ dueDate: '2026-11-16' }), today)).toBe('soon');
    expect(loanStatus(loan({ dueDate: '2026-11-23' }), today)).toBe('soon');
    expect(loanStatus(loan({ dueDate: '2026-11-24' }), today)).toBe('later');
    expect(loanStatus(loan(), today)).toBe('later');
  });

  it('due text', () => {
    const today = '2026-11-16';
    expect(dueText(loan({ dueDate: '2026-11-10' }), today)).toBe('6 days late');
    expect(dueText(loan({ dueDate: '2026-11-15' }), today)).toBe('1 day late');
    expect(dueText(loan({ dueDate: '2026-11-16' }), today)).toBe('Due today');
    expect(dueText(loan({ dueDate: '2026-11-30' }), today)).toBe('By 30 Nov');
    expect(dueText(loan(), today)).toBe('No date');
    expect(dueText(loan({ repayments: [pay(5000)] }), today)).toBe('Paid back');
    expect(dueText(loan({ writtenOff: true }), today)).toBe('Written off');
  });

  it('open loans sort by due date (undated last); closed loans are separate; tombstones are ignored', () => {
    const a = loan({ dueDate: '2026-12-01', createdAt: 1 });
    const b = loan({ dueDate: '2026-11-20', createdAt: 2 });
    const c = loan({ createdAt: 3 });
    const done = loan({ repayments: [pay(5000)], createdAt: 4 });
    const gone = loan({ deletedAt: 9, createdAt: 5 });
    expect(openLoans([a, c, b, done, gone])).toEqual([b, a, c]);
    expect(closedLoans([a, done, gone])).toEqual([done]);
  });

  it('summary', () => {
    const today = '2026-11-16';
    const s = summarize(
      [
        loan({ dueDate: '2026-11-10', amount: 2000 }), // overdue
        loan({ dueDate: '2026-11-20', amount: 5000, repayments: [pay(2000)] }), // soon, 3000 left
        loan({ dueDate: '2027-01-15', amount: 8000 }), // later
        loan({ amount: 1000, repayments: [pay(1000)] }), // settled
      ],
      today,
    );
    expect(s).toEqual({ total: 13000, people: 3, overdue: 1, overdueAmount: 2000, soonAmount: 3000 });
  });

  it('only a write-off reaches the budget: open, part-paid and fully repaid loans give no effect', () => {
    expect(loanEffects([loan(), loan({ repayments: [pay(2000)] }), loan({ repayments: [pay(5000)] })])).toEqual([]);
  });

  it('a write-off is a negative effect for what was still owed, dated the day it was written off', () => {
    const off = loan({ repayments: [pay(2000)], writtenOff: true, writtenOffOn: '2026-11-20' });
    expect(writtenOffAmount(off)).toBe(3000);
    expect(loanEffects([off])).toEqual([{ date: '2026-11-20', amount: -3000 }]);
  });

  it('write-offs without a date, with nothing left, or deleted are ignored', () => {
    expect(loanEffects([loan({ writtenOff: true })])).toEqual([]); // never dated
    expect(loanEffects([loan({ writtenOff: true, writtenOffOn: '2026-11-20', repayments: [pay(5000)] })])).toEqual([]);
    expect(loanEffects([loan({ writtenOff: true, writtenOffOn: '2026-11-20', deletedAt: 1 })])).toEqual([]);
  });

  it('due choices: a week out, the last day of the month, none', () => {
    expect(dueFromChoice('week', '2026-11-16')).toBe('2026-11-23');
    expect(dueFromChoice('month', '2026-11-16')).toBe('2026-11-30');
    expect(dueFromChoice('month', '2026-02-03')).toBe('2026-02-28');
    expect(dueFromChoice('month', '2028-02-03')).toBe('2028-02-29');
    expect(dueFromChoice('none', '2026-11-16')).toBeNull();
  });

  it('validation messages', () => {
    const ok = { amount: 500, person: 'Arjun', kind: 'Friends', dueDate: null };
    expect(validateLoan(ok, '2026-11-16')).toBeNull();
    expect(validateLoan({ ...ok, amount: 0 }, '2026-11-16')).toMatch(/amount/i);
    expect(validateLoan({ ...ok, person: '  ' }, '2026-11-16')).toBeNull(); // the name is optional
    expect(validateLoan({ ...ok, person: 'x'.repeat(25) }, '2026-11-16')).toMatch(/24/);
    expect(validateLoan({ ...ok, kind: 'Neighbour' }, '2026-11-16')).toBeNull(); // any type the user added is fine
    expect(validateLoan({ ...ok, kind: '  ' }, '2026-11-16')).toMatch(/who you lent/i);
    expect(validateLoan({ ...ok, kind: 'x'.repeat(25) }, '2026-11-16')).toMatch(/who you lent/i);
    expect(validateLoan({ ...ok, dueDate: '2026-11-01' }, '2026-11-16')).toMatch(/before/);
  });
});

describe('a write-off is a month-level debit in the budget maths', () => {
  const cyc = { startDate: '2026-10-01', totalDays: 10, planAmount: 1000 };

  it('spentToday ignores lent amounts (lending is not spending)', () => {
    expect(spentToday([{ amount: 100, fromSavings: false }, { amount: 5000, fromSavings: false, outsideBudget: true }])).toBe(100);
  });

  it('dated today it lowers the pool at once, and "spent" is untouched', () => {
    const base = rollupCycle({ ...cyc, currentDay: 3 }, []);
    const r = rollupCycle({ ...cyc, currentDay: 3 }, [], [{ date: '2026-10-03', amount: -800 }]);
    expect(r.pool).toBe(base.pool - 800);
    expect(r.days.every((d) => d.spent === 0)).toBe(true);
    // closing that day later counts the same money once
    const closed = rollupCycle({ ...cyc, currentDay: 4 }, [], [{ date: '2026-10-03', amount: -800 }]);
    expect(closed.pool).toBe(rollupCycle({ ...cyc, currentDay: 4 }, []).pool - 800);
  });

  it('dated on a closed day it shows as spent on that day and lowers the pool; earlier days are not rewritten', () => {
    const none = rollupCycle({ ...cyc, currentDay: 4 }, [{ txnDate: '2026-10-02', amount: 300, fromSavings: false }]);
    const off = rollupCycle({ ...cyc, currentDay: 4 }, [{ txnDate: '2026-10-02', amount: 300, fromSavings: false }], [{ date: '2026-10-02', amount: -200 }]);
    expect(off.pool).toBe(none.pool - 200);
    expect(off.days[1].spent).toBe(500);
    expect(off.days[0].allowanceAtStart).toBe(none.days[0].allowanceAtStart);
    expect(off.days[2].allowanceAtStart).toBeLessThan(none.days[2].allowanceAtStart);
  });

  it('a debit outside the cycle is ignored', () => {
    const base = rollupCycle({ ...cyc, currentDay: 3 }, []);
    expect(rollupCycle({ ...cyc, currentDay: 3 }, [], [{ date: '2026-11-03', amount: -800 }]).pool).toBe(base.pool);
  });

  it('buildCycle only counts a write-off in its own month; the plan amount is untouched', () => {
    const plan = { income: 50000, bills: 20000, savings: 0, createdAt: 1, effectiveFrom: '2026-10-01', periodStartDay: 1 };
    const nov = periodFor(1, '2026-11-16');
    const oct = periodFor(1, '2026-10-16');
    const effects = [{ date: '2026-11-05', amount: -3000 }];
    const baseNov = buildCycle(nov, plan, [], '2026-11-16', '2026-10-01')!;
    const baseOct = buildCycle(oct, plan, [], '2026-11-16', '2026-10-01')!;
    const withNov = buildCycle(nov, plan, [], '2026-11-16', '2026-10-01', false, effects)!;
    const withOct = buildCycle(oct, plan, [], '2026-11-16', '2026-10-01', false, effects)!;
    expect(withNov.pool).toBe(baseNov.pool - 3000);
    expect(withNov.planAmount).toBe(baseNov.planAmount);
    expect(todayAllowance(withNov)).toBeLessThan(todayAllowance(baseNov));
    expect(withOct.pool).toBe(baseOct.pool); // October is not touched by a November write-off
    expect(withOct.days).toEqual(baseOct.days);
  });
});

const store = new Map<string, string>();
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };
const TODAY = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function setup(uid: string) {
  await openUserDB(uid);
  await ensureSeed();
  await createPlan(plan, `${iso(TODAY).slice(0, 8)}01`);
  return (await cycleFor(getDB()))!;
}

describe('loans in the database', () => {
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

  it('addLoan writes the Lend spend and the loan together, linked by id', async () => {
    const cycle = await setup('lend-a');
    const { loan: l, entry } = await addLoan(cycle, { amount: 5000, person: ' Arjun ', kind: 'Friends', dueDate: null });
    const t = (await getDB().transactions.get(entry.id))!;
    expect(t).toMatchObject({ amount: 5000, type: 'Lend', categoryId: 'lend', subtype: 'Friends', label: 'Arjun', fromSavings: false });
    expect(await getDB().loans.get(l.id)).toMatchObject({ txnId: t.id, person: 'Arjun', kind: 'Friends', amount: 5000, lentOn: t.txnDate, repayments: [], writtenOff: false });
  });

  it('the name is optional: the type stands in for it, and a custom type works', async () => {
    const cycle = await setup('lend-names');
    const a = await addLoan(cycle, { amount: 300, person: '  ', kind: 'Neighbour', dueDate: null });
    expect(a.loan).toMatchObject({ person: '', kind: 'Neighbour' });
    expect(loanName(a.loan)).toBe('Neighbour');
    expect(await getDB().transactions.get(a.entry.id)).toMatchObject({ type: 'Lend', subtype: 'Neighbour', label: 'Neighbour' });
    const b = await addLoan(cycle, { amount: 300, person: 'Arjun', kind: 'Friends', dueDate: null });
    expect(loanName(b.loan)).toBe('Arjun');
  });

  it('a type added to the Lend category is a real type of it (Categories and the picker see it)', async () => {
    await setup('lend-kinds');
    const lend = (await loadCategories()).find((c) => c.name === 'Lend')!;
    expect(lend.subcategories).toEqual(['Friends', 'Family', 'Coworker']);
    expect(await addSubcategory(lend.id, 'Neighbour')).toBeNull();
    expect(await addSubcategory(lend.id, 'friends')).toMatch(/already/i);
    expect((await loadCategories()).find((c) => c.name === 'Lend')!.subcategories).toContain('Neighbour');
  });

  it('invalid input writes nothing', async () => {
    const cycle = await setup('lend-c');
    await expect(addLoan(cycle, { amount: 0, person: 'A', kind: 'Friends', dueDate: null })).rejects.toThrow(/amount/i);
    await expect(addLoan(cycle, { amount: 10, person: 'A', kind: '', dueDate: null })).rejects.toThrow(/who you lent/i);
    expect(await getDB().loans.count()).toBe(0);
    expect(await getDB().transactions.count()).toBe(0);
  });

  it('repayment is clamped to what is owed; undo takes the last one back', async () => {
    const cycle = await setup('lend-d');
    const { loan: l } = await addLoan(cycle, { amount: 5000, person: 'Arjun', kind: 'Friends', dueDate: null });
    const r1 = await recordRepayment(l.id, 2000);
    expect(r1!.repayments).toHaveLength(1);
    const r2 = await recordRepayment(l.id, 99999); // only 3000 is left
    expect(remaining(r2!)).toBe(0);
    expect(r2!.repayments.map((r) => r.amount)).toEqual([2000, 3000]);
    expect(await recordRepayment(l.id, 100)).toBeNull(); // nothing owed any more
    expect((await undoLastRepayment(l.id))!.repayments.map((r) => r.amount)).toEqual([2000]);
  });

  it('due date and will-pay edits; a date before the day it was lent is refused', async () => {
    const cycle = await setup('lend-f');
    const { loan: l } = await addLoan(cycle, { amount: 1000, person: 'Meera', kind: 'Friends', dueDate: null });
    const later = addDays(l.lentOn, 3);
    expect((await setLoanDue(l.id, later))!.dueDate).toBe(later);
    expect(await setLoanDue(l.id, '2000-01-01')).toBeNull();
    expect((await setLoanDue(l.id, null))!.dueDate).toBeNull();
  });

  it('deleting the Lend spend removes its loan, unless money already came back', async () => {
    const cycle = await setup('lend-g');
    const a = await addLoan(cycle, { amount: 1000, person: 'A', kind: 'Friends', dueDate: null });
    expect(await removeEntry(a.entry.id)).toBe('removed');
    expect((await getDB().loans.get(a.loan.id))!.deletedAt).toBeTypeOf('number');
    expect((await getDB().transactions.get(a.entry.id))!.deletedAt).toBeTypeOf('number');

    const b = await addLoan(cycle, { amount: 1000, person: 'B', kind: 'Family', dueDate: null });
    await recordRepayment(b.loan.id, 100);
    expect(await removeEntry(b.entry.id)).toBe('has-repayments');
    expect((await getDB().loans.get(b.loan.id))!.deletedAt).toBeUndefined();
    expect((await getDB().transactions.get(b.entry.id))!.deletedAt).toBeUndefined();
  });

  it('a loan owns its spend: amount, category and label cannot be edited, note and payment can', async () => {
    const cycle = await setup('lend-h');
    const { entry } = await addLoan(cycle, { amount: 1000, person: 'A', kind: 'Friends', dueDate: null });
    await updateEntry(entry.id, { amount: 9, category: 'Food', subcategory: null, label: 'Lunch', note: 'for rent', payment: 'Cash' });
    const t = (await getDB().transactions.get(entry.id))!;
    expect(t).toMatchObject({ amount: 1000, type: 'Lend', subtype: 'Friends', label: 'A', note: 'for rent', payment: 'Cash' });
  });

  it('an ordinary spend is untouched by the loan rules', async () => {
    const cycle = await setup('lend-i');
    const e = await addSpend(cycle, { amount: 50, label: 'Tea', category: 'Food' });
    await updateEntry(e.id, { amount: 60 });
    expect((await getDB().transactions.get(e.id))!.amount).toBe(60);
    expect(await removeEntry(e.id)).toBe('removed');
  });
});

/* The rule: lending is not spending. A lend and its repayments never touch today's spend, "left today", the pool, the days,
 * History totals or Insights. The ONLY time a loan reaches the budget is a write-off, in the month it was written off. */
describe('lending and the budget', () => {
  const FROM = '2026-11-01';
  const TODAY_ISO = '2026-11-20';
  const NOON = new Date(2026, 10, 20, 12);

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

  async function fixed(uid: string, from = FROM) {
    await openUserDB(uid);
    await ensureSeed();
    await createPlan(plan, from);
    return (await cycleFor(getDB(), TODAY_ISO, TODAY_ISO))!;
  }
  const now = async () => (await cycleFor(getDB(), TODAY_ISO, TODAY_ISO))!;
  const lend = (cycle: Awaited<ReturnType<typeof now>>, amount: number, date?: string) =>
    addLoan(cycle, { amount, person: 'Arjun', kind: 'Friends', dueDate: null }, NOON, undefined, date);

  it('adding a lend takes it out of the pool at once (daily amount drops); "spent today" and the days are untouched', async () => {
    const base = await fixed('lb-1');
    const before = await previewCloseDay(TODAY_ISO);
    await lend(base, 5000);
    const after = await now();
    expect(after.pool).toBe(base.pool - 5000);
    expect(todayAllowance(after)).toBeLessThan(todayAllowance(base));
    expect(after.days).toEqual(base.days);
    const preview = await previewCloseDay(TODAY_ISO);
    expect(preview!.record.spent).toBe(0); // not a spend
    expect(preview!.tomorrowAllowance).toBeLessThan(before!.tomorrowAllowance);
  });

  it('a real spend on the same day still counts, the lend beside it does not', async () => {
    const base = await fixed('lb-2');
    await addSpend(base, { amount: 100, label: 'Lunch', category: 'Food' }, NOON);
    await lend(base, 5000);
    expect((await previewCloseDay(TODAY_ISO))!.record.spent).toBe(100);
  });

  it('a lend dated on a past day comes out of the pool and shows on that day', async () => {
    const base = await fixed('lb-3');
    await lend(base, 5000, '2026-11-10');
    const after = await now();
    expect(after.pool).toBe(base.pool - 5000);
    expect(after.days[9].spent).toBe(5000); // day 10
  });

  it('a lend dated before budgeting began does not move the tracking start or create an earlier month', async () => {
    const base = await fixed('lb-4');
    await lend(base, 5000, '2026-10-25');
    expect((await getDB().plans.toArray())[0].effectiveFrom).toBe(FROM);
    expect(await cycleFor(getDB(), '2026-10-25', TODAY_ISO)).toBeUndefined();
    expect((await now()).pool).toBe(base.pool);
  });

  it('lend, part repayment and full repayment: the pool goes down by the lend and comes back as money returns', async () => {
    const base = await fixed('lb-5');
    const { loan: l } = await lend(base, 5000);
    expect((await now()).pool).toBe(base.pool - 5000);
    await recordRepayment(l.id, 2000, TODAY_ISO);
    expect((await now()).pool).toBe(base.pool - 3000);
    await recordRepayment(l.id, 3000, '2026-11-12');
    expect((await now()).pool).toBe(base.pool);
    expect((await allCycles(getDB(), TODAY_ISO)).find((c) => c.id === base.id)!.pool).toBe(base.pool);
  });

  it('writing off adds nothing more: what was left is already out of the pool, today spend does not move', async () => {
    const base = await fixed('lb-6');
    const { loan: l } = await lend(base, 5000);
    await recordRepayment(l.id, 2000, TODAY_ISO);
    await writeOffLoan(l.id, TODAY_ISO);
    const after = await now();
    expect(after.pool).toBe(base.pool - 3000); // 5000 lent - 2000 back = 3000 lost
    expect(todayAllowance(after)).toBeLessThan(todayAllowance(base));
    expect((await previewCloseDay(TODAY_ISO))!.record.spent).toBe(0); // not a spend on the day it was written off
    expect((await allCycles(getDB(), TODAY_ISO)).find((c) => c.id === base.id)!.pool).toBe(base.pool - 3000);
  });

  it('a lend hits the month it was lent in, and a later write-off in November changes nothing', async () => {
    await openUserDB('lb-7');
    await ensureSeed();
    await createPlan(plan, '2026-10-01');
    const octBefore = (await cycleFor(getDB(), '2026-10-15', TODAY_ISO))!;
    const novBefore = (await cycleFor(getDB(), TODAY_ISO, TODAY_ISO))!;
    const { loan: l } = await lend(novBefore, 4000, '2026-10-20'); // lent in October...
    const octAfter = (await cycleFor(getDB(), '2026-10-15', TODAY_ISO))!;
    expect(octAfter.pool).toBe(octBefore.pool - 4000);
    await writeOffLoan(l.id, TODAY_ISO); // ...written off in November
    expect(await cycleFor(getDB(), '2026-10-15', TODAY_ISO)).toEqual(octAfter);
    expect((await cycleFor(getDB(), TODAY_ISO, TODAY_ISO))!.pool).toBe(novBefore.pool); // November never saw it
  });

  it('a write-off dated on a closed day changes no day: the lend already took the money out', async () => {
    const base = await fixed('lb-8');
    const { loan: l } = await lend(base, 3000);
    const held = await now();
    await writeOffLoan(l.id, '2026-11-05');
    const after = await now();
    expect(after.pool).toBe(base.pool - 3000);
    expect(after.days).toEqual(held.days);
  });

  it('undoing a write-off (or the last repayment of a written-off loan) keeps the unpaid part out of the pool', async () => {
    const base = await fixed('lb-9');
    const { loan: l } = await lend(base, 3000);
    await writeOffLoan(l.id, TODAY_ISO);
    expect((await now()).pool).toBe(base.pool - 3000);
    expect((await reopenLoan(l.id))!.writtenOff).toBe(false);
    expect((await now()).pool).toBe(base.pool - 3000);
    expect(await reopenLoan(l.id)).toBeNull(); // nothing to undo
    await recordRepayment(l.id, 500, TODAY_ISO);
    await writeOffLoan(l.id, TODAY_ISO);
    expect((await now()).pool).toBe(base.pool - 2500);
    await undoLastRepayment(l.id); // also reopens
    expect((await now()).pool).toBe(base.pool - 3000);
  });

  it('a loan with nothing left cannot be written off (no zero debit)', async () => {
    const base = await fixed('lb-10');
    const { loan: l } = await lend(base, 1000);
    await recordRepayment(l.id, 1000, TODAY_ISO);
    expect(await writeOffLoan(l.id, TODAY_ISO)).toBeNull();
    expect(await now()).toEqual(base);
  });

  it('deleting the Lend spend changes nothing in the budget (it was never in it)', async () => {
    const base = await fixed('lb-11');
    const { entry } = await lend(base, 5000);
    expect(await removeEntry(entry.id)).toBe('removed');
    expect(await now()).toEqual(base);
  });

  it('the lent spend is flagged outside the budget, a normal spend is not, and History totals skip it', async () => {
    const base = await fixed('lb-12');
    const normal = await addSpend(base, { amount: 100, label: 'Lunch', category: 'Food' }, NOON);
    const { entry } = await lend(base, 5000);
    const names = await loadLinkNames();
    const txns = await getDB().transactions.toArray();
    const entries = txns.map((t) => toEntry(t, base, names));
    expect(entries.find((e) => e.id === entry.id)!.outsideBudget).toBe(true);
    expect(entries.find((e) => e.id === normal.id)!.outsideBudget).toBeUndefined();
    expect(spentToday(entries)).toBe(100);
    const totals = await dateTotalsBetween(getDB(), TODAY_ISO, TODAY_ISO);
    expect(totals.get(TODAY_ISO)).toMatchObject({ spent: 100, count: 2 }); // listed (count 2), counted once
  });
});

describe('sync mapping', () => {
  it('a loan survives local -> remote -> local, including repayments and null dates', () => {
    const l: Loan = {
      id: 'l1', updatedAt: 5, txnId: 't1', person: 'Arjun', kind: 'Friends', amount: 5000, lentOn: '2026-11-02',
      dueDate: '2026-11-30', willPay: 'maybe', repayments: [{ id: 'r1', amount: 2000, date: '2026-11-10' }], writtenOff: true, writtenOffOn: '2026-11-18', holdBack: false, createdAt: 3,
    };
    const remote = MAPPERS.loans.toRemote(l);
    expect(remote).toMatchObject({ txn_id: 't1', person: 'Arjun', kind: 'Friends', amount: 5000, lent_on: '2026-11-02', due_date: '2026-11-30', will_pay: 'maybe', written_off: true, written_off_on: '2026-11-18' });
    expect(MAPPERS.loans.toLocal({ ...remote, deleted_at: null, user_id: 'u' } as never)).toEqual({ ...l, deletedAt: null });

    const bare = MAPPERS.loans.toLocal({ id: 'l2', client_updated_at: 1, deleted_at: null, txn_id: null, person: 'M', kind: 'Family', amount: '800', lent_on: '2026-11-02', due_date: null, will_pay: 'yes', repayments: null, written_off: null, created_at: '9' } as never);
    expect(bare).toMatchObject({ txnId: null, dueDate: null, repayments: [], writtenOff: false, writtenOffOn: null, amount: 800, createdAt: 9 });
  });
});

describe('hold back (always on)', () => {
  const held = (over: Partial<LoanLike & { createdAt: number }> = {}) => loan({ holdBack: true, lentOn: '2026-11-05', ...over });

  it('loanEffects: the whole amount out on the day lent, each repayment back on its day, nothing extra on write-off', () => {
    expect(loanEffects([held()])).toEqual([{ date: '2026-11-05', amount: -5000 }]);
    expect(loanEffects([held({ repayments: [pay(2000, '2026-11-12')] })])).toEqual([
      { date: '2026-11-05', amount: -5000 },
      { date: '2026-11-12', amount: 2000 },
    ]);
    // written off: what is still owed is already held back, so no second debit
    expect(loanEffects([held({ writtenOff: true, writtenOffOn: '2026-11-20', repayments: [pay(2000, '2026-11-12')] })])).toEqual([
      { date: '2026-11-05', amount: -5000 },
      { date: '2026-11-12', amount: 2000 },
    ]);
    expect(loanEffects([held({ deletedAt: 1 })])).toEqual([]);
    // the flag is ignored now: every loan, old or new, comes out of the daily amount until repaid
    expect(loanEffects([loan({ lentOn: '2026-11-05' })])).toEqual([{ date: '2026-11-05', amount: -5000 }]);
  });

  it('lowers the pool at once, and gives it back as money returns', async () => {
    const cycle = await setup('lend-hold');
    const base = (await cycleFor(getDB()))!.pool;
    const { loan: l } = await addLoan(cycle, { amount: 6000, person: 'Arjun', kind: 'Friends', dueDate: null });
    expect((await cycleFor(getDB()))!.pool).toBe(base - 6000);
    await recordRepayment(l.id, 2500);
    expect((await cycleFor(getDB()))!.pool).toBe(base - 3500);
    await recordRepayment(l.id, 3500);
    expect((await cycleFor(getDB()))!.pool).toBe(base);
  });

  it('there is no choice any more: a new loan is always held back, and a write-off adds nothing', async () => {
    const cycle = await setup('lend-nohold');
    const base = (await cycleFor(getDB()))!.pool;
    const { loan: l } = await addLoan(cycle, { amount: 6000, person: 'Meera', kind: 'Friends', dueDate: null });
    expect(l.holdBack).toBe(true);
    expect((await cycleFor(getDB()))!.pool).toBe(base - 6000);
    await writeOffLoan(l.id);
    expect((await cycleFor(getDB()))!.pool).toBe(base - 6000);
  });

  it('a held loan that is written off keeps the unpaid part held, with no double count', async () => {
    const cycle = await setup('lend-hold-off');
    const base = (await cycleFor(getDB()))!.pool;
    const { loan: l } = await addLoan(cycle, { amount: 6000, person: 'Karthik', kind: 'Friends', dueDate: null });
    await recordRepayment(l.id, 1000);
    await writeOffLoan(l.id);
    expect((await cycleFor(getDB()))!.pool).toBe(base - 5000);
  });

  it('syncs both ways, and a row from before the column existed reads as not held', () => {
    const l = { id: 'h1', updatedAt: 5, txnId: 't1', person: 'A', kind: 'Friends', amount: 900, lentOn: '2026-11-02', dueDate: null, willPay: 'yes', repayments: [], writtenOff: false, writtenOffOn: null, holdBack: true, createdAt: 3 } as Loan;
    const remote = MAPPERS.loans.toRemote(l) as Record<string, unknown>;
    expect(remote.hold_back).toBe(true);
    expect(MAPPERS.loans.toLocal({ ...remote, client_updated_at: 5, deleted_at: null } as never).holdBack).toBe(true);
    expect(MAPPERS.loans.toLocal({ id: 'o', client_updated_at: 1, deleted_at: null, txn_id: null, person: 'M', kind: 'Family', amount: '8', lent_on: '2026-11-02', due_date: null, will_pay: 'yes', repayments: null, written_off: null, created_at: '9' } as never).holdBack).toBe(false);
  });
});
