'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { inr } from '@/lib/format';
import { moneyToLiveOn, type PlanInput } from '@/lib/budget';
import { addDays, cycleEndDate, formatShort, formatWithWeekday, todayISO } from '@/lib/dates';
import type { Cycle } from '@/db/schema';

export function PlanSummary({
  plan,
  activeCycle,
  actionLabel,
  onBack,
  onStart,
  busy,
  startDate,
  onStartDateChange,
}: {
  plan: PlanInput;
  activeCycle?: Cycle;
  actionLabel?: string;
  onBack: () => void;
  onStart: () => void;
  busy?: boolean;
  /** New cycles only: chosen start date (today … 7 days back). */
  startDate?: string;
  onStartDateChange?: (iso: string) => void;
}) {
  const live = moneyToLiveOn(plan);
  const isEditing = !!activeCycle && activeCycle.currentDay > 0;
  const alreadySpent = isEditing ? Math.max(0, activeCycle.planAmount - activeCycle.pool) : 0;
  const remainingPool = isEditing ? live - alreadySpent : live;
  const daysRemaining = isEditing
    ? Math.max(1, plan.monthLength - activeCycle.currentDay + 1)
    : plan.monthLength;
  const dailyAmount = Math.max(0, Math.round(remainingPool / daysRemaining));
  const end = formatWithWeekday(
    cycleEndDate(isEditing ? activeCycle.startDate : (startDate ?? todayISO()), plan.monthLength),
  );

  const rows = [
    { label: 'Income', value: plan.income, items: undefined },
    { label: 'Bills', value: plan.bills, items: plan.billItems },
    { label: 'Savings and investments', value: plan.savings, items: plan.savingsItems },
  ] as const;

  return (
    <main className="flex h-full flex-col px-6 pb-6 pt-4">
      <IconButton label="Back" onClick={onBack} className="-ml-3 self-start">
        <BackIcon />
      </IconButton>
      <div className="flex-1 overflow-y-auto">
        <p className="mt-4 text-[14px] text-soft">
          {isEditing ? 'Remaining money to live on' : 'Your money to live on'}
        </p>
        <HugeNumber value={isEditing ? remainingPool : live} className="mt-1" />
        {isEditing ? (
          <p className="mt-3 text-body text-soft">
            About {inr(dailyAmount)} a day for the remaining {daysRemaining}{' '}
            {daysRemaining === 1 ? 'day' : 'days'} (Day {activeCycle.currentDay}/{plan.monthLength}), until {end}.
          </p>
        ) : (
          <p className="mt-3 text-body text-soft">
            About {inr(Math.round(live / plan.monthLength))} a day for the next {plan.monthLength}{' '}
            {plan.monthLength === 1 ? 'day' : 'days'}, until {end}.
          </p>
        )}
        <dl className="mt-8 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.label} className="py-3.5">
              <div className="flex items-center justify-between">
                <dt className="text-[15px] text-soft">{r.label}</dt>
                <dd className="num text-[20px] text-ink">{inr(r.value)}</dd>
              </div>
              {r.items && r.items.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="rounded-full bg-tint px-2.5 py-0.5 text-[12px] text-soft"
                    >
                      {it.name} <span className="num text-ink">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>
        {isEditing ? (
          <div className="mt-6 rounded-note border border-line bg-tint/80 px-4 py-3 text-[13px] leading-relaxed text-soft">
            <span className="font-semibold text-ink">Note:</span> Your day will not restart. Differences from previous days are divided equally across each remaining day.
          </div>
        ) : (
          <>
            {startDate && onStartDateChange && (
              <div className="mt-6">
                <p className="text-[14px] text-soft">Start date</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => {
                    const iso = addDays(todayISO(), -i);
                    const on = iso === startDate;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => onStartDateChange(iso)}
                        aria-pressed={on}
                        className={`rounded-full px-3 py-1.5 text-[13px] ${on ? 'bg-ink text-white' : 'bg-tint text-soft'}`}
                      >
                        {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatShort(iso)}
                      </button>
                    );
                  })}
                </div>
                {startDate !== todayISO() && (
                  <p className="mt-2 text-[12px] leading-relaxed text-soft">
                    Days since {formatShort(startDate)} will be caught up next, so you can enter a rough total for them.
                  </p>
                )}
              </div>
            )}
          <div className="mt-6 rounded-note border border-line bg-tint/80 px-4 py-3 text-[13px] leading-relaxed text-soft">
            Bills and savings are already set aside, so you won&apos;t log them again.
          </div>
          </>
        )}
      </div>
      <PrimaryButton onClick={onStart} disabled={busy}>
        {actionLabel ?? (isEditing ? 'Save updated plan' : 'Start my month')}
      </PrimaryButton>
    </main>
  );
}
