'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { inr } from '@/lib/format';
import { moneyToLiveOn, type PlanInput } from '@/lib/budget';
import { addDays, daysBetween, formatWithWeekday, todayISO } from '@/lib/dates';
import { clampStartDay, periodFor, type DerivedCycle } from '@/lib/period';

export function PlanSummary({
  plan,
  activeCycle,
  actionLabel,
  onBack,
  onStart,
  busy,
  startDate,
}: {
  plan: PlanInput;
  activeCycle?: DerivedCycle;
  actionLabel?: string;
  onBack: () => void;
  onStart: () => void;
  busy?: boolean;
  /** New plans only: the day tracking starts on (chosen on the previous screen). */
  startDate?: string;
}) {
  const live = moneyToLiveOn(plan);
  const isEditing = !!activeCycle && activeCycle.currentDay > 0;
  const alreadySpent = isEditing ? Math.max(0, activeCycle.planAmount - activeCycle.pool) : 0;
  const remainingPool = isEditing ? live - alreadySpent : live;
  const today = todayISO();
  const from = isEditing ? today : (startDate ?? today);
  const startDay = clampStartDay(plan.periodStartDay ?? 1);
  // The month is derived from the salary day: it ends the day before the next one.
  const period = periodFor(startDay, today);
  const daysRemaining = Math.max(1, daysBetween(isEditing ? today : from, period.end) + 1);
  const dailyAmount = Math.max(0, Math.round(remainingPool / daysRemaining));
  const end = formatWithWeekday(period.end);
  const nextMonth = formatWithWeekday(addDays(period.end, 1));

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
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <p className="mt-3 text-[13px] text-soft">
          {isEditing ? 'Remaining money to live on' : 'Your money to live on'}
        </p>
        <HugeNumber value={isEditing ? remainingPool : live} size={56} className="mt-1" />
        {isEditing ? (
          <p className="mt-3 text-body text-soft">
            About {inr(dailyAmount)} a day for the remaining {daysRemaining}{' '}
            {daysRemaining === 1 ? 'day' : 'days'}, until {end}.
          </p>
        ) : (
          <p className="mt-3 text-body text-soft">
            About {inr(dailyAmount)} a day for the next {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}, until{' '}
            {end}. A fresh month starts on {nextMonth}.
          </p>
        )}
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0 py-3">
              <div className="flex items-center justify-between">
                <dt className="text-[14px] text-soft">{r.label}</dt>
                <dd className="num text-[18px] text-ink">{inr(r.value)}</dd>
              </div>
              {r.items && r.items.length > 0 && (
                <ul className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                  {r.items.map((it, i) => (
                    <li
                      key={`${it.name}-${i}`}
                      className="max-w-full truncate rounded-full bg-tint px-2 py-0.5 text-[11px] text-soft"
                    >
                      {it.name} <span className="num text-ink">{inr(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </dl>
        {isEditing && (
          <div className="mt-6 rounded-note border border-line bg-white px-4 py-3 text-[13px] leading-relaxed text-soft">
            <span className="font-semibold text-ink">Note:</span> Your month will not restart. What earlier days used stays used; the rest is spread equally over the days left.
          </div>
        )}
      </div>
      <PrimaryButton onClick={onStart} disabled={busy}>
        {actionLabel ?? (isEditing ? 'Save updated plan' : 'Start my month')}
      </PrimaryButton>
    </main>
  );
}
