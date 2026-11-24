import { useRef, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Btn, C, GROUPS, Phone, Sheet, Toast, first, money, nm, sum, useToast, type Debt } from './kit';

/**
 * Settle up: four designs for the sheet opened by a "Settle" chip. Rules kept from the app: you mark a payment as paid only
 * once the money has actually moved, everyone in the group sees it, and you can settle only payments you are part of.
 *  A. Slide to confirm: one deliberate gesture, no extra screen.
 *  B. Full or part: pay the whole amount or type a smaller one (the rest stays owed).
 *  C. How did you pay: UPI / Cash / Bank chips, remembered on the payment ("Paid by UPI").
 *  D. Ticket: a receipt-style summary with a hold-to-confirm button, the most "this is final" feel.
 */
const meta: Meta = { title: 'Splits / 13. Settle options (4 designs)', parameters: { layout: 'centered' } };
export default meta;

const s = sum(GROUPS[0]);
const D: Debt = s.debts.find((d) => d.from === 'u1') ?? { from: 'u1', to: 'u2', amount: 1152.67 };

function Frame({ children }: { children: (done: (m: string) => void) => ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [t, say] = useToast();
  return (
    <Phone>
      <div className="px-5 pt-6 opacity-60"><p className="font-display text-[20px] font-semibold text-ink">Goa trip</p>{[1, 2, 3, 4, 5].map((i) => <div key={i} className="mt-5 h-10 rounded-[12px] bg-tint" />)}</div>
      {msg ? (
        <div className="splits-fade absolute inset-0 z-30 flex flex-col items-center justify-center bg-white px-8 text-center">
          <span className="splits-up flex h-20 w-20 items-center justify-center rounded-full" style={{ background: C.goodBg }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.good} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <p className="font-display mt-5 text-[22px] font-semibold text-ink">{msg}</p>
          <button onClick={() => setMsg(null)} className="mt-6 text-[13px] font-semibold text-ink underline underline-offset-4">Undo</button>
        </div>) : children((m) => { setMsg(m); say(m); })}
      <Toast msg={t} />
    </Phone>
  );
}
const Pair = ({ amount }: { amount: number }) => (
  <div className="mt-5 flex items-center justify-between px-2">
    <div className="flex w-20 flex-col items-center gap-1"><Av id={D.from} size={52} /><span className="text-[12px] text-soft">{nm(D.from)}</span></div>
    <div className="flex flex-1 flex-col items-center"><span className="num text-[28px] leading-none text-ink">{money(amount)}</span><span className="mt-2 text-faint">→</span></div>
    <div className="flex w-20 flex-col items-center gap-1"><Av id={D.to} size={52} /><span className="text-[12px] text-soft">{nm(D.to)}</span></div>
  </div>
);

/** A. Slide to confirm */
export const A_SlideToConfirm = () => {
  const [x, setX] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  return (
    <Frame>{(done) => (
      <Sheet title="Settle up" onClose={() => {}}>
        <Pair amount={D.amount} />
        <p className="mt-4 text-center text-[13px] text-soft">Slide once the money has actually moved.</p>
        <div ref={track} className="relative mt-5 h-14 overflow-hidden rounded-full bg-tint">
          <span className="absolute inset-0 flex items-center justify-center text-[14px] font-medium text-soft">Slide to mark as paid</span>
          <span className="absolute inset-y-0 left-0 rounded-full bg-goodBg" style={{ width: x + 56 }} />
          <input aria-label="Slide to mark as paid" type="range" min={0} max={100} value={x} onChange={(e) => setX(+e.target.value)}
            onPointerUp={() => (x > 90 ? done(`Paid ${first(D.to)} ${money(D.amount)}`) : setX(0))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <span className="pointer-events-none absolute top-1 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white" style={{ left: 4 + (x / 100) * ((track.current?.clientWidth ?? 300) - 56) }}>→</span>
        </div>
        <button className="mt-3 w-full text-[13px] font-medium text-soft">Not yet</button>
      </Sheet>)}</Frame>
  );
};

/** B. Full or part */
export const B_FullOrPart = () => {
  const [mode, setMode] = useState<'full' | 'part'>('full');
  const [part, setPart] = useState('500');
  const amt = mode === 'full' ? D.amount : Math.min(D.amount, Number(part || 0));
  return (
    <Frame>{(done) => (
      <Sheet title="Settle up" onClose={() => {}}>
        <Pair amount={amt} />
        <div className="mx-auto mt-5 flex w-fit rounded-full bg-tint p-0.5">
          {(['full', 'part'] as const).map((k) => <button key={k} onClick={() => setMode(k)} className={`h-8 rounded-full px-5 text-[12px] font-medium ${mode === k ? 'bg-ink text-white' : 'text-soft'}`}>{k === 'full' ? 'Pay all' : 'Pay part'}</button>)}
        </div>
        {mode === 'part' && (
          <div className="mt-4 flex items-center gap-2 rounded-btn border border-line px-4">
            <span className="text-faint">₹</span>
            <input inputMode="decimal" value={part} onChange={(e) => setPart(e.target.value.replace(/[^\d.]/g, ''))} className="num h-12 flex-1 bg-transparent text-[18px] text-ink outline-none" aria-label="Amount to pay" />
            <span className="text-[12px] text-soft">of {money(D.amount)}</span>
          </div>)}
        <p className="mt-3 text-center text-[12px] text-soft">{mode === 'part' && amt < D.amount ? `${money(D.amount - amt)} stays to pay.` : 'This clears the payment.'}</p>
        <div className="mt-4"><Btn disabled={amt <= 0} onClick={() => done(`Paid ${first(D.to)} ${money(amt)}`)}>Mark {money(amt)} as paid</Btn></div>
      </Sheet>)}</Frame>
  );
};

/** C. How did you pay */
export const C_HowPaid = () => {
  const [how, setHow] = useState('UPI');
  return (
    <Frame>{(done) => (
      <Sheet title="Settle up" onClose={() => {}}>
        <Pair amount={D.amount} />
        <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">How did you pay?</p>
        <div className="grid grid-cols-3 gap-2">
          {['UPI', 'Cash', 'Bank'].map((k) => (
            <button key={k} onClick={() => setHow(k)} aria-pressed={how === k} className={`h-12 rounded-btn border text-[14px] font-medium ${how === k ? 'border-ink bg-ink text-white' : 'border-line text-ink'}`}>{k}</button>))}
        </div>
        <p className="mt-3 text-center text-[12px] text-soft">The group sees “Paid by {how}”.</p>
        <div className="mt-4 flex gap-2"><Btn kind="secondary">Not yet</Btn><Btn onClick={() => done(`Paid ${first(D.to)} by ${how}`)}>I have paid</Btn></div>
      </Sheet>)}</Frame>
  );
};

/** D. Ticket + hold to confirm */
export const D_TicketHold = () => {
  const [p, setP] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setP(0); };
  return (
    <Frame>{(done) => (
      <Sheet title="" onClose={() => {}}>
        <div className="rounded-3xl border border-line" style={{ background: C.cream }}>
          <div className="px-6 pb-4 pt-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Payment</p>
            <p className="num mt-2 text-[40px] leading-none text-ink">{money(D.amount)}</p>
            <p className="mt-2 text-[13px] text-soft">{nm(D.from)} → {nm(D.to)} · Goa trip</p>
          </div>
          <div className="border-t border-dashed border-line" />
          <p className="px-6 py-3 text-center text-[12px] text-soft">Everyone in the group will see this.</p>
        </div>
        <button
          onPointerDown={() => { let v = 0; timer.current = setInterval(() => { v += 5; setP(v); if (v >= 100) { stop(); done(`Paid ${first(D.to)} ${money(D.amount)}`); } }, 40); }}
          onPointerUp={stop} onPointerLeave={stop}
          className="relative mt-4 h-[54px] w-full overflow-hidden rounded-btn bg-ink text-[15px] font-semibold text-white">
          <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${p}%` }} />
          <span className="relative">Hold to mark as paid</span>
        </button>
      </Sheet>)}</Frame>
  );
};
