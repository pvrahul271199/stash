import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { roundMoney } from '@/lib/money';
import { Av, Btn, C, Digits, Eyebrow, GROUPS, Phone, Sheet, Toast, WASH, first, grouped, money, nm, sum, useAmount, useToast, type Debt } from './kit';

/**
 * Settle up (the sheet behind "Settle"), the picked design. Shipped rule kept: you mark a payment as paid only once the money
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
