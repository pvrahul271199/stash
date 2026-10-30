import { addDays, dateOfDay, daysBetween, formatShort } from './dates';
import { useCurrencyStore } from './currency';

/** Minimal shapes so this stays pure and testable. */
export interface HistoryEntry {
  id: string;
  cycleId: number;
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
  id?: number;
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
  cycleId: number;
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
