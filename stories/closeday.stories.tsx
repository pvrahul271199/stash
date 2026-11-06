import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { BackIcon, IconButton, PrimaryButton } from '@/components/ui/Button';
import { categoryRamp } from '@/theme/tokens';

/**
 * Three directions for "Close the day". Same data and the same rule in all of them: closing is a recap
 * (nothing is written, the day rolls over at midnight), and "Paid cash or forgot something?" lives next to the
 * main button instead of floating in the list.
 */
const meta: Meta = { title: 'Close the day options', parameters: { layout: 'centered' } };
export default meta;

const ALLOWANCE = 850;
const TOMORROW = 872;
const items = [
  { id: 1, label: 'Lunch', cat: 'Food', pay: 'UPI', amt: 240 },
  { id: 2, label: 'Auto', cat: 'Transport', pay: 'Cash', amt: 90 },
  { id: 3, label: 'Headphones', cat: 'Shopping', pay: 'Card', amt: 1499, savings: true },
  { id: 4, label: 'Chai', cat: 'Food', pay: 'Cash', amt: 30 },
];
type Item = (typeof items)[number];
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const colorOf = (cat: string) => categoryRamp[[...new Set(items.map((i) => i.cat))].indexOf(cat) % categoryRamp.length];
const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white px-6 pb-6 pt-4 shadow-sm';

const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
const X = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const Forgot = () => (
  <button className="mb-3 mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-tint text-[14px] font-medium text-ink active:opacity-70">
    <Plus /> Paid cash or forgot something?
  </button>
);
const Footer = ({ cta = 'Close the day' }: { cta?: string }) => (
  <>
    <Forgot />
    <PrimaryButton>{cta}</PrimaryButton>
  </>
);
const Top = () => (
  <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
);

function useList() {
  const [list, setList] = useState<Item[]>(items);
  return { list, remove: (id: number) => setList((l) => l.filter((i) => i.id !== id)), total: list.reduce((s, i) => s + i.amt, 0) };
}

/* ---------- 1. Receipt: a calm paper slip ---------- */
export const Option1_Receipt = () => {
  const { list, remove, total } = useList();
  return (
    <div className={`${phone} bg-tint`}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <div className="mt-2 rounded-[22px] bg-white px-5 pt-5 shadow-[0_1px_0_rgba(30,27,75,0.04),0_12px_30px_-18px_rgba(30,27,75,0.35)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-soft">Spent today</p>
          <p className="num mt-1 text-[48px] leading-none text-ink"><span className="text-faint">₹</span>{total.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-[13px] text-faint">6 Nov · {list.length} entries</p>
          <ul className="mt-4 border-t border-dashed border-line">
            {list.map((i) => (
              <li key={i.id} className="flex items-center gap-2 border-b border-dashed border-line py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{i.label}</p>
                  <p className="text-[12.5px] text-faint">{i.cat} · {i.pay}{i.savings && <span className="text-warm"> · from savings</span>}</p>
                </div>
                <p className="num text-[17px] text-ink">{fmt(i.amt)}</p>
                <button aria-label={`Remove ${i.label}`} onClick={() => remove(i.id)} className="flex h-9 w-7 items-center justify-center text-faint"><X /></button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between py-4">
            <span className="text-[13px] text-soft">Total</span>
            <span className="num text-[20px] text-ink">{fmt(total)}</span>
          </div>
          {/* torn edge */}
          <div className="-mx-5 h-3" style={{ background: 'radial-gradient(circle at 8px 0, #F7F6FD 6px, transparent 7px) 0 0 / 16px 12px repeat-x' }} />
        </div>
      </div>
      <Footer />
    </div>
  );
};

/* ---------- 2. Breakdown: where did it go? ---------- */
export const Option2_Breakdown = () => {
  const { list, remove, total } = useList();
  const byCat = Object.entries(list.reduce<Record<string, number>>((m, i) => ({ ...m, [i.cat]: (m[i.cat] ?? 0) + i.amt }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <div className={phone}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <p className="mt-2 text-[14px] text-soft">Spent today</p>
        <p className="num text-[52px] leading-[1.05] text-ink"><span className="text-faint">₹</span>{total.toLocaleString('en-IN')}</p>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-tint" role="img" aria-label="Spend by category">
          {byCat.map(([c, v]) => (
            <span key={c} style={{ width: `${(v / (total || 1)) * 100}%`, background: colorOf(c) }} className="mr-[2px] last:mr-0" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {byCat.map(([c, v]) => (
            <span key={c} className="flex items-center gap-1.5 text-[12.5px] text-soft">
              <i className="h-2 w-2 rounded-full" style={{ background: colorOf(c) }} />{c} <b className="num font-medium text-ink">{fmt(v)}</b>
            </span>
          ))}
        </div>
        <ul className="mt-5 flex flex-col gap-1.5">
          {list.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-[16px] bg-tint px-3 py-2.5">
              <i className="h-8 w-1 rounded-full" style={{ background: colorOf(i.cat) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{i.label}</p>
                <p className="text-[12px] text-faint">{i.pay}{i.savings && <span className="ml-1 rounded-full bg-warmBg px-1.5 py-px text-warm">from savings</span>}</p>
              </div>
              <p className="num text-[17px] text-ink">{fmt(i.amt)}</p>
              <button aria-label={`Remove ${i.label}`} onClick={() => remove(i.id)} className="flex h-9 w-8 items-center justify-center text-faint"><X /></button>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
    </div>
  );
};

/* ---------- 3. Tomorrow-first: the reward for logging ---------- */
export const Option3_TomorrowFirst = () => {
  const { list, remove, total } = useList();
  const pct = Math.min(100, Math.round((total / ALLOWANCE) * 100));
  const over = total > ALLOWANCE;
  return (
    <div className={phone}>
      <Top />
      <div className="flex-1 overflow-y-auto pb-2">
        <p className="mt-2 text-[14px] text-soft">Spent today</p>
        <div className="flex items-baseline gap-2">
          <p className="num text-[44px] leading-[1.05] text-ink"><span className="text-faint">₹</span>{total.toLocaleString('en-IN')}</p>
          <p className="num text-[14px] text-faint">of {fmt(ALLOWANCE)}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line/70">
          <div className={`h-full rounded-full ${over ? 'bg-warm' : 'bg-good'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`mt-4 rounded-[20px] px-4 py-3.5 ${over ? 'bg-warmBg' : 'bg-goodBg'}`}>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${over ? 'text-warm' : 'text-good'}`}>If that&apos;s all for today</p>
          <p className="num mt-0.5 text-[28px] text-ink">{fmt(over ? 801 : TOMORROW)}<span className="ml-2 text-[13px] text-soft">tomorrow</span></p>
          <p className="mt-0.5 text-[12.5px] text-soft">{over ? 'Over today, so the extra is spread over the days left.' : 'Under today, so every day ahead gets a little more.'}</p>
        </div>
        <p className="mb-1 mt-5 text-[12px] font-semibold uppercase tracking-wide text-soft">Today&apos;s {list.length} entries</p>
        <ul className="divide-y divide-line">
          {list.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: colorOf(i.cat) }}>{i.label[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{i.label}</p>
                <p className="text-[12px] text-faint">{i.cat} · {i.pay}</p>
              </div>
              <p className="num text-[16px] text-ink">{fmt(i.amt)}</p>
              <button aria-label={`Remove ${i.label}`} onClick={() => remove(i.id)} className="flex h-9 w-8 items-center justify-center text-faint"><X /></button>
            </li>
          ))}
        </ul>
      </div>
      <Footer cta="See tomorrow" />
    </div>
  );
};

/* ---------- The shipped screen (Option 3, light and minimal) ---------- */
import { CloseDay } from '@/components/screens/CloseDay';
import type { Entry } from '@/db/schema';

const mk = (o: Pick<Entry, 'id' | 'label' | 'amount' | 'category'> & Partial<Entry>): Entry => ({
  cycleId: '', day: 7, date: '2026-11-06', subcategory: null, event: null, payment: 'UPI', note: null,
  fromSavings: false, adjustsPool: true, isEstimate: false, hour: 12, createdAt: 0, ...o,
});
const real: Entry[] = [
  mk({ id: 'a', label: 'Lunch', amount: 240, category: 'Food' }),
  mk({ id: 'b', label: 'Auto', amount: 90, category: 'Transport', payment: 'Cash' }),
  mk({ id: 'c', label: 'Chai', amount: 30, category: 'Food', payment: 'Cash', note: 'with Priya' }),
];
const cyc = { currentDay: 7, totalDays: 30, pool: 20400, fromSavingsTotal: 0 };
const noop = () => {};
const frame = 'relative h-[780px] w-[390px] overflow-hidden rounded-phone border border-line';
export const Shipped_UnderBudget = () => (
  <div className={frame}><CloseDay entries={real} cycle={cyc} onBack={noop} onAddMore={noop} onClose={noop} /></div>
);
export const Shipped_OverBudget = () => (
  <div className={frame}>
    <CloseDay entries={[...real, mk({ id: 'd', label: 'Headphones', amount: 1499, category: 'Shopping', payment: 'Card', fromSavings: false })]} cycle={cyc} onBack={noop} onAddMore={noop} onClose={noop} />
  </div>
);
export const Shipped_Empty = () => (
  <div className={frame}><CloseDay entries={[]} cycle={cyc} onBack={noop} onAddMore={noop} onClose={noop} /></div>
);
