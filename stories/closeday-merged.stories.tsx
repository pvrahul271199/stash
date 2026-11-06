import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { BackIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { WeekRow, type WeekDay } from '@/components/ui/WeekRow';
import { CloseDay } from '@/components/screens/CloseDay';
import type { Entry } from '@/db/schema';

/**
 * Close the day as ONE screen: the old "Day closed" recap (tomorrow's amount, the reason, the week) is folded into
 * the screen where you close, so it is a single tap. Same data in all four (from a real case: ₹558 of ₹734 spent).
 * Palette only: ink, tint, good teal / goodBg, warm / warmBg, line.
 */
const meta: Meta = { title: 'Close the day: one screen', parameters: { layout: 'centered' } };
export default meta;

const ALLOW = 734;
const SPENT = 558;
const TOMORROW = 741;
const MSG = 'You spent ₹176 less than your amount, so every day ahead gets ₹7 more.';
const rows = [
  { id: 1, label: 'Lunch', sub: 'Food · UPI', amt: 240 },
  { id: 2, label: 'Auto', sub: 'Transport · Cash', amt: 90 },
  { id: 3, label: 'Groceries', sub: 'Food · UPI', amt: 198 },
  { id: 4, label: 'Chai', sub: 'Food · Cash', amt: 30 },
];
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const week: WeekDay[] = [
  { day: 4, status: 'closed' }, { day: 5, status: 'closed' }, { day: 6, status: 'closed' },
  { day: 7, status: 'today' }, { day: 8, status: 'future' }, { day: 9, status: 'future' }, { day: 10, status: 'future' },
];
const START = '2026-11-01';
const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-6 pb-6 pt-4 shadow-sm';

const X = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
const Top = () => <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>;
const Footer = () => (
  <>
    <button className="mb-3 mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-full bg-tint text-[14px] font-medium text-ink active:opacity-70">
      <Plus /> Paid cash or forgot something?
    </button>
    <PrimaryButton>Close the day</PrimaryButton>
  </>
);
const Rows = ({ list, remove, compact }: { list: typeof rows; remove: (id: number) => void; compact?: boolean }) => (
  <ul className="divide-y divide-line">
    {list.map((r) => (
      <li key={r.id} className={`flex items-center gap-2 ${compact ? 'py-2' : 'py-2.5'}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{r.label}</p>
          <p className="text-[12.5px] text-faint">{r.sub}</p>
        </div>
        <p className="num text-[16px] text-ink">{fmt(r.amt)}</p>
        <button aria-label={`Remove ${r.label}`} onClick={() => remove(r.id)} className="flex h-10 w-8 items-center justify-center text-faint"><X /></button>
      </li>
    ))}
  </ul>
);
function useRows() {
  const [list, setList] = useState(rows);
  return { list, remove: (id: number) => setList((l) => l.filter((r) => r.id !== id)) };
}

/* ---------- 1. Calm card (this is what's wired into the app) ---------- */
const e = (o: Pick<Entry, 'id' | 'label' | 'amount' | 'category'> & Partial<Entry>): Entry => ({
  cycleId: '', day: 7, date: '2026-11-07', subcategory: null, event: null, payment: 'UPI', note: null,
  fromSavings: false, adjustsPool: true, isEstimate: false, hour: 12, createdAt: 0, ...o,
});
export const Design1_CalmCard = () => (
  <div className="relative h-[780px] w-[390px] overflow-hidden rounded-phone border border-line">
    <CloseDay
      entries={[e({ id: 'a', label: 'Lunch', amount: 240, category: 'Food' }), e({ id: 'b', label: 'Auto', amount: 90, category: 'Transport', payment: 'Cash' }), e({ id: 'c', label: 'Groceries', amount: 198, category: 'Food' }), e({ id: 'd', label: 'Chai', amount: 30, category: 'Food', payment: 'Cash' })]}
      cycle={{ currentDay: 7, totalDays: 30, pool: 17616, fromSavingsTotal: 0 }}
      week={week}
      startDate={START}
      onBack={() => {}}
      onAddMore={() => {}}
      onClose={() => {}}
    />
  </div>
);

/* ---------- 2. Tomorrow hero: the answer first, the receipt folded away ---------- */
export const Design2_TomorrowHero = () => {
  const { list, remove } = useRows();
  const [open, setOpen] = useState(false);
  return (
    <div className={phone}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <div className="mt-2 rounded-[26px] bg-goodBg px-5 pb-5 pt-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-good">Tomorrow you can spend</p>
          <p className="num mt-1 text-[60px] leading-none text-ink"><span className="text-good/50">₹</span>{TOMORROW}</p>
          <p className="mt-3 text-[13.5px] leading-snug text-ink/80">{MSG}</p>
        </div>
        <div className="mt-4 flex items-baseline justify-between px-1">
          <p className="text-[14px] text-soft">Spent today</p>
          <p className="num text-[20px] text-ink">{fmt(SPENT)} <span className="text-[13px] text-faint">of {fmt(ALLOW)}</span></p>
        </div>
        <div className="mt-6"><WeekRow days={week} startDate={START} /></div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-5 flex w-full items-center justify-between border-t border-line pt-3 text-[14px] font-medium text-ink">
          {list.length} entries today
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {open && <Rows list={list} remove={remove} compact />}
      </div>
      <Footer />
    </div>
  );
};

/* ---------- 3. Compare: two thin bars and a before/after ---------- */
export const Design3_Compare = () => {
  const { list, remove } = useRows();
  return (
    <div className={phone}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <p className="mt-2 text-[14px] text-soft">Today you spent</p>
        <p className="num text-[46px] leading-[1.05] text-ink"><span className="text-faint">₹</span>{SPENT}</p>
        <span className="mt-1 inline-block rounded-full bg-goodBg px-2.5 py-0.5 text-[12px] font-medium text-good">{fmt(ALLOW - SPENT)} under today&apos;s amount</span>

        <div className="mt-5 space-y-2.5">
          {[['Your amount', ALLOW, 'bg-line'], ['Spent', SPENT, 'bg-good']].map(([l, v, c]) => (
            <div key={l as string}>
              <div className="mb-1 flex justify-between text-[12px] text-soft"><span>{l}</span><span className="num">{fmt(v as number)}</span></div>
              <div className="h-2 rounded-full bg-tint"><div className={`h-full rounded-full ${c}`} style={{ width: `${((v as number) / ALLOW) * 100}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-[18px] bg-tint px-4 py-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow</p>
            <p className="num text-[26px] leading-tight text-ink">{fmt(TOMORROW)}</p>
          </div>
          <div className="text-right">
            <p className="num text-[12px] text-faint line-through">{fmt(ALLOW)}</p>
            <p className="num text-[14px] font-semibold text-good">+₹7 a day</p>
          </div>
        </div>
        <div className="mt-5"><WeekRow days={week} startDate={START} /></div>
        <p className="mb-1 mt-5 text-[12px] font-semibold uppercase tracking-wide text-soft">Entries</p>
        <Rows list={list} remove={remove} compact />
      </div>
      <Footer />
    </div>
  );
};

/* ---------- 4. Ring: one glanceable circle ---------- */
export const Design4_Ring = () => {
  const { list, remove } = useRows();
  const r = 62, c = 2 * Math.PI * r, pct = Math.min(1, SPENT / ALLOW);
  return (
    <div className={phone}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <div className="mt-1 flex flex-col items-center">
          <div className="relative h-[160px] w-[160px]">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" className="stroke-tint" />
              <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="stroke-good" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[12px] text-soft">Spent today</p>
              <p className="num text-[32px] leading-none text-ink">{fmt(SPENT)}</p>
              <p className="num mt-1 text-[12px] text-faint">of {fmt(ALLOW)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-full bg-tint px-4 py-1.5 text-[14px] text-ink">
            Tomorrow <b className="num ml-1 text-[16px]">{fmt(TOMORROW)}</b> <span className="num ml-1 text-[12px] font-semibold text-good">+₹7</span>
          </div>
          <p className="mt-2 max-w-[300px] text-center text-[12.5px] leading-snug text-soft">{MSG}</p>
        </div>
        <div className="mt-5"><WeekRow days={week} startDate={START} /></div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {list.map((r2) => (
            <span key={r2.id} className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pl-3 pr-1 text-[13px] text-ink">
              {r2.label} <b className="num font-medium">{fmt(r2.amt)}</b>
              <button aria-label={`Remove ${r2.label}`} onClick={() => remove(r2.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-faint"><X /></button>
            </span>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};
