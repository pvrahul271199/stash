'use client';
import { useEffect, useState } from 'react';
import { useOccasions } from '@/db/queries';
import { inr } from '@/lib/format';
import type { DerivedCycle } from '@/lib/period';
import { useUI } from '@/store/ui';
import { EventPlanSheet } from './EventPlanSheet';

/**
 * History > Plans: every plan (to-do list with prices), newest first. Tap one to open its list, or start a new one.
 * The sheet opens straight on the list, so closing it lands back here.
 */
export function PlansTab({ cycle }: { cycle: DerivedCycle }) {
  const plans = useOccasions();
  const [open, setOpen] = useState<{ eventId: string | null } | null>(null);
  // Arrived from the log screen's Plan button: open a blank new plan straight away, once.
  const wantNew = useUI((s) => s.newPlanRequest);
  useEffect(() => {
    if (!wantNew) return;
    setOpen({ eventId: null });
    useUI.getState().clearNewPlanRequest();
  }, [wantNew]);
  if (!plans) return null;
  return (
    <div className="mt-2">
      <p className="mb-3 text-[13px] text-soft">Planning to buy many things? List them all here, add prices if you know them, and tick each one off as you buy it.</p>
      <button
        type="button"
        onClick={() => setOpen({ eventId: null })}
        className="flex min-h-0 w-full items-center gap-3 rounded-note border-[1.5px] border-dashed border-line px-4 py-3.5 text-left text-[15px] font-medium text-ink hover:border-ink"
      >
        <span className="text-[18px] leading-none">+</span> New plan
      </button>
      {plans.length === 0 ? null : (
        <ul className="mt-2 divide-y divide-line">
          {plans.map(({ event, totals }) => {
            const done = totals.count > 0 && totals.doneCount === totals.count;
            return (
              <li key={event.id}>
                <button type="button" onClick={() => setOpen({ eventId: event.id })} className="flex w-full min-h-0 items-center gap-3 py-3.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-medium ${done ? 'text-faint line-through decoration-ink/40' : 'text-ink'}`}>{event.name}</span>
                    <span className="num block text-[12px] text-soft">
                      {done ? `All ${totals.count} bought` : `${totals.count - totals.doneCount} of ${totals.count} to buy · ${inr(totals.toGo)} to go`}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[13px] text-soft">
                    {inr(totals.paid)}
                    {totals.planned > 0 && <span className="text-faint"> / {inr(totals.planned)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <EventPlanSheet cycle={cycle} start={{ k: 'list', eventId: open.eventId }} onClose={() => setOpen(null)} />}
    </div>
  );
}
