import { MAX_NAME } from './categories';
import { addDays, daysBetween, formatShort } from './dates';

/**
 * Money the user lent to someone (docs/ENHANCEMENTS.md E-LEND). Pure helpers: no database, no clock (callers pass `today`).
 *
 * A loan is the *record* (who, how much, due when, will they pay, what came back). The money that left the wallet is a row
 * in `transactions` (category `Lend`, linked by `Loan.txnId`) so it shows in History, but it is **outside the budget**:
 * lending is not spending, so it never touches today's spend, "left today", the pool or Insights, and a repayment (money
 * returning to the wallet) changes nothing either. The only time a loan touches the budget is a **write-off**: the rest
 * is gone for good, so it counts as spent in the month it was written off (`loanEffects`), once, as a month-level
 * debit (it lowers the pool, never "left today" of the day it was written off).
 */

export const LEND_CATEGORY = 'Lend';
/** The types the Lend category starts with. The user can add more in the log screen or Categories (they are the Lend category's types). */
export const DEFAULT_LOAN_KINDS = ['Friends', 'Family', 'Coworker'] as const;
/** Who it was lent to: any type of the Lend category ("Friends", "Neighbour", ...). */
export type LoanKind = string;
export const WILL_PAY = ['yes', 'maybe', 'unsure'] as const;
export type WillPay = (typeof WILL_PAY)[number];
export const WILL_PAY_LABEL: Record<WillPay, string> = { yes: 'Yes', maybe: 'Maybe', unsure: 'Not sure' };

export const isLoanKind = (s: unknown): s is LoanKind => typeof s === 'string' && s.trim().length > 0 && s.trim().length <= MAX_NAME;

/** Who to call it on screen: the name if the user gave one, else the type ("Friends"). */
export const loanName = (l: { person: string; kind: string }): string => l.person.trim() || l.kind;

export interface Repayment {
  id: string;
  /** Whole currency units, > 0. */
  amount: number;
  /** yyyy-mm-dd the money came back. */
  date: string;
}

/** The fields the maths needs; `Loan` (db/schema.ts) satisfies it. */
export interface LoanLike {
  amount: number;
  dueDate: string | null;
  repayments: Repayment[];
  writtenOff: boolean;
  /** yyyy-mm-dd the rest was written off (the month it counts against). */
  writtenOffOn?: string | null;
  /** The user chose to take the money out of their daily amount while it is owed. */
  holdBack?: boolean;
  /** yyyy-mm-dd it was lent (needed for `holdBack`). */
  lentOn?: string;
  deletedAt?: number | null;
}

export const repaid = (l: Pick<LoanLike, 'repayments'>): number => l.repayments.reduce((s, r) => s + r.amount, 0);

/** What is still owed. A written-off loan owes nothing (the money is gone, it is not a credit). */
export const remaining = (l: LoanLike): number => (l.writtenOff ? 0 : Math.max(0, l.amount - repaid(l)));

export type LoanStatus = 'settled' | 'overdue' | 'soon' | 'later';
/** Days ahead that count as "due soon". */
export const SOON_DAYS = 7;

export function loanStatus(l: LoanLike, today: string): LoanStatus {
  if (remaining(l) <= 0) return 'settled';
  if (!l.dueDate) return 'later';
  const d = daysBetween(today, l.dueDate);
  return d < 0 ? 'overdue' : d <= SOON_DAYS ? 'soon' : 'later';
}

/** "3 days late", "Due today", "By 30 Nov", "No date", "Paid back", "Written off". */
export function dueText(l: LoanLike, today: string): string {
  if (l.writtenOff) return 'Written off';
  if (remaining(l) <= 0) return 'Paid back';
  if (!l.dueDate) return 'No date';
  const d = daysBetween(today, l.dueDate);
  if (d < 0) return `${-d} ${d === -1 ? 'day' : 'days'} late`;
  if (d === 0) return 'Due today';
  return `By ${formatShort(l.dueDate)}`;
}

/** Open loans (something still owed), most urgent first; loans without a date last. */
export function openLoans<T extends LoanLike & { createdAt: number }>(loans: T[]): T[] {
  return loans
    .filter((l) => l.deletedAt == null && remaining(l) > 0)
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || a.createdAt - b.createdAt);
}

/** Finished loans (paid back or written off), newest first. */
export function closedLoans<T extends LoanLike & { createdAt: number }>(loans: T[]): T[] {
  return loans.filter((l) => l.deletedAt == null && remaining(l) <= 0).sort((a, b) => b.createdAt - a.createdAt);
}

export interface LendSummary {
  /** Still owed across open loans. */
  total: number;
  people: number;
  overdue: number;
  overdueAmount: number;
  soonAmount: number;
}

export function summarize(loans: LoanLike[], today: string): LendSummary {
  const s: LendSummary = { total: 0, people: 0, overdue: 0, overdueAmount: 0, soonAmount: 0 };
  for (const l of loans) {
    if (l.deletedAt != null) continue;
    const left = remaining(l);
    if (left <= 0) continue;
    s.total += left;
    s.people++;
    const st = loanStatus(l, today);
    if (st === 'overdue') {
      s.overdue++;
      s.overdueAmount += left;
    } else if (st === 'soon') s.soonAmount += left;
  }
  return s;
}

/** A dated money adjustment for `buildCycle`: positive adds to the month's money, negative takes from it. */
export interface Credit {
  date: string;
  amount: number;
}

/** What is lost when the rest of a loan is written off (what was still owed at that moment). */
export const writtenOffAmount = (l: Pick<LoanLike, 'amount' | 'repayments'>): number => Math.max(0, l.amount - repaid(l));

/**
 * The only ways a loan reaches the budget, returned as dated adjustments (`buildCycle` -> `rollupCycle`):
 *  - default: a written-off loan is a loss, counted once in the month it was written off (negative).
 *  - `holdBack` (the user's choice on the Lend screen): the whole amount comes out of the daily amount on the day it was
 *    lent, and each repayment gives its share back on the day it arrives. A write-off then adds nothing: what is still
 *    owed is already held back.
 * Open, repaid and deleted loans without `holdBack` return nothing, and a write-off without a date is ignored.
 */
export function loanEffects(
  loans: Pick<LoanLike, 'amount' | 'repayments' | 'writtenOff' | 'writtenOffOn' | 'deletedAt' | 'holdBack' | 'lentOn'>[],
): Credit[] {
  const out: Credit[] = [];
  for (const l of loans) {
    if (l.deletedAt != null) continue;
    if (l.holdBack && l.lentOn) {
      out.push({ date: l.lentOn, amount: -l.amount });
      for (const r of l.repayments) out.push({ date: r.date, amount: r.amount });
      continue;
    }
    if (!l.writtenOff || !l.writtenOffOn) continue;
    const lost = writtenOffAmount(l);
    if (lost > 0) out.push({ date: l.writtenOffOn, amount: -lost });
  }
  return out;
}

export type DueChoice = 'week' | 'month' | 'none';

/** The date a quick choice means, counted from `today` ("month" = the last day of today's month). */
export function dueFromChoice(choice: DueChoice, today: string): string | null {
  if (choice === 'none') return null;
  if (choice === 'week') return addDays(today, 7);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return `${today.slice(0, 8)}${String(last).padStart(2, '0')}`;
}

/** A gentle error message, or null when the loan input is fine. The name is optional; the type (whom) is not. */
export function validateLoan(input: { amount: number; person: string; kind: string; dueDate: string | null }, lentOn: string, maxName = MAX_NAME): string | null {
  if (!(Math.round(input.amount) > 0)) return 'Enter an amount first';
  if (input.person.trim().length > maxName) return `Keep the name to ${maxName} characters or less.`;
  if (!isLoanKind(input.kind)) return 'Pick who you lent it to (Friends, Family, Coworker, or add your own).';
  if (input.dueDate && input.dueDate < lentOn) return 'The pay-back date is before the day you lent it.';
  return null;
}
