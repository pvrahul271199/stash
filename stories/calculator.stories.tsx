import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { BackIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { CALC_INIT, calcExpression, calcPress, calcResult, OP_SYMBOL, type CalcState, type Op } from '@/lib/calc';

/**
 * Calculator on the Log spend screen: four layouts, all fully working (tap away).
 * A. Side rail      – operators as a lavender column beside the digits.
 * B. Operator strip – digit pad untouched, a row of round operators above it.
 * C. Round & tape   – circular keys, running "tape" of the sum above the amount.
 * D. Tuck-away      – plain keypad by default; a ± button slides a calculator tray in.
 */
const meta: Meta = { title: 'Log spend: calculator', parameters: { layout: 'centered' } };
export default meta;

const OPS: Op[] = ['/', '*', '-', '+'];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];
const LAV = '#ECE9FB';
const SHADOW = 'shadow-[0_6px_14px_-6px_rgba(30,27,75,0.5)]';

const Del = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z" /><path d="M13 10l4 4M17 10l-4 4" />
  </svg>
);
const glyph = (k: string) => (k === 'del' ? <Del /> : k);

function useCalc(initial: string[] = ['4', '5', '0']) {
  const [s, setS] = useState<CalcState>(() => initial.reduce(calcPress, CALC_INIT));
  return { s, press: (k: string) => setS((p) => calcPress(p, k)), amount: calcResult(s), expr: calcExpression(s) };
}

function Shell({ amount, children, top, keys }: { amount: number; children?: ReactNode; top?: ReactNode; keys: ReactNode }) {
  const size = String(amount).length <= 5 ? 64 : 52;
  return (
    <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-6 pb-6 pt-4 shadow-sm">
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="flex flex-1 flex-col items-center justify-center">
        {top}
        <div className="num flex items-baseline" style={{ fontSize: size, lineHeight: 1.05 }}>
          <span className="mr-1 text-faint">₹</span>
          <span className={amount ? 'text-ink' : 'text-faint'}>{amount ? amount.toLocaleString('en-IN') : '0'}</span>
        </div>
        {children}
      </div>
      <div className="mb-2 mt-3">{keys}</div>
      <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]">Save</PrimaryButton>
    </div>
  );
}

/* ---------------- A. Side rail ---------------- */
export const A_SideRail = () => {
  const { s, press, amount, expr } = useCalc();
  return (
    <Shell
      amount={amount}
      top={
        <div className="mb-2 flex h-7 items-center">
          {expr && <span key={s.op} className="num rounded-full px-3.5 py-0.5 text-[15px] text-ink" style={{ background: LAV }}>{expr}</span>}
        </div>
      }
      keys={
        <div className="grid grid-cols-4 gap-1.5">
          {[...Array(4)].flatMap((_, r) => [
            ...DIGITS.slice(r * 3, r * 3 + 3).map((k) => (
              <button key={k} onClick={() => press(k)} className="num h-[44px] rounded-key bg-tint text-[22px] text-ink transition active:scale-95">{glyph(k)}</button>
            )),
            <button
              key={OPS[r]}
              onClick={() => press(OPS[r])}
              className={`num h-[44px] rounded-key text-[24px] font-light transition active:scale-95 ${s.op === OPS[r] ? `bg-ink text-white ${SHADOW}` : 'text-ink'}`}
              style={s.op === OPS[r] ? undefined : { background: LAV }}
            >{OP_SYMBOL[OPS[r]]}</button>,
          ])}
        </div>
      }
    />
  );
};

/* ---------------- B. Operator strip ---------------- */
export const B_OperatorStrip = () => {
  const { s, press, amount, expr } = useCalc();
  return (
    <Shell
      amount={amount}
      top={<div className="mb-1 h-5 text-[14px] text-soft num">{expr ?? ' '}</div>}
      keys={
        <>
          <div className="mb-2 flex items-center justify-between gap-2 rounded-full p-1" style={{ background: LAV }}>
            {OPS.map((o) => (
              <button
                key={o}
                aria-label={o}
                onClick={() => press(o)}
                className={`num flex h-9 flex-1 items-center justify-center rounded-full text-[22px] font-light transition active:scale-95 ${s.op === o ? `bg-ink text-white ${SHADOW}` : 'text-ink'}`}
              >{OP_SYMBOL[o]}</button>
            ))}
            <button
              aria-label="Equals"
              onClick={() => press('=')}
              disabled={!s.op}
              className="num flex h-9 flex-1 items-center justify-center rounded-full bg-white text-[20px] text-ink transition disabled:opacity-30 active:scale-95"
            >=</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DIGITS.map((k) => (
              <button key={k} onClick={() => press(k)} className="num h-[44px] rounded-key bg-tint text-[22px] text-ink transition active:scale-95">{glyph(k)}</button>
            ))}
          </div>
        </>
      }
    />
  );
};

/* ---------------- C. Round keys + tape ---------------- */
export const C_RoundAndTape = () => {
  const { s, press, amount } = useCalc(['1', '2', '0', '+', '4', '5']);
  return (
    <Shell
      amount={amount}
      top={
        <div className="mb-3 flex flex-col items-center gap-0.5 text-[15px] text-faint num">
          <span className="h-5">{s.acc !== null ? s.acc.toLocaleString('en-IN') : ' '}</span>
          <span className="h-5 text-soft">{s.op ? `${OP_SYMBOL[s.op]} ${s.digits ? Number(s.digits).toLocaleString('en-IN') : ''}` : ' '}</span>
          <span className="h-px w-16 bg-line" />
        </div>
      }
      keys={
        <div className="grid grid-cols-4 place-items-center gap-y-2">
          {[...Array(4)].flatMap((_, r) => [
            ...DIGITS.slice(r * 3, r * 3 + 3).map((k) => (
              <button key={k} onClick={() => press(k)} className="num flex h-[58px] w-[58px] items-center justify-center rounded-full bg-tint text-[22px] text-ink transition active:scale-90 active:bg-[#EFEDFA]">{glyph(k)}</button>
            )),
            <button
              key={OPS[r]}
              onClick={() => press(OPS[r])}
              className={`num flex h-[58px] w-[58px] items-center justify-center rounded-full text-[26px] font-light transition active:scale-90 ${s.op === OPS[r] ? `bg-white text-ink ring-2 ring-ink` : 'bg-ink text-white'}`}
            >{OP_SYMBOL[OPS[r]]}</button>,
          ])}
        </div>
      }
    />
  );
};

/* ---------------- D. Tuck-away tray ---------------- */
export const D_TuckAway = () => {
  const { s, press, amount, expr } = useCalc();
  const [open, setOpen] = useState(false);
  return (
    <Shell
      amount={amount}
      top={
        <button
          onClick={() => setOpen((o) => !o)}
          aria-pressed={open}
          aria-label="Calculator"
          className={`mb-2 flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition ${open ? 'bg-ink text-white' : 'text-ink'}`}
          style={open ? undefined : { background: LAV }}
        >
          <span className="num text-[15px] leading-none">+ −</span>
          {expr ?? 'Calculate'}
        </button>
      }
      keys={
        <>
          <div className={`grid overflow-hidden transition-all duration-300 ease-out ${open ? 'mb-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="min-h-0">
              <div className="flex gap-1.5 rounded-[20px] p-1.5" style={{ background: LAV }}>
                {[...OPS.slice().reverse(), '='].map((o) => (
                  <button
                    key={o}
                    onClick={() => press(o)}
                    className={`num flex h-10 flex-1 items-center justify-center rounded-[14px] text-[22px] font-light transition active:scale-95 ${
                      o === s.op ? `bg-ink text-white ${SHADOW}` : o === '=' ? 'bg-ink/90 text-white' : 'bg-white text-ink'
                    }`}
                  >{o === '=' ? '=' : OP_SYMBOL[o as Op]}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DIGITS.map((k) => (
              <button key={k} onClick={() => press(k)} className="num h-[44px] rounded-key bg-tint text-[22px] text-ink transition active:scale-95">{glyph(k)}</button>
            ))}
          </div>
        </>
      }
    />
  );
};
