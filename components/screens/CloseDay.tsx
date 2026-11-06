'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { removeEntry } from '@/db/queries';
import type { Entry } from '@/db/schema';
import { inr, num } from '@/lib/format';
import { closeDay, spentToday, todayAllowance, type CycleState } from '@/lib/budget';

/**
 * "Close the day", the only screen of the flow: today's total against today's amount, what tomorrow will be and why,
 * and the entries. One tap really closes the day (db/queries `closeToday`) and the app moves on at once.
 */
export function CloseDay({
  entries,
  cycle,
  onBack,
  onAddMore,
  onClose,
  busy,
}: {
  entries: Entry[];
  cycle: CycleState;
  onBack: () => void;
  onAddMore: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const spent = spentToday(entries);
  const allowance = todayAllowance(cycle);
  const over = spent > allowance;
  const pct = allowance > 0 ? Math.min(100, Math.round((spent / allowance) * 100)) : spent > 0 ? 100 : 0;
  const { tomorrowAllowance, delta, kind } = closeDay(cycle, spent);
  const daysAfter = Math.max(1, cycle.totalDays - cycle.currentDay);
  const days = `${daysAfter} ${daysAfter === 1 ? 'day' : 'days'}`;
  const change = inr(Math.abs(Math.round(delta)));
  const note = allowance <= 0
    ? "This month's spending money is used up."
    : kind === 'onplan'
      ? 'Right on plan. Tomorrow stays the same.'
      : kind === 'less'
        ? `Kept ${inr(allowance - spent)} today, so each of the next ${days} gets a bit more.`
        : `Over by ${inr(spent - allowance)}, so each of the next ${days} gives a little.`;
  const lastDay = cycle.currentDay >= cycle.totalDays;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Close the day"
      className="absolute inset-0 z-30 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      <IconButton label="Back" onClick={onBack} className="-ml-3 self-start">
        <BackIcon />
      </IconButton>

      <div className="flex-1 overflow-y-auto">
        <p className="mt-2 text-[14px] text-soft">Spent today</p>
        <div className="flex items-baseline gap-2">
          <p className="num text-[44px] leading-[1.05] text-ink">
            <span className="text-faint">₹</span>
            {num(spent)}
          </p>
          <p className="num text-[14px] text-faint">of {inr(allowance)}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tint" role="img" aria-label={`${pct}% of today's amount`}>
          <div className={`h-full rounded-full ${over ? 'bg-warm' : 'bg-good'}`} style={{ width: `${pct}%` }} />
        </div>

        {lastDay ? (
          <div className="mt-4 rounded-[18px] bg-tint px-4 py-3 text-[14px] leading-snug text-ink">
            This is the last day of your month. A new one starts tomorrow.
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-line bg-white px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow</p>
              {kind !== 'onplan' && allowance > 0 && (
                <span className={`num text-[13px] font-semibold ${kind === 'less' ? 'text-good' : 'text-warm'}`}>
                  {kind === 'less' ? '+' : '−'}
                  {change} a day
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              {kind !== 'onplan' && allowance > 0 && (
                <>
                  <p className="num text-[18px] text-faint line-through decoration-faint/60">{inr(allowance)}</p>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-faint" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
              <p className="num text-[34px] leading-none text-ink">{inr(tomorrowAllowance)}</p>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-soft">{note}</p>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="mt-6 text-body text-soft">Nothing logged today. That&apos;s fine.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {e.label}
                    {e.fromSavings && <span className="ml-2 text-[12px] font-normal text-warm">from savings</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-faint">
                    {[e.subcategory ?? e.category, e.payment, e.event].filter(Boolean).join(' · ')}
                  </p>
                  {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
                </div>
                <p className="num text-[17px] text-ink">{inr(e.amount)}</p>
                <button
                  aria-label={`Remove ${e.label} ${inr(e.amount)}`}
                  onClick={() => removeEntry(e.id)}
                  className="flex h-11 w-9 items-center justify-center text-faint"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onAddMore}
        className="mb-3 mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-full bg-tint text-[14px] font-medium text-ink transition-opacity active:opacity-70"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Paid cash or forgot something?
      </button>
      <PrimaryButton onClick={onClose} disabled={busy}>
        Close the day
      </PrimaryButton>
    </div>
  );
}
