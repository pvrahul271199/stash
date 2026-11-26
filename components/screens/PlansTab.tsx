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
    <div className="mt-2 flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6">
      <p className="mb-3 text-[13px] text-soft">Your rough books for the market, a party, a trip. Scribble what you need, add prices if you know them, and tick each thing off as it goes in the bag.</p>
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
      </div>
      <div className="shrink-0 bg-white px-6 pb-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen({ eventId: null })}
          className="flex h-[50px] min-h-0 w-full items-center justify-center gap-2 rounded-btn border border-line bg-white text-[15px] font-semibold text-ink shadow-[0_6px_18px_-6px_rgba(30,27,75,0.28)]"
        >
          <span className="text-[18px] leading-none">+</span> New plan
        </button>
      </div>
      {open && <EventPlanSheet cycle={cycle} start={{ k: 'list', eventId: open.eventId }} onClose={() => setOpen(null)} />}
    </div>
  );
}
