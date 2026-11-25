'use client';
import { weekdayStats, MIN_CLOSED_DAYS, biggestSpends, categoryTotals, type DayPoint, type InsightEntry } from '@/lib/insights';
import { compactINR } from '@/lib/history';
import { formatWithWeekday } from '@/lib/dates';
import { inr1 } from '@/lib/format';

const HOT = '#D98324';
type Spend = InsightEntry & { date: string };

const Label = ({ children }: { children: string }) => (
  <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{children}</p>
);
const tile = 'rounded-note border border-line bg-white p-3.5';

/** "At a glance": what stands out this month (whole month, ignores the page focus). */
export function AtAGlance({ entries, days, startDate, planAmount, totalDays, colorOf }: {
  entries: Spend[]; days: DayPoint[]; startDate: string; planAmount: number; totalDays: number; colorOf: Record<string, string>;
}) {
  const closed = days.filter((d) => d.status === 'closed' || d.status === 'estimated');
  const slices = categoryTotals(entries);
  const top = slices[0];
  const big = biggestSpends(entries, null, 1)[0] as Spend | undefined;
  if (!top || !big || closed.length < MIN_CLOSED_DAYS) {
    return <p className="text-body text-soft">Close a few days to see this.</p>;
  }
  const perDay = planAmount / totalDays;
  const { stats, usual } = weekdayStats(days, startDate);
  const wd = stats.filter((s) => s.count > 0);
  const priciest = [...wd].sort((a, b) => b.avg - a.avg)[0];
  const max = Math.max(...wd.map((s) => s.avg), 1);
  const over = closed.filter((d) => d.totalSpent > perDay).length;
  const tip = priciest.avg > usual * 1.15
    ? `${priciest.name} are your priciest day, about ${inr1(priciest.avg - usual)} above a usual day. Moving one outing to a weekday could save around ${inr1((priciest.avg - usual) * 4)} a month.`
    : `Spending is even across the week. ${top.name} is where any saving would come from.`;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={tile}>
          <Label>Top category</Label>
          <p className="mt-1 flex items-center gap-1.5 text-[18px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf[top.name] }} />{top.name}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint">
            <div className="h-full rounded-full" style={{ width: `${top.pct}%`, background: colorOf[top.name] }} />
          </div>
          <p className="num mt-1.5 text-[12px] text-soft">{Math.round(top.pct)}% · {compactINR(top.total)}</p>
        </div>
        <div className={tile}>
          <Label>Priciest day</Label>
          <p className="mt-1 text-[18px] font-semibold text-ink">{priciest.name}</p>
          <div className="mt-2 flex h-6 items-end gap-0.5" aria-hidden="true">
            {stats.map((s) => (
              <div key={s.wd} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (s.avg / max) * 100)}%`, background: s === priciest ? HOT : '#E4E4E0' }} />
            ))}
          </div>
          <p className="num mt-1.5 text-[12px] text-soft">avg {inr1(priciest.avg)}</p>
        </div>
        <div className={tile}>
          <Label>Biggest spend</Label>
          <p className="num mt-1 text-[20px] font-semibold text-ink">{inr1(big.amount)}</p>
          <p className="mt-0.5 truncate text-[12px] text-soft">{big.label}</p>
          <p className="text-[12px] text-faint">{formatWithWeekday(big.date)}</p>
        </div>
        <div className={tile}>
          <Label>Over the day's amount</Label>
          <p className="num mt-1 text-[20px] font-semibold text-ink">
            {over} <span className="text-[13px] font-normal text-soft">of {closed.length} days</span>
          </p>
          <div className="mt-2 flex gap-0.5" aria-hidden="true">
            {closed.map((d) => (
              <span key={d.day} className="h-2 flex-1 rounded-sm" style={{ background: d.totalSpent > perDay ? HOT : '#CFE3D6' }} />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 rounded-note bg-tint px-3.5 py-2.5 text-[13px] leading-snug text-ink">
        <span className="font-semibold">Try this: </span>{tip}
      </p>
    </>
  );
}
