'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { inr } from '@/lib/format';
import { moneyToLiveOn, type PlanInput } from '@/lib/budget';
import { cycleEndDate, formatWithWeekday, todayISO } from '@/lib/dates';

export function PlanSummary({
  plan,
  onBack,
  onStart,
  busy,
}: {
  plan: PlanInput;
  onBack: () => void;
  onStart: () => void;
  busy?: boolean;
}) {
  const live = moneyToLiveOn(plan);
  const end = formatWithWeekday(cycleEndDate(todayISO(), plan.monthLength));
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
        <p className="mt-4 text-[14px] text-soft">Your money to live on</p>
        <HugeNumber value={live} className="mt-1" />
        <p className="mt-3 text-body text-soft">
          About {inr(live / plan.monthLength)} a day for the next {plan.monthLength}{' '}
          {plan.monthLength === 1 ? 'day' : 'days'}, until {end}.
        </p>
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
        <Note tone="good" className="mt-6">
          Bills and savings are already set aside, so you won&apos;t log them again.
        </Note>
      </div>
      <PrimaryButton onClick={onStart} disabled={busy}>
        Start my month
      </PrimaryButton>
    </main>
  );
}
