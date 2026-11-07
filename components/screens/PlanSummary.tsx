'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { HugeNumber } from '../ui/HugeNumber';
import { inr } from '@/lib/format';
import { moneyToLiveOn, type PlanInput } from '@/lib/budget';
import { daysBetween, formatWithWeekday, todayISO } from '@/lib/dates';
import { clampStartDay, periodFor, type DerivedCycle } from '@/lib/period';
import { colors } from '@/theme/tokens';

const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-soft';
/** Staggered entrance: each block rises in a little after the one above it. */
const rise = (i: number) => ({ animationDelay: `${80 + i * 90}ms` });

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
  // The month is derived from the start day: it ends the day before the next one.
  const period = periodFor(startDay, today);
  const daysRemaining = Math.max(1, daysBetween(from, period.end) + 1);
  const dailyAmount = Math.max(0, Math.round(remainingPool / daysRemaining));
  const startIdx = Math.min(period.totalDays - 1, Math.max(0, daysBetween(period.start, from)));

  // Where the income goes, as shares of one bar.
  const income = Math.max(plan.income, 1);
  const parts = [
    { key: 'bills', label: 'Bills', value: plan.bills, color: colors.warm, items: plan.billItems },
    { key: 'savings', label: 'Savings and investments', value: plan.savings, color: colors.good, items: plan.savingsItems },
    { key: 'live', label: 'To live on', value: live, color: colors.ink, items: undefined },
  ];

  return (
    <main className="relative flex h-full flex-col overflow-hidden px-5 pb-4 pt-2">
      {/* soft glow behind the number */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'radial-gradient(90% 70% at 50% -5%, #E7E3FA 0%, rgba(255,255,255,0) 70%)' }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-[#EDEAFB] opacity-70 blur-3xl" />

      <IconButton label="Back" onClick={onBack} className="relative z-10 -ml-3 self-start">
        <BackIcon />
      </IconButton>

      <div className="relative z-10 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-2">
        {/* hero */}
        <p className={`${eyebrow} stash-rise mt-1`} style={rise(0)}>
          {isEditing ? 'Remaining money to live on' : 'Your money to live on'}
        </p>
        <div className="stash-rise" style={rise(1)}>
          <HugeNumber value={isEditing ? remainingPool : live} size={44} className="mt-0.5" />
        </div>
        {/* the month ahead */}
        <section
          className="stash-rise mt-4 rounded-[18px] border border-line bg-white/90 p-3 shadow-sm backdrop-blur"
          style={rise(4)}
          aria-label="Your month"
        >
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>The month ahead</p>
            <p className="num text-[11px] text-soft">
              {daysRemaining} of {period.totalDays} days
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-x-1 gap-y-1.5" aria-hidden="true">
            {Array.from({ length: period.totalDays }, (_, i) => {
              const gone = i < startIdx;
              const first = i === startIdx;
              return (
                <li key={i} className="flex justify-center">
                  <span
                    className="stash-grow block aspect-square w-full max-w-[11px] rounded-full"
                    style={{
                      animationDelay: `${420 + i * 16}ms`,
                      background: gone ? colors.line : first ? colors.good : colors.ink,
                      opacity: gone ? 0.8 : 1,
                      boxShadow: first ? `0 0 0 2px ${colors.goodBg}` : undefined,
                    }}
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-start justify-between text-[11px]">
            <span>
              <span className="block font-semibold text-ink">{formatWithWeekday(from)}</span>
              <span className="text-faint">{isEditing ? 'Today' : from === today ? 'You start today' : 'You start here'}</span>
            </span>
            <span className="text-right">
              <span className="block font-semibold text-ink">{formatWithWeekday(period.end)}</span>
              <span className="text-faint">Last day</span>
            </span>
          </div>
        </section>

        {/* where the money goes */}
        <section
          className="stash-rise mt-2.5 rounded-[18px] border border-line bg-white/90 p-3 shadow-sm backdrop-blur"
          style={rise(5)}
          aria-label="Where your income goes"
        >
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>Where it goes</p>
            <p className="num text-[12px] text-soft">
              of {inr(plan.income)} <span className="text-faint">income</span>
            </p>
          </div>
          <div className="mt-2.5 flex h-2 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
            {parts
              .filter((p) => p.value > 0)
              .map((p) => (
                <span key={p.key} className="h-full rounded-full" style={{ width: `${Math.max(2, (p.value / income) * 100)}%`, background: p.color }} />
              ))}
          </div>
          <dl className="mt-2 divide-y divide-line">
            {parts.map((p) => (
              <div key={p.key} className="min-w-0 py-1.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-[13px] text-soft">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                    {p.label}
                  </dt>
                  <dd className={`num text-[15px] ${p.value > 0 ? 'text-ink' : 'text-faint'}`}>{inr(p.value)}</dd>
                </div>
                {p.items && p.items.length > 0 && (
                  <ul className="mt-1.5 flex min-w-0 flex-wrap gap-1 pl-[18px]">
                    {p.items.map((it, i) => (
                      <li key={`${it.name}-${i}`} className="max-w-full truncate rounded-full bg-tint px-2 py-0.5 text-[11px] text-soft">
                        {it.name} <span className="num text-ink">{inr(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </dl>
        </section>

        {isEditing && (
          <div className="stash-rise mt-3 rounded-[18px] border border-line bg-white/90 px-4 py-3 text-[13px] leading-relaxed text-soft" style={rise(6)}>
            <span className="font-semibold text-ink">Note:</span> Your month will not restart. What earlier days used stays used; the rest is spread equally over the days left.
          </div>
        )}
      </div>

      <div className="stash-rise relative z-10 pb-3 pt-2 text-center" style={rise(6)}>
        <p className="flex items-baseline justify-center gap-2">
          <span className="text-[14px] text-soft">You can spend</span>
          <span className="num text-[30px] font-semibold leading-none text-good">{inr(dailyAmount)}</span>
          <span className="text-[14px] text-soft">a day</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-soft">
          For the next{' '}
          <span className="font-semibold text-ink">
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
          </span>
          , until {formatWithWeekday(period.end)}.
        </p>
      </div>

      <div className="relative z-10">
        <PrimaryButton onClick={onStart} disabled={busy}>
          {actionLabel ?? (isEditing ? 'Save updated plan' : 'Start my month')}
        </PrimaryButton>
      </div>
    </main>
  );
}
