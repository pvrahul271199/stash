import type { Meta } from '@storybook/react-vite';
import { MonthEndView } from '@/components/screens/MonthEnd';
import type { Entry, Plan } from '@/db/schema';
import type { DerivedCycle } from '@/lib/period';

/**
 * The real month-end recap (components/screens/MonthEnd.tsx, pure `MonthEndView`). A look back with insights: what was left,
 * where it went, and a few things worth noticing. No decisions, one Continue button.
 * Shown once after a month in which the user logged on its last day has turned over.
 */
const meta: Meta = { title: 'Month end (recap)', parameters: { layout: 'centered' } };
export default meta;

const plan = { income: 80000, bills: 25000, savings: 9000, monthLength: 30 } as unknown as Plan;
const cycle = (over: Record<string, unknown>) =>
  ({ monthStart: '2026-11-01', startDate: '2026-11-01', totalDays: 30, currentDay: 31, planAmount: 46000, pool: 0, fromSavingsTotal: 0, days: [], ...over }) as unknown as DerivedCycle;

const e = (day: number, amount: number, category: string, label = category, over: Partial<Entry> = {}): Entry => ({
  id: `${day}-${label}-${amount}`, cycleId: '', day, date: `2026-11-${String(day).padStart(2, '0')}`, amount, label, category,
  subcategory: null, event: null, payment: 'UPI', note: null, fromSavings: false, adjustsPool: true, isEstimate: false, hour: 13, createdAt: day, ...over,
});

const spends: Entry[] = [
  ...[2, 5, 9, 12, 16, 19, 23, 26, 29].map((d) => e(d, 180 + d * 7, 'Food', 'Chai')),
  e(1, 9000, 'Rent', 'Rent'),
  e(7, 1800, 'Shopping', 'Shoes'),
  e(8, 600, 'Transport', 'Cab'),
  e(14, 2400, 'Fun', 'Movie night'),
  e(15, 5200, 'Travel', 'Goa flight', { event: 'Goa Trip' }),
  e(16, 3100, 'Travel', 'Hotel', { event: 'Goa Trip' }),
  e(21, 900, 'Health', 'Pharmacy'),
  e(25, 700, 'Other', 'Gift'),
  e(28, 1500, 'Fun', 'Concert', { fromSavings: true }),
];

const Frame = ({ c, entries }: { c: DerivedCycle; entries: Entry[] }) => (
  <div className="relative h-[780px] w-[390px] overflow-hidden rounded-phone border border-line bg-white shadow-sm">
    <MonthEndView cycle={c} plan={plan} entries={entries} onDone={() => {}} />
  </div>
);

export const MoneyLeft = () => <Frame c={cycle({ pool: 14200 })} entries={spends} />;
export const MostlySpent = () => <Frame c={cycle({ pool: 1800 })} entries={spends} />;
export const NothingLeft = () => <Frame c={cycle({ pool: 0 })} entries={spends} />;
export const OverspentAndFromSavings = () => <Frame c={cycle({ pool: -3200, fromSavingsTotal: 1500 })} entries={spends} />;
export const NoSpendsLogged = () => <Frame c={cycle({ pool: 46000 })} entries={[]} />;
