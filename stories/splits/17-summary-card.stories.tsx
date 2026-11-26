import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Phone, money } from './kit';

/**
 * "Across all groups" summary card at the top of the Splits tab, five designs. Same content as the app:
 * the net across groups, how many payments are still to settle, and a line saying which way it leans.
 * Kept from the current card: the rounded 26px corners, the hairline border (border-line) and the soft shadow.
 * Mock = you owe ₹6,945.32 and are owed ₹1,200.00, so the net is −₹5,745.32 with 1 payment to settle.
 */
const meta: Meta = { title: 'Splits / 17. Across all groups card (5 designs)', parameters: { layout: 'centered' } };
export default meta;

interface Pay { id: string; who: string; group: string; amount: number }
/** Every payment still open across all groups: what you pay (to-pay) and what comes to you (to-get). Mock, adds up to the card. */
const TO_PAY: Pay[] = [
  { id: 'p1', who: 'Athul Narayanan', group: 'Kunyis Trading', amount: 5745.32 },
  { id: 'p2', who: 'Sai Nath', group: 'Goa Trip', amount: 1200 },
];
const TO_GET: Pay[] = [{ id: 'g1', who: 'Ravi', group: 'Goa Trip', amount: 1200 }];
const OWED = TO_GET.reduce((s, p) => s + p.amount, 0), OWE = TO_PAY.reduce((s, p) => s + p.amount, 0), NET = OWED - OWE;
const PENDING = TO_PAY.length + TO_GET.length;
const SHADOW = 'shadow-[0_12px_32px_rgba(30,27,75,0.09)]';
const lean = NET < 0 ? 'You owe more than you are owed' : NET > 0 ? 'More is owed to you than you owe' : 'You are all square';
const net = (v: number) => (v === 0 ? money(0) : `${v > 0 ? '+' : '−'}${money(Math.abs(v))}`);

function Page({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <Phone>
      {overlay}
      <header className="px-5 pb-3 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <section className="mx-5">{children}</section>
      <div className="mx-5 mt-5 flex flex-col gap-2">
        {['Kunyis Trading', 'Goa Trip'].map((g, i) => (
          <div key={g} className="flex items-center gap-3 border-b border-line py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-tint text-[15px] font-semibold text-ink">{g[0]}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-ink">{g}</span><span className="block text-[12px] text-soft">{i === 0 ? '1 to settle' : 'All settled'}</span></span>
            <span className={`num text-[14px] ${i === 0 ? 'text-warm' : 'text-faint'}`}>{i === 0 ? net(NET) : 'Settled'}</span>
          </div>))}
      </div>
    </Phone>
  );
}

/** The pending payments sheet: opened from the card in A. Pay rows carry Settle, get rows carry Remind. */
function PendingSheet({ onClose }: { onClose: () => void }) {
  const Row = ({ p, kind }: { p: Pay; kind: 'pay' | 'get' }) => (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-semibold text-ink">{p.who[0]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{kind === 'pay' ? `Pay ${p.who}` : `${p.who} pays you`}</p>
        <p className="truncate text-[12px] text-soft">{p.group}</p>
      </div>
      <span className={`num text-[14px] font-semibold ${kind === 'pay' ? 'text-warm' : 'text-ink'}`}>{money(p.amount)}</span>
      {kind === 'pay'
        ? <button className="h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white active:opacity-80">Settle</button>
        : <button className="min-h-0 text-[13px] font-semibold text-ink underline underline-offset-4">Remind</button>}
    </div>
  );
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-ink/25" onClick={onClose} role="presentation">
      <div role="dialog" aria-label="Pending payments" onClick={(e) => e.stopPropagation()}
        className="max-h-[82%] overflow-y-auto rounded-t-[28px] border border-line bg-white px-5 pb-7 pt-3 shadow-[0_-12px_40px_rgba(30,27,75,0.18)]">
        <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</p>
        <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">{PENDING} payments to settle</h2>
        <p className="mt-1 text-[12px] text-soft">You pay {money(OWE)} · you get {money(OWED)}</p>

        <p className="mb-1 mt-5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-faint"><span>To pay</span><span className="num normal-case tracking-normal text-soft">{money(OWE)}</span></p>
        <div className="divide-y divide-line">{TO_PAY.map((p) => <Row key={p.id} p={p} kind="pay" />)}</div>

        <p className="mb-1 mt-5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-faint"><span>To get</span><span className="num normal-case tracking-normal text-soft">{money(OWED)}</span></p>
        <div className="divide-y divide-line">{TO_GET.map((p) => <Row key={p.id} p={p} kind="get" />)}</div>

        <button onClick={onClose} className="mt-6 h-12 w-full rounded-full border border-line text-[14px] font-semibold text-ink active:bg-tint">Close</button>
      </div>
    </div>
  );
}

/** 1. Refined: the current card, tidied. Tap it to see the pending payments across all groups (sheet). */
export const A_Refined = () => {
  const [open, setOpen] = useState(false);
  return (
  <Page overlay={open ? <PendingSheet onClose={() => setOpen(false)} /> : null}>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${PENDING} payments to settle, open list`}
      className={`block w-full overflow-hidden rounded-[26px] border border-line bg-white text-left active:opacity-95 ${SHADOW}`}>
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</span>
          <span className="rounded-full bg-tint px-2.5 py-0.5 text-[10px] font-medium text-soft">{PENDING} to settle</span>
        </div>
        <p className={`num mt-3 text-[34px] leading-none ${NET < 0 ? 'text-warm' : 'text-ink'}`}>{net(NET)}</p>
        <p className="mt-2 text-[12px] text-soft">{lean}</p>
        <div className="mt-4 flex h-1 gap-0.5 overflow-hidden rounded-full bg-tint">
          <span className="rounded-full bg-ink" style={{ width: `${(OWED / (OWED + OWE)) * 100}%` }} />
          <span className="rounded-full bg-warm" style={{ width: `${(OWE / (OWED + OWE)) * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-soft"><span>Owed to you <b className="num font-semibold text-ink">{money(OWED)}</b></span><span>You owe <b className="num font-semibold text-warm">{money(OWE)}</b></span></div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] font-medium text-ink">
        <span>See the {PENDING} payments</span><span aria-hidden="true" className="text-faint">›</span>
      </div>
    </button>
  </Page>
  );
};

/** 2. Two columns: "You are owed" and "You owe" sit side by side under the net, so both numbers are read without a bar. */
export const B_TwoColumns = () => (
  <Page>
    <div className={`overflow-hidden rounded-[26px] border border-line bg-white ${SHADOW}`}>
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</span>
          <span className="text-[11px] font-medium text-soft">{PENDING} to settle</span>
        </div>
        <p className={`num mt-3 text-[34px] leading-none ${NET < 0 ? 'text-warm' : 'text-ink'}`}>{net(NET)}</p>
        <p className="mt-2 text-[12px] text-soft">{lean}</p>
      </div>
      <div className="grid grid-cols-2 border-t border-line">
        <div className="px-5 py-3.5"><p className="text-[11px] text-soft">You are owed</p><p className="num mt-0.5 text-[15px] font-semibold text-ink">{money(OWED)}</p></div>
        <div className="border-l border-line px-5 py-3.5"><p className="text-[11px] text-soft">You owe</p><p className="num mt-0.5 text-[15px] font-semibold text-warm">{money(OWE)}</p></div>
      </div>
    </div>
  </Page>
);

/** 3. Minimal: only the net, one sentence and the settle count. Nothing else competes with the number. */
export const C_Minimal = () => (
  <Page>
    <div className={`rounded-[26px] border border-line bg-white px-6 py-6 text-center ${SHADOW}`}>
      <p className="text-[12px] font-medium text-soft">Across all groups</p>
      <p className={`num mt-2 text-[40px] leading-none ${NET < 0 ? 'text-warm' : 'text-ink'}`}>{net(NET)}</p>
      <p className="mt-3 text-[13px] text-soft">{lean}</p>
      <span className="mt-4 inline-block rounded-full border border-line px-3 py-1 text-[12px] font-medium text-soft">{PENDING} payment to settle</span>
    </div>
  </Page>
);

/** 4. Ledger: the net on top, then a small two-line ledger of what is owed each way, with the right-hand figures aligned. */
export const D_Ledger = () => (
  <Page>
    <div className={`rounded-[26px] border border-line bg-white px-5 py-5 ${SHADOW}`}>
      <div className="flex items-end justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</p><p className="text-[12px] text-soft">{lean}</p></div>
        <p className={`num text-[30px] leading-none ${NET < 0 ? 'text-warm' : 'text-ink'}`}>{net(NET)}</p>
      </div>
      <div className="mt-4 divide-y divide-line border-t border-line">
        <div className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-soft">Owed to you</span><span className="num font-medium text-ink">{money(OWED)}</span></div>
        <div className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-soft">You owe</span><span className="num font-medium text-warm">{money(OWE)}</span></div>
        <div className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-soft">Payments to settle</span><span className="num font-medium text-ink">{PENDING}</span></div>
      </div>
    </div>
  </Page>
);

/** 5. Ink hero: the card is inked and carries the net in white, the detail sits below on the white card. Same border and shadow. */
export const E_InkHero = () => (
  <Page>
    <div className={`overflow-hidden rounded-[26px] border border-line bg-white ${SHADOW}`}>
      <div className="bg-ink px-5 pb-5 pt-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">Across all groups</span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium text-white">{PENDING} to settle</span>
        </div>
        <p className="num mt-3 text-[34px] leading-none">{net(NET)}</p>
        <p className="mt-2 text-[12px] text-white/70">{lean}</p>
      </div>
      <div className="flex justify-between px-5 py-3.5 text-[12px]">
        <span className="text-soft">Owed to you <b className="num text-ink">{money(OWED)}</b></span>
        <span className="text-soft">You owe <b className="num text-warm">{money(OWE)}</b></span>
      </div>
    </div>
  </Page>
);
