import { StashDB, dbNameFor, GUEST_UID, openUserDB } from './schema';

type Counts = Record<string, number>;

/**
 * Copies the guest DB into the new account's DB. Runs only when the target is empty,
 * the guest has a plan or spends, and the guest data is not sample data.
 * The guest copy is left in place (removed after the first successful push in the sync phase).
 * Login never calls this.
 */
export async function claimGuestData(uid: string): Promise<{ claimed: boolean; counts: Counts }> {
  if (uid === GUEST_UID) return { claimed: false, counts: {} };
  const target = await openUserDB(uid);
  const guest = new StashDB(dbNameFor(GUEST_UID));
  try {
    await guest.open();
    const targetHasData =
      (await target.plan.count()) + (await target.cycle.count()) + (await target.entries.count()) > 0;
    if (targetHasData) return { claimed: false, counts: {} };
    const gMeta = await guest.meta.get('main');
    if (gMeta?.sampleLoaded) return { claimed: false, counts: {} };
    const [plans, cycles, days, entries, events] = await Promise.all([
      guest.plan.toArray(),
      guest.cycle.toArray(),
      guest.days.toArray(),
      guest.entries.toArray(),
      guest.events.toArray(),
    ]);
    if (plans.length + entries.length === 0) return { claimed: false, counts: {} };
    const categories = await guest.categories.toArray();
    const own = <T extends { userId?: string }>(rows: T[]): T[] => rows.map((r) => ({ ...r, userId: uid }));
    await target.transaction(
      'rw',
      [target.plan, target.cycle, target.days, target.entries, target.categories, target.events, target.meta],
      async () => {
        await target.categories.clear();
        await target.plan.bulkPut(own(plans));
        await target.cycle.bulkPut(own(cycles));
        await target.days.bulkPut(own(days));
        await target.entries.bulkPut(own(entries));
        await target.categories.bulkPut(own(categories));
        await target.events.bulkPut(own(events));
        await target.meta.put({
          id: 'main',
          lastUsedLabel: gMeta?.lastUsedLabel ?? null,
          lastPayment: gMeta?.lastPayment ?? null,
          schemaVersion: gMeta?.schemaVersion ?? 4,
          activeUserId: uid,
          activeEvent: gMeta?.activeEvent ?? null,
          currency: gMeta?.currency ?? null,
        });
      },
    );
    return {
      claimed: true,
      counts: { plan: plans.length, cycle: cycles.length, days: days.length, entries: entries.length, events: events.length },
    };
  } finally {
    guest.close();
  }
}
