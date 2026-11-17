import { MAX_NAME } from './categories';
import type { Credit } from './lend';

/**
 * Extra income: money that arrives after the plan was made (bonus, freelance, gift, refund). Pure helpers, no database.
 *
 * It is NOT spending and not part of the plan's monthly income. It is a dated, positive adjustment to the month's money
 * (the same `Credit` mechanism loans use, see lib/lend.ts `loanEffects`): on a closed day it raises that day's pool,
 * dated today or ahead it raises the pool at once. So every remaining day gets more. Nothing month-shaped is stored.
 */

/** What an income is called when the user wrote no note. Types/categories were dropped: an income is just money in. */
export const DEFAULT_INCOME_SOURCE = 'Income';

/** The line to show for an income: the user's note, else the stored type (older rows: "Bonus"), else "Income". */
export const incomeLabel = (i: { note: string | null; source: string }): string => i.note?.trim() || i.source.trim() || DEFAULT_INCOME_SOURCE;

export interface IncomeLike {
  amount: number;
  date: string;
  deletedAt?: number | null;
}

/** null when fine, else the message to show. */
export function validateIncome(input: { amount: number; source?: string }, maxName = MAX_NAME): string | null {
  if (!Number.isFinite(input.amount) || Math.round(input.amount) <= 0) return 'Enter an amount first';
  if ((input.source ?? '').trim().length > maxName) return `Keep the name under ${maxName} characters`;
  return null;
}

/** Live incomes as dated positive credits for `buildCycle` / `rollupCycle`. */
export function incomeEffects(incomes: IncomeLike[]): Credit[] {
  return incomes.filter((i) => i.deletedAt == null && i.amount > 0).map((i) => ({ date: i.date, amount: i.amount }));
}

/** Total of the live incomes dated within [from, to] (inclusive). */
export function incomeBetween(incomes: IncomeLike[], from: string, to: string): number {
  return incomes.filter((i) => i.deletedAt == null && i.date >= from && i.date <= to).reduce((s, i) => s + i.amount, 0);
}
