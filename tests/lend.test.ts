import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLoan, addSpend, addSubcategory, createPlan, cycleFor, ensureSeed, recordRepayment, removeEntry, setLoanDue, setLoanWillPay,
  loadCategories, undoLastRepayment, updateEntry, writeOffLoan,
} from '@/db/queries';
import { getDB, openUserDB, type Loan } from '@/db/schema';
import { rollupCycle, todayAllowance } from '@/lib/budget';
import { buildCycle, periodFor } from '@/lib/period';
import { MAPPERS } from '@/lib/sync';
import { addDays } from '@/lib/dates';
import {
  closedLoans, creditsOf, dueFromChoice, dueText, loanName, loanStatus, openLoans, remaining, summarize, validateLoan,
  type LoanLike,
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

  it('credits come from live loans only', () => {
    expect(creditsOf([loan({ repayments: [pay(100, '2026-11-02')] }), loan({ repayments: [pay(50)], deletedAt: 1 })])).toEqual([{ date: '2026-11-02', amount: 100 }]);
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

describe('repayments are credits in the budget maths', () => {
  const cyc = { startDate: '2026-10-01', totalDays: 10, planAmount: 1000 };

  it('a credit on a closed day lowers that day net spend and hands the pool the money back', () => {
    const none = rollupCycle({ ...cyc, currentDay: 4 }, [{ txnDate: '2026-10-02', amount: 300, fromSavings: false }]);
    const withCredit = rollupCycle({ ...cyc, currentDay: 4 }, [{ txnDate: '2026-10-02', amount: 300, fromSavings: false }], [{ date: '2026-10-02', amount: 200 }]);
    expect(withCredit.pool).toBe(none.pool + 200);
    expect(withCredit.days[1].spent).toBe(100); // 300 spent, 200 came back
    expect(withCredit.days[0].allowanceAtStart).toBe(none.days[0].allowanceAtStart); // earlier days are not rewritten
    expect(withCredit.days[2].allowanceAtStart).toBeGreaterThan(none.days[2].allowanceAtStart);
  });

  it('a credit dated today raises the pool at once (income-like), unlike a spend', () => {
    const base = rollupCycle({ ...cyc, currentDay: 3 }, []);
    const r = rollupCycle({ ...cyc, currentDay: 3 }, [], [{ date: '2026-10-03', amount: 800 }]);
    expect(r.pool).toBe(base.pool + 800);
    // and once that day is closed it is the same money, counted once
    const closed = rollupCycle({ ...cyc, currentDay: 4 }, [], [{ date: '2026-10-03', amount: 800 }]);
    expect(closed.pool).toBe(rollupCycle({ ...cyc, currentDay: 4 }, []).pool + 800);
  });

  it('a credit outside the cycle is ignored', () => {
    const base = rollupCycle({ ...cyc, currentDay: 3 }, []);
    expect(rollupCycle({ ...cyc, currentDay: 3 }, [], [{ date: '2026-11-03', amount: 800 }]).pool).toBe(base.pool);
  });

  it('buildCycle only counts credits dated in its own month', () => {
    const plan = { income: 50000, bills: 20000, savings: 0, createdAt: 1, effectiveFrom: '2026-11-01', periodStartDay: 1 };
    const p = periodFor(1, '2026-11-16');
    const base = buildCycle(p, plan, [], '2026-11-16', '2026-11-01')!;
    const credited = buildCycle(p, plan, [], '2026-11-16', '2026-11-01', false, [
      { date: '2026-11-05', amount: 3000 },
      { date: '2026-10-05', amount: 99999 }, // last month's money: not ours
    ])!;
    expect(credited.pool).toBe(base.pool + 3000);
    expect(todayAllowance(credited)).toBeGreaterThan(todayAllowance(base));
    expect(credited.planAmount).toBe(base.planAmount); // the plan itself is untouched
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
    const { loan: l, entry } = await addLoan(cycle, { amount: 5000, person: ' Arjun ', kind: 'Friends', willPay: 'yes', dueDate: null });
    const t = (await getDB().transactions.get(entry.id))!;
    expect(t).toMatchObject({ amount: 5000, type: 'Lend', categoryId: 'lend', subtype: 'Friends', label: 'Arjun', fromSavings: false });
    expect(await getDB().loans.get(l.id)).toMatchObject({ txnId: t.id, person: 'Arjun', kind: 'Friends', amount: 5000, lentOn: t.txnDate, repayments: [], writtenOff: false });
  });

  it('the name is optional: the type stands in for it, and a custom type works', async () => {
    const cycle = await setup('lend-names');
    const a = await addLoan(cycle, { amount: 300, person: '  ', kind: 'Neighbour', willPay: 'maybe', dueDate: null });
    expect(a.loan).toMatchObject({ person: '', kind: 'Neighbour' });
    expect(loanName(a.loan)).toBe('Neighbour');
    expect(await getDB().transactions.get(a.entry.id)).toMatchObject({ type: 'Lend', subtype: 'Neighbour', label: 'Neighbour' });
    const b = await addLoan(cycle, { amount: 300, person: 'Arjun', kind: 'Friends', willPay: 'yes', dueDate: null });
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

  it('the Lend spend lowers the month like any spend (it really left the wallet)', async () => {
    const cycle = await setup('lend-b');
    const before = (await cycleFor(getDB()))!;
    await addLoan(cycle, { amount: 5000, person: 'Arjun', kind: 'Friends', willPay: 'yes', dueDate: null });
    const after = (await cycleFor(getDB()))!;
    const spentBefore = before.days.reduce((s, d) => s + d.spent, 0);
    expect(after.days.reduce((s, d) => s + d.spent, 0)).toBe(spentBefore); // today is not closed yet: shows in "left today", not the pool
    expect(after.pool).toBe(before.pool);
  });

  it('invalid input writes nothing', async () => {
    const cycle = await setup('lend-c');
    await expect(addLoan(cycle, { amount: 0, person: 'A', kind: 'Friends', willPay: 'yes', dueDate: null })).rejects.toThrow(/amount/i);
    await expect(addLoan(cycle, { amount: 10, person: 'A', kind: '', willPay: 'yes', dueDate: null })).rejects.toThrow(/who you lent/i);
    expect(await getDB().loans.count()).toBe(0);
    expect(await getDB().transactions.count()).toBe(0);
  });

  it('repayment: clamped to what is owed, raises the month money, undo takes it back', async () => {
    const cycle = await setup('lend-d');
    const { loan: l } = await addLoan(cycle, { amount: 5000, person: 'Arjun', kind: 'Friends', willPay: 'yes', dueDate: null });
    const poolBefore = (await cycleFor(getDB()))!.pool;

    const r1 = await recordRepayment(l.id, 2000);
    expect(r1!.repayments).toHaveLength(1);
    expect((await cycleFor(getDB()))!.pool).toBe(poolBefore + 2000);

    const r2 = await recordRepayment(l.id, 99999); // only 3000 is left
    expect(remaining(r2!)).toBe(0);
    expect(r2!.repayments.map((r) => r.amount)).toEqual([2000, 3000]);
    expect(await recordRepayment(l.id, 100)).toBeNull(); // nothing owed any more
    expect((await cycleFor(getDB()))!.pool).toBe(poolBefore + 5000);

    const u = await undoLastRepayment(l.id);
    expect(u!.repayments.map((r) => r.amount)).toEqual([2000]);
    expect((await cycleFor(getDB()))!.pool).toBe(poolBefore + 2000);
  });

  it('write-off owes nothing and gives nothing back; undo can reopen a loan', async () => {
    const cycle = await setup('lend-e');
    const { loan: l } = await addLoan(cycle, { amount: 1000, person: 'Karthik', kind: 'Coworker', willPay: 'maybe', dueDate: null });
    const poolBefore = (await cycleFor(getDB()))!.pool;
    const w = await writeOffLoan(l.id);
    expect(w!.writtenOff).toBe(true);
    expect(remaining(w!)).toBe(0);
    expect((await cycleFor(getDB()))!.pool).toBe(poolBefore);
    expect(await writeOffLoan(l.id)).toBeNull(); // already closed
  });

  it('due date and will-pay edits; a date before the day it was lent is refused', async () => {
    const cycle = await setup('lend-f');
    const { loan: l } = await addLoan(cycle, { amount: 1000, person: 'Meera', kind: 'Friends', willPay: 'yes', dueDate: null });
    const later = addDays(l.lentOn, 3);
    expect((await setLoanDue(l.id, later))!.dueDate).toBe(later);
    expect(await setLoanDue(l.id, '2000-01-01')).toBeNull();
    expect((await setLoanWillPay(l.id, 'unsure'))!.willPay).toBe('unsure');
    expect((await setLoanDue(l.id, null))!.dueDate).toBeNull();
  });

  it('deleting the Lend spend removes its loan, unless money already came back', async () => {
    const cycle = await setup('lend-g');
    const a = await addLoan(cycle, { amount: 1000, person: 'A', kind: 'Friends', willPay: 'yes', dueDate: null });
    expect(await removeEntry(a.entry.id)).toBe('removed');
    expect((await getDB().loans.get(a.loan.id))!.deletedAt).toBeTypeOf('number');
    expect((await getDB().transactions.get(a.entry.id))!.deletedAt).toBeTypeOf('number');

    const b = await addLoan(cycle, { amount: 1000, person: 'B', kind: 'Family', willPay: 'yes', dueDate: null });
    await recordRepayment(b.loan.id, 100);
    expect(await removeEntry(b.entry.id)).toBe('has-repayments');
    expect((await getDB().loans.get(b.loan.id))!.deletedAt).toBeUndefined();
    expect((await getDB().transactions.get(b.entry.id))!.deletedAt).toBeUndefined();
  });

  it('a loan owns its spend: amount, category and label cannot be edited, note and payment can', async () => {
    const cycle = await setup('lend-h');
    const { entry } = await addLoan(cycle, { amount: 1000, person: 'A', kind: 'Friends', willPay: 'yes', dueDate: null });
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

describe('sync mapping', () => {
  it('a loan survives local -> remote -> local, including repayments and null dates', () => {
    const l: Loan = {
      id: 'l1', updatedAt: 5, txnId: 't1', person: 'Arjun', kind: 'Friends', amount: 5000, lentOn: '2026-11-02',
      dueDate: '2026-11-30', willPay: 'maybe', repayments: [{ id: 'r1', amount: 2000, date: '2026-11-10' }], writtenOff: false, createdAt: 3,
    };
    const remote = MAPPERS.loans.toRemote(l);
    expect(remote).toMatchObject({ txn_id: 't1', person: 'Arjun', kind: 'Friends', amount: 5000, lent_on: '2026-11-02', due_date: '2026-11-30', will_pay: 'maybe', written_off: false });
    expect(MAPPERS.loans.toLocal({ ...remote, deleted_at: null, user_id: 'u' } as never)).toEqual({ ...l, deletedAt: null });

    const bare = MAPPERS.loans.toLocal({ id: 'l2', client_updated_at: 1, deleted_at: null, txn_id: null, person: 'M', kind: 'Family', amount: '800', lent_on: '2026-11-02', due_date: null, will_pay: 'yes', repayments: null, written_off: null, created_at: '9' } as never);
    expect(bare).toMatchObject({ txnId: null, dueDate: null, repayments: [], writtenOff: false, amount: 800, createdAt: 9 });
  });
});
