'use client';
import { useMemo, useState } from 'react';
import {
  removeEntry,
  useAllCycles,
  useAllEntries,
  useCycleEntries,
  useDateEntries,
  useDateTotals,
  useDayRows,
} from '@/db/queries';
import type { Cycle, Entry, Plan } from '@/db/schema';
import { EditSpendSheet } from './EditSpendSheet';
import { LogSpend } from './LogSpend';
import {
  buildMonthCalendar,
  compactINR,
  searchEntries,
} from '@/lib/history';
import {
  MONTHS,
  cycleEndDate,
  dateOfDay,
  daysBetween,
  formatMonthYear,
  formatShort,
  formatWithWeekday,
  todayISO,
} from '@/lib/dates';
import { inr } from '@/lib/format';
import { useCurrency } from '@/lib/currency';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HistoryTab({ activeCycle, plan }: { activeCycle: Cycle; plan?: Plan }) {
  const { currency } = useCurrency();
  const allCycles = useAllCycles() ?? [activeCycle];
  const [selectedCycleId, setSelectedCycleId] = useState<string>(activeCycle.id);
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;
  const allEntries = useAllEntries(true) ?? [];
  const cycle = allCycles.find((c) => c.id === selectedCycleId) ?? activeCycle;

  const cycleEntries = useCycleEntries(cycle.id) ?? [];
  const dayRows = useDayRows(activeCycle.id) ?? [];

  const today = todayISO();
  const [viewYear, setViewYear] = useState<number>(() => Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState<number>(() => Number(today.slice(5, 7))); // 1-12
  const [selectedIso, setSelectedIso] = useState<string>(() => today);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editing, setEditing] = useState<Entry | null>(null);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);

  const monthWeeks = useMemo(
    () => buildMonthCalendar(viewYear, viewMonth, activeCycle, today),
    [viewYear, viewMonth, activeCycle, today],
  );

  // Amounts come straight from the DB by calendar date (txnDate), never from cycle/day maths.
  const gridFrom = monthWeeks[0]?.[0]?.iso ?? today;
  const lastWeek = monthWeeks[monthWeeks.length - 1];
  const gridTo = lastWeek?.[lastWeek.length - 1]?.iso ?? today;
  const totalsByDate = useDateTotals(gridFrom, gridTo);
  const selectedDateEntries = useDateEntries(selectedIso);

  const rowByDate = useMemo(() => {
    const map = new Map<string, (typeof dayRows)[0]>();
    for (const r of dayRows) {
      const iso = dateOfDay(activeCycle.startDate, r.day);
      map.set(iso, r);
    }
    return map;
  }, [dayRows, activeCycle.startDate]);

  const offsetFromActive = daysBetween(activeCycle.startDate, selectedIso);
  const isWithinActiveCycle = offsetFromActive >= 0 && offsetFromActive < activeCycle.totalDays;
  const activeDayNumber = isWithinActiveCycle ? offsetFromActive + 1 : null;

  const selectedRow = rowByDate.get(selectedIso);
  const selectedStat = useMemo(() => {
    const t = { spent: 0, fromSavings: 0, count: 0 };
    for (const e of selectedDateEntries) {
      if (e.fromSavings) t.fromSavings += e.amount;
      else t.spent += e.amount;
      t.count += 1;
    }
    return t;
  }, [selectedDateEntries]);
  const selectedSpent = selectedStat.spent;

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

      {/* Cycle switcher pills */}
      {!query.trim() && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Cycle</p>
        <div className="no-scrollbar -mx-6 overflow-x-auto px-6 touch-pan-x" role="group" aria-label="Cycles">
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
                    setSelectedCycleId(c.id);
                    setViewYear(Number(c.startDate.slice(0, 4)));
                    setViewMonth(Number(c.startDate.slice(5, 7)));
                    setSelectedIso(c.startDate);
                  }}
                  className={`min-h-[36px] rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                    isSel ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-tint/50'
                  }`}
                >
                  {startLbl} – {endLbl}
                  {c.id === activeCycle.id ? ' (Current)' : ''}
                </button>
              );
            })}
          </div>
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
          {/* Calendar Month & Year Navigation Header with Floating Overlay Picker */}
          <div className="relative mt-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                aria-expanded={pickerOpen}
                aria-label="Select month and year"
                className="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[15px] font-semibold text-ink active:opacity-70"
              >
                {formatMonthYear(viewYear, viewMonth)}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-faint transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => {
                    if (viewMonth === 1) {
                      setViewMonth(12);
                      setViewYear((y) => y - 1);
                    } else setViewMonth((m) => m - 1);
                  }}
                  className="flex h-7 w-7 min-h-0 items-center justify-center rounded-full text-faint hover:text-ink active:bg-tint"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => {
                    if (viewMonth === 12) {
                      setViewMonth(1);
                      setViewYear((y) => y + 1);
                    } else setViewMonth((m) => m + 1);
                  }}
                  className="flex h-7 w-7 min-h-0 items-center justify-center rounded-full text-faint hover:text-ink active:bg-tint"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Month & Year Picker Floating Overlay */}
            {pickerOpen && (
              <>
                {/* Backdrop so tapping anywhere outside closes the overlay */}
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setPickerOpen(false)}
                  aria-hidden="true"
                />

                <div
                  role="region"
                  aria-label="Month and year picker"
                  className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-card border border-line bg-white/95 p-3 shadow-[0_18px_45px_-12px_rgba(30,27,75,0.24)] backdrop-blur-md transition-all"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <span className="text-[12px] font-semibold text-soft">Choose Month & Year</span>
                    <div className="flex items-center rounded-full border border-line bg-white p-0.5 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setViewYear((y) => y - 1)}
                        aria-label="Previous year"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-ink transition-all hover:bg-tint active:scale-90"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <span className="num px-2.5 text-[13px] font-semibold text-ink">{viewYear}</span>
                      <button
                        type="button"
                        onClick={() => setViewYear((y) => y + 1)}
                        aria-label="Next year"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-ink transition-all hover:bg-tint active:scale-90"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {MONTHS.map((mName, idx) => {
                      const mNum = idx + 1;
                      const isCurrent = mNum === viewMonth;
                      return (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            setViewMonth(mNum);
                            setPickerOpen(false);
                          }}
                          className={`rounded-key py-2 text-[12px] font-medium transition-all ${
                            isCurrent
                              ? 'bg-ink font-semibold text-white shadow-xs'
                              : 'border border-line/60 bg-white text-ink hover:bg-tint active:scale-95'
                          }`}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interactive Spending Calendar */}
          <div role="table" aria-label="Spending calendar" className="mt-3">
            <div role="row" className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-faint">
              {WEEKDAY_HEADERS.map((d) => (
                <span key={d} role="columnheader" className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="mt-1 flex flex-col gap-1.5">
              {monthWeeks.map((week, wIdx) => (
                <div key={wIdx} role="row" className="grid grid-cols-7 gap-1.5">
                  {week.map((cell) => {
                    const stat = totalsByDate.get(cell.iso);
                    const row = rowByDate.get(cell.iso);
                    const spent = stat?.spent ?? 0;
                    const isSelected = cell.iso === selectedIso;
                    const isToday = cell.isToday;
                    const isFuture = cell.iso > today;
                    const isOver = row ? spent > row.allowanceAtStart : false;
                    const hasData = Boolean(stat);

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

                    const ariaLabel = cell.isWithinActiveCycle
                      ? `Day ${cell.dayInCycle}, ${formatWithWeekday(cell.iso)}, spent ${inr(spent)}`
                      : `${formatWithWeekday(cell.iso)}, spent ${inr(spent)}`;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        role="cell"
                        onClick={() => setSelectedIso(cell.iso)}
                        aria-pressed={isSelected}
                        aria-label={ariaLabel}
                        className={`flex h-[66px] min-h-0 flex-col items-center justify-between rounded-[10px] px-0.5 py-1 text-center transition-colors ${
                          !cell.isCurrentMonth ? 'opacity-40' : ''
                        } ${isSelected ? 'bg-tint/80 ring-1 ring-ink/20' : 'hover:bg-tint/40'}`}
                      >
                        <span
                          className={`text-[9px] font-medium leading-none ${
                            isSelected || isToday ? 'font-semibold text-ink' : 'text-faint'
                          }`}
                        >
                          {cell.isWithinActiveCycle ? `Day ${cell.dayInCycle}` : isToday ? 'Today' : ''}
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
                          {hasData || isToday ? compactINR(spent) : cell.isCurrentMonth ? '—' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-4 text-[11px] text-soft">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-good/40 bg-goodBg" /> On plan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-warm/40 bg-warmBg" /> Over day limit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink" /> Selected
              </span>
            </div>
          </div>

          {/* Selected Date Detail Card */}
          <section className="mt-6 rounded-note border border-line p-4" aria-label="Selected day details">
            <div className="flex items-baseline justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-[16px] font-semibold text-ink">
                  {formatWithWeekday(selectedIso)}
                  {isWithinActiveCycle ? ` · Day ${activeDayNumber}` : ''}
                </h2>
                <p className="mt-0.5 text-[12px] text-soft">
                  {isWithinActiveCycle
                    ? selectedRow
                      ? `Daily allowance was ${inr(selectedRow.allowanceAtStart)}`
                      : selectedIso === today
                        ? 'Today (open)'
                        : `Day ${activeDayNumber}/${activeCycle.totalDays}`
                    : 'Historical date (outside active 30-day cycle)'}
                  {selectedStat.fromSavings ? ` · +${inr(selectedStat.fromSavings)} from savings` : ''}
                </p>
              </div>
              <p className="num text-[22px] font-semibold text-ink">{inr(selectedSpent)}</p>
            </div>

            {selectedDateEntries.length === 0 ? (
              <p className="py-4 text-[14px] text-soft">No spends logged on this date.</p>
            ) : (
              <ul className="divide-y divide-line">
                {selectedDateEntries.map((e) => (
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
                onClick={() => setAddingForDate(selectedIso)}
                aria-label={`Log for this date (${formatShort(selectedIso)})`}
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
                Log for this date ({formatShort(selectedIso)})
              </button>
            </div>
          </section>
        </>
      )}

      {editing && <EditSpendSheet entry={editing} onClose={() => setEditing(null)} />}
      {addingForDate && (
        <LogSpend
          cycle={activeCycle}
          plan={
            plan ?? {
              income: activeCycle.planAmount,
              bills: 0,
              savings: 0,
              monthLength: activeCycle.totalDays,
              createdAt: 0,
              id: '',
              updatedAt: 0,
            }
          }
          targetDate={addingForDate}
          onClose={() => setAddingForDate(null)}
        />
      )}
    </div>
  );
}
