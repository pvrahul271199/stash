import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeToday, createPlan } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { addDays, clockISO, isAheadOfClock, setClosedThrough, todayISO } from '@/lib/dates';

describe('closeToday', () => {
  afterEach(() => setClosedThrough(null));

  it('moves the app to the next day at once, persists it, and the next day can be closed too', async () => {
    await openUserDB('close-a');
    await createPlan({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, addDays(clockISO(), -3));
    const clock = clockISO();

    const r = await closeToday();
    expect(r).not.toBeNull();
    expect(todayISO()).toBe(addDays(clock, 1));
    expect(isAheadOfClock()).toBe(true);
    expect((await getDB().meta.get('main'))?.closedThrough).toBe(clock);

    // the user logs the next day early and closes that one as well
    expect(await closeToday()).not.toBeNull();
    expect(todayISO()).toBe(addDays(clock, 2));
    expect((await getDB().meta.get('main'))?.closedThrough).toBe(addDays(clock, 1));

    // reopening the same database restores it (app reload)
    setClosedThrough(null);
    await openUserDB('close-b');
    await openUserDB('close-a');
    expect(todayISO()).toBe(addDays(clock, 2));
  });
});
