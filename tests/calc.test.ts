import { describe, it, expect } from 'vitest';
import { CALC_INIT, calcPress, calcResult, calcExpression } from '../lib/calc';

const run = (keys: string[]) => keys.reduce(calcPress, CALC_INIT);

describe('amount calculator', () => {
  it('plain digits behave as before', () => {
    expect(calcResult(run(['1', '2', '00']))).toBe(1200);
    expect(calcResult(run(['0', '0', '5']))).toBe(5);
  });
  it('adds, subtracts, multiplies, divides with a live result', () => {
    expect(calcResult(run(['1', '2', '0', '+', '4', '5']))).toBe(165);
    expect(calcResult(run(['5', '0', '0', '-', '1', '2', '0']))).toBe(380);
    expect(calcResult(run(['2', '5', '0', '*', '3']))).toBe(750);
    expect(calcResult(run(['1', '0', '0', '0', '/', '3']))).toBe(333);
  });
  it('chains left to right and = collapses', () => {
    const s = run(['1', '0', '+', '5', '*', '2', '=']);
    expect(s.op).toBeNull();
    expect(calcResult(s)).toBe(30);
  });
  it('never goes negative, ignores ÷0, swaps operators, del steps back', () => {
    expect(calcResult(run(['5', '-', '9']))).toBe(0);
    expect(calcResult(run(['5', '/', '0']))).toBe(5);
    expect(calcResult(run(['5', '+', '*', '3']))).toBe(15);
    expect(calcPress(run(['5', '+']), 'del')).toEqual({ acc: null, op: null, digits: '5' });
  });
  it('ignores a leading operator and shows the expression', () => {
    expect(run(['+'])).toEqual(CALC_INIT);
    expect(calcExpression(run(['1', '2', '+', '3']))).toBe('12 + 3');
  });
});
