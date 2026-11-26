import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Phone, money } from './kit';

/**
 * Pending payments across all groups: the sheet that opens from the "Across all groups" card (see 17-summary-card, A).
 * Four more designs. Same data as A: 2 to pay (Athul ₹5,745.32 in Kunyis Trading, Sai ₹1,200 in Goa Trip) and
 * 1 to get (Ravi ₹1,200 in Goa Trip).
 *
 * What Remind does: Chelav has no push notifications and cannot message other people. Remind opens the phone's share
 * sheet with a short message (the same reminder text the group status card already uses, lib/shareStatus.ts `shareText`),
 * and you send it yourself. Where sharing is not available it copies the text.
 */
const meta: Meta = { title: 'Splits / 18. Pending payments sheet (4 designs)', parameters: { layout: 'centered' } };
export default meta;

interface Pay { id: string; who: string; group: string; amount: number; dir: 'pay' | 'get' }
const PAY: Pay[] = [
  { id: 'p1', who: 'Athul Narayanan', group: 'Kunyis Trading', amount: 5745.32, dir: 'pay' },
  { id: 'p2', who: 'Sai Nath', group: 'Goa Trip', amount: 1200, dir: 'pay' },
  { id: 'g1', who: 'Ravi', group: 'Goa Trip', amount: 1200, dir: 'get' },
];
const OWE = PAY.filter((p) => p.dir === 'pay').reduce((s, p) => s + p.amount, 0);
const OWED = PAY.filter((p) => p.dir === 'get').reduce((s, p) => s + p.amount, 0);
const COUNT = PAY.length;

/** Dimmed stand-in for the card behind the sheet, so each sheet reads as a prompt over the Splits tab. */
function Scene({ children }: { children: ReactNode }) {
  return (
    <Phone>
      <header className="px-5 pb-3 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>
      <div className="mx-5 h-[150px] rounded-[26px] border border-line bg-white" />
      <div className="absolute inset-0 z-20 flex flex-col justify-end bg-ink/25">
        <div role="dialog" aria-label="Pending payments" className="max-h-[86%] overflow-y-auto rounded-t-[28px] border border-line bg-white px-5 pb-7 pt-3 shadow-[0_-12px_40px_rgba(30,27,75,0.18)]">
          <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
          {children}
        </div>
      </div>
    </Phone>
  );
}
const Head = () => (
  <div className="mt-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</p>
    <h2 className="font-display mt-1 text-[22px] font-semibold text-ink">{COUNT} payments to settle</h2>
  </div>
);
const Close = () => <button className="mt-6 h-12 w-full rounded-full border border-line text-[14px] font-semibold text-ink active:bg-tint">Close</button>;
const Avatar = ({ who }: { who: string }) => <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-semibold text-ink">{who[0]}</span>;

/** 1. Grouped by group: one block per group with its own total, so you settle a whole trip in one place. */
export const A_ByGroup = () => {
  const groups = Array.from(new Set(PAY.map((p) => p.group)));
  return (
    <Scene>
      <Head />
      {groups.map((g) => {
        const rows = PAY.filter((p) => p.group === g);
        const net = rows.reduce((s, p) => s + (p.dir === 'pay' ? -p.amount : p.amount), 0);
        return (
          <div key={g} className="mt-5 rounded-[20px] border border-line p-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-ink">{g}</p>
              <span className={`num text-[13px] font-semibold ${net < 0 ? 'text-warm' : 'text-ink'}`}>{net < 0 ? '−' : '+'}{money(Math.abs(net))}</span>
            </div>
            <div className="mt-2 divide-y divide-line">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar who={p.who} />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.dir === 'pay' ? 'You pay' : 'Pays you'} {p.who.split(' ')[0]}</p>
                  <span className="num text-[13px] text-soft">{money(p.amount)}</span>
                </div>))}
            </div>
          </div>);
      })}
      <Close />
    </Scene>
  );
};

/** 2. Next up: the largest payment is a featured card with one clear action; the rest sit below as a compact list. */
export const B_NextUp = () => {
  const next = [...PAY].filter((p) => p.dir === 'pay').sort((a, b) => b.amount - a.amount)[0];
  const rest = PAY.filter((p) => p.id !== next.id);
  return (
    <Scene>
      <Head />
      <div className="mt-5 rounded-[22px] bg-ink p-5 text-white">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/60">Biggest one to settle</p>
        <p className="num mt-2 text-[30px] leading-none">{money(next.amount)}</p>
        <p className="mt-2 text-[13px] text-white/80">You pay {next.who} · {next.group}</p>
        <button className="mt-4 h-11 w-full rounded-full bg-white text-[14px] font-semibold text-ink">Settle {money(next.amount)}</button>
      </div>
      <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Also open</p>
      <div className="divide-y divide-line">
        {rest.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-3">
            <Avatar who={p.who} />
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-ink">{p.who}</p><p className="truncate text-[12px] text-soft">{p.dir === 'pay' ? 'You pay' : 'Pays you'} · {p.group}</p></div>
            {p.dir === 'pay' ? <button className="h-9 min-h-0 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink">Settle</button>
              : <button className="min-h-0 text-[13px] font-semibold text-ink underline underline-offset-4">Remind</button>}
          </div>))}
      </div>
      <Close />
    </Scene>
  );
};

/** 3. Two tabs: "To pay" and "To get" as a segmented control; one list at a time, each with its own total in the tab. */
export const C_TwoTabs = () => {
  const [tab, setTab] = useState<'pay' | 'get'>('pay');
  const list = PAY.filter((p) => p.dir === tab);
  return (
    <Scene>
      <Head />
      <div className="mt-4 grid grid-cols-2 rounded-full bg-tint p-0.5">
        {([['pay', 'To pay', OWE], ['get', 'To get', OWED]] as const).map(([k, label, total]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`flex h-11 min-h-0 items-center justify-center gap-2 rounded-full text-[13px] font-medium ${tab === k ? 'bg-white text-ink shadow-sm' : 'text-soft'}`}>
            {label} <span className="num text-[12px] font-semibold">{money(total)}</span>
          </button>))}
      </div>
      <div className="mt-2 divide-y divide-line">
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-3.5">
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium text-ink">{p.who}</p><p className="truncate text-[12px] text-soft">{p.group}</p></div>
            <span className="num text-[14px] font-semibold text-ink">{money(p.amount)}</span>
            {p.dir === 'pay' ? <button className="h-9 min-h-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Settle</button>
              : <button className="h-9 min-h-0 rounded-full border border-line px-3.5 text-[13px] font-semibold text-ink">Remind</button>}
          </div>))}
      </div>
      <Close />
    </Scene>
  );
};

/** 4. Share bars: each payment is a row with a bar of its share of the total you move, so the biggest is obvious. Tap a row to act. */
export const D_ShareBars = () => {
  const total = PAY.reduce((s, p) => s + p.amount, 0);
  return (
    <Scene>
      <Head />
      <div className="mt-4 flex items-baseline justify-between text-[12px] text-soft"><span>Total moving</span><span className="num font-semibold text-ink">{money(total)}</span></div>
      <div className="mt-5 space-y-4">
        {PAY.map((p) => (
          <div key={p.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p.dir === 'pay' ? 'Pay' : 'Get from'} {p.who} <span className="font-normal text-soft">· {p.group}</span></p>
              <span className={`num text-[13px] font-semibold ${p.dir === 'pay' ? 'text-warm' : 'text-ink'}`}>{p.dir === 'pay' ? '−' : '+'}{money(p.amount)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint">
              <span className={`block h-full rounded-full ${p.dir === 'pay' ? 'bg-warm' : 'bg-ink'}`} style={{ width: `${(p.amount / total) * 100}%` }} />
            </div>
          </div>))}
      </div>
      <div className="mt-6 flex gap-2">
        <button className="h-12 flex-1 rounded-full bg-ink text-[14px] font-semibold text-white">Settle {money(OWE)}</button>
        <button className="h-12 flex-1 rounded-full border border-line text-[14px] font-semibold text-ink">Close</button>
      </div>
    </Scene>
  );
};
