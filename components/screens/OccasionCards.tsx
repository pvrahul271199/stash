'use client';
import { useOccasions, type EventPlanView } from '@/db/queries';
import { inr1 } from '@/lib/format';
import { Disclosure } from '../ui/Disclosure';

/**
 * Insights > Events, top block: occasions you plan with a checklist. Looks different from the "By event" cards on
 * purpose: tinted, plan-based (planned vs paid, whole occasion, not one month) rather than a white card of tagged spends.
 */
export function OccasionCards({ onOpen }: { onOpen?: (eventId: string) => void }) {
  const occasions = useOccasions();
  if (!occasions || occasions.length === 0) return null;
  const paid = occasions.reduce((t, o) => t + o.totals.paid, 0);
  const planned = occasions.reduce((t, o) => t + o.totals.planned, 0);
  return (
    <Disclosure
      title="Occasions"
      hint="What you planned for, and what is paid. Whole occasion, not just this month."
      summary={`${occasions.length} ${occasions.length === 1 ? 'occasion' : 'occasions'} · ${inr1(paid)} of ${inr1(planned)}`}
      storageKey="stash:insights:occasions"
    >
      <ul className="flex flex-col gap-3">
        {occasions.map((o) => (
          <li key={o.event.id}>
            <OccasionCard o={o} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

function OccasionCard({ o, onOpen }: { o: EventPlanView; onOpen?: (eventId: string) => void }) {
  const { event, totals, items } = o;
  const allPaid = totals.count > 0 && totals.doneCount === totals.count;
  const next = items.filter((i) => !i.state.paid).slice(0, 3);
  const pct = totals.planned > 0 ? Math.min(100, (totals.paid / totals.planned) * 100) : 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Occasion</p>
          <p className="mt-0.5 truncate text-[17px] font-semibold text-ink">{event.name}</p>
          <p className="num mt-0.5 text-[12px] text-soft">
            {allPaid ? `All ${totals.count} paid` : `${totals.doneCount} of ${totals.count} paid · ${inr1(totals.toGo)} to go`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[20px] font-semibold text-ink">{inr1(totals.paid)}</p>
          <p className="num text-[12px] text-faint">of {inr1(totals.planned)}</p>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`${event.name} paid`}>
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      {totals.doneCount > 0 && totals.variance !== 0 && (
        <p className={`num mt-2 text-[12px] ${totals.variance > 0 ? 'text-warm' : 'text-soft'}`}>
          {totals.variance > 0 ? `${inr1(totals.variance)} over plan so far` : `${inr1(-totals.variance)} under plan so far`}
        </p>
      )}
      {next.length > 0 && (
        <p className="num mt-2 truncate text-[12px] text-faint">
          Next: {next.map((i) => `${i.item.name} ${inr1(i.item.planned)}`).join(' · ')}
        </p>
      )}
    </>
  );
  const cls = 'block w-full rounded-note bg-tint p-4 text-left';
  return onOpen ? (
    <button type="button" onClick={() => onOpen(event.id)} className={cls} aria-label={`Open ${event.name} checklist`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
