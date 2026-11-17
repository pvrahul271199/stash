import { describe, it, expect } from 'vitest';
import { roundMoney, roundMoney1, sumMoney, cleanAmountInput, formatNumber } from '../lib/money';
import { CALC_INIT, calcPress, calcResult, calcExpression, formatTyped } from '../lib/calc';
import { compactINR } from '../lib/history';
import { inr, inr1, num } from '../lib/format';
import { validateIncome } from '../lib/income';

const run = (keys: string[]) => keys.reduce(calcPress, CALC_INIT);

describe('money rounding', () => {
  it('rounds to 2 places without float noise', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(4.754)).toBe(4.75);
    expect(roundMoney(-1.666)).toBe(-1.67);
    expect(roundMoney(-0.001)).toBe(0);
    expect(roundMoney(NaN)).toBe(0);
  });
  it('rounds to 1 place for calendar and insights', () => {
    expect(roundMoney1(4.25)).toBe(4.3);
    expect(roundMoney1(4.24)).toBe(4.2);
  });
  it('sums without drift', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
  });
  it('cleans typed input', () => {
    expect(cleanAmountInput('12.345')).toBe('12.34');
    expect(cleanAmountInput('1.2.3')).toBe('1.23');
    expect(cleanAmountInput('.5')).toBe('0.5');
    expect(cleanAmountInput('0,5')).toBe('0.5');
    expect(cleanAmountInput('007')).toBe('7');
    expect(cleanAmountInput('12345678')).toBe('1234567');
  });
});

describe('formatting', () => {
  it('logs: whole stays whole, otherwise 2 places', () => {
    expect(inr(1250)).toBe('₹1,250');
    expect(inr(4.5)).toBe('₹4.50');
    expect(inr(-4.756)).toBe('-₹4.76');
    expect(num(1234.5)).toBe('1,234.50');
  });
  it('insights + calendar: 1 place', () => {
    expect(inr1(4.56)).toBe('₹4.6');
    expect(inr1(1250)).toBe('₹1,250');
    expect(compactINR(4.56)).toBe('₹4.6');
    expect(compactINR(1250.4)).toBe('₹1.3k');
    expect(compactINR(0)).toBe('₹0');
  });
  it('formatNumber', () => {
    expect(formatNumber(2.345, 'en-US', 2)).toBe('2.35');
  });
});

describe('keypad decimals', () => {
  it('types a decimal amount', () => {
    expect(calcResult(run(['4', '.', '7', '5']))).toBe(4.75);
    expect(run(['4', '.']).digits).toBe('4.');
    expect(run(['.', '5']).digits).toBe('0.5');
  });
  it('allows one point and two decimals', () => {
    expect(run(['1', '.', '.', '2', '3', '9']).digits).toBe('1.23');
  });
  it('del walks back through the point', () => {
    expect(run(['1', '.', '5', 'del', 'del']).digits).toBe('1');
  });
  it('maths on decimals stays clean', () => {
    expect(calcResult(run(['0', '.', '1', '+', '0', '.', '2']))).toBe(0.3);
    expect(calcResult(run(['1', '0', '/', '3']))).toBe(3.33);
    expect(run(['1', '0', '+', '2', '.', '5', '=']).digits).toBe('12.5');
  });
  it('shows what was typed', () => {
    expect(formatTyped('5.')).toBe('5.');
    expect(formatTyped('1234.50')).toBe('1,234.50');
    expect(calcExpression(run(['1', '.', '5', '+', '2', '.']))).toBe('1.5 + 2.');
  });
});

describe('validation accepts decimals', () => {
  it('income of 0.5 is fine', () => {
    expect(validateIncome({ amount: 0.5, source: 'Gift' })).toBeNull();
  });
});

import 'fake-indexeddb/auto';
import { addSpend, createPlan, cycleFor, updateEntry } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';

describe('decimal spends in the DB', () => {
  it('stores 2 decimals, never a whole-number round, and keeps sums clean', async () => {
    await openUserDB('decimals-a');
    await createPlan({ income: 1000, bills: 300, savings: 100, monthLength: 30 }, '2026-11-01');
    let cycle = (await cycleFor(getDB(), '2026-11-10', '2026-11-10'))!;
    await addSpend(cycle, { amount: 4.754, label: 'Coffee', category: 'Food' });
    cycle = (await cycleFor(getDB(), '2026-11-10', '2026-11-10'))!;
    await addSpend(cycle, { amount: 0.1, label: 'a', category: 'Food' });
    await addSpend(cycle, { amount: 0.2, label: 'b', category: 'Food' });
    const rows = await getDB().transactions.toArray();
    expect(rows.map((r) => r.amount).sort()).toEqual([0.1, 0.2, 4.75]);
    await updateEntry(rows.find((r) => r.amount === 4.75)!.id, { amount: 3.999 });
    expect((await getDB().transactions.toArray()).map((r) => r.amount).sort()).toEqual([0.1, 0.2, 4]);
  });
});
