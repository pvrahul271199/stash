import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Keypad } from '@/components/ui/Keypad';

/**
 * Additional income, four designs for EACH screen it touches: Log, User, Today, History.
 * Rule shared by all: income is money IN. It is added on top of the plan, so this month's money goes up and every
 * remaining day gets more. It is never counted as spending. Spend, categories, events and types stay as they are;
 * in Income the words change ("Money in", "Received by", "Where did this come from?", "Add income").
 * Palette is the app's own: ink = money out, good teal = money in, tint/line surfaces.
 * Log A and User A are what is wired into the app today.
 */
const meta: Meta = { title: 'Additional income (4 designs per screen)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const DAYS_LEFT = 11;
const POOL = 8800; // money left in the month before the extra income
const perDay = (extra: number) => Math.round((POOL + extra) / DAYS_LEFT);
const SOURCES = ['Salary', 'Freelance', 'Bonus', 'Gift', 'Refund', 'Other'];
const PAYMENTS = ['UPI', 'Card', 'Cash'];
const INCOMES = [
  { id: 1, source: 'Bonus', date: '12 Nov', sub: 'Diwali', amt: 8000 },
  { id: 2, source: 'Freelance', date: '6 Nov', sub: 'Logo work', amt: 3500 },
  { id: 3, source: 'Gift', date: '2 Nov', sub: '', amt: 1000 },
];
const TOTAL = INCOMES.reduce((s, i) => s + i.amt, 0);

function useAmount(init = '') {
  const [v, setV] = useState(init);
  const press = (k: string) => setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return { n: Number(v || 0), press };
}
const Big = ({ n, sign = '', tone = 'ink', size = 56 }: { n: number; sign?: string; tone?: 'ink' | 'good'; size?: number }) => (
  <div className="num flex items-baseline" style={{ fontSize: size, lineHeight: 1.05 }}>
    <span className={`mr-1 ${tone === 'good' ? 'text-good/60' : 'text-faint'}`}>{sign}₹</span>
    <span className={n ? 'text-ink' : 'text-faint'}>{n ? n.toLocaleString('en-IN') : '0'}</span>
  </div>
);
const Pill = ({ children }: { children: ReactNode }) => (
  <p className="num rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">{children}</p>
);
const Seg = ({ items, value, onChange, goodKey }: { items: string[]; value: string; onChange: (v: string) => void; goodKey?: string }) => (
  <div role="tablist" className="flex w-fit rounded-full bg-tint p-0.5">
    {items.map((k) => (
      <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
        className={`h-7 min-h-0 rounded-full px-4 text-[12px] font-medium ${value === k ? (k === goodKey ? 'bg-good text-white' : 'bg-ink text-white') : 'text-soft'}`}>{k}</button>
    ))}
  </div>
);
const Pay = ({ label = 'Received by' }: { label?: string }) => {
  const [p, setP] = useState('UPI');
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[11px] font-medium text-soft">{label}</p>
      <div className="inline-flex rounded-full bg-tint p-0.5">
        {PAYMENTS.map((m) => (
          <button key={m} onClick={() => setP(m)} className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${p === m ? 'bg-ink text-white' : 'text-soft'}`}>{m}</button>
        ))}
      </div>
    </div>
  );
};
const EventPill = () => (
  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-soft">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
    Diwali
  </span>
);
const Src = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="mb-3 flex flex-wrap justify-center gap-1.5">
    {SOURCES.map((s) => (
      <Chip key={s} onClick={() => onChange(s)} className={`h-8 min-h-0 px-3 text-[12px] ${value === s ? '!border-good !bg-goodBg !text-good' : ''}`}>{s}</Chip>
    ))}
  </div>
);
const Close = () => <IconButton label="Close" className="-ml-3 self-start"><BackIcon /></IconButton>;
const Top = () => (
  <div className="flex items-center justify-between"><Close /><EventPill /><span className="w-7" /></div>
);
const Save = ({ children = 'Add income' }: { children?: ReactNode }) => <PrimaryButton className="mt-2 !bg-good">{children}</PrimaryButton>;

/* =====================================================================================
 * 1. LOG: where the income is entered
 * ===================================================================================== */

/** A. (wired) Third segment: Spend | Lend | Income. Only the Income tab is teal; the rest looks like Spend, the words change, small type chips can be added to. */
export const Log_A_ThirdSegment = () => {
  const { n, press } = useAmount('8000');
  const [src, setSrc] = useState('Bonus');
  const [m, setM] = useState('Income');
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <Top />
      <div className="mx-auto mt-2"><Seg items={['Spend', 'Lend', 'Income']} value={m} onChange={setM} goodKey="Income" /></div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Big n={n} sign="+" size={64} />
        <p className="max-w-[260px] text-center text-[13px] text-soft">
          Your {DAYS_LEFT} days left go from <span className="num font-semibold text-ink">{fmt(perDay(0))}</span> to <span className="num font-semibold text-ink">{fmt(perDay(n))}</span> a day.
        </p>
        <div className="inline-flex rounded-full bg-tint p-0.5">
          {PAYMENTS.map((p) => <button key={p} className={`h-7 rounded-full px-3 text-[12px] font-medium ${p === 'UPI' ? 'bg-ink text-white' : 'text-soft'}`}>{p}</button>)}
        </div>
        <button className="inline-flex h-6 items-center gap-1 rounded-full border border-line px-2.5 text-[11px] font-medium text-soft">+ Where did this come from?</button>
      </div>
      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {[...SOURCES, '+ Add'].map((s) => (
          <Chip key={s} dashed={s === '+ Add'} onClick={() => setSrc(s)} className={`h-7 min-h-0 px-2.5 text-[11px] ${src === s ? '!border-ink !bg-ink !text-white' : ''}`}>{s}</Chip>
        ))}
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]">Add income</PrimaryButton>
    </div>
  );
};

/** B. "Money in" takeover: the whole screen turns soft teal and talks differently ("How much came in?"). */
export const Log_B_MoneyInScreen = () => {
  const { n, press } = useAmount('8000');
  const [src, setSrc] = useState('Bonus');
  return (
    <div className={`${phone} bg-goodBg px-5 pb-5 pt-4`}>
      <Top />
      <div className="mt-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-good">Money in</p>
        <p className="mt-1 text-[20px] font-semibold text-ink">How much came in?</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Big n={n} sign="+" tone="good" size={64} />
        <p className="max-w-[260px] text-center text-[13px] text-soft">
          Your {DAYS_LEFT} days left go from <span className="num font-semibold text-ink">{fmt(perDay(0))}</span> to <span className="num font-semibold text-good">{fmt(perDay(n))}</span> a day.
        </p>
        <Pay label="It arrived by" />
      </div>
      <Src value={src} onChange={setSrc} />
      <Keypad onKey={press} />
      <Save>Add to this month</Save>
      <button className="mt-2 text-center text-[12px] font-medium text-soft">Actually, this is a spend</button>
    </div>
  );
};

/** C. Sign toggle on the amount: tap "−" to "+" and the same screen becomes income. No extra tab. */
export const Log_C_SignToggle = () => {
  const { n, press } = useAmount('8000');
  const [plus, setPlus] = useState(true);
  const [src, setSrc] = useState('Bonus');
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <Top />
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setPlus((v) => !v)} aria-label={plus ? 'Switch to spend' : 'Switch to income'}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-[24px] font-semibold ${plus ? 'bg-good text-white' : 'bg-tint text-ink'}`}>{plus ? '+' : '−'}</button>
          <Big n={n} tone={plus ? 'good' : 'ink'} size={60} />
        </div>
        <p className={`text-[12px] font-medium ${plus ? 'text-good' : 'text-soft'}`}>{plus ? 'Money in' : 'Money out'}</p>
        {plus ? <Pill>Daily {fmt(perDay(0))} → {fmt(perDay(n))}</Pill> : <Pill>Tap + for income</Pill>}
        {plus && <Pay />}
      </div>
      {plus ? <Src value={src} onChange={setSrc} /> : <p className="mb-3 text-center text-[12px] text-faint">Food · Travel · Home · More</p>}
      <Keypad onKey={press} />
      {plus ? <Save /> : <PrimaryButton className="mt-2">Save</PrimaryButton>}
    </div>
  );
};

/** D. Source first: big cards ask "What came in?" before the amount, so the type leads and the note is the card's subtitle. */
export const Log_D_SourceFirst = () => {
  const { n, press } = useAmount('8000');
  const [src, setSrc] = useState('Bonus');
  const hints: Record<string, string> = { Salary: 'Pay', Freelance: 'Side work', Bonus: 'Extra pay', Gift: 'From someone', Refund: 'Money back', Other: 'Anything else' };
  return (
    <div className={`${phone} px-5 pb-5 pt-4`}>
      <Top />
      <p className="mt-3 text-[20px] font-semibold text-ink">What came in?</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SOURCES.map((s) => (
          <button key={s} onClick={() => setSrc(s)} className={`rounded-note border px-2 py-2.5 text-left ${src === s ? 'border-good bg-goodBg' : 'border-line bg-white'}`}>
            <p className={`text-[13px] font-semibold ${src === s ? 'text-good' : 'text-ink'}`}>{s}</p>
            <p className="text-[10.5px] text-faint">{hints[s]}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <Big n={n} sign="+" tone="good" size={56} />
        <Pill>Every day ahead: +{fmt(perDay(n) - perDay(0))}</Pill>
      </div>
      <Keypad onKey={press} />
      <Save>Add {src.toLowerCase()}</Save>
    </div>
  );
};

/* =====================================================================================
 * 2. USER PAGE: where additional income is kept
 * ===================================================================================== */

const UserShell = ({ children }: { children: ReactNode }) => (
  <div className={`${phone} overflow-y-auto px-6 pb-8 pt-6`}>
    <h1 className="text-[20px] font-semibold tracking-tight text-ink">User Profile & Plan</h1>
    <section className="mt-5 rounded-note border border-line p-4">
      <h2 className="text-[16px] font-semibold text-ink">Your budget plan</h2>
      {[['Monthly income', '₹80,000'], ['Fixed bills', '₹25,000'], ['Savings & investments', '₹15,000']].map(([a, b]) => (
        <div key={a} className="flex justify-between border-t border-line py-2.5 first:mt-2"><dt className="text-[15px] text-soft">{a}</dt><dd className="num text-[16px] font-semibold text-ink">{b}</dd></div>
      ))}
    </section>
    {children}
  </div>
);
const Rows = ({ compact }: { compact?: boolean }) => (
  <ul className="divide-y divide-line">
    {INCOMES.map((i) => (
      <li key={i.id} className={`flex items-center gap-2 ${compact ? 'py-2' : 'py-2.5'}`}>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-medium text-ink">{i.source}</p><p className="text-[12px] text-faint">{i.date}{i.sub ? ` · ${i.sub}` : ''}</p></div>
        <p className="num text-[15px] font-semibold text-good">+{fmt(i.amt)}</p>
        <button aria-label={`Remove ${i.source}`} className="flex h-10 w-8 items-center justify-center text-faint">×</button>
      </li>
    ))}
  </ul>
);

/** A. (wired) A collapsed card under the plan (like Saved from leftovers): total on the right, tap to open the list and "+ Add income". */
export const User_A_SectionCard = () => (
  <UserShell>
    <section className="mt-6 rounded-note border border-line p-4">
      <div className="flex items-start justify-between border-b border-line pb-3">
        <div><h2 className="text-[16px] font-semibold text-ink">Additional income</h2><p className="mt-0.5 text-[12px] text-soft">Bonus, freelance, a gift. Added on top of your plan.</p></div>
        <div className="text-right"><p className="num text-[18px] font-semibold text-good">+{fmt(TOTAL)}</p><p className="text-[11px] text-faint">this month</p></div>
      </div>
      <Rows />
      <div className="mt-2 border-t border-line/70 pt-3"><button className="w-full rounded-btn border border-good/40 bg-goodBg py-2 text-[13px] font-medium text-good">+ Add income</button></div>
    </section>
  </UserShell>
);

/** B. Hero tile: a stacked bar shows the plan and the extra on top of it, so the effect is visible at once. */
export const User_B_HeroTile = () => (
  <UserShell>
    <section className="mt-6 rounded-note bg-goodBg p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-good">Additional income</p>
      <p className="num mt-1 text-[34px] font-semibold text-good">+{fmt(TOTAL)}</p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white">
        <span className="h-full bg-ink" style={{ width: '78%' }} /><span className="h-full bg-good" style={{ width: '22%' }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-soft"><span>Plan {fmt(40000)}</span><span>Extra {fmt(TOTAL)}</span></div>
      <p className="mt-3 text-[13px] text-soft">That is <span className="num font-semibold text-ink">{fmt(Math.round(TOTAL / 30))}</span> more on each of the 30 days.</p>
      <button className="mt-3 h-10 w-full rounded-full bg-good text-[14px] font-medium text-white">+ Add income</button>
      <div className="mt-3 border-t border-good/20"><Rows compact /></div>
    </section>
  </UserShell>
);

/** C. In the plan maths: extra income is a teal row inside "Your budget plan", so Money to live on adds up in front of you. */
export const User_C_InPlanMaths = () => (
  <div className={`${phone} overflow-y-auto px-6 pb-8 pt-6`}>
    <h1 className="text-[20px] font-semibold tracking-tight text-ink">User Profile & Plan</h1>
    <section className="mt-5 rounded-note border border-line p-4">
      <h2 className="text-[16px] font-semibold text-ink">Your budget plan</h2>
      <p className="text-[12px] text-soft">November</p>
      {[['Monthly income', '₹80,000', 'text-ink'], ['Additional income', `+${fmt(TOTAL)}`, 'text-good'], ['Fixed bills', '−₹25,000', 'text-ink'], ['Savings & investments', '−₹15,000', 'text-ink']].map(([a, b, c]) => (
        <div key={a} className="flex justify-between border-t border-line py-2.5 first:mt-2"><dt className="text-[15px] text-soft">{a}</dt><dd className={`num text-[16px] font-semibold ${c}`}>{b}</dd></div>
      ))}
      <div className="flex justify-between border-t-2 border-ink py-3"><dt className="text-[15px] font-semibold text-ink">Money to live on</dt><dd className="num text-[18px] font-semibold text-ink">{fmt(40000 + TOTAL)}</dd></div>
      <button className="w-full rounded-btn border border-good/40 bg-goodBg py-2 text-[13px] font-medium text-good">+ Add income</button>
    </section>
    <section className="mt-5 rounded-note border border-line px-4 py-1"><Rows compact /></section>
  </div>
);

/** D. By type: chips total each source ("Bonus ₹8,000"), months fold open to the entries, one dashed "+ Add" chip. */
export const User_D_ByType = () => {
  const [open, setOpen] = useState(true);
  return (
    <UserShell>
      <section className="mt-6 rounded-note border border-line px-4">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-[56px] w-full items-center justify-between text-left">
          <span className="text-[16px] font-semibold text-ink">Additional income</span>
          <span className="num text-[18px] font-semibold text-good">+{fmt(TOTAL)}</span>
        </button>
        <div className="flex flex-wrap gap-1.5 pb-3">
          {INCOMES.map((i) => <span key={i.id} className="rounded-full bg-goodBg px-2.5 py-1 text-[12px] text-good">{i.source} <span className="num font-semibold">{fmt(i.amt)}</span></span>)}
          <Chip dashed className="h-7 min-h-0 px-2.5 text-[12px]">+ Add</Chip>
        </div>
        {open && (
          <div className="border-t border-line pb-1">
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">November</p><Rows compact />
            <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">October</p>
            <p className="py-2.5 text-[13px] text-soft">Nothing added.</p>
          </div>
        )}
      </section>
    </UserShell>
  );
};

/* =====================================================================================
 * 3. TODAY: how the home screen shows that more money came in
 * ===================================================================================== */

const TodayShell = ({ children, allowance = perDay(0), extra }: { children?: ReactNode; allowance?: number; extra?: ReactNode }) => (
  <div className={`${phone} px-6 pt-8`}>
    <p className="text-[13px] text-soft">Left today</p>
    <p className="num text-[56px] leading-none text-ink">{fmt(allowance)}</p>
    <p className="mt-2 text-[13px] text-faint">of {fmt(allowance)} · {DAYS_LEFT} days left</p>
    {extra}
    <div className="mt-6 flex gap-1">{Array.from({ length: 14 }, (_, i) => <span key={i} className={`h-8 flex-1 rounded ${i < 3 ? 'bg-ink/80' : 'bg-tint'}`} />)}</div>
    {children}
  </div>
);

/** A. Quiet line under the number: "+₹12,500 extra this month". Nothing else moves. */
export const Today_A_QuietLine = () => (
  <TodayShell allowance={perDay(TOTAL)} extra={<p className="num mt-3 text-[12px] font-medium text-good">+{fmt(TOTAL)} extra income this month</p>} />
);

/** B. In / out card: the month as two numbers, money in (teal) and money out (ink). */
export const Today_B_InOutCard = () => (
  <TodayShell allowance={perDay(TOTAL)}>
    <div className="mt-6 grid grid-cols-2 gap-2">
      <div className="rounded-note bg-goodBg p-3"><p className="text-[11px] text-good">In extra</p><p className="num text-[20px] font-semibold text-good">+{fmt(TOTAL)}</p></div>
      <div className="rounded-note bg-tint p-3"><p className="text-[11px] text-soft">Spent</p><p className="num text-[20px] font-semibold text-ink">{fmt(8420)}</p></div>
    </div>
  </TodayShell>
);

/** C. Delta chip beside the amount: "▲ ₹1,136 a day" so the effect on today is the headline. */
export const Today_C_DeltaChip = () => (
  <TodayShell allowance={perDay(TOTAL)} extra={<p className="num mt-3 inline-flex rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">▲ {fmt(perDay(TOTAL) - perDay(0))} a day since your bonus</p>} />
);

/** D. One-time banner after saving: "Daily ₹800 → ₹1,936", dismissable, then the screen is back to normal. */
export const Today_D_Banner = () => (
  <TodayShell allowance={perDay(TOTAL)}>
    <div className="mt-6 flex items-start gap-3 rounded-note border border-good/30 bg-goodBg p-3">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-good text-white">+</span>
      <div className="flex-1"><p className="text-[14px] font-semibold text-ink">{fmt(8000)} added · Bonus</p><p className="num text-[12px] text-soft">Daily {fmt(perDay(0))} → {fmt(perDay(8000))}</p></div>
      <button className="text-faint" aria-label="Dismiss">×</button>
    </div>
  </TodayShell>
);

/* =====================================================================================
 * 4. HISTORY: how income shows next to spends
 * ===================================================================================== */

const SPENDS = [{ l: 'Lunch', s: 'Food · UPI', a: 240 }, { l: 'Auto', s: 'Travel · Cash', a: 90 }, { l: 'Groceries', s: 'Home · UPI', a: 198 }];
const Row = ({ l, s, a, income }: { l: string; s: string; a: number; income?: boolean }) => (
  <li className="flex items-center gap-2 py-2.5">
    <div className="min-w-0 flex-1"><p className="text-[15px] font-medium text-ink">{l}</p><p className="text-[12px] text-faint">{s}</p></div>
    <p className={`num text-[16px] ${income ? 'font-semibold text-good' : 'text-ink'}`}>{income ? '+' : ''}{fmt(a)}</p>
  </li>
);
const HistShell = ({ children, tabs }: { children: ReactNode; tabs?: ReactNode }) => (
  <div className={`${phone} px-6 pt-6`}>
    <h1 className="text-[20px] font-semibold text-ink">History</h1>
    {tabs}
    <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-faint">Thu 12 Nov</p>
    {children}
  </div>
);

/** A. Inline row: a teal "+₹8,000 Bonus" row sits among the day's spends. */
export const History_A_InlineRow = () => (
  <HistShell><ul className="divide-y divide-line"><Row l="Bonus" s="Income · Diwali" a={8000} income />{SPENDS.map((r) => <Row key={r.l} l={r.l} s={r.s} a={r.a} />)}</ul></HistShell>
);

/** B. Own tab: History | Lend | Income, the same way Lend has its tab. Spends list stays pure. */
export const History_B_IncomeTab = () => (
  <HistShell tabs={<div className="mt-3"><Seg items={['History', 'Lend', 'Income']} value="Income" onChange={() => {}} goodKey="Income" /></div>}>
    <ul className="divide-y divide-line">{INCOMES.map((i) => <Row key={i.id} l={i.source} s={`${i.date}${i.sub ? ` · ${i.sub}` : ''}`} a={i.amt} income />)}</ul>
    <p className="num mt-3 text-[13px] text-soft">This month <span className="font-semibold text-good">+{fmt(TOTAL)}</span></p>
  </HistShell>
);

/** C. Day net: the day header carries the net, "+₹7,472 net", with in and out beneath it. */
export const History_C_DayNet = () => (
  <HistShell>
    <div className="flex items-baseline justify-between"><p className="num text-[18px] font-semibold text-good">+{fmt(8000 - 528)} net</p><p className="num text-[12px] text-faint">in {fmt(8000)} · out {fmt(528)}</p></div>
    <ul className="divide-y divide-line"><Row l="Bonus" s="Income · Diwali" a={8000} income />{SPENDS.map((r) => <Row key={r.l} l={r.l} s={r.s} a={r.a} />)}</ul>
  </HistShell>
);

/** D. Money-in group: income gathers under its own small teal header at the top of the day. */
export const History_D_MoneyInGroup = () => (
  <HistShell>
    <div className="mt-1 rounded-note bg-goodBg px-3">
      <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-good">Money in</p>
      <ul><Row l="Bonus" s="Diwali" a={8000} income /></ul>
    </div>
    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">Spent</p>
    <ul className="divide-y divide-line">{SPENDS.map((r) => <Row key={r.l} l={r.l} s={r.s} a={r.a} />)}</ul>
  </HistShell>
);
