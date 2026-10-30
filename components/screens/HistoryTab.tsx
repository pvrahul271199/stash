'use client';
import { useMemo, useState } from 'react';
import {
  removeEntry,
  useAllCycles,
  useAllEntries,
  useCycleEntries,
  useDayRows,
} from '@/db/queries';
import type { Cycle, Entry, Plan } from '@/db/schema';
import { EditSpendSheet } from './EditSpendSheet';
import { LogSpend } from './LogSpend';
import {
  buildCalendar,
  compactINR,
  dayTotals,
  searchEntries,
} from '@/lib/history';
import {
  cycleEndDate,
  dateOfDay,
  formatShort,
  formatWithWeekday,
} from '@/lib/dates';
import { inr } from '@/lib/format';
import { useCurrency } from '@/lib/currency';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HistoryTab({ activeCycle, plan }: { activeCycle: Cycle; plan?: Plan }) {
  const { currency } = useCurrency();
  const allCycles = useAllCycles() ?? [activeCycle];
  const [selectedCycleId, setSelectedCycleId] = useState<number>(activeCycle.id!);
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;
  const allEntries = useAllEntries(isSearching) ?? [];
  const cycle = allCycles.find((c) => c.id === selectedCycleId) ?? activeCycle;

  const cycleEntries = useCycleEntries(cycle.id) ?? [];
  const dayRows = useDayRows(cycle.id) ?? [];

  const defaultDay = Math.min(cycle.currentDay, cycle.totalDays);
  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [addingForDay, setAddingForDay] = useState<number | null>(null);

  const activeDay = selectedDay >= 1 && selectedDay <= cycle.totalDays ? selectedDay : defaultDay;

  const weeks = useMemo(
    () => buildCalendar(cycle.startDate, cycle.totalDays),
    [cycle.startDate, cycle.totalDays],
  );
  const totalsByDay = useMemo(() => dayTotals(cycleEntries), [cycleEntries]);
  const rowByDay = useMemo(() => new Map(dayRows.map((r) => [r.day, r])), [dayRows]);

  const activeDayStat = totalsByDay.get(activeDay);
  const activeDayRow = rowByDay.get(activeDay);
  const activeDayIso = dateOfDay(cycle.startDate, activeDay);

  const dayEntries = useMemo(() => {
    const seen = new Set<string>();
    return cycleEntries
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        if (e.day !== activeDay) return false;
        if (e.date && e.date !== activeDayIso) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cycleEntries, activeDay, activeDayIso]);

  const searchResults = useMemo(
    () => (query.trim() ? searchEntries(allEntries, allCycles, query) : []),
    [allEntries, allCycles, query],
  );

  const cycleTotalSpent = useMemo(
    () => cycleEntries.filter((e) => !e.fromSavings).reduce((s, e) => s + e.amount, 0),
    [cycleEntries],
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-question font-semibold text-ink">History</h1>
        <span className="num text-[14px] text-soft">{inr(cycleTotalSpent)} spent</span>
      </div>

      {/* Search bar across all days and cycles */}
      <div className="relative mt-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search spends, category, UPI, Card, event, or ${currency.symbol}…`}
          aria-label="Search spends"
          className="h-11 w-full rounded-key border border-line bg-tint/40 pl-3.5 pr-9 text-[14px] text-ink placeholder:text-faint"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-faint"
          >
            ×
          </button>
        )}
      </div>

      {/* Cycle switcher (when user has multiple cycles or wants to see cycle range) */}
      {!query.trim() && (
        <div className="no-scrollbar -mx-6 mt-3 overflow-x-auto px-6 touch-pan-x" role="group" aria-label="Cycles">
          <div className="flex w-max gap-2 pb-1">
            {allCycles.map((c, idx) => {
              const isSel = c.id === cycle.id;
              const startLbl = formatShort(c.startDate);
              const endLbl = formatShort(cycleEndDate(c.startDate, c.totalDays));
              return (
                <button
                  key={c.id ?? idx}
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => {
                    setSelectedCycleId(c.id!);
                    setSelectedDay(Math.min(c.currentDay, c.totalDays));
                  }}
                  className={`min-h-[36px] rounded-full border px-3.5 text-[13px] font-medium ${
                    isSel ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                  }`}
                >
                  {startLbl} – {endLbl}
                  {c.id === activeCycle.id ? ' (Current)' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search results mode */}
      {query.trim() ? (
        <section className="mt-5" aria-label="Search results">
          <p className="text-[13px] text-soft">
            {searchResults.length === 0
              ? `No spends matching "${query.trim()}".`
              : `${searchResults.reduce((s, g) => s + g.entries.length, 0)} matching spends`}
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {searchResults.map((group) => (
              <div key={`${group.cycleId}:${group.day}`} className="rounded-note border border-line p-3.5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-[13px] font-semibold text-ink">
                    {formatWithWeekday(group.iso)} · Day {group.day}
                  </span>
                  <span className="num text-[14px] font-semibold text-ink">{inr(group.total)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {group.entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEditing(e as Entry)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-[15px] font-medium text-ink">
                          {e.label}
                          {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                        </p>
                        <p className="text-[12px] text-faint">
                          {e.subcategory ?? e.category}
                          {e.payment ? ` · ${e.payment}` : ''}
                          {e.event ? ` · ${e.event}` : ''}
                        </p>
                        {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
                      </button>
                      <span className="num text-[17px] text-ink">{inr(e.amount)}</span>
                      <button
                        type="button"
                        onClick={() => setEditing(e as Entry)}
                        aria-label={`Edit ${e.label}`}
                        className="flex h-7 w-7 min-h-0 items-center justify-center text-faint hover:text-ink"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Interactive Calendar View */}
          <section className="mt-4" aria-label="Spending calendar">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-faint">
              {WEEKDAY_HEADERS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="mt-1 flex flex-col gap-1.5">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-7 gap-1.5">
                  {week.map((cell) => {
                    if (cell.day == null) {
                      return <div key={cell.iso} className="h-[64px] rounded-[10px]" aria-hidden="true" />;
                    }
                    const d = cell.day;
                    const stat = totalsByDay.get(d);
                    const row = rowByDay.get(d);
                    const spent = stat?.spent ?? row?.spent ?? 0;
                    const isSelected = d === activeDay;
                    const isToday = cycle.id === activeCycle.id && d === cycle.currentDay;
                    const isFuture = cycle.id === activeCycle.id && d > cycle.currentDay;
                    const isOver = row ? spent > row.allowanceAtStart : false;
                    const hasData = Boolean(stat || row);

                    let circleStyle = 'border border-line bg-white text-ink';
                    if (isSelected) {
                      circleStyle = 'bg-ink text-white';
                    } else if (isFuture) {
                      circleStyle = 'border border-line/60 bg-tint/30 text-faint';
                    } else if (row && isOver) {
                      circleStyle = 'border border-warm/40 bg-warmBg text-ink';
                    } else if (row) {
                      circleStyle = 'border border-good/40 bg-goodBg/70 text-ink';
                    } else if (isToday) {
                      circleStyle = 'border-2 border-ink bg-white text-ink';
                    }

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => setSelectedDay(d)}
                        aria-pressed={isSelected}
                        aria-label={`Day ${d}, ${formatWithWeekday(cell.iso)}, spent ${inr(spent)}`}
                        className={`flex h-[64px] min-h-0 flex-col items-center justify-between rounded-[10px] px-0.5 py-1 text-center transition-colors ${
                          isSelected ? 'bg-tint/80 ring-1 ring-ink/20' : 'hover:bg-tint/40'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-medium leading-none ${
                            isSelected || isToday ? 'font-semibold text-ink' : 'text-faint'
                          }`}
                        >
                          Day {d}
                        </span>
                        <span
                          className={`num flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold leading-none transition-colors ${circleStyle}`}
                        >
                          {cell.dom}
                        </span>
                        <span
                          className={`num text-[10px] font-semibold leading-none ${
                            hasData || isToday
                              ? isOver
                                ? 'text-warm'
                                : 'text-ink'
                              : 'text-faint'
                          }`}
                        >
                          {hasData || isToday ? compactINR(spent) : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-4 text-[11px] text-soft">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-goodBg border border-good/40" /> On plan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-warmBg border border-warm/40" /> Over day limit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink" /> Selected
              </span>
            </div>
          </section>

          {/* Selected Day Detail */}
          <section className="mt-6 rounded-note border border-line p-4" aria-label="Selected day details">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-[16px] font-semibold text-ink">
                  {formatWithWeekday(activeDayIso)} · Day {activeDay}
                </h2>
                <p className="mt-0.5 text-[12px] text-soft">
                  {activeDayRow
                    ? `Daily allowance was ${inr(activeDayRow.allowanceAtStart)}`
                    : cycle.id === activeCycle.id && activeDay === cycle.currentDay
                      ? 'Today (open)'
                      : 'Not closed yet'}
                  {activeDayStat?.fromSavings ? ` · +${inr(activeDayStat.fromSavings)} from savings` : ''}
                </p>
              </div>
              <p className="num text-[22px] font-semibold text-ink">
                {inr(activeDayStat?.spent ?? activeDayRow?.spent ?? 0)}
              </p>
            </div>

            {dayEntries.length === 0 ? (
              <p className="py-4 text-[14px] text-soft">No spends logged on this day.</p>
            ) : (
              <ul className="divide-y divide-line">
                {dayEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-[15px] font-medium text-ink">
                        {e.label}
                        {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                        {e.isEstimate && <span className="ml-2 text-[12px] text-faint">estimate</span>}
                      </p>
                      <p className="text-[12px] text-faint">
                        {e.subcategory ?? e.category}
                        {e.payment ? ` · ${e.payment}` : ''}
                        {e.event ? ` · ${e.event}` : ''}
                      </p>
                      {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
                    </button>
                    <p className="num text-[18px] text-ink">{inr(e.amount)}</p>
                    <button
                      type="button"
                      aria-label={`Edit ${e.label} ${inr(e.amount)}`}
                      onClick={() => setEditing(e)}
                      className="flex h-7 w-7 min-h-0 items-center justify-center text-faint hover:text-ink"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${e.label} ${inr(e.amount)}`}
                      onClick={() => void removeEntry(e.id)}
                      className="flex h-7 w-7 min-h-0 items-center justify-center text-[16px] text-faint hover:text-warm"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setAddingForDay(activeDay)}
                aria-label={`Log for this day (${formatWithWeekday(activeDayIso)}, Day ${activeDay})`}
                className="flex h-10 min-h-0 w-full items-center justify-center gap-1.5 rounded-key border border-line bg-tint/50 text-[13px] font-medium text-ink transition-colors hover:bg-tint active:scale-[0.99]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Log for this day ({formatShort(activeDayIso)})
              </button>
            </div>
          </section>
        </>
      )}

      {editing && <EditSpendSheet entry={editing} onClose={() => setEditing(null)} />}
      {addingForDay != null && (
        <LogSpend
          cycle={cycle}
          plan={
            plan ?? {
              income: cycle.planAmount,
              bills: 0,
              savings: 0,
              monthLength: cycle.totalDays,
              createdAt: 0,
            }
          }
          targetDay={addingForDay}
          onClose={() => setAddingForDay(null)}
        />
      )}
    </div>
  );
}
