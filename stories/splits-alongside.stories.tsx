import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Splits next to Spend, Income and Lend: four ways to place it. Mock data, today = 26 Nov 2026.
 * Rule kept in every design (CLAUDE.md, "Splits"): a group bill never changes today's amount, the pool or Insights.
 * The only money that moves the daily amount is your own spend, income and write-offs. Splits is a separate place that
 * shows what you owe and are owed by friends, so it sits beside the budget, not inside it.
 */
const meta: Meta = { title: 'Money / Splits alongside (4 designs)', parameters: { layout: 'centered' } };
export default meta;

const Phone = ({ children }: { children: ReactNode }) => (
  <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-[44px] border border-line bg-white shadow-sm">{children}</div>
);
const TabBar = ({ on }: { on: 'Today' | 'History' | 'Splits' | 'Insights' | 'You' }) => (
  <nav className="flex items-end justify-around border-t border-line bg-white px-2 pb-6 pt-2">
    {(['Today', 'History', 'Log', 'Splits', 'Insights'] as const).map((k) => k === 'Log'
      ? <span key={k} className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-[24px] text-white shadow-md">+</span>
      : <span key={k} className={`flex flex-col items-center gap-1 text-[11px] ${k === on ? 'font-semibold text-ink' : 'text-faint'}`}><span className={`h-1 w-1 rounded-full ${k === on ? 'bg-ink' : 'bg-transparent'}`} />{k}</span>)}
  </nav>
);
const Allowance = () => (
  <div className="px-6 pt-4">
    <p className="text-[12px] text-soft">Today you can spend</p>
    <p className="num mt-1 text-[56px] leading-none text-ink">₹1,240</p>
    <p className="mt-2 text-[12px] text-soft">₹18,600 left for 4 more days · ₹420 spent today</p>
  </div>
);

/** S1. Its own tab: Splits is a tab in the bar, between Log and Insights. Budget screens stay exactly as they are. */
export const S1_OwnTab = () => (
  <Phone>
    <header className="px-6 pt-7"><p className="text-[12px] text-soft">Thursday, 26 Nov</p></header>
    <Allowance />
    <div className="mx-6 mt-6 rounded-[20px] bg-tint p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Splits</p>
      <p className="mt-1 text-[14px] text-ink">Kunyis Trading · you owe <b className="num">₹5,745</b></p>
      <p className="text-[12px] text-soft">Open Splits to settle</p>
    </div>
    <div className="flex-1" />
    <TabBar on="Today" />
  </Phone>
);

/** S2. A quiet card under the allowance: "Shared with friends" sits below the number and says plainly it is not in it. */
export const S2_SeparateCard = () => (
  <Phone>
    <header className="px-6 pt-7"><p className="text-[12px] text-soft">Thursday, 26 Nov</p></header>
    <Allowance />
    <div className="mx-6 mt-5 flex items-center justify-between rounded-[18px] border border-dashed border-line px-4 py-3">
      <div><p className="text-[13px] font-medium text-ink">Shared with friends</p><p className="text-[11px] text-faint">Not part of today's amount</p></div>
      <span className="num text-[14px] font-semibold text-warm">−₹5,745</span>
    </div>
    <div className="mx-6 mt-3 flex items-center justify-between rounded-[18px] border border-line px-4 py-3">
      <div><p className="text-[13px] font-medium text-ink">Lent out</p><p className="text-[11px] text-faint">2 people, due soon</p></div>
      <span className="num text-[14px] font-semibold text-ink">₹5,000</span>
    </div>
    <div className="flex-1" />
    <TabBar on="Today" />
  </Phone>
);

/** S3. The log sheet grows a fourth segment. Split opens the group picker and records a group bill, never a budget spend. */
export const S3_LogSegments = () => (
  <Phone>
    <header className="flex items-center justify-between px-6 pt-7"><p className="text-[14px] font-semibold text-ink">Add</p><span className="text-[13px] text-soft">Cancel</span></header>
    <div className="mx-6 mt-4 grid grid-cols-4 rounded-full bg-tint p-0.5 text-[12px] font-medium">
      {['Spend', 'Lend', 'Income', 'Split'].map((k) => <span key={k} className={`flex h-9 items-center justify-center rounded-full ${k === 'Split' ? 'bg-[#2B5083] text-white' : 'text-soft'}`}>{k}</span>)}
    </div>
    <div className="px-6 pt-8">
      <p className="text-[12px] text-soft">Split with a group</p>
      <p className="num mt-1 text-[48px] leading-none text-ink">₹1,200</p>
      <div className="mt-6 rounded-[18px] border border-line p-4"><p className="text-[12px] text-soft">Group</p><p className="text-[15px] font-medium text-ink">Kunyis Trading</p></div>
      <div className="mt-3 rounded-[18px] border border-line p-4"><p className="text-[12px] text-soft">Paid by</p><p className="text-[15px] font-medium text-ink">You, split equally with 2 others</p></div>
      <p className="mt-4 text-[12px] leading-relaxed text-faint">This goes to the group's balances. Your daily amount does not change.</p>
    </div>
    <div className="flex-1" />
    <div className="px-6 pb-8"><button className="h-12 w-full rounded-full bg-ink text-[15px] font-semibold text-white">Add to group</button></div>
  </Phone>
);

/** S4. One money hub: Budget | Lend | Splits | Income as segments, with a summary row for each; the Splits line is labelled "outside budget". */
export const S4_MoneyHub = () => (
  <Phone>
    <header className="px-6 pt-7"><h1 className="font-display text-[26px] font-semibold text-ink">Money</h1><p className="text-[12px] text-soft">November 2026</p></header>
    <div className="px-6 pt-4"><div className="grid grid-cols-4 rounded-full bg-tint p-0.5 text-[11px] font-medium">{['Budget', 'Lend', 'Splits', 'Income'].map((k) => <span key={k} className={`flex h-8 items-center justify-center rounded-full ${k === 'Budget' ? 'bg-ink text-white' : 'text-soft'}`}>{k}</span>)}</div></div>
    <div className="mx-6 mt-5 divide-y divide-line rounded-[20px] border border-line">
      {[
        ['Budget left', '₹18,600', 'Your daily amount is built from this'],
        ['Lent out', '₹5,000', 'To get back, not spending'],
        ['Income added', '+₹3,000', 'Money in after the plan'],
        ['Splits', '−₹5,745', 'Friends · outside the budget'],
      ].map(([t, v, d]) => (
        <div key={t} className="flex items-center justify-between px-4 py-3.5">
          <div><p className="text-[14px] font-medium text-ink">{t}</p><p className="text-[11px] text-faint">{d}</p></div>
          <span className="num text-[15px] font-semibold text-ink">{v}</span>
        </div>))}
    </div>
    <div className="mx-6 mt-4 rounded-[18px] bg-tint p-4 text-[12px] leading-relaxed text-soft">Splits has its own tab inside Money. Nothing here changes what you can spend today.</div>
    <div className="flex-1" />
    <TabBar on="Splits" />
  </Phone>
);
