import { roundMoney } from './money';

/** Pure state machine behind the amount keypad: plain digits plus + − × ÷ with a live result. */
export type Op = '+' | '-' | '*' | '/';

export type CalcState = { acc: number | null; op: Op | null; digits: string };

export const CALC_INIT: CalcState = { acc: null, op: null, digits: '' };
export const MAX_DIGITS = 7; // whole-number digits
export const MAX_DECIMALS = 2;
export const MAX_AMOUNT = 10 ** MAX_DIGITS - 1;

export const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const isOp = (k: string): k is Op => k === '+' || k === '-' || k === '*' || k === '/';

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? a : a / b; // ÷0 is ignored rather than erroring mid-typing
  }
}

/** The amount the screen shows and saves: 2 decimals at most (never negative, capped). */
export function calcResult(s: CalcState): number {
  const cur = s.digits === '' ? null : Number(s.digits);
  if (s.op === null || s.acc === null) return cur ?? 0;
  const raw = cur === null ? s.acc : apply(s.acc, s.op, cur);
  return Math.min(MAX_AMOUNT, Math.max(0, roundMoney(raw)));
}

export function calcPress(s: CalcState, k: string): CalcState {
  if (k === '.') {
    if (s.digits.includes('.')) return s;
    return { ...s, digits: (s.digits === '' ? '0' : s.digits) + '.' };
  }
  if (/^\d+$/.test(k)) {
    const dot = s.digits.indexOf('.');
    if (dot >= 0) {
      // typing decimals: keep at most MAX_DECIMALS after the point ('00' adds as many zeros as fit)
      const room = MAX_DECIMALS - (s.digits.length - dot - 1);
      return room <= 0 ? s : { ...s, digits: s.digits + k.slice(0, room) };
    }
    const nd = (s.digits + k).replace(/^0+/, '');
    return nd.length > MAX_DIGITS ? s : { ...s, digits: nd };
  }
  if (k === 'del') {
    if (s.digits !== '') return { ...s, digits: s.digits.slice(0, -1) };
    if (s.op !== null) return { acc: null, op: null, digits: s.acc ? String(s.acc) : '' };
    return s;
  }
  if (isOp(k)) {
    if (s.op !== null && s.digits === '') return { ...s, op: k }; // swap operator
    const base = calcResult(s);
    if (base === 0 && s.op === null) return s; // nothing to operate on yet
    return { acc: base, op: k, digits: '' };
  }
  if (k === '=') {
    if (s.op === null) return s;
    const r = calcResult(s);
    return { acc: null, op: null, digits: r > 0 ? String(r) : '' };
  }
  return s;
}

/** Locale text for a typed number string, keeping a trailing "." and trailing zeros ("5.", "5.0"). */
export function formatTyped(digits: string, locale = 'en-IN'): string {
  if (digits === '') return '';
  const [int, dec] = digits.split('.');
  const head = Number(int || '0').toLocaleString(locale);
  return dec === undefined ? head : `${head}.${dec}`;
}

const accText = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: MAX_DECIMALS });

/** "120 + 45" style line shown above the amount while an operation is pending. */
export function calcExpression(s: CalcState): string | null {
  if (s.op === null || s.acc === null) return null;
  return `${accText(s.acc)} ${OP_SYMBOL[s.op]}${s.digits === '' ? '' : ' ' + formatTyped(s.digits)}`;
}
