'use client';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { moveLeftoverToSavings, startNextMonth } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import { monthEnd } from '@/lib/budget';
import { inr } from '@/lib/format';
import { useToast } from '@/store/toast';

export function MonthEnd({ cycle, plan }: { cycle: Cycle; plan: Plan }) {
  const toast = useToast((s) => s.show);
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
        <h1 className="font-display text-[32px] font-semibold leading-tight text-ink">Your month is done</h1>
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
          </Note>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {m.leftOver > 0 && (
          <SecondaryButton
            disabled={cycle.leftoverMoved}
            onClick={async () => {
              await moveLeftoverToSavings(cycle.id!);
              toast(`Moved ${inr(m.leftOver)} to savings`);
            }}
          >
            {cycle.leftoverMoved ? 'Moved to savings' : `Move ${inr(m.leftOver)} to savings`}
          </SecondaryButton>
        )}
        <PrimaryButton onClick={() => startNextMonth()}>Start next month</PrimaryButton>
      </div>
    </main>
  );
}
