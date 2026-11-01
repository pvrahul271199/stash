import Dexie from 'dexie';
import { StashDB, SCHEMA_VERSION, dbNameFor, GUEST_UID, type Meta } from './schema';
import { encodeUsernameToBase64 } from '@/lib/user';

export const LEGACY_DB_NAME = 'stash';
export const LEGACY_SPLIT_FLAG = 'stash:legacy-split';

export interface LegacySplitReport {
  skipped: boolean;
  targets: Record<string, Record<string, number>>;
}

function flagSet(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LEGACY_SPLIT_FLAG) === '1';
  } catch {
    return false;
  }
}
function setFlag() {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(LEGACY_SPLIT_FLAG, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Splits the old shared `stash` DB into per-user DBs. The active user's rows and
 * rows without an owner become the guest DB (`stash-default`); rows of any other
 * username go to dormant `stash-legacy-<b64>` DBs so the first claimant never
 * absorbs someone else's data. The legacy DB is left untouched.
 */
export async function splitLegacyDB(): Promise<LegacySplitReport> {
  const report: LegacySplitReport = { skipped: true, targets: {} };
  if (flagSet()) return report;
  if (!(await Dexie.exists(LEGACY_DB_NAME))) {
    setFlag();
    return report;
  }
  report.skipped = false;
  const legacy = new StashDB(LEGACY_DB_NAME);
  try {
    await legacy.open();
    const [users, plans, cycles, days, entries, categories, events, metaRows] = await Promise.all([
      legacy.users.toArray(),
      legacy.plan.toArray(),
      legacy.cycle.toArray(),
      legacy.days.toArray(),
      legacy.entries.toArray(),
      legacy.categories.toArray(),
      legacy.events.toArray(),
      legacy.meta.toArray(),
    ]);
    const activeUser = metaRows.find((m) => m.id === 'main')?.activeUserId ?? null;

    const bucketOf = (uid?: string | null): string => {
      if (!uid || uid === GUEST_UID || uid === activeUser) return GUEST_UID;
      return `legacy-${uid}`;
    };
    const cycleBucket = new Map<number, string>();
    for (const c of cycles) if (c.id != null) cycleBucket.set(c.id, bucketOf(c.userId));

    type Bucket = {
      users: typeof users;
      plan: typeof plans;
      cycle: typeof cycles;
      days: typeof days;
      entries: typeof entries;
      categories: typeof categories;
      events: typeof events;
    };
    const buckets = new Map<string, Bucket>();
    const get = (k: string): Bucket => {
      let b = buckets.get(k);
      if (!b) {
        b = { users: [], plan: [], cycle: [], days: [], entries: [], categories: [], events: [] };
        buckets.set(k, b);
      }
      return b;
    };
    get(GUEST_UID);
    for (const u of users) get(bucketOf(u.userId)).users.push(u);
    for (const r of plans) get(bucketOf(r.userId)).plan.push(r);
    for (const r of cycles) get(bucketOf(r.userId)).cycle.push(r);
    for (const r of days) get(cycleBucket.get(r.cycleId) ?? bucketOf(r.userId)).days.push(r);
    for (const r of entries) get(cycleBucket.get(r.cycleId) ?? bucketOf(r.userId)).entries.push(r);
    for (const r of categories) get(bucketOf(r.userId)).categories.push(r);
    for (const r of events) get(bucketOf(r.userId)).events.push(r);

    // Write every target before setting the flag; a failure leaves the flag unset and legacy untouched.
    for (const [key, b] of buckets) {
      const target = new StashDB(dbNameFor(key));
      try {
        await target.open();
        const done = await target.meta.get('main');
        if (done?.migratedFrom) continue;
        await target.transaction(
          'rw',
          [target.users, target.plan, target.cycle, target.days, target.entries, target.categories, target.events, target.meta],
          async () => {
            await target.users.bulkPut(b.users);
            await target.plan.bulkPut(b.plan);
            await target.cycle.bulkPut(b.cycle);
            await target.days.bulkPut(b.days);
            await target.entries.bulkPut(b.entries);
            await target.categories.bulkPut(b.categories);
            await target.events.bulkPut(b.events);
            const base = key === GUEST_UID ? metaRows.find((m) => m.id === 'main') : undefined;
            const meta: Meta = {
              ...(base ?? { id: 'main', lastUsedLabel: null }),
              id: 'main',
              schemaVersion: SCHEMA_VERSION,
              activeUserId: null,
              migratedFrom: LEGACY_DB_NAME,
            };
            await target.meta.put(meta);
          },
        );
        report.targets[dbNameFor(key)] = {
          plan: b.plan.length,
          cycle: b.cycle.length,
          days: b.days.length,
          entries: b.entries.length,
          categories: b.categories.length,
          events: b.events.length,
        };
      } finally {
        target.close();
      }
    }
    setFlag();
    return report;
  } finally {
    legacy.close();
  }
}

/** Boot step: must resolve before the first `openUserDB`. */
export async function initDB(): Promise<void> {
  await splitLegacyDB();
}

/** Used by tests / future claim: base64 id of a legacy username. */
export function legacyKeyFor(username: string): string {
  return `legacy-${encodeUsernameToBase64(username)}`;
}
