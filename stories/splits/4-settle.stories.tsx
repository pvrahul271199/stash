import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { roundMoney } from '@/lib/money';
import { Av, Btn, C, Digits, Eyebrow, GROUPS, Phone, Sheet, Toast, WASH, first, grouped, money, nm, sum, useAmount, useToast, type Debt } from './kit';

/**
 * Settle up (the sheet behind "Settle"), five designs. Shipped rule kept: you mark a payment as paid only once the money
 * has moved; everyone in the group sees it. B and E also allow a part payment (the shipped app pays the whole amount).
 * Each story sits over a dimmed group screen so the sheet is seen in place.
 */
const meta: Meta = { title: 'Splits / 4. Settle up', parameters: { layout: 'centered' } };
export default meta;

const s = sum(GROUPS[0]);
const D: Debt = s.debts.find((d) => d.to === 'u1') ?? s.debts[0];
const MINE: Debt = { from: 'u1', to: 'u5', amount: 1152.67 };

const Behind = () => (
  <div className="px-5 pt-6 opacity-60">
    <p className="font-display text-[20px] font-semibold text-ink">Goa trip</p>
    <p className="num mt-6 text-[48px] leading-none text-ink">{money(s.total)}</p>
    {[1, 2, 3, 4].map((i) => <div key={i} className="mt-5 h-10 rounded-[12px] bg-tint" />)}
  </div>
);

function Shell({ children, done, reset }: { children: (pay: (m: string) => void) => React.ReactNode; done?: string; reset?: () => void }) {
  const [msg, setMsg] = useState<string | null>(done ?? null);
  const [t, say] = useToast();
  return (
    <Phone>
      <Behind />
      {msg ? (
        <div className="splits-fade absolute inset-0 z-30 flex flex-col items-center justify-center bg-white px-8 text-center">
          <span className="splits-up flex h-20 w-20 items-center justify-center rounded-full" style={{ background: C.goodBg }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.good} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} className="stash-draw" /></svg>
          </span>
          <p className="font-display mt-5 text-[22px] font-semibold text-ink">{msg}</p>
          <p className="mt-1 text-[13px] text-soft">Everyone in Goa trip sees it.</p>
          <button onClick={() => { setMsg(null); reset?.(); }} className="mt-6 text-[13px] font-semibold text-ink underline underline-offset-4">Undo</button>
        </div>
      ) : children((m) => { setMsg(m); say(m); })}
      <Toast msg={t} />
    </Phone>
  );
}

/* A. Refined current: two avatars, the amount between, an arrow that draws itself. */
export const A_Refined = () => (
  <Shell>{(pay) => (
    <Sheet title="Settle up" onClose={() => {}}>
      <div className="mt-6 flex items-center justify-between px-2">
        <div className="flex w-20 flex-col items-center gap-1"><Av id={D.from} size={52} /><span className="text-[12px] text-soft">{nm(D.from)}</span></div>
        <div className="flex flex-1 flex-col items-center">
          <span className="num text-[30px] leading-none text-ink">{money(D.amount)}</span>
          <svg width="100%" height="14" viewBox="0 0 120 14" preserveAspectRatio="none" className="mt-2"><path d="M4 7 H112 M106 2 L113 7 L106 12" fill="none" stroke={C.ink} strokeWidth="1.4" pathLength={1} className="stash-draw" /></svg>
        </div>
        <div className="flex w-20 flex-col items-center gap-1"><Av id={D.to} size={52} /><span className="text-[12px] text-soft">{nm(D.to)}</span></div>
      </div>
      <p className="mt-5 text-center text-[13px] text-soft">Mark it as paid once the money has actually moved.</p>
      <div className="mt-5 flex gap-2"><Btn kind="secondary">Not yet</Btn><Btn onClick={() => pay(`${first(D.from)} paid you ${money(D.amount)}`)}>Mark as paid</Btn></div>
    </Sheet>)}
  </Shell>
);

/* B. Part payment: the full amount is filled in, a keypad lets you pay less. What is left shows live. */
export const B_PartPayment = () => {
  const a = useAmount(String(MINE.amount));
  const left = roundMoney(MINE.amount - a.total);
  return (
    <Shell reset={() => a.setAmt(String(MINE.amount))}>{(pay) => (
      <Sheet onClose={() => {}}>
        <div className="flex items-center justify-center gap-2 text-[13px] text-soft"><Av id={MINE.from} size={22} /> You pay <Av id={MINE.to} size={22} /> {nm(MINE.to)}</div>
        <Digits amt={a.amt} size={52} className="mt-4" />
        <p className={`num mt-2 text-center text-[12px] ${left < 0 ? 'text-warm' : 'text-soft'}`}>{left === 0 ? 'Settles it in full' : left > 0 ? `${money(left)} still to pay after this` : `${money(-left)} more than you owe`}</p>
        <div className="mt-3 flex justify-center gap-2">
          {[0.5, 1].map((f) => <button key={f} onClick={() => a.setAmt(String(roundMoney(MINE.amount * f)))} className="h-8 min-h-0 rounded-full border border-line px-3 text-[12px] text-ink">{f === 1 ? 'Full' : 'Half'}</button>)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button key={k} onClick={() => a.press(k)} className="num h-11 min-h-0 rounded-key bg-tint text-[20px] text-ink">{k === 'del' ? '⌫' : k}</button>))}
        </div>
        <Btn className="mt-3" disabled={!a.total || left < 0} onClick={() => pay(`You paid ${first(MINE.to)} ${money(a.total)}`)}>Mark {money(a.total)} as paid</Btn>
      </Sheet>)}
    </Shell>
  );
};

/* C. Pay with UPI first: open the payment app, then come back and confirm. The confirm step is the same rule. */
export const C_PayThenMark = () => {
  const [step, setStep] = useState<0 | 1>(0);
  return (
    <Shell reset={() => setStep(0)}>{(pay) => (
      <Sheet onClose={() => {}}>
        <div className="rounded-[22px] px-5 py-6 text-center" style={{ background: WASH }}>
          <div className="flex justify-center"><Av id={MINE.to} size={56} /></div>
          <p className="mt-3 text-[13px] text-soft">You owe {nm(MINE.to)}</p>
          <p className="num text-[40px] leading-none text-ink">{money(MINE.amount)}</p>
        </div>
        {step === 0 ? (
          <>
            <Btn className="mt-5" onClick={() => setStep(1)}>Pay with UPI</Btn>
            <Btn kind="ghost" className="mt-1" onClick={() => setStep(1)}>I paid another way</Btn>
          </>
        ) : (
          <div className="splits-up mt-5">
            <p className="text-center text-[14px] text-ink">Did the money go through?</p>
            <div className="mt-4 flex gap-2"><Btn kind="secondary" onClick={() => setStep(0)}>Not yet</Btn><Btn onClick={() => pay(`You paid ${first(MINE.to)}`)}>Yes, mark paid</Btn></div>
          </div>)}
      </Sheet>)}
    </Shell>
  );
};

/* D. All my payments: one sheet lists everything that involves you; tick the ones that have happened. */
export const D_Checklist = () => {
  const mine = [...s.debts.filter((d) => d.from === 'u1' || d.to === 'u1'), MINE];
  const [on, setOn] = useState<number[]>([]);
  const net = roundMoney(mine.filter((_, i) => on.includes(i)).reduce((a, d) => a + (d.to === 'u1' ? d.amount : -d.amount), 0));
  return (
    <Shell reset={() => setOn([])}>{(pay) => (
      <Sheet title="Your payments" onClose={() => {}}>
        <p className="-mt-1 text-[13px] text-soft">Tick what has been paid.</p>
        <div className="mt-3">
          {mine.map((d, i) => { const ticked = on.includes(i); const incoming = d.to === 'u1'; const other = incoming ? d.from : d.to; return (
            <button key={i} onClick={() => setOn((x) => (ticked ? x.filter((y) => y !== i) : [...x, i]))} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[12px] transition ${ticked ? 'border-good bg-good text-white' : 'border-line'}`}>{ticked && '✓'}</span>
              <Av id={other} size={30} />
              <span className="flex-1 text-[14px] text-ink">{incoming ? `${first(other)} pays you` : `You pay ${first(other)}`}<span className="block text-[11px] text-faint">{i === mine.length - 1 ? 'Flat 4B' : 'Goa trip'}</span></span>
              <span className={`num text-[15px] ${incoming ? 'text-good' : 'text-warm'} ${ticked ? 'line-through opacity-50' : ''}`}>{incoming ? '+' : '−'}{money(d.amount)}</span>
            </button>); })}
        </div>
        <Btn className="mt-5" disabled={!on.length} onClick={() => pay(`${on.length} ${on.length === 1 ? 'payment' : 'payments'} marked`)}>
          {on.length ? `Mark ${on.length} as paid · net ${net >= 0 ? '+' : '−'}${money(net)}` : 'Mark as paid'}
        </Btn>
      </Sheet>)}
    </Shell>
  );
};

/* E. Slide to confirm: a deliberate swipe instead of a tap, so nobody marks a payment by accident. */
export const E_Slide = () => {
  const [x, setX] = useState(0);
  const W = 278;
  return (
    <Shell reset={() => setX(0)}>{(pay) => (
      <Sheet onClose={() => {}}>
        <Eyebrow className="text-center">Settle up</Eyebrow>
        <div className="mt-4 flex items-center justify-center">
          <Av id={D.from} size={46} /><span className="-ml-3"><Av id={D.to} size={46} ring /></span>
        </div>
        <p className="mt-3 text-center text-[14px] text-soft">{nm(D.from)} pays {D.to === 'u1' ? 'you' : nm(D.to)}</p>
        <p className="num text-center text-[48px] leading-none text-ink">₹{grouped(String(D.amount))}</p>
        <div className="relative mx-auto mt-7 h-14 rounded-full bg-tint" style={{ width: W + 56 }}>
          <span className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-soft" style={{ opacity: 1 - x / W }}>Slide when the money has moved</span>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: x + 56, background: C.goodBg }} />
          <input type="range" min={0} max={W} value={x} aria-label="Slide to mark as paid"
            onChange={(e) => setX(Number(e.target.value))}
            onPointerUp={() => (x > W * 0.9 ? pay(`${first(D.from)} paid you ${money(D.amount)}`) : setX(0))}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
          <span className="pointer-events-none absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow transition-[left] duration-75" style={{ left: x + 4 }}>›</span>
        </div>
        <p className="mt-3 text-center text-[11px] text-faint">Everyone in the group sees it.</p>
      </Sheet>)}
    </Shell>
  );
};
