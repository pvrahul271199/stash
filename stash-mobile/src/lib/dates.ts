/** Pure date helpers. All dates are local, ISO yyyy-mm-dd. No timezone/DST surprises:
 *  day arithmetic goes through UTC midnight of the y/m/d triple. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** Today's local date as ISO. */
export function todayISO(now: Date = new Date()): string {
  return toISO(now);
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

/** Last day of the cycle, as ISO. */
export function cycleEndDate(startDate: string, totalDays: number): string {
  return dateOfDay(startDate, totalDays);
}
