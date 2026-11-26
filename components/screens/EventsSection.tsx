'use client';
import type { Entry } from '@/db/schema';
import type { EventTotal } from '@/lib/insights';
import { formatWithWeekday } from '@/lib/dates';
import { inr1 } from '@/lib/format';

const IcoTag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12V4h8l10 10-8 8L3 12z" />
    <circle cx="7.5" cy="8.5" r="1.2" />
  </svg>
);

/**
 * Insights > Events: events only (spends tagged with an event name). Tap one to see its spends right under it.
 * Plans (shopping lists) live in History > Plans, so a plan's own tagged spends are left out of this list.
 */
export function EventsSection({
  planNames,
  events,
  entries,
  activeEvent,
  activeFocus,
  colorOf,
  onToggleEvent,
  onToggleCategory,
  onEditEntry,
}: {
  /** Names of plans: their tagged spends belong to the plan, not to an event. */
  planNames: string[];
  events: EventTotal[];
  entries: Entry[];
  activeEvent: string | null;
  activeFocus: string | null;
  colorOf: Record<string, string>;
  onToggleEvent: (name: string) => void;
  onToggleCategory: (name: string) => void;
  onEditEntry: (e: Entry) => void;
}) {
  const plans = new Set(planNames);
  const lastSpend = (name: string) => entries.reduce((m, e) => (e.event === name && e.date > m ? e.date : m), '');
  const rows = events
    .filter((e) => !plans.has(e.name))
    .map((ev) => ({ ev, date: lastSpend(ev.name) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = rows.reduce((t, r) => t + r.ev.total, 0);

  if (rows.length === 0) return <p className="mt-4 text-[13px] text-soft">Events you tag show up here.</p>;

  return (
    <div className="mt-3">
      <p className="num text-[13px] text-soft">
        {rows.length} {rows.length === 1 ? 'event' : 'events'} · {inr1(total)}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {rows.map(({ ev }) => (
          <li key={ev.name}>
            <EventRow
              ev={ev}
              spends={entries.filter((e) => e.event === ev.name && (!activeFocus || e.category === activeFocus)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.amount - a.amount))}
              onEdit={onEditEntry}
              selected={activeEvent === ev.name}
              activeFocus={activeFocus}
              colorOf={colorOf}
              onToggle={() => onToggleEvent(ev.name)}
              onCategory={onToggleCategory}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventRow({
  ev, spends, selected, activeFocus, colorOf, onToggle, onCategory, onEdit,
}: {
  ev: EventTotal; spends: Entry[]; selected: boolean; activeFocus: string | null; colorOf: Record<string, string>;
  onToggle: () => void; onCategory: (name: string) => void; onEdit: (e: Entry) => void;
}) {
  const bodyId = `ev-${ev.name.replace(/\W+/g, '-')}`;
  return (
    <div className={`rounded-note border bg-white p-3.5 transition-colors duration-200 ${selected ? 'border-ink' : 'border-line'}`}>
      <button type="button" onClick={onToggle} aria-pressed={selected} aria-expanded={selected} aria-controls={bodyId} className="flex w-full items-center gap-3 text-left">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${selected ? 'border-ink bg-ink text-white' : 'border-line bg-tint text-soft'}`}><IcoTag /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{ev.name}</p>
          <p className="num mt-0.5 truncate text-[12px] text-soft">
            {ev.count} {ev.count === 1 ? 'spend' : 'spends'}
            {ev.pct > 0 ? ` · ${Math.round(ev.pct)}% of spending` : ''}
          </p>
          {ev.note && <p className="mt-0.5 truncate text-[12px] text-faint">{ev.note}</p>}
        </div>
        <p className="num shrink-0 text-[17px] font-semibold text-ink">{inr1(ev.total)}</p>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={`shrink-0 text-soft transition-transform duration-300 motion-reduce:transition-none ${selected ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* grid rows 0fr -> 1fr animates the height without measuring it; the rows then slide in one after another */}
      <div
        id={bodyId}
        inert={!selected}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${selected ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">
            {ev.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label={`Categories in ${ev.name}`}>
                {ev.categories.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => onCategory(cat.name)}
                    aria-pressed={activeFocus === cat.name}
                    className={`flex min-h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${
                      activeFocus === cat.name ? 'border-ink bg-ink text-white' : cat.total > 0 ? 'border-line bg-white text-ink' : 'border-line bg-white text-faint'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: colorOf[cat.name] }} />
                    <span>{cat.name}</span>
                    <span className="num opacity-80">{inr1(cat.total)}</span>
                  </button>
                ))}
              </div>
            )}
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {spends.length === 0 && <li className="py-3 text-[13px] text-soft">No spends here this month.</li>}
              {spends.map((e, i) => (
                <li
                  key={e.id}
                  style={{ transitionDelay: selected ? `${80 + Math.min(i, 8) * 45}ms` : '0ms' }}
                  className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${selected ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
                >
                  <button type="button" onClick={() => onEdit(e)} className="flex w-full min-h-0 items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{e.label}</span>
                      <span className="block truncate text-[12px] text-faint">
                        {formatWithWeekday(e.date)} · {e.subcategory ?? e.category}
                      </span>
                    </span>
                    <span className="num text-[14px] font-semibold text-ink">{inr1(e.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
