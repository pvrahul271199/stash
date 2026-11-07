'use client';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { moveLeftoverToSavings, useSavedFromLeftovers } from '@/db/queries';
import type { Plan } from '@/db/schema';
import type { DerivedCycle } from '@/lib/period';
import { monthEnd } from '@/lib/budget';
import { inr } from '@/lib/format';
import { useToast } from '@/store/toast';
import { useAuth } from '@/lib/auth';
import { useSampleMode } from '@/lib/sampleMode';

/** Summary of the month that just ended. Your new month has already started; this only looks back. */
export function MonthEnd({
  cycle,
  plan,
  onDone,
  onCreateAccount,
}: {
  cycle: DerivedCycle;
  plan: Plan;
  onDone: () => void;
  /** Opens sign-in. Guests see a backup card; without it the card is hidden. */
  onCreateAccount?: () => void;
}) {
  const auth = useAuth();
  const inSample = useSampleMode();
  const showBackup = !!onCreateAccount && auth.status === 'guest' && !inSample;
  const toast = useToast((s) => s.show);
  const saved = useSavedFromLeftovers();
  const m = monthEnd(plan, cycle.planAmount, cycle);
  const rows: [string, number, boolean][] = [
    ['Spent on daily life', m.spentOnDaily, true],
    ['Saved and invested first', m.savedFirst, true],
    ['Taken from savings', m.fromSavings, m.fromSavings > 0],
    ['Left over', m.leftOver, true],
  ];

  return (
    <main className="flex h-full flex-col px-6 pb-6 pt-14">
      <div className="flex-1 overflow-y-auto">
        <h1 className="font-display text-[32px] font-semibold leading-tight text-ink">Last month, wrapped up</h1>
        <p className="mt-2 text-body text-soft">Your new month has already started. Here&apos;s how the last one went.</p>
        <dl className="mt-8 divide-y divide-line border-y border-line">
          {rows
            .filter((r) => r[2])
            .map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3.5">
                <dt className="text-[15px] text-soft">{k}</dt>
                <dd className="num text-[22px] text-ink">{inr(v)}</dd>
              </div>
            ))}
        </dl>
        {m.leftOver === 0 && (
          <Note tone="neutral" className="mt-6">
            You used all of this month&apos;s spending money. Next month starts fresh.
          </Note>
        )}
        {m.leftOver > 0 && cycle.leftoverMoved && (
          <Note tone="good" className="mt-6">
            {inr(m.leftOver)} moved to savings.
            {saved.months > 1 && <> You have saved {inr(saved.total)} from leftovers across {saved.months} months.</>}
          </Note>
        )}
        {showBackup && (
          <section className="mt-6 rounded-[20px] border border-line bg-tint p-4" aria-label="Back up your months">
            <p className="text-[15px] font-semibold text-ink">Keep your months safe</p>
            <p className="mt-1 text-[14px] leading-relaxed text-soft">
              A whole month of spends lives only on this phone. It can be lost if you clear data or lose the phone. A free account backs it up.
            </p>
            <button
              type="button"
              onClick={onCreateAccount}
              className="mt-3 h-[44px] min-h-0 rounded-btn bg-ink px-5 text-[15px] font-semibold text-white active:scale-[0.99]"
            >
              Create account
            </button>
          </section>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {m.leftOver > 0 && (
          <SecondaryButton
            disabled={cycle.leftoverMoved}
            onClick={async () => {
              await moveLeftoverToSavings(cycle.id!, m.leftOver);
              toast(`Moved ${inr(m.leftOver)} to savings`);
            }}
          >
            {cycle.leftoverMoved ? 'Moved to savings' : `Move ${inr(m.leftOver)} to savings`}
          </SecondaryButton>
        )}
        <PrimaryButton onClick={onDone}>Continue to this month</PrimaryButton>
      </div>
    </main>
  );
}
