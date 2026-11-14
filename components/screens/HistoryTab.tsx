'use client';
import { entryLines } from '@/lib/entryDisplay';
import { useMemo, useState } from 'react';
import {
  removeEntry,
  useAllCycles,
  useAllEntries,
  useDateEntries,
  useDateTotals,
  dayRowsOf,
} from '@/db/queries';
import type { Entry, Plan } from '@/db/schema';
import { monthView, type DerivedCycle } from '@/lib/period';
import { EditSpendSheet } from './EditSpendSheet';
import { LogSpend } from './LogSpend';
import {
  buildMonthCalendar,
  compactINR,
  searchEntries,
} from '@/lib/history';
import {
  MONTHS,
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

export function HistoryTab({ activeCycle, plan }: { activeCycle: DerivedCycle; plan?: Plan }) {
  const { currency } = useCurrency();
  const allCycles = useAllCycles() ?? [activeCycle];
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const isSearching = query.trim().length > 0;
  const allEntries = useAllEntries(true) ?? [];
  const dayRows = useMemo(() => dayRowsOf(activeCycle), [activeCycle]);

  const today = todayISO();
  const [viewYear, setViewYear] = useState<number>(() => Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState<number>(() => Number(today.slice(5, 7))); // 1-12
  const [selectedIso, setSelectedIso] = useState<string>(() => today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // Prompts for the empty search box: the user's own most-used categories and types.
  const prompts = useMemo(() => {
    const top = (count: Map<string, number>) => [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
    const cats = new Map<string, number>();
    const types = new Map<string, number>();
    for (const e of allEntries) {
      cats.set(e.category, (cats.get(e.category) ?? 0) + 1);
      if (e.subcategory) types.set(e.subcategory, (types.get(e.subcategory) ?? 0) + 1);
    }
    return { cats: top(cats), types: top(types) };
  }, [allEntries]);
  const showPrompts = searchFocused && !isSearching && (prompts.cats.length > 0 || prompts.types.length > 0);

  // Spent in the calendar month being viewed (the calendar below picks the month; no separate month chips).
  const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
  const monthSpent = useMemo(() => {
    let sum = 0;
    for (const [iso, t] of totalsByDate) if (iso.startsWith(monthPrefix)) sum += t.spent;
    return sum;
  }, [totalsByDate, monthPrefix]);

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-question font-semibold text-ink">History</h1>
        <span className="num text-[14px] text-soft">{inr(monthSpent)} spent in {MONTHS[viewMonth - 1]}</span>
      </div>

      {/* Search bar across all days and cycles */}
      <div className="relative mt-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={`Search spends, category, UPI, Card, event, or ${currency.symbol}…`}
          aria-label="Search spends"
          className="h-11 w-full rounded-key border border-line bg-white pl-3.5 pr-9 text-[14px] text-ink placeholder:text-faint"
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

      {showPrompts && (
        <div className="mt-4 flex flex-col gap-4" aria-label="Search suggestions">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By category</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {prompts.cats.map((c) => (
                  <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery(c)} className="min-h-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink active:bg-tint">
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {prompts.types.map((c) => (
                  <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery(c)} className="min-h-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink active:bg-tint">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-soft">By amount</p>
            <p className="mt-2 text-[13px] text-faint">Type a number, like 450</p>
          </div>
        </div>
      )}

      {/* Search results mode */}
      {showPrompts ? null : query.trim() ? (
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
                          {entryLines(e).title}
                          {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                        </p>
                        {entryLines(e).detail && <p className="truncate text-[13px] text-soft">{entryLines(e).detail}</p>}
                        {entryLines(e).meta && <p className="text-[12px] text-faint">{entryLines(e).meta}</p>}
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
                              : 'border border-line/60 bg-white text-ink active:scale-95'
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
                      circleStyle = 'border border-line/60 bg-white text-faint';
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
                        onClick={() => {
                          setSelectedIso(cell.iso);
                          setSheetOpen(true);
                        }}
                        aria-pressed={isSelected}
                        aria-label={ariaLabel}
                        className={`flex h-[66px] min-h-0 flex-col items-center justify-between rounded-[10px] px-0.5 py-1 text-center transition-colors ${
                          !cell.isCurrentMonth ? 'opacity-40' : ''
                        } ${isSelected ? 'bg-white ring-1 ring-ink/20' : ''}`}
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

          {/* Selected date detail: bottom sheet, same as the Today day peek */}
          {sheetOpen && (
          <div className="absolute inset-0 z-[45] flex items-end bg-ink/40" role="presentation" onClick={() => setSheetOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Selected day details"
            onClick={(ev) => ev.stopPropagation()}
            className="thin-scrollbar max-h-[80%] w-full overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-6 pt-3"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
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
                    : 'Date outside this month'}
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
                        {entryLines(e).title}
                        {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                        {e.isEstimate && <span className="ml-2 text-[12px] text-faint">estimate</span>}
                      </p>
                      {entryLines(e).detail && <p className="truncate text-[13px] text-soft">{entryLines(e).detail}</p>}
                      {entryLines(e).meta && <p className="text-[12px] text-faint">{entryLines(e).meta}</p>}
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
                onClick={() => {
                  setSheetOpen(false);
                  setAddingForDate(selectedIso);
                }}
                aria-label={`Log for this date (${formatShort(selectedIso)})`}
                className="flex h-10 min-h-0 w-full items-center justify-center gap-1.5 rounded-key border border-line bg-white text-[13px] font-medium text-ink transition-colors active:scale-[0.99]"
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
          </div>
          )}
        </>
      )}

      {editing && <EditSpendSheet entry={editing} onClose={() => setEditing(null)} />}
      {addingForDate && (
        <LogSpend
          cycle={monthView(activeCycle)}
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
