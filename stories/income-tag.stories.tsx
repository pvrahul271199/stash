import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { PrimaryButton, IconButton, BackIcon } from '@/components/ui/Button';
import { Chip, Note } from '@/components/ui/Chip';
import { Keypad } from '@/components/ui/Keypad';
import { HugeNumber } from '@/components/ui/HugeNumber';

/**
 * Income tag: three designs for EACH screen the tag touches.
 * Rule shared by every design: an entry tagged Income is money IN. It raises this month's pool,
 * so every remaining day gets more. It is never counted as spending (like Lend, it sits outside Spent).
 * Palette is the app's own: ink = money out, good teal = money in, tint/line surfaces.
 * Screens: Log spend · Today · History · Insights · Close the day.
 */
const meta: Meta = { title: 'Income tag (per screen)', parameters: { layout: 'centered' } };
export default meta;

const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const DAYS_LEFT = 24;
const POOL = 20400;
const perDay = (extra: number) => Math.round((POOL + extra) / DAYS_LEFT);
const SOURCES = ['Salary', 'Freelance', 'Bonus', 'Gift', 'Refund'];

function useAmount(init = '') {
  const [v, setV] = useState(init);
  const press = (k: string) =>
    setV((p) => (k === 'del' ? p.slice(0, -1) : (p + k).replace(/^0+/, '').slice(0, 7)));
  return { n: Number(v || 0), press };
}

const Plus = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Down = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v15M6 13l6 6 6-6" />
  </svg>
);

/** Tabs bar shared by the mock screens. */
const Tabs = ({ active }: { active: 'Today' | 'History' | 'Insights' }) => (
  <div className="mt-auto flex border-t border-line bg-white px-6 py-3 text-[12px] font-medium">
    {(['Today', 'History', 'Insights'] as const).map((t) => (
      <span key={t} className={`flex-1 text-center ${active === t ? 'text-ink' : 'text-faint'}`}>{t}</span>
    ))}
  </div>
);

const Label = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-soft">{children}</p>
);

/* =====================================================================================
 * 1. LOG SPEND: where the tag is chosen
 * ===================================================================================== */

/** A. Third segment on the existing switch: Spend | Lend | Income. Smallest change. */
export const Log_A_ThirdSegment = () => {
  const { n, press } = useAmount('8000');
  const [m, setM] = useState<'spend' | 'lend' | 'income'>('income');
  const [src, setSrc] = useState('Bonus');
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div role="tablist" className="mx-auto mt-1 flex w-fit rounded-full bg-tint p-0.5">
        {(['spend', 'lend', 'income'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={m === k}
            onClick={() => setM(k)}
            className={`h-7 rounded-full px-4 text-[12px] font-medium capitalize ${m === k ? (k === 'income' ? 'bg-good text-white' : 'bg-ink text-white') : 'text-soft'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-baseline" style={{ fontSize: 56, lineHeight: 1.05 }}>
          <span className={`mr-1 ${m === 'income' ? 'text-good/60' : 'text-faint'}`}>{m === 'income' ? '+₹' : '₹'}</span>
          <span className={n ? 'text-ink' : 'text-faint'}>{n ? n.toLocaleString('en-IN') : '0'}</span>
        </div>
        {m === 'income' && (
          <p className="num mt-3 rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">
            Daily {fmt(perDay(0))} → {fmt(perDay(n))}
          </p>
        )}
      </div>
      {m === 'income' && (
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {SOURCES.map((s) => (
            <Chip key={s} onClick={() => setSrc(s)} className={`h-8 min-h-0 px-3 text-[12px] ${src === s ? '!border-good !bg-goodBg !text-good' : ''}`}>{s}</Chip>
          ))}
        </div>
      )}
      <Keypad onKey={press} />
      <PrimaryButton className={`mt-2 ${m === 'income' ? '!bg-good' : ''}`}>{m === 'income' ? 'Add income' : 'Add spend'}</PrimaryButton>
    </div>
  );
};

/** B. A small "+ Income" tag chip beside the category chips. Stays on the spend screen. */
export const Log_B_TagChip = () => {
  const { n, press } = useAmount('8000');
  const [isIncome, setIsIncome] = useState(true);
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-baseline" style={{ fontSize: 56, lineHeight: 1.05 }}>
          <span className={`mr-1 ${isIncome ? 'text-good/60' : 'text-faint'}`}>{isIncome ? '+₹' : '₹'}</span>
          <span className="text-ink">{n ? n.toLocaleString('en-IN') : '0'}</span>
        </div>
        {isIncome && <span className="mt-3 rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">Tagged as income · not a spend</span>}
      </div>
      <div className="mb-3 flex flex-wrap justify-center gap-1.5">
        <Chip className="h-8 min-h-0 px-3 text-[12px]">Food</Chip>
        <Chip className="h-8 min-h-0 px-3 text-[12px]">Transport</Chip>
        <Chip className="h-8 min-h-0 px-3 text-[12px]">Shopping</Chip>
        <Chip
          onClick={() => setIsIncome((v) => !v)}
          aria-pressed={isIncome}
          className={`h-8 min-h-0 gap-1 px-3 text-[12px] ${isIncome ? '!border-good !bg-good !text-white' : '!border-dashed !text-good'}`}
        >
          <Plus s={11} /> Income
        </Chip>
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className={`mt-2 ${isIncome ? '!bg-good' : ''}`}>{isIncome ? 'Add income' : 'Add spend'}</PrimaryButton>
    </div>
  );
};

/** C. Tap the sign: the "₹" prefix flips between − (spend) and + (income). Calculator feel, no extra UI. */
export const Log_C_SignToggle = () => {
  const { n, press } = useAmount('8000');
  const [plus, setPlus] = useState(true);
  return (
    <div className={`${phone} px-6 pb-6 pt-4`}>
      <IconButton label="Back" className="-ml-3 self-start"><BackIcon /></IconButton>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="num flex items-center gap-2" style={{ fontSize: 56, lineHeight: 1.05 }}>
          <button
            onClick={() => setPlus((v) => !v)}
            aria-label={plus ? 'Switch to spend' : 'Switch to income'}
            className={`flex h-12 w-12 items-center justify-center rounded-full text-[28px] ${plus ? 'bg-goodBg text-good' : 'bg-tint text-soft'}`}
          >
            {plus ? '+' : '−'}
          </button>
          <span className="text-ink">{n ? n.toLocaleString('en-IN') : '0'}</span>
        </div>
        <p className="mt-3 text-[12px] text-soft">{plus ? 'Money in. Tap + to switch to a spend' : 'Money out. Tap − to switch to income'}</p>
        {plus && (
          <div className="mt-4 flex gap-1.5">
            {SOURCES.slice(0, 4).map((s, i) => (
              <Chip key={s} className={`h-8 min-h-0 px-3 text-[12px] ${i === 1 ? '!border-good !bg-goodBg !text-good' : ''}`}>{s}</Chip>
            ))}
          </div>
        )}
      </div>
      <Keypad onKey={press} />
      <PrimaryButton className={`mt-2 ${plus ? '!bg-good' : ''}`}>{plus ? 'Add income' : 'Add spend'}</PrimaryButton>
    </div>
  );
};

/* =====================================================================================
 * 2. TODAY: how the extra money shows up in the allowance
 * ===================================================================================== */

const TodayShell = ({ children }: { children: ReactNode }) => (
  <div className={phone}>
    <div className="flex flex-1 flex-col px-6 pt-14">{children}</div>
    <Tabs active="Today" />
  </div>
);

/** A. Quiet line under the big number: "+₹8,000 bonus today". */
export const Today_A_QuietLine = () => (
  <TodayShell>
    <p className="text-[14px] text-soft">You can spend today</p>
    <HugeNumber value={perDay(8000)} />
    <p className="num mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-goodBg px-3 py-1 text-[12px] font-medium text-good">
      <Plus s={11} /> {fmt(8000)} Bonus · was {fmt(perDay(0))}/day
    </p>
    <div className="mt-8 rounded-[20px] bg-tint p-4">
      <Label>Left today</Label>
      <p className="num mt-1 text-[28px] text-ink">{fmt(perDay(8000) - 240)}</p>
      <p className="mt-0.5 text-[12px] text-soft">Spent {fmt(240)} so far</p>
    </div>
  </TodayShell>
);

/** B. Month card with In / Out: income becomes a visible row in the month summary. */
export const Today_B_InOutCard = () => (
  <TodayShell>
    <p className="text-[14px] text-soft">You can spend today</p>
    <HugeNumber value={perDay(8000)} />
    <div className="mt-8 rounded-[20px] border border-line p-4">
      <Label>This month</Label>
      <dl className="num mt-3 space-y-2 text-[14px]">
        <div className="flex justify-between"><dt className="text-soft">Money to live on</dt><dd className="text-ink">{fmt(30000)}</dd></div>
        <div className="flex justify-between"><dt className="text-good">+ Income added</dt><dd className="text-good">{fmt(8000)}</dd></div>
        <div className="flex justify-between"><dt className="text-soft">− Spent</dt><dd className="text-ink">{fmt(9600)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 font-medium"><dt className="text-ink">Pool left</dt><dd className="text-ink">{fmt(POOL + 8000)}</dd></div>
      </dl>
    </div>
  </TodayShell>
);

/** C. Celebratory delta chip on the number: ▲ ₹333/day, tappable for details. */
export const Today_C_DeltaChip = () => (
  <TodayShell>
    <p className="text-[14px] text-soft">You can spend today</p>
    <div className="relative">
      <HugeNumber value={perDay(8000)} />
      <span className="num absolute -top-1 right-0 rounded-full bg-good px-2.5 py-1 text-[12px] font-semibold text-white">▲ {fmt(perDay(8000) - perDay(0))}</span>
    </div>
    <Note tone="good" className="mt-6">
      <b>Bonus +{fmt(8000)}</b> added today. Every one of the {DAYS_LEFT} days left gets <b className="num">{fmt(perDay(8000) - perDay(0))}</b> more.
    </Note>
    <button className="mt-3 w-fit text-[13px] font-medium text-soft underline underline-offset-4">Undo income</button>
  </TodayShell>
);

/* =====================================================================================
 * 3. HISTORY: how an income entry looks in the list
 * ===================================================================================== */

const Row = ({ title, sub, amt, right }: { title: string; sub: string; amt: string; right?: ReactNode }) => (
  <div className="flex items-center gap-3 py-3">
    <div className="flex-1">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="text-[12px] text-soft">{sub}</p>
    </div>
    {right}
    <p className="num text-[15px]">{amt}</p>
  </div>
);

const HistoryShell = ({ children, tabs }: { children: ReactNode; tabs?: ReactNode }) => (
  <div className={phone}>
    <div className="px-6 pt-14">
      <h1 className="font-display text-[28px] font-semibold text-ink">History</h1>
      {tabs}
    </div>
    <div className="flex-1 overflow-hidden px-6 pt-3">{children}</div>
    <Tabs active="History" />
  </div>
);

/** A. Inline: teal "+" amount with a small Income pill, in the same list as spends. */
export const History_A_InlineRow = () => (
  <HistoryShell>
    <Label>Fri 7 Nov</Label>
    <div className="divide-y divide-line">
      <Row title="Freelance payout" sub="Income · UPI" amt="+₹8,000" right={<span className="rounded-full bg-goodBg px-2 py-0.5 text-[10px] font-semibold text-good">INCOME</span>} />
      <Row title="Lunch" sub="Food · Eating out" amt="₹240" />
      <Row title="Auto" sub="Transport · Cash" amt="₹90" />
    </div>
    <div className="mt-4"><Label>Thu 6 Nov</Label></div>
    <div className="divide-y divide-line">
      <Row title="Groceries" sub="Food" amt="₹820" />
      <Row title="Refund · headphones" sub="Income · Card" amt="+₹1,499" right={<span className="rounded-full bg-goodBg px-2 py-0.5 text-[10px] font-semibold text-good">INCOME</span>} />
    </div>
  </HistoryShell>
);

/** B. Own tab, like Lend: History | Lend | Income. Spends list stays clean. */
export const History_B_IncomeTab = () => (
  <HistoryShell
    tabs={
      <div className="mt-3 flex w-fit rounded-full bg-tint p-0.5 text-[12px] font-medium">
        {['History', 'Lend', 'Income'].map((t) => (
          <span key={t} className={`rounded-full px-4 py-1.5 ${t === 'Income' ? 'bg-good text-white' : 'text-soft'}`}>{t}</span>
        ))}
      </div>
    }
  >
    <div className="rounded-[18px] bg-goodBg px-4 py-3">
      <Label>Income this month</Label>
      <p className="num text-[28px] text-good">{fmt(9499)}</p>
    </div>
    <div className="mt-2 divide-y divide-line">
      <Row title="Freelance payout" sub="7 Nov · UPI" amt="+₹8,000" />
      <Row title="Refund · headphones" sub="6 Nov · Card" amt="+₹1,499" />
    </div>
  </HistoryShell>
);

/** C. Day header carries net: "+₹7,670 net" with income rows grouped on top of the day. */
export const History_C_DayNet = () => (
  <HistoryShell>
    <div className="flex items-baseline justify-between">
      <Label>Fri 7 Nov</Label>
      <p className="num text-[13px] font-medium text-good"><Down /> +₹7,670 net</p>
    </div>
    <div className="mt-1 rounded-[16px] bg-goodBg px-3">
      <Row title="Freelance payout" sub="Money in" amt="+₹8,000" />
    </div>
    <div className="divide-y divide-line">
      <Row title="Lunch" sub="Food · Eating out" amt="−₹240" />
      <Row title="Auto" sub="Transport · Cash" amt="−₹90" />
    </div>
    <div className="mt-4 flex items-baseline justify-between"><Label>Thu 6 Nov</Label><p className="num text-[13px] text-soft">−₹820 net</p></div>
    <div className="divide-y divide-line"><Row title="Groceries" sub="Food" amt="−₹820" /></div>
  </HistoryShell>
);

/* =====================================================================================
 * 4. INSIGHTS: where income appears next to spending
 * ===================================================================================== */

const InsightsShell = ({ children }: { children: ReactNode }) => (
  <div className={phone}>
    <div className="px-6 pt-14">
      <h1 className="font-display text-[28px] font-semibold text-ink">Insights</h1>
      <p className="text-[13px] text-soft">November</p>
    </div>
    <div className="flex-1 overflow-hidden px-6 pt-4">{children}</div>
    <Tabs active="Insights" />
  </div>
);

/** A. One extra stat tile: "Income added" beside Spent / Saved. */
export const Insights_A_StatTile = () => (
  <InsightsShell>
    <div className="grid grid-cols-2 gap-2">
      {[
        { l: 'Spent', v: fmt(9600), c: 'text-ink', bg: 'bg-tint' },
        { l: 'Income added', v: '+' + fmt(8000), c: 'text-good', bg: 'bg-goodBg' },
        { l: 'Saved', v: fmt(5000), c: 'text-ink', bg: 'bg-tint' },
        { l: 'Avg / day', v: fmt(420), c: 'text-ink', bg: 'bg-tint' },
      ].map((t) => (
        <div key={t.l} className={`rounded-[18px] p-4 ${t.bg}`}>
          <Label>{t.l}</Label>
          <p className={`num mt-1 text-[24px] ${t.c}`}>{t.v}</p>
        </div>
      ))}
    </div>
    <p className="mt-4 text-[12px] text-soft">Income raises your daily amount. It is never counted as spending in the charts below.</p>
  </InsightsShell>
);

/** B. In vs Out bars for the month: simple two-bar comparison, plus source split. */
export const Insights_B_InVsOut = () => (
  <InsightsShell>
    <Label>Money in vs out</Label>
    <div className="mt-3 space-y-3">
      {[
        { l: 'In', v: 38000, w: '100%', c: 'bg-good' },
        { l: 'Out', v: 14600, w: '38%', c: 'bg-ink' },
      ].map((b) => (
        <div key={b.l}>
          <div className="flex justify-between text-[13px]"><span className="text-soft">{b.l}</span><span className="num text-ink">{fmt(b.v)}</span></div>
          <div className="mt-1 h-3 rounded-full bg-tint"><div className={`h-3 rounded-full ${b.c}`} style={{ width: b.w }} /></div>
        </div>
      ))}
    </div>
    <div className="mt-6"><Label>Where income came from</Label></div>
    <div className="mt-2 flex h-3 overflow-hidden rounded-full">
      <div className="bg-good" style={{ width: '79%' }} />
      <div className="bg-good/60" style={{ width: '21%' }} />
    </div>
    <div className="num mt-2 flex justify-between text-[12px] text-soft"><span>Salary {fmt(30000)}</span><span>Freelance {fmt(8000)}</span></div>
  </InsightsShell>
);

/** C. Daily chart overlay: teal markers on days money came in, line shows allowance stepping up. */
export const Insights_C_ChartMarkers = () => {
  const bars = [40, 55, 30, 62, 48, 35, 70, 52, 44, 38, 60, 46];
  return (
    <InsightsShell>
      <Label>Daily spend · income days marked</Label>
      <div className="relative mt-4 flex h-44 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="relative flex-1">
            {i === 6 && <span className="absolute -top-6 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-good text-white"><Plus s={10} /></span>}
            <div className={`w-full rounded-t-md ${i === 6 ? 'bg-good/30' : 'bg-ink/80'}`} style={{ height: `${h * 2}px` }} />
          </div>
        ))}
      </div>
      <Note tone="good" className="mt-6">
        <b>7 Nov · Freelance +{fmt(8000)}</b>
        <br />
        Your daily amount stepped up from {fmt(perDay(0))} to {fmt(perDay(8000))}.
      </Note>
    </InsightsShell>
  );
};

/* =====================================================================================
 * 5. CLOSE THE DAY: the recap must say what came in
 * ===================================================================================== */

const CloseShell = ({ children }: { children: ReactNode }) => (
  <div className={`${phone} px-6 pb-6 pt-14`}>
    <h1 className="font-display text-[26px] font-semibold text-ink">Close the day</h1>
    <div className="flex flex-1 flex-col">{children}</div>
    <PrimaryButton>Close day</PrimaryButton>
  </div>
);

/** A. Recap line: a teal "Income +₹8,000" line above the spent total. */
export const Close_A_RecapLine = () => (
  <CloseShell>
    <div className="mt-6 divide-y divide-line">
      <Row title="Lunch" sub="Food" amt="₹240" />
      <Row title="Auto" sub="Transport" amt="₹90" />
    </div>
    <div className="num mt-4 space-y-1 text-[14px]">
      <div className="flex justify-between text-good"><span>Income today</span><span>+{fmt(8000)}</span></div>
      <div className="flex justify-between"><span className="text-soft">Spent today</span><span className="text-ink">{fmt(330)}</span></div>
    </div>
    <p className="num mt-6 text-center text-[13px] text-soft">Tomorrow you can spend</p>
    <div className="text-center"><HugeNumber value={perDay(8000) + 20} size={56} /></div>
  </CloseShell>
);

/** B. Banner on top: a teal card explains how income changed tomorrow's number. */
export const Close_B_TopBanner = () => (
  <CloseShell>
    <Note tone="good" className="mt-6">
      <b>+{fmt(8000)} Freelance</b> came in today. It&apos;s spread over {DAYS_LEFT} days, so each day gets <b className="num">{fmt(Math.round(8000 / DAYS_LEFT))}</b> more.
    </Note>
    <div className="mt-3 divide-y divide-line">
      <Row title="Lunch" sub="Food" amt="₹240" />
      <Row title="Auto" sub="Transport" amt="₹90" />
    </div>
    <div className="flex-1" />
    <p className="num text-center text-[13px] text-soft">Tomorrow you can spend</p>
    <div className="text-center"><HugeNumber value={perDay(8000) + 20} size={56} /></div>
  </CloseShell>
);

/** C. Before → after number: the recap leads with the allowance change, income is the reason. */
export const Close_C_BeforeAfter = () => (
  <CloseShell>
    <div className="mt-8 rounded-[24px] bg-goodBg px-5 py-6 text-center">
      <Label>Tomorrow</Label>
      <p className="num mt-2 text-[44px] leading-none text-ink">{fmt(perDay(8000) + 20)}</p>
      <p className="num mt-2 text-[13px] text-soft"><span className="line-through">{fmt(perDay(0) + 20)}</span> · because of <b className="text-good">+{fmt(8000)} income</b></p>
    </div>
    <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Today&apos;s entries</p>
    <div className="divide-y divide-line">
      <Row title="Freelance payout" sub="Income" amt="+₹8,000" />
      <Row title="Lunch" sub="Food" amt="−₹240" />
      <Row title="Auto" sub="Transport" amt="−₹90" />
    </div>
  </CloseShell>
);
