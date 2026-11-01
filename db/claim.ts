import { defaultCategoryId } from './queries';
import { StashDB, dbNameFor, GUEST_UID, openUserDB } from './schema';

type Counts = Record<string, number>;

/**
 * Copies the guest DB into the new account's DB. Runs only when the target is empty,
 * the guest has a plan or spends, and the guest data is not sample data.
 * The guest copy is removed after the first successful push (sync phase).
 * Login never calls this.
 */
export async function claimGuestData(uid: string): Promise<{ claimed: boolean; counts: Counts }> {
  if (uid === GUEST_UID) return { claimed: false, counts: {} };
  const target = await openUserDB(uid);
  const guest = new StashDB(dbNameFor(GUEST_UID));
  try {
    await guest.open();
    const targetHasData =
      (await target.plans.count()) + (await target.cycles.count()) + (await target.transactions.count()) > 0;
    if (targetHasData) return { claimed: false, counts: {} };
    const gMeta = await guest.meta.get('main');
    if (gMeta?.sampleLoaded) return { claimed: false, counts: {} };
    const [plans, cycles, txns, rows, evts, cats] = await Promise.all([
      guest.plans.toArray(),
      guest.cycles.toArray(),
      guest.transactions.toArray(),
      guest.dayRows.toArray(),
      guest.evts.toArray(),
      guest.cats.toArray(),
    ]);
    if (plans.length + txns.length === 0) return { claimed: false, counts: {} };
    const now = Date.now();
    // Guest default-category ids are derived from 'default'; re-derive them for this account
    // so two accounts never share a server primary key.
    const remappedCats = await Promise.all(
      cats.map(async (c) =>
        c.id === (await defaultCategoryId(GUEST_UID, c.name)) ? { ...c, id: await defaultCategoryId(uid, c.name) } : c,
      ),
    );
    const touch = <T extends { updatedAt: number }>(r: T[]): T[] => r.map((x) => ({ ...x, updatedAt: Math.max(x.updatedAt, now) }));
    await target.transaction(
      'rw',
      [target.plans, target.cycles, target.transactions, target.dayRows, target.cats, target.evts, target.meta],
      async () => {
        await target.cats.clear();
        await target.plans.bulkPut(touch(plans));
        await target.cycles.bulkPut(touch(cycles));
        await target.transactions.bulkPut(touch(txns));
        await target.dayRows.bulkPut(rows);
        await target.cats.bulkPut(touch(remappedCats));
        await target.evts.bulkPut(touch(evts));
        await target.meta.put({
          id: 'main',
          lastUsedLabel: gMeta?.lastUsedLabel ?? null,
          lastPayment: gMeta?.lastPayment ?? null,
          schemaVersion: gMeta?.schemaVersion ?? 6,
          activeUserId: uid,
          activeEvent: gMeta?.activeEvent ?? null,
          currency: gMeta?.currency ?? null,
          guestClaimPending: true,
        });
      },
    );
    return {
      claimed: true,
      counts: { plans: plans.length, cycles: cycles.length, transactions: txns.length, events: evts.length },
    };
  } finally {
    guest.close();
  }
}
