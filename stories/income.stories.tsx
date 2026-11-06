import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, GhostButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Chip, Note } from '@/components/ui/Chip';
import { Keypad } from '@/components/ui/Keypad';
import { HugeNumber } from '@/components/ui/HugeNumber';
import { CloseDay } from '@/components/screens/CloseDay';
import type { Entry } from '@/db/schema';

/**
 * Add income: three proposals for logging money that arrives mid-month (bonus, freelance, gift, refund).
 * Core rule shared by all three: income raises this month's pool, so every remaining day gets more.
 * Colours are the app palette only: ink (money out / actions), good teal (money in), tint surfaces.
 */
const meta: Meta = { title: 'Income & Close day', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const SOURCES = ['Salary', 'Freelance', 'Bonus', 'Gift', 'Refund', 'Other'];
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const DAYS_LEFT = 24;
const POOL = 20400;
const perDay = (extra: number) => Math.round((POOL + extra) / DAYS_LEFT);

function useAmount() {
  const [v, setV] = useState('');
  const press = (k: string) =>
    setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return { n: Number(v || 0), press };
}

const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ---------- A. Keypad-first: mirrors the Log-spend screen, teal instead of ink ---------- */
export const A_KeypadFirst = () => {
  const { n, press } = useAmount();
  const [src, setSrc] = useState('Freelance');
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <p className="mt-1 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-good">Money in</p>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-baseline" style={{ fontSize: 56, lineHeight: 1.05 }}>
          <span className="mr-1 text-good/60">+₹</span>
          <span className={n ? 'text-ink' : 'text-faint'}>{n ? n.toLocaleString('en-IN') : '0'}</span>
        </div>
        <p className="num mt-3 rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">
          {n ? `Daily ${fmt(perDay(0))} → ${fmt(perDay(n))}` : 'Your daily amount will go up'}
        </p>
      </div>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        {SOURCES.map((s) => (
          <Chip key={s} onClick={() => setSrc(s)} className={`h-8 min-h-0 px-3 text-[12px] ${src === s ? '!border-good !bg-goodBg !text-good' : ''}`}>
            {s}
          </Chip>
        ))}
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2 !bg-good" disabled={!n}>Add income</PrimaryButton>
    </div>
  );
};

/* ---------- B. Sheet over Today: quick, no new screen ---------- */
export const B_QuickSheet = () => {
  const [amt, setAmt] = useState('8000');
  const n = Number(amt || 0);
  const [src, setSrc] = useState('Bonus');
  return (
    <div className={phone}>
      {/* dimmed Today behind */}
      <div className="flex-1 bg-tint px-6 pt-16 opacity-60">
        <p className="text-[14px] text-soft">You can spend today</p>
        <HugeNumber value={perDay(0)} />
      </div>
      <div className="absolute inset-0 bg-ink/30" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pb-8 pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="font-display text-[22px] font-semibold text-ink">Add income</h2>
        <p className="mt-0.5 text-[13px] text-soft">It joins this month&apos;s pool. Every remaining day gets a little more.</p>

        <label className="mt-5 flex items-center gap-2 rounded-[18px] border border-line bg-tint px-4 py-3 focus-within:border-good">
          <span className="num text-[24px] text-good">+₹</span>
          <input
            inputMode="numeric"
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/\D/g, '').slice(0, 7))}
            aria-label="Income amount"
            className="num w-full bg-transparent text-[30px] text-ink outline-none"
          />
        </label>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSrc(s)}
              className={`h-11 rounded-[14px] border text-[13px] font-medium ${src === s ? 'border-good bg-goodBg text-good' : 'border-line bg-white text-ink'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <Note tone="good" className="mt-4">
          Tomorrow you can spend <b className="num">{fmt(perDay(n))}</b> <span className="text-soft">(was {fmt(perDay(0))})</span>
        </Note>
        <PrimaryButton className="mt-4">Add {fmt(n)}</PrimaryButton>
        <GhostButton>Cancel</GhostButton>
      </div>
    </div>
  );
};

/* ---------- C. Impact-first: what will you do with it? ---------- */
export const C_ImpactFirst = () => {
  const { n, press } = useAmount();
  const [plan, setPlan] = useState<'spread' | 'save' | 'split'>('spread');
  const usable = plan === 'spread' ? n : plan === 'split' ? Math.round(n / 2) : 0;
  const opts = [
    { id: 'spread', t: 'Spend it', d: 'Spread over the rest of the month' },
    { id: 'split', t: 'Half and half', d: 'Half to spend, half to savings' },
    { id: 'save', t: 'Save it', d: 'Straight to savings' },
  ] as const;
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="mt-1 rounded-[24px] bg-goodBg px-5 pb-5 pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-good">Income received</p>
        <div className="num mt-1 text-ink" style={{ fontSize: 48, lineHeight: 1.05 }}>
          <span className="text-good/60">+₹</span>{n ? n.toLocaleString('en-IN') : '0'}
        </div>
        <p className="num mt-2 text-[13px] text-ink">
          Daily <span className="text-soft line-through">{fmt(perDay(0))}</span> → <b>{fmt(perDay(usable))}</b>
        </p>
      </div>
      <p className="mb-2 mt-5 text-[13px] font-medium text-soft">What should happen to it?</p>
      <div className="flex flex-col gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => setPlan(o.id)}
            aria-pressed={plan === o.id}
            className={`flex items-center gap-3 rounded-[16px] border px-4 py-2.5 text-left ${plan === o.id ? 'border-ink bg-tint' : 'border-line bg-white'}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${plan === o.id ? 'border-ink bg-ink' : 'border-faint'}`}>
              {plan === o.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span>
              <span className="block text-[14px] font-medium text-ink">{o.t}</span>
              <span className="block text-[12px] text-soft">{o.d}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2" disabled={!n}>Add income</PrimaryButton>
    </div>
  );
};

/* ---------- Entry point: where income is started from (Today) ---------- */
export const EntryPoint_TodayPlusMenu = () => (
  <div className={`${phone} px-6 pt-16`}>
    <p className="text-[14px] text-soft">You can spend today</p>
    <HugeNumber value={perDay(0)} />
    <div className="absolute inset-x-6 bottom-28 rounded-[22px] border border-line bg-white p-2 shadow-xl">
      {[
        { t: 'Log a spend', d: 'Something you paid for', c: 'bg-ink text-white' },
        { t: 'Add income', d: 'Bonus, freelance, refund…', c: 'bg-goodBg text-good' },
      ].map((r) => (
        <button key={r.t} className="flex w-full items-center gap-3 rounded-[16px] p-3 text-left active:bg-tint">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${r.c}`}><Plus /></span>
          <span>
            <span className="block text-[15px] font-medium text-ink">{r.t}</span>
            <span className="block text-[12.5px] text-soft">{r.d}</span>
          </span>
        </button>
      ))}
    </div>
    <button aria-label="Add" className="absolute bottom-8 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-ink text-white shadow-lg">
      <Plus />
    </button>
  </div>
);

/* ---------- Redesigned Close the day (the real component) ---------- */
const e = (o: Partial<Entry> & Pick<Entry, 'id' | 'label' | 'amount' | 'category'>): Entry => ({
  cycleId: '', day: 7, date: '2026-11-07', subcategory: null, event: null, payment: 'UPI', note: null,
  fromSavings: false, adjustsPool: true, isEstimate: false, hour: 12, createdAt: 0, ...o,
});
const entries: Entry[] = [
  e({ id: '1', label: 'Lunch', amount: 240, category: 'Food', subcategory: 'Eating out' }),
  e({ id: '2', label: 'Auto', amount: 90, category: 'Transport', payment: 'Cash' }),
  e({ id: '3', label: 'Headphones', amount: 1499, category: 'Shopping', payment: 'Card', fromSavings: true }),
  e({ id: '4', label: 'Chai', amount: 30, category: 'Food', payment: 'Cash', note: 'with Priya' }),
];
const noop = () => {};
const cycleState = { currentDay: 7, totalDays: 30, pool: 20400, fromSavingsTotal: 0 };
export const CloseTheDay = () => (
  <div className="relative h-[780px] w-[390px] overflow-hidden rounded-phone border border-line">
    <CloseDay entries={entries} cycle={cycleState} onBack={noop} onAddMore={noop} onClose={noop} />
  </div>
);
export const CloseTheDay_Empty = () => (
  <div className="relative h-[780px] w-[390px] overflow-hidden rounded-phone border border-line">
    <CloseDay entries={[]} cycle={cycleState} onBack={noop} onAddMore={noop} onClose={noop} />
  </div>
);
