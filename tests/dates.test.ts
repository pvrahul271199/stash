import { describe, it, expect } from 'vitest';
import {
  addDays,
  calendarDay,
  dateOfDay,
  daysBetween,
  formatLong,
  formatWithWeekday,
  weekdayOfDay,
  toISO,
} from '@/lib/dates';

describe('dates', () => {
  it('formats local ISO', () => {
    expect(toISO(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between, unaffected by DST', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-01', '2026-11-05')).toBe(35);
    expect(daysBetween('2026-10-27', '2026-10-27')).toBe(0);
  });

  it('calendarDay is 1-based and capped at totalDays + 1', () => {
    expect(calendarDay('2026-10-09', '2026-10-27', 30)).toBe(19);
    expect(calendarDay('2026-10-09', '2026-10-09', 30)).toBe(1);
    expect(calendarDay('2026-10-09', '2027-03-01', 30)).toBe(31);
  });

  it('calendarDay never goes below 1 if the device date moves backwards', () => {
    expect(calendarDay('2026-10-09', '2026-10-01', 30)).toBe(1);
  });

  it.each([28, 30, 31])('maps weekdays and dates for a %i-day month', (total) => {
    const start = '2026-10-27'; // Tuesday
    expect(weekdayOfDay(start, 1)).toBe(2);
    expect(weekdayOfDay(start, 6)).toBe(0); // Sunday
    expect(weekdayOfDay(start, 8)).toBe(2);
    expect(weekdayOfDay(start, total)).toBe((2 + total - 1) % 7);
    expect(dateOfDay(start, total)).toBe(addDays(start, total - 1));
  });

  it('weekday mapping works across month boundaries', () => {
    const start = '2026-10-25'; // Sunday
    expect(dateOfDay(start, 8)).toBe('2026-11-01');
    expect(weekdayOfDay(start, 8)).toBe(0);
    expect(formatWithWeekday(dateOfDay(start, 8))).toBe('Sun 1 Nov');
    expect(formatLong('2026-10-23')).toBe('Friday, 23 Oct');
  });

  it('formats the header example', () => {
    expect(formatWithWeekday('2026-10-27')).toBe('Tue 27 Oct');
  });
});
