import { addDays, dateOfDay, daysBetween, formatShort, todayISO } from './dates';
import { useCurrencyStore } from './currency';

/** Minimal shapes so this stays pure and testable. */
export interface HistoryEntry {
  id: string;
  cycleId: string;
  day: number;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  event?: string | null;
  payment?: string | null;
  note?: string | null;
  fromSavings: boolean;
  isEstimate: boolean;
  createdAt: number;
}

export interface HistoryCycle {
  id?: string;
  startDate: string;
  totalDays: number;
}

/* ---------- calendar ---------- */

export interface CalendarCell {
  iso: string;
  /** Day of month, 1-31. */
  dom: number;
  /** Cycle day (1-based) or null when the cell is outside the cycle (padding). */
  day: number | null;
  /** "Nov" on the 1st of a month and on the first cycle day, so month changes are visible. */
  monthLabel: string | null;
}

/** Weeks (Mon-Sun) covering the whole cycle, padded at both ends. */
export function buildCalendar(startDate: string, totalDays: number): CalendarCell[][] {
  const [y, m, d] = startDate.split('-').map(Number);
  const startWd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  const lead = (startWd + 6) % 7; // days back to Monday
  const first = addDays(startDate, -lead);
  const last = dateOfDay(startDate, totalDays);
  const span = daysBetween(first, last) + 1;
  const cellsCount = Math.ceil(span / 7) * 7;

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cellsCount; i++) {
    const iso = addDays(first, i);
    const offset = daysBetween(startDate, iso);
    const day = offset >= 0 && offset < totalDays ? offset + 1 : null;
    const dom = Number(iso.slice(8, 10));
    const monthLabel = day != null && (dom === 1 || day === 1) ? formatShort(iso).split(' ')[1] : null;
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ iso, dom, day, monthLabel });
  }
  return weeks;
}

export interface MonthCalendarCell {
  iso: string;
  year: number;
  month: number;
  dom: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayInCycle: number | null;
  isWithinActiveCycle: boolean;
}

/** Builds a full Mon-Sun month grid for any given year and month (1-12). */
export function buildMonthCalendar(
  year: number,
  month: number,
  activeCycle?: HistoryCycle | null,
  today: string = todayISO(),
): MonthCalendarCell[][] {
  const paddedMonth = String(month).padStart(2, '0');
  const firstOfMonthIso = `${year}-${paddedMonth}-01`;

  const [y, m, d] = [year, month, 1];
  const firstWd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  const lead = (firstWd + 6) % 7; // days back to Monday

  const gridStart = addDays(firstOfMonthIso, -lead);

  // Total days in this month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastOfMonthIso = `${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const lastWd = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  const trail = 7 - ((lastWd + 6) % 7) - 1;
  const gridEnd = addDays(lastOfMonthIso, trail >= 0 ? trail : 0);

  const totalCells = daysBetween(gridStart, gridEnd) + 1;
  const numWeeks = Math.ceil(totalCells / 7);

  const weeks: MonthCalendarCell[][] = [];

  for (let w = 0; w < numWeeks; w++) {
    const week: MonthCalendarCell[] = [];
    for (let c = 0; c < 7; c++) {
      const idx = w * 7 + c;
      const iso = addDays(gridStart, idx);
      const cellYear = Number(iso.slice(0, 4));
      const cellMonth = Number(iso.slice(5, 7));
      const cellDom = Number(iso.slice(8, 10));
      const isCurrentMonth = cellYear === year && cellMonth === month;
      const isToday = iso === today;

      let dayInCycle: number | null = null;
      let isWithinActiveCycle = false;

      if (activeCycle && activeCycle.startDate) {
        const offset = daysBetween(activeCycle.startDate, iso);
        if (offset >= 0 && offset < activeCycle.totalDays) {
          dayInCycle = offset + 1;
          isWithinActiveCycle = true;
        }
      }

      week.push({
        iso,
        year: cellYear,
        month: cellMonth,
        dom: cellDom,
        isCurrentMonth,
        isToday,
        dayInCycle,
        isWithinActiveCycle,
      });
    }
    weeks.push(week);
  }

  return weeks;
}

export interface DayTotal {
  /** Spent from the daily pool (excludes from-savings). */
  spent: number;
  fromSavings: number;
  count: number;
}

export function dayTotals(entries: HistoryEntry[]): Map<number, DayTotal> {
  const map = new Map<number, DayTotal>();
  for (const e of entries) {
    const t = map.get(e.day) ?? { spent: 0, fromSavings: 0, count: 0 };
    if (e.fromSavings) t.fromSavings += e.amount;
    else t.spent += e.amount;
    t.count += 1;
    map.set(e.day, t);
  }
  return map;
}

export function dayTotalsByDate(
  entries: (HistoryEntry & { date?: string })[],
  cycle?: HistoryCycle | null,
): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>();
  for (const e of entries) {
    const iso = e.date || (cycle ? dateOfDay(cycle.startDate, e.day) : null);
    if (!iso) continue;
    const t = map.get(iso) ?? { spent: 0, fromSavings: 0, count: 0 };
    if (e.fromSavings) t.fromSavings += e.amount;
    else t.spent += e.amount;
    t.count += 1;
    map.set(iso, t);
  }
  return map;
}

/** Compact currency label (e.g. "₹1.2k" or "$1.2k") that fits inside a calendar cell. */
export function compactINR(n: number): string {
  const info = useCurrencyStore.getState().currency;
  const sym = info.symbol;
  const space = sym.length > 1 ? ' ' : '';
  const r = Math.round(n);
  if (r < 1000) return `${sym}${space}${r}`;
  if (info.code === 'INR') {
    if (r < 100000) {
      const k = r / 1000;
      return `${sym}${space}${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
    }
    const l = r / 100000;
    return `${sym}${space}${l >= 10 ? Math.round(l) : Math.round(l * 10) / 10}L`;
  }
  if (r < 1000000) {
    const k = r / 1000;
    return `${sym}${space}${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  const m = r / 1000000;
  return `${sym}${space}${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
}

/* ---------- search ---------- */

export interface SearchGroup {
  iso: string;
  cycleId: string;
  day: number;
  total: number;
  entries: HistoryEntry[];
}

/**
 * Searches every spend across all cycles. Matches label, category, type, event and payment
 * (case-insensitive, all words must match). A plain number also matches the exact amount.
 * Results are grouped by date, newest first.
 */
export function searchEntries(entries: HistoryEntry[], cycles: HistoryCycle[], query: string): SearchGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const amount = /^[^\d]?\d+$/.test(q) ? Number(q.replace(/[^\d]/g, '')) : null;
  const startOf = new Map(cycles.filter((c) => c.id != null).map((c) => [c.id!, c.startDate]));

  const hits = entries.filter((e) => {
    if (!startOf.has(e.cycleId)) return false;
    if (amount != null && e.amount === amount) return true;
    const hay = [
      e.label,
      e.category,
      e.subcategory ?? '',
      e.event ?? '',
      e.payment ?? '',
      e.note ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });

  const groups = new Map<string, SearchGroup>();
  for (const e of hits) {
    const iso = dateOfDay(startOf.get(e.cycleId)!, e.day);
    const key = `${e.cycleId}:${e.day}`;
    const g = groups.get(key) ?? { iso, cycleId: e.cycleId, day: e.day, total: 0, entries: [] };
    g.entries.push(e);
    if (!e.fromSavings) g.total += e.amount;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.createdAt - a.createdAt) }))
    .sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
}
