/** Pure state machine behind the amount keypad: plain digits plus + − × ÷ with a live result. */
export type Op = '+' | '-' | '*' | '/';

export type CalcState = { acc: number | null; op: Op | null; digits: string };

export const CALC_INIT: CalcState = { acc: null, op: null, digits: '' };
export const MAX_DIGITS = 7;
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

/** The whole-unit amount the screen shows and saves (never negative, capped). */
export function calcResult(s: CalcState): number {
  const cur = s.digits === '' ? null : Number(s.digits);
  if (s.op === null || s.acc === null) return cur ?? 0;
  const raw = cur === null ? s.acc : apply(s.acc, s.op, cur);
  return Math.min(MAX_AMOUNT, Math.max(0, Math.round(raw)));
}

export function calcPress(s: CalcState, k: string): CalcState {
  if (/^\d+$/.test(k)) {
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

/** "120 + 45" style line shown above the amount while an operation is pending. */
export function calcExpression(s: CalcState): string | null {
  if (s.op === null || s.acc === null) return null;
  return `${s.acc.toLocaleString('en-IN')} ${OP_SYMBOL[s.op]}${s.digits === '' ? '' : ' ' + Number(s.digits).toLocaleString('en-IN')}`;
}
