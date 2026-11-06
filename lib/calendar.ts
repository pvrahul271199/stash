/** Pure month-grid maths for the date picker (components/ui/DatePicker.tsx), so it can be unit-tested. */
import { MONTHS_LONG, addDays, weekdayOfDay } from './dates';
import { periodFor } from './period';

export interface PickerCell {
  iso: string;
  day: number;
  /** Outside min..max: shown dimmed and not selectable. */
  disabled: boolean;
  selected: boolean;
  /** After the selected day, up to max: the days that will be tracked. */
  inRange: boolean;
  today: boolean;
}

export interface PickerMonth {
  /** First day of the month shown. */
  first: string;
  title: string;
  /** Monday-first weeks; `null` pads the first and last week. */
  weeks: (PickerCell | null)[][];
  hasPrev: boolean;
  hasNext: boolean;
}

export const PICKER_WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** First day of the month `delta` months away (-1 / +1). */
export function shiftMonth(first: string, delta: -1 | 1): string {
  return periodFor(1, addDays(first, delta > 0 ? 32 : -1)).start;
}

export function pickerMonth(
  anyDateInMonth: string,
  o: { min: string; max: string; selected: string; today: string },
): PickerMonth {
  const { start: first, end: last, totalDays } = periodFor(1, anyDateInMonth);
  const lead = (weekdayOfDay(first, 1) + 6) % 7; // Sunday = 0 -> Monday-first column
  const cells: (PickerCell | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= totalDays; d++) {
    const iso = addDays(first, d - 1);
    cells.push({
      iso,
      day: d,
      disabled: iso < o.min || iso > o.max,
      selected: iso === o.selected,
      inRange: iso > o.selected && iso <= o.max,
      today: iso === o.today,
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const [y, m] = first.split('-').map(Number);
  return { first, title: `${MONTHS_LONG[m - 1]} ${y}`, weeks, hasPrev: first > o.min, hasNext: last < o.max };
}
