'use client';
import { useState } from 'react';
import type { Entry } from '@/db/schema';
import type { EventPlanView } from '@/db/queries';
import type { EventTotal } from '@/lib/insights';
import { formatWithWeekday, toISO } from '@/lib/dates';
import { inr1 } from '@/lib/format';

type Pill = 'All' | 'Plans' | 'Events';

type Row =
  | { kind: 'occ'; id: string; name: string; date: string; o: EventPlanView }
  | { kind: 'evt'; id: string; name: string; date: string; ev: EventTotal };

const IcoList = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
  </svg>
);
const IcoTag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12V4h8l10 10-8 8L3 12z" />
    <circle cx="7.5" cy="8.5" r="1.2" />
  </svg>
);

/**
 * Insights > Events: occasions (planned checklists) and events (spends tagged with an event name) in one list.
 * An occasion has a dark checklist icon and opens its checklist; an event has a quiet tag icon and, when tapped,
 * shows its spends right under it. Pills: All | Plans | Events.
 */
export function EventsSection({
  occasions,
  events,
  entries,
  activeEvent,
  activeFocus,
  colorOf,
  onToggleEvent,
  onToggleCategory,
  onOpenOccasion,
  onEditEntry,
}: {
  occasions: EventPlanView[];
  events: EventTotal[];
  entries: Entry[];
  activeEvent: string | null;
  activeFocus: string | null;
  colorOf: Record<string, string>;
  onToggleEvent: (name: string) => void;
  onToggleCategory: (name: string) => void;
  onOpenOccasion?: (eventId: string) => void;
  onEditEntry: (e: Entry) => void;
}) {
  const [pill, setPill] = useState<Pill>('All');
  const occNames = new Set(occasions.map((o) => o.event.name));
  const lastSpend = (name: string) => entries.reduce((m, e) => (e.event === name && e.date > m ? e.date : m), '');
  const rows: Row[] = [
    ...occasions.map((o): Row => ({ kind: 'occ', id: o.event.id, name: o.event.name, date: toISO(new Date(o.event.createdAt)), o })),
    // an occasion's own spends are already inside its card
    ...events.filter((e) => !occNames.has(e.name)).map((ev): Row => ({ kind: 'evt', id: `e:${ev.name}`, name: ev.name, date: lastSpend(ev.name), ev })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const nOcc = rows.filter((r) => r.kind === 'occ').length;
  const counts: Record<Pill, number> = { All: rows.length, Plans: nOcc, Events: rows.length - nOcc };
  const shown = rows.filter((r) => pill === 'All' || (pill === 'Plans' ? r.kind === 'occ' : r.kind === 'evt'));
  const total = rows.reduce((t, r) => t + (r.kind === 'occ' ? r.o.totals.paid : r.ev.total), 0);

  if (rows.length === 0) return <p className="mt-4 text-[13px] text-soft">Events you tag, and plans you make, show up here.</p>;

  const card = (r: Row) =>
    r.kind === 'occ' ? <OccasionRow o={r.o} onOpen={onOpenOccasion} /> : (
      <EventRow ev={r.ev} spends={entries.filter((e) => e.event === r.name && (!activeFocus || e.category === activeFocus)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.amount - a.amount))} onEdit={onEditEntry} selected={activeEvent === r.name} activeFocus={activeFocus} colorOf={colorOf} onToggle={() => onToggleEvent(r.name)} onCategory={onToggleCategory} />
    );

  return (
    <div className="mt-3">
      <p className="num text-[13px] text-soft">
        {rows.length} {rows.length === 1 ? 'item' : 'items'} · {inr1(total)}
      </p>
      <div role="tablist" aria-label="Show" className="mt-3 grid grid-cols-3 rounded-full bg-tint p-1">
        {(['All', 'Plans', 'Events'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={pill === k}
            onClick={() => setPill(k)}
            className={`h-9 min-h-0 rounded-full text-[13px] font-medium transition-colors ${pill === k ? 'bg-ink text-white' : 'text-soft'}`}
          >
            {k} <span className="num opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-soft">Nothing here yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {shown.map((r) => (
            <li key={r.id}>{card(r)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OccasionRow({ o, onOpen }: { o: EventPlanView; onOpen?: (eventId: string) => void }) {
  const { event, totals, items } = o;
  const over = totals.planned > 0 && totals.paid > totals.planned;
  const next = items.filter((i) => !i.state.paid).slice(0, 3);
  const body = (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white"><IcoList /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{event.name}</p>
        <p className="num mt-0.5 truncate text-[12px] text-soft">
          {totals.count > 0 && totals.doneCount === totals.count ? `All ${totals.count} bought` : `${totals.count - totals.doneCount} of ${totals.count} to buy${totals.toGo > 0 ? ` · ${inr1(totals.toGo)} to go` : ''}`}
        </p>
        {next.length > 0 && <p className="num mt-0.5 truncate text-[12px] text-faint">Next: {next.map((i) => i.item.name).join(' · ')}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`num text-[17px] font-semibold ${over ? 'text-warm' : 'text-ink'}`}>{inr1(totals.paid)}</p>
        <p className="num text-[12px] text-faint">{totals.planned > 0 ? `of ${inr1(totals.planned)}` : 'no amounts yet'}</p>
      </div>
    </div>
  );
  const cls = 'block w-full rounded-note border border-line bg-white p-3.5 text-left';
  return onOpen ? (
    <button type="button" onClick={() => onOpen(event.id)} className={cls} aria-label={`Open ${event.name} checklist`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
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
