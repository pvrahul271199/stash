import Dexie from 'dexie';
import { StashDB, dbNameFor, GUEST_UID, openUserDB } from './schema';

type Counts = Record<string, number>;

/**
 * Copies the guest DB into the new account's DB. Runs only when the target is empty,
 * the guest has a plan or spends, and the guest data is not sample data.
 * The guest copy is removed after the first successful push (sync phase).
 * Login never calls this, and neither does sign-up by itself: the app first asks "move your data?" (`describeGuestData`).
 */
export async function claimGuestData(uid: string): Promise<{ claimed: boolean; counts: Counts }> {
  if (uid === GUEST_UID) return { claimed: false, counts: {} };
  const target = await openUserDB(uid);
  const guest = new StashDB(dbNameFor(GUEST_UID));
  try {
    await guest.open();
    const targetHasData =
      (await target.plans.count()) + (await target.transactions.count()) > 0;
    if (targetHasData) return { claimed: false, counts: {} };
    const gMeta = await guest.meta.get('main');
    if (gMeta?.sampleLoaded) return { claimed: false, counts: {} };
    const [plans, txns, evts, cats] = await Promise.all([
      guest.plans.toArray(),
      guest.transactions.toArray(),
      guest.evts.toArray(),
      guest.cats.toArray(),
    ]);
    if (plans.length + txns.length === 0) return { claimed: false, counts: {} };
    const now = Date.now();
    const touch = <T extends { updatedAt: number }>(r: T[]): T[] => r.map((x) => ({ ...x, updatedAt: Math.max(x.updatedAt, now) }));
    await target.transaction(
      'rw',
      [target.plans, target.transactions, target.cats, target.evts, target.meta],
      async () => {
        await target.cats.clear();
        await target.plans.bulkPut(touch(plans));
        await target.transactions.bulkPut(touch(txns));
        await target.cats.bulkPut(touch(cats));
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
      counts: { plans: plans.length, transactions: txns.length, events: evts.length },
    };
  } finally {
    guest.close();
  }
}

export interface GuestData {
  spends: number;
  plans: number;
}

/**
 * What is waiting in the guest database, for the "move it into your account?" question. Null when there is nothing worth
 * asking about: no guest database, nothing in it, or only sample data left by an older version (which is never moved).
 * Reads only; never creates the database.
 */
export async function describeGuestData(): Promise<GuestData | null> {
  if (!(await Dexie.exists(dbNameFor(GUEST_UID)))) return null;
  const guest = new StashDB(dbNameFor(GUEST_UID));
  try {
    await guest.open();
    if ((await guest.meta.get('main'))?.sampleLoaded) return null;
    const [txns, plans] = await Promise.all([guest.transactions.toArray(), guest.plans.toArray()]);
    const spends = txns.filter((t) => t.deletedAt == null).length;
    const livePlans = plans.filter((p) => p.deletedAt == null).length;
    return spends + livePlans > 0 ? { spends, plans: livePlans } : null;
  } finally {
    guest.close();
  }
}
