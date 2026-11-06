/** Pure date helpers. All dates are local, ISO yyyy-mm-dd. No timezone/DST surprises:
 *  day arithmetic goes through UTC midnight of the y/m/d triple. */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MS_DAY = 86_400_000;

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * "Close the day" is a real action: the last day the user closed on this device. While the clock is still on that
 * day, the app already treats the next one as today, so closing at 9:45 pm moves on immediately instead of at
 * midnight. Per device; set from `meta.closedThrough` when a database opens (db/schema.ts) and by `closeToday`.
 */
let closedThrough: string | null = null;
const dayListeners = new Set<() => void>();

export function setClosedThrough(iso: string | null | undefined): void {
  const next = iso ?? null;
  if (next === closedThrough) return;
  closedThrough = next;
  dayListeners.forEach((l) => l());
}
export function getClosedThrough(): string | null {
  return closedThrough;
}
/** Re-run when the effective day changes without the clock moving (a day was closed). */
export function subscribeDay(l: () => void): () => void {
  dayListeners.add(l);
  return () => dayListeners.delete(l);
}

/** The calendar date on the clock, ignoring any closed day. */
export function clockISO(now: Date = new Date()): string {
  return toISO(now);
}

/** True while a day has been closed early and the clock has not reached the next one yet. */
export function isAheadOfClock(): boolean {
  return todayISO() !== clockISO();
}

/** Today's local date as ISO. With no argument, a closed day is skipped (see `closedThrough`). An explicit `now` is taken literally. */
export function todayISO(now?: Date): string {
  if (now) return toISO(now);
  const clock = toISO(new Date());
  return closedThrough && clock <= closedThrough ? addDays(closedThrough, 1) : clock;
}

export function addDays(iso: string, n: number): string {
  const t = new Date(utc(iso) + n * MS_DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  return Math.round((utc(toISOStr) - utc(fromISO)) / MS_DAY);
}

/** Day number (1-based) of today within the cycle, capped at totalDays + 1. */
export function calendarDay(startDate: string, today: string, totalDays: number): number {
  const n = daysBetween(startDate, today) + 1;
  return Math.max(1, Math.min(n, totalDays + 1));
}

/** ISO date for cycle day N (1-based). */
export function dateOfDay(startDate: string, day: number): string {
  return addDays(startDate, day - 1);
}

/** 0 = Sunday ... 6 = Saturday, for cycle day N. */
export function weekdayOfDay(startDate: string, day: number): number {
  const [y, m, d] = startDate.split('-').map(Number);
  const startWd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (((startWd + day - 1) % 7) + 7) % 7;
}

export function weekdayShort(wd: number): string {
  return WEEKDAYS[wd];
}
export function weekdayLong(wd: number): string {
  return WEEKDAYS_LONG[wd];
}

/** "27 Oct" */
export function formatShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Tue 27 Oct" */
export function formatWithWeekday(iso: string): string {
  const wd = new Date(utc(iso)).getUTCDay();
  return `${WEEKDAYS[wd]} ${formatShort(iso)}`;
}

/** "Friday, 23 Oct" */
export function formatLong(iso: string): string {
  const wd = new Date(utc(iso)).getUTCDay();
  return `${WEEKDAYS_LONG[wd]}, ${formatShort(iso)}`;
}

/** "October 2026" */
export function formatMonthYear(year: number, month: number): string {
  const m = Math.max(1, Math.min(12, month));
  return `${MONTHS_LONG[m - 1]} ${year}`;
}

/** Last day of the cycle, as ISO. */
export function cycleEndDate(startDate: string, totalDays: number): string {
  return dateOfDay(startDate, totalDays);
}

/** A forward jump of the device date bigger than this is treated as a possible clock error. */
export const MAX_PLAUSIBLE_JUMP_DAYS = 45;
/** A suspicious date is accepted once it has stayed the same for this long (a mis-set clock is usually fixed quickly). */
export const SUSPECT_CONFIRM_MS = 10 * 60 * 1000;

export interface CalendarSeen {
  /** Latest device date that was accepted. */
  date: string;
  /** A suspicious later date, and the clock reading when it was first seen. */
  suspect?: { date: string; since: number } | null;
}

/**
 * Decides whether `today` can be used to close days automatically. Closing a day is permanent, so a phone whose
 * date was moved far forward must not be believed straight away. Returns the date to use (null = don't act yet)
 * and the bookkeeping to store.
 */
export function vetToday(seen: CalendarSeen | null | undefined, today: string, nowMs: number): { use: boolean; next: CalendarSeen } {
  if (!seen) return { use: true, next: { date: today } };
  if (today <= seen.date) return { use: true, next: seen }; // same day, or the clock went back (nothing new closes)
  if (daysBetween(seen.date, today) <= MAX_PLAUSIBLE_JUMP_DAYS) return { use: true, next: { date: today } };
  const s = seen.suspect;
  if (s && s.date === today && nowMs - s.since >= SUSPECT_CONFIRM_MS) return { use: true, next: { date: today } };
  return { use: false, next: { date: seen.date, suspect: s && s.date === today ? s : { date: today, since: nowMs } } };
}
