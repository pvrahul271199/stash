import Dexie, { type Transaction } from 'dexie';
import { rollupCycle } from '@/lib/budget';
import { DEFAULT_CATEGORIES } from './schema';
import { dateOfDay } from '@/lib/dates';
import type { CategoryRow, Cycle, DayRow, StashEvent, Txn, Plan } from './schema';
import type { LegacyCategory, LegacyCycle, LegacyDayRow, LegacyEntry, LegacyEvent, LegacyPlan } from './legacy';
import { SCHEMA_VERSION, dbNameFor, GUEST_UID, type Meta } from './schema';
import { LegacyStashDB } from './legacy';
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
  const legacy = new LegacyStashDB(LEGACY_DB_NAME);
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
      const target = new LegacyStashDB(dbNameFor(key));
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
              schemaVersion: 4,
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

export interface V5MigrationReport {
  plans: number;
  cycles: number;
  transactions: number;
  categories: number;
  events: number;
  droppedDuplicates: number;
  /** Spends whose cycle no longer exists; kept with cycleId null. */
  detached: number;
  /** Per cycle: stored pool vs the pool derived from transactions. */
  pools: { cycleId: string; legacyPool: number; derivedPool: number }[];
}

export interface V4Rows {
  plan: LegacyPlan[];
  cycle: LegacyCycle[];
  days: LegacyDayRow[];
  entries: LegacyEntry[];
  categories: LegacyCategory[];
  events: LegacyEvent[];
}

/** Pure v4 -> v5 transform. Derived pool wins; the old value is kept in the report. */
export function transformV4(rows: V4Rows, newId: () => string = () => crypto.randomUUID()) {
  const report: V5MigrationReport = {
    plans: 0, cycles: 0, transactions: 0, categories: 0, events: 0,
    droppedDuplicates: 0, detached: 0, pools: [],
  };
  const plans: Plan[] = rows.plan.map((p) => ({
    id: newId(), updatedAt: p.createdAt, createdAt: p.createdAt,
    income: p.income, bills: p.bills, savings: p.savings, monthLength: p.monthLength,
    currency: p.currency, billItems: p.billItems, savingsItems: p.savingsItems,
  }));
  const cycleIds = new Map<number, string>();
  const estimatedByCycle = new Map<number, number[]>();
  for (const d of rows.days) {
    if (d.status === 'estimated') estimatedByCycle.set(d.cycleId, [...(estimatedByCycle.get(d.cycleId) ?? []), d.day]);
  }
  const cycles: Cycle[] = rows.cycle.map((c) => {
    const id = newId();
    if (c.id != null) cycleIds.set(c.id, id);
    return {
      id, updatedAt: Date.parse(c.startDate) || 0, startDate: c.startDate, totalDays: c.totalDays,
      planAmount: c.planAmount, currentDay: c.currentDay, pool: c.pool,
      fromSavingsTotal: c.fromSavingsTotal, leftoverMoved: c.leftoverMoved,
      estimatedDays: (estimatedByCycle.get(c.id ?? -1) ?? []).sort((a, b) => a - b),
    };
  });
  const cycleByOld = new Map(rows.cycle.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const transactions: Txn[] = [];
  for (const e of rows.entries) {
    if (seen.has(e.id)) {
      report.droppedDuplicates++;
      continue;
    }
    seen.add(e.id);
    const oldCycle = cycleByOld.get(e.cycleId);
    const mapped = cycleIds.get(e.cycleId) ?? null;
    if (!mapped) report.detached++;
    const txnDate = e.date ?? (oldCycle && e.day > 0 ? dateOfDay(oldCycle.startDate, e.day) : null);
    if (!txnDate) {
      report.detached++;
      continue;
    }
    transactions.push({
      id: e.id, updatedAt: e.createdAt, createdAt: e.createdAt,
      cycleId: e.day === 0 ? null : mapped, txnDate, amount: e.amount,
      type: e.category, subtype: e.subcategory, label: e.label, event: e.event ?? null,
      payment: e.payment ?? null, note: e.note ?? null, fromSavings: e.fromSavings,
      adjustsPool: e.adjustsPool !== false, isEstimate: e.isEstimate, hour: e.hour,
    });
  }
  const dayRows: DayRow[] = [];
  for (const c of cycles) {
    const old = rows.cycle.find((x) => cycleIds.get(x.id ?? -1) === c.id);
    const r = rollupCycle(c, transactions.filter((t) => t.cycleId === c.id));
    report.pools.push({ cycleId: c.id, legacyPool: old?.pool ?? c.pool, derivedPool: r.pool });
    c.pool = r.pool;
    c.fromSavingsTotal = r.fromSavingsTotal;
    for (const d of r.days) dayRows.push({ cycleId: c.id, day: d.day, allowanceAtStart: d.allowanceAtStart, spent: d.spent, status: d.status });
  }
  const categories: CategoryRow[] = rows.categories.map((c) => ({
    id: newId(), updatedAt: 0, name: c.name, sortOrder: c.sortOrder, isSystem: c.isSystem, subcategories: c.subcategories,
    baseId: null, subAdded: [], subRemoved: [],
  }));
  const events: StashEvent[] = rows.events.map((e) => ({
    id: newId(), updatedAt: e.createdAt, name: e.name, note: e.note ?? null, categories: e.categories, createdAt: e.createdAt,
  }));
  report.plans = plans.length;
  report.cycles = cycles.length;
  report.transactions = transactions.length;
  report.categories = categories.length;
  report.events = events.length;
  return { plans, cycles, transactions, dayRows, categories, events, report };
}

/**
 * Dexie upgrade body (runs once per DB inside the upgrade transaction).
 * Re-runnable: v5 tables are replaced from the v4 tables each time.
 */
export async function migrateV4ToV5(tx: Transaction): Promise<void> {
  const rows: V4Rows = {
    plan: await tx.table('plan').toArray(),
    cycle: await tx.table('cycle').toArray(),
    days: await tx.table('days').toArray(),
    entries: await tx.table('entries').toArray(),
    categories: await tx.table('categories').toArray(),
    events: await tx.table('events').toArray(),
  };
  const out = transformV4(rows);
  await Promise.all(['plans', 'cycles', 'transactions', 'dayRows', 'cats', 'evts'].map((t) => tx.table(t).clear()));
  await tx.table('plans').bulkPut(out.plans);
  await tx.table('cycles').bulkPut(out.cycles);
  await tx.table('transactions').bulkPut(out.transactions);
  await tx.table('dayRows').bulkPut(out.dayRows);
  await tx.table('cats').bulkPut(out.categories);
  await tx.table('evts').bulkPut(out.events);
  const meta = await tx.table('meta').get('main');
  await tx.table('meta').put({
    ...(meta ?? { id: 'main', lastUsedLabel: null }),
    id: 'main',
    schemaVersion: SCHEMA_VERSION,
    migrationReport: out.report,
  });
}

/** Boot step: must resolve before the first `openUserDB`. */
export async function initDB(): Promise<void> {
  await splitLegacyDB();
}

/** Used by tests / future claim: base64 id of a legacy username. */
export function legacyKeyFor(username: string): string {
  return `legacy-${encodeUsernameToBase64(username)}`;
}

/**
 * v7 upgrade: full category copies become overrides. A row equal to a default is dropped
 * (tombstoned so any copy already on the server is removed); differences become
 * subAdded/subRemoved; other names stay as user-created categories.
 */
export async function migrateCatsToOverrides(tx: Transaction): Promise<void> {
  const table = tx.table('cats');
  const rows = (await table.toArray()) as (Partial<CategoryRow> & { id: string; name: string; subcategories: string[] })[];
  const now = Date.now();
  for (const r of rows) {
    if (r.baseId !== undefined) continue; // already new-shape
    const d = DEFAULT_CATEGORIES.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
    if (!d) {
      await table.put({ ...r, baseId: null, subAdded: [], subRemoved: [] });
      continue;
    }
    const subAdded = r.subcategories.filter((x) => !d.subcategories.includes(x));
    const subRemoved = d.subcategories.filter((x) => !r.subcategories.includes(x));
    if (r.deletedAt != null) {
      await table.put({ ...r, baseId: d.key, subAdded: [], subRemoved: [] }); // user had removed it
    } else if (subAdded.length || subRemoved.length) {
      await table.put({ ...r, baseId: d.key, subAdded, subRemoved, updatedAt: now });
    } else {
      await table.put({ ...r, baseId: null, subAdded: [], subRemoved: [], deletedAt: now, updatedAt: now });
    }
  }
}
