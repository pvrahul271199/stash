import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Splits tab: what opens when you tap the big "Across all groups" card.
 * Five designs for that popup. Tap the card to open it, tap outside or × to close.
 * Same example everywhere: you are owed ₹3,000 and owe ₹1,550, so ₹1,450 more is owed to you.
 */
const meta: Meta = { title: 'Splits · total card popup (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

interface Debt { who: string; group: string; amt: number; dir: 'get' | 'owe'; hue: string }
const DEBTS: Debt[] = [
  { who: 'Arun', group: 'Goa trip', amt: 2400, dir: 'get', hue: '#E4DDF8' },
  { who: 'Meera', group: 'Flat', amt: 600, dir: 'get', hue: '#FBE3D2' },
  { who: 'Kiran', group: 'Office lunch', amt: 1550, dir: 'owe', hue: '#D9ECE6' },
];
const GET = DEBTS.filter((d) => d.dir === 'get').reduce((t, d) => t + d.amt, 0);
const OWE = DEBTS.filter((d) => d.dir === 'owe').reduce((t, d) => t + d.amt, 0);
const NET = GET - OWE;

const Avatar = ({ name, hue, size = 32 }: { name: string; hue: string; size?: number }) => (
  <span aria-hidden="true" className="font-display flex shrink-0 items-center justify-center rounded-full font-semibold text-ink" style={{ width: size, height: size, background: hue, fontSize: size * 0.42 }}>
    {name[0]}
  </span>
);

function Pop({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <div className={`absolute inset-0 z-30 flex items-end transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      style={{ background: 'linear-gradient(180deg, rgba(236,231,250,0.82) 0%, rgba(250,238,226,0.86) 100%)' }} onClick={onClose} role="presentation">
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="max-h-[88%] w-full overflow-y-auto rounded-t-[28px] bg-white px-6 pb-8 pt-3 shadow-[0_-10px_40px_rgba(30,27,75,0.10)] transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: open ? 'none' : 'translateY(100%)' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 min-h-0 w-8 items-center justify-center text-[20px] leading-none text-faint">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The real Splits tab behind the popup: heading, the big card, a few group rows. */
function Screen({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${phone} pt-8`}>
      <h1 className="px-5 font-display text-[26px] font-semibold text-ink">Splits</h1>
      <button onClick={() => setOpen(true)} aria-label="Open the details" className="mx-5 mt-3 block min-h-0 overflow-hidden rounded-[26px] border border-line bg-white px-5 pb-3 pt-4 text-left shadow-[0_12px_32px_rgba(30,27,75,0.09)] active:bg-tint/50">
        <span className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Across all groups</span>
          <span className="rounded-full bg-tint px-2.5 py-0.5 text-[10px] font-medium text-soft">3 to settle</span>
        </span>
        <span className="num mt-2 block text-[34px] leading-none text-ink">+{fmt(NET)}</span>
        <span className="mt-1 block text-[12px] text-soft">More is owed to you than you owe</span>
        <span className="mt-4 flex h-1 gap-0.5 overflow-hidden rounded-full bg-tint">
          <span className="rounded-full bg-ink" style={{ width: `${(GET / (GET + OWE)) * 100}%` }} />
          <span className="rounded-full bg-warm" style={{ width: `${(OWE / (GET + OWE)) * 100}%` }} />
        </span>
        <span className="mt-3 block h-[14px]" />
      </button>
      <div className="mt-5 px-5">
        {DEBTS.map((d) => (
          <div key={d.group} className="flex items-center gap-3 border-b border-line py-3.5">
            <Avatar name={d.group} hue={d.hue} size={40} />
            <span className="flex-1 text-[15px] font-semibold text-ink">{d.group}</span>
            <span className={`num text-[14px] ${d.dir === 'owe' ? 'text-warm' : 'text-ink'}`}>{d.dir === 'owe' ? '−' : '+'}{fmt(d.amt)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-faint">Tap the big card to open the popup</p>
      <Pop open={open} onClose={() => setOpen(false)} title={title}>{children}</Pop>
    </div>
  );
}
const DebtRow = ({ d, showGroup = true }: { d: Debt; showGroup?: boolean }) => (
  <div className="flex items-center gap-3 py-2.5">
    <Avatar name={d.who} hue={d.hue} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-ink">{d.who}</span>
      {showGroup && <span className="block truncate text-[11px] text-faint">{d.group}</span>}
    </span>
    <span className={`num text-[14px] font-semibold ${d.dir === 'owe' ? 'text-warm' : 'text-ink'}`}>{fmt(d.amt)}</span>
    <span className="text-faint" aria-hidden="true">›</span>
  </div>
);

/* ---------- A. Two quiet sections ---------- */
export const A_TwoSections = () => (
  <Screen title="Who and how much">
    {(['get', 'owe'] as const).map((k) => (
      <div key={k} className="mt-4">
        <div className="flex items-baseline justify-between border-b border-line pb-2">
          <span className="text-[12px] font-medium text-soft">{k === 'get' ? 'You get' : 'You owe'}</span>
          <span className={`num text-[16px] ${k === 'get' ? 'text-ink' : 'text-warm'}`}>{fmt(k === 'get' ? GET : OWE)}</span>
        </div>
        {DEBTS.filter((d) => d.dir === k).map((d) => <DebtRow key={d.who} d={d} />)}
      </div>
    ))}
  </Screen>
);

/* ---------- B. One list, a switch on top ---------- */
export const B_Switch = () => {
  const [k, setK] = useState<'get' | 'owe'>('get');
  return (
    <Screen title="Who and how much">
      <div className="mt-4 grid grid-cols-2 rounded-full bg-tint p-0.5" role="tablist">
        {(['get', 'owe'] as const).map((x) => (
          <button key={x} role="tab" aria-selected={k === x} onClick={() => setK(x)}
            className={`h-9 min-h-0 rounded-full text-[13px] font-medium ${k === x ? 'bg-white text-ink shadow-sm' : 'text-soft'}`}>
            {x === 'get' ? `You get · ${fmt(GET)}` : `You owe · ${fmt(OWE)}`}
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-[180px]">{DEBTS.filter((d) => d.dir === k).map((d) => <DebtRow key={d.who} d={d} />)}</div>
    </Screen>
  );
};

/* ---------- C. One sorted list, signed amounts ---------- */
export const C_OneList = () => (
  <Screen title="Everyone, together">
    <p className="num mt-2 text-[13px] text-soft">{fmt(GET)} to get · {fmt(OWE)} to pay</p>
    <div className="mt-2">
      {[...DEBTS].sort((a, b) => b.amt - a.amt).map((d) => (
        <div key={d.who} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <Avatar name={d.who} hue={d.hue} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-ink">{d.who}</span>
            <span className="block text-[11px] text-faint">{d.dir === 'get' ? 'owes you' : 'you owe'} · {d.group}</span>
          </span>
          <span className={`num text-[15px] font-semibold ${d.dir === 'owe' ? 'text-warm' : 'text-ink'}`}>{d.dir === 'owe' ? '−' : '+'}{fmt(d.amt)}</span>
        </div>
      ))}
    </div>
  </Screen>
);

/* ---------- D. By group ---------- */
export const D_ByGroup = () => (
  <Screen title="By group">
    <div className="mt-3 flex flex-col gap-2.5">
      {DEBTS.map((d) => (
        <div key={d.group} className="rounded-[18px] border border-line p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">{d.group}</span>
            <span className={`num text-[14px] font-semibold ${d.dir === 'owe' ? 'text-warm' : 'text-ink'}`}>{d.dir === 'owe' ? '−' : '+'}{fmt(d.amt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-soft">
            <Avatar name={d.who} hue={d.hue} size={20} />
            {d.dir === 'get' ? `${d.who} owes you` : `You owe ${d.who}`}
          </div>
        </div>
      ))}
    </div>
  </Screen>
);

/* ---------- E. Next to settle, with the action ---------- */
export const E_Settle = () => (
  <Screen title="To settle">
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-note bg-tint px-3.5 py-3"><p className="text-[11px] text-soft">You get</p><p className="num mt-0.5 text-[18px] text-ink">{fmt(GET)}</p></div>
      <div className="rounded-note bg-tint px-3.5 py-3"><p className="text-[11px] text-soft">You owe</p><p className="num mt-0.5 text-[18px] text-warm">{fmt(OWE)}</p></div>
    </div>
    <div className="mt-2">
      {[...DEBTS].sort((a, b) => b.amt - a.amt).map((d) => (
        <div key={d.who} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <Avatar name={d.who} hue={d.hue} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-ink">{d.who} <span className="num font-normal text-soft">{fmt(d.amt)}</span></span>
            <span className="block text-[11px] text-faint">{d.group}</span>
          </span>
          <button className="h-8 min-h-0 rounded-full border border-line px-3.5 text-[12px] font-semibold text-ink">{d.dir === 'get' ? 'Remind' : 'Pay'}</button>
        </div>
      ))}
    </div>
  </Screen>
);
