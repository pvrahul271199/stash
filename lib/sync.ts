import {
  getDB,
  type Category,
  type Cycle,
  type DayRow,
  type Entry,
  type Plan,
  type StashEvent,
  type UserRecord,
} from '@/db/schema';
import {
  DEFAULT_AVATAR_THEME,
  DEFAULT_USER_ID,
  USERNAME_STORAGE_KEY,
  USER_THEME_STORAGE_KEY,
  buildUserProfile,
  clearBrowserSessionUser,
  decodeBase64Username,
  encodeUsernameToBase64,
  getActiveUserId,
  getBrowserSessionUser,
  getStoredAvatarTheme,
  getStoredUsername,
  normalizeUsername,
  setBrowserSessionUser,
  type BrowserSessionUser,
  type UserProfile,
} from './user';
import { dateOfDay, daysBetween } from './dates';

export {
  DEFAULT_USER_ID,
  buildUserProfile,
  clearBrowserSessionUser,
  decodeBase64Username,
  encodeUsernameToBase64,
  getActiveUserId,
  getBrowserSessionUser,
  getStoredAvatarTheme,
  getStoredUsername,
  normalizeUsername,
  setBrowserSessionUser,
  type BrowserSessionUser,
  type UserProfile,
};

export interface SyncService {
  push(): Promise<void>;
  pull(): Promise<boolean>;
  isEnabled(): boolean;
}

export const noopSync: SyncService = {
  async push() {},
  async pull() {
    return false;
  },
  isEnabled: () => false,
};

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** Deterministic Base64 user ID (primary filter for all user data). */
  userId: string;
  /** Kept in sync with `userId` for composite primary-key compatibility. */
  workspaceId: string;
}

const CONFIG_STORAGE_KEY = 'stash:supabase-config';
const LAST_SYNC_STORAGE_KEY = 'stash:last-synced-at';

/**
 * Saves the human-readable username, encodes it to Base64 (`userId`),
 * persists the `UserRecord` in local IndexedDB, and updates the active Supabase config
 * so every transaction and table row is stored and retrieved by `user_id`.
 */
export function saveUsername(username: string, avatarTheme?: string): string {
  const clean = normalizeUsername(username);
  const b64 = clean ? encodeUsernameToBase64(clean) : DEFAULT_USER_ID;
  const theme = avatarTheme || getStoredAvatarTheme();

  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        window.localStorage.setItem(USERNAME_STORAGE_KEY, clean);
        setBrowserSessionUser(clean, b64);
      } else {
        clearBrowserSessionUser();
      }
      if (avatarTheme) window.localStorage.setItem(USER_THEME_STORAGE_KEY, avatarTheme);

      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      const parsed: Partial<SupabaseConfig> = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({
          url: parsed.url ?? '',
          anonKey: parsed.anonKey ?? '',
          userId: b64,
          workspaceId: b64,
        }),
      );

      // Persist user record in local IndexedDB asynchronously
      const profile = buildUserProfile(clean, theme);
      const db = getDB();
      void db.transaction('rw', [db.users, db.meta], async () => {
        await db.users.put(profile);
        await db.meta.update('main', { activeUserId: b64 });
      }).catch(() => {});
    } catch {
      /* ignore storage errors */
    }
  }
  return b64;
}

/**
 * Resolves Supabase configuration from `.env.local` (`NEXT_PUBLIC_SUPABASE_*`)
 * and the active user's Base64 `userId`.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    '';
  const envWorkspace = process.env.NEXT_PUBLIC_STASH_WORKSPACE_ID?.trim() || DEFAULT_USER_ID;

  if (typeof window !== 'undefined') {
    try {
      const storedUser = window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim();
      const userB64 = storedUser ? encodeUsernameToBase64(storedUser) : '';
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
        const url = (parsed.url?.trim() || envUrl).replace(/\/+$/, '');
        const anonKey = parsed.anonKey?.trim() || envKey;
        const resolvedUserId = userB64 || parsed.userId?.trim() || parsed.workspaceId?.trim() || envWorkspace;
        if (url && anonKey) {
          return {
            url,
            anonKey,
            userId: resolvedUserId,
            workspaceId: resolvedUserId,
          };
        }
      } else if (envUrl && envKey && userB64) {
        return {
          url: envUrl.replace(/\/+$/, ''),
          anonKey: envKey,
          userId: userB64,
          workspaceId: userB64,
        };
      }
    } catch {
      /* ignore storage errors */
    }
  }

  if (envUrl && envKey) {
    return {
      url: envUrl.replace(/\/+$/, ''),
      anonKey: envKey,
      userId: envWorkspace,
      workspaceId: envWorkspace,
    };
  }
  return null;
}

export function saveSupabaseConfig(config: Pick<SupabaseConfig, 'url' | 'anonKey' | 'workspaceId'> | null): void {
  if (typeof window === 'undefined') return;
  if (!config || (!config.url.trim() && !config.anonKey.trim())) {
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    return;
  }
  const uid = config.workspaceId.trim() || DEFAULT_USER_ID;
  window.localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      url: config.url.trim().replace(/\/+$/, ''),
      anonKey: config.anonKey.trim(),
      userId: uid,
      workspaceId: uid,
    }),
  );
}

export function getLastSyncedAt(): number | null {
  if (typeof window === 'undefined') return null;
  const val = window.localStorage.getItem(LAST_SYNC_STORAGE_KEY);
  return val ? Number(val) : null;
}

function setLastSyncedAt(ts: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

async function pgRequest<T = unknown>(
  config: SupabaseConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/* ---------- Row mappers (CamelCase <-> snake_case, every row has `user_id`) ---------- */

interface DbUserRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_theme: string;
  created_at: number;
  metadata?: Record<string, unknown>;
}

interface DbPlanRow {
  workspace_id: string;
  user_id?: string;
  id: number;
  income: number;
  bills: number;
  savings: number;
  month_length: number;
  created_at: number;
  metadata?: Record<string, unknown>;
}

interface DbCycleRow {
  workspace_id: string;
  user_id?: string;
  id: number;
  start_date: string;
  total_days: number;
  plan_amount: number;
  current_day: number;
  pool: number;
  from_savings_total: number;
  leftover_moved: boolean;
  metadata?: Record<string, unknown>;
}

interface DbDayRow {
  workspace_id: string;
  user_id?: string;
  cycle_id: number;
  day: number;
  allowance_at_start: number;
  spent: number;
  status: 'closed' | 'estimated';
}

interface DbEntryRow {
  workspace_id: string;
  user_id?: string;
  id: string;
  cycle_id: number;
  day: number;
  entry_date?: string | null;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  event?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  from_savings: boolean;
  is_estimate: boolean;
  hour: number;
  created_at: number;
  metadata?: Record<string, unknown>;
}

interface DbCategoryRow {
  workspace_id: string;
  user_id?: string;
  id: number;
  name: string;
  sort_order: number;
  is_system: boolean;
  subcategories: string[];
}

interface DbEventRow {
  workspace_id: string;
  user_id?: string;
  id: number;
  name: string;
  note: string | null;
  categories: string[];
  created_at: number;
}

interface WorkspaceBundle {
  userRows: DbUserRow[];
  planRows: DbPlanRow[];
  cycleRows: DbCycleRow[];
  dayRows: DbDayRow[];
  entryRows: DbEntryRow[];
  categoryRows: DbCategoryRow[];
  eventRows: DbEventRow[];
}

/**
 * Queries all tables by `user_id` (or `workspace_id` for legacy rows created before `user_id` was populated).
 * Falls back cleanly if the remote `user_id` column hasn't been migrated from `uuid` to `text` yet.
 */
async function queryByUser<T>(
  config: SupabaseConfig,
  table: string,
  key: string,
  extraQuery = '',
): Promise<T[]> {
  const k = encodeURIComponent(key);
  const suffix = extraQuery ? `&${extraQuery}` : '';
  try {
    return (
      (await pgRequest<T[]>(
        config,
        `${table}?or=(user_id.eq.${k},workspace_id.eq.${k})${suffix}`,
      )) ?? []
    );
  } catch {
    // Fallback if `user_id` on the remote table is still `uuid` type (before re-running schema.sql)
    return (
      (await pgRequest<T[]>(config, `${table}?workspace_id=eq.${k}${suffix}`).catch(() => [] as T[])) ?? []
    );
  }
}

async function fetchBundleForKey(config: SupabaseConfig, key: string): Promise<WorkspaceBundle> {
  const k = encodeURIComponent(key);
  const [userRows, planRows, cycleRows, dayRows, entryRows, categoryRows, eventRows] = await Promise.all([
    pgRequest<DbUserRow[]>(config, `stash_users?user_id=eq.${k}`).catch(() => [] as DbUserRow[]),
    queryByUser<DbPlanRow>(config, 'stash_plans', key, 'order=id.asc'),
    queryByUser<DbCycleRow>(config, 'stash_cycles', key, 'order=id.asc'),
    queryByUser<DbDayRow>(config, 'stash_days', key),
    queryByUser<DbEntryRow>(config, 'stash_entries', key, 'deleted_at=is.null&order=created_at.asc').then(
      (rows) => (rows.length ? rows : queryByUser<DbEntryRow>(config, 'stash_entries', key, 'order=created_at.asc')),
    ),
    queryByUser<DbCategoryRow>(config, 'stash_categories', key, 'order=sort_order.asc'),
    queryByUser<DbEventRow>(config, 'stash_events', key, 'order=created_at.asc'),
  ]);
  return {
    userRows: userRows ?? [],
    planRows: planRows ?? [],
    cycleRows: cycleRows ?? [],
    dayRows: dayRows ?? [],
    entryRows: entryRows ?? [],
    categoryRows: categoryRows ?? [],
    eventRows: eventRows ?? [],
  };
}

function candidateKeys(primaryUserId: string): string[] {
  const keys = [primaryUserId];
  const decoded = decodeBase64Username(primaryUserId);
  if (decoded && !keys.includes(decoded)) keys.push(decoded);
  if (decoded) {
    const cap = decoded.charAt(0).toUpperCase() + decoded.slice(1);
    const capB64 = typeof Buffer !== 'undefined' ? Buffer.from(cap, 'utf-8').toString('base64') : btoa(cap);
    if (!keys.includes(capB64)) keys.push(capB64);
    if (!keys.includes(cap)) keys.push(cap);
  }
  if (!keys.includes(DEFAULT_USER_ID)) keys.push(DEFAULT_USER_ID);
  return keys;
}

/**
 * Upserts rows with `user_id` populated. If the remote Supabase table still has `user_id`
 * typed as `uuid` (before the user runs the updated `supabase/schema.sql`), retries without `user_id`
 * so sync never breaks.
 */
async function upsertWithUserIdFallback<T extends { user_id?: string }>(
  config: SupabaseConfig,
  endpoint: string,
  rows: T[],
): Promise<void> {
  if (!rows.length) return;
  const upsertHeaders = { Prefer: 'resolution=merge-duplicates,return=minimal' };
  try {
    await pgRequest(config, endpoint, {
      method: 'POST',
      headers: upsertHeaders,
      body: JSON.stringify(rows),
    });
  } catch {
    const withoutUserId = rows.map(({ user_id: _omit, ...rest }) => rest);
    await pgRequest(config, endpoint, {
      method: 'POST',
      headers: upsertHeaders,
      body: JSON.stringify(withoutUserId),
    });
  }
}

/* ---------- Core Sync Service ---------- */

export const supabaseSync: SyncService = {
  isEnabled(): boolean {
    return getSupabaseConfig() !== null;
  },

  /**
   * Pushes the active user profile (`stash_users`) and all local IndexedDB state to Supabase,
   * stamping `user_id` (Base64 username) on every single transaction and table row.
   */
  async push(): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;

    const db = getDB();
    const [plans, cycles, days, entries, categories, events] = await Promise.all([
      db.plan.toArray(),
      db.cycle.toArray(),
      db.days.toArray(),
      db.entries.toArray(),
      db.categories.toArray(),
      db.events.toArray(),
    ]);

    const uid = config.userId;
    const ws = config.workspaceId;
    const username = decodeBase64Username(uid) || getStoredUsername() || DEFAULT_USER_ID;
    const avatarTheme = getStoredAvatarTheme();

    const userRow: DbUserRow = {
      user_id: uid,
      username,
      display_name: username === DEFAULT_USER_ID ? 'Guest' : username,
      avatar_theme: avatarTheme,
      created_at: Date.now(),
      metadata: {
        activeCycleId: cycles[cycles.length - 1]?.id ?? null,
        totalSpends: entries.length,
      },
    };

    const planRows: DbPlanRow[] = plans
      .filter((p): p is Plan & { id: number } => p.id != null)
      .map((p) => ({
        workspace_id: ws,
        user_id: uid,
        id: p.id,
        income: p.income,
        bills: p.bills,
        savings: p.savings,
        month_length: p.monthLength,
        created_at: p.createdAt,
        metadata: {
          userId: uid,
          username,
          billItems: p.billItems ?? [],
          savingsItems: p.savingsItems ?? [],
        },
      }));

    const cycleRows: DbCycleRow[] = cycles
      .filter((c): c is Cycle & { id: number } => c.id != null)
      .map((c) => ({
        workspace_id: ws,
        user_id: uid,
        id: c.id,
        start_date: c.startDate,
        total_days: c.totalDays,
        plan_amount: c.planAmount,
        current_day: c.currentDay,
        pool: c.pool,
        from_savings_total: c.fromSavingsTotal,
        leftover_moved: c.leftoverMoved,
        metadata: {
          userId: uid,
          username,
          avatarTheme,
        },
      }));

    const dayRows: DbDayRow[] = days.map((d) => ({
      workspace_id: ws,
      user_id: uid,
      cycle_id: d.cycleId,
      day: d.day,
      allowance_at_start: d.allowanceAtStart,
      spent: d.spent,
      status: d.status,
    }));

    const cycleStartMap = new Map(cycles.map((c) => [c.id!, c.startDate]));

    const entryRows: DbEntryRow[] = entries.map((e) => {
      const entryIso =
        e.date || (cycleStartMap.get(e.cycleId) ? dateOfDay(cycleStartMap.get(e.cycleId)!, e.day) : null);
      return {
        workspace_id: ws,
        user_id: uid,
        id: e.id,
        cycle_id: e.cycleId,
        day: e.day,
        entry_date: entryIso,
        amount: e.amount,
        label: e.label,
        category: e.category,
        subcategory: e.subcategory,
        event: e.event ?? null,
        payment_method: e.payment ?? null,
        notes: e.note ?? null,
        from_savings: e.fromSavings,
        is_estimate: e.isEstimate,
        hour: e.hour,
        created_at: e.createdAt,
        metadata: {
          userId: uid,
          username,
          date: entryIso,
          event: e.event ?? null,
          payment: e.payment ?? null,
          note: e.note ?? null,
          adjustsPool: e.adjustsPool ?? true,
        },
      };
    });

    const categoryRows: DbCategoryRow[] = categories
      .filter((c): c is Category & { id: number } => c.id != null)
      .map((c) => ({
        workspace_id: ws,
        user_id: uid,
        id: c.id,
        name: c.name,
        sort_order: c.sortOrder,
        is_system: c.isSystem,
        subcategories: c.subcategories,
      }));

    const eventRows: DbEventRow[] = events
      .filter((ev): ev is StashEvent & { id: number } => ev.id != null)
      .map((ev) => ({
        workspace_id: ws,
        user_id: uid,
        id: ev.id,
        name: ev.name,
        note: ev.note ?? null,
        categories: ev.categories,
        created_at: ev.createdAt,
      }));

    const pushEntries = async () => {
      if (!entryRows.length) return;
      try {
        await upsertWithUserIdFallback(config, 'stash_entries?on_conflict=workspace_id,id', entryRows);
      } catch {
        const minimalRows = entries.map((e) => ({
          workspace_id: ws,
          id: e.id,
          cycle_id: e.cycleId,
          day: e.day,
          amount: e.amount,
          label: e.label,
          category: e.category,
          subcategory: e.subcategory,
          from_savings: e.fromSavings,
          is_estimate: e.isEstimate,
          hour: e.hour,
          created_at: e.createdAt,
          metadata: {
            userId: uid,
            username,
            event: e.event ?? null,
            payment: e.payment ?? null,
            note: e.note ?? null,
          },
        }));
        await pgRequest(config, 'stash_entries?on_conflict=workspace_id,id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(minimalRows),
        });
      }
    };

    // 1. Upsert parent tables first (stash_users, stash_plans, stash_cycles) so foreign keys on
    //    stash_days(workspace_id, cycle_id) and stash_entries(workspace_id, cycle_id) are always satisfied.
    await Promise.all([
      pgRequest(config, 'stash_users?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([userRow]),
      }).catch(() => undefined),
      upsertWithUserIdFallback(config, 'stash_plans?on_conflict=workspace_id,id', planRows),
      upsertWithUserIdFallback(config, 'stash_cycles?on_conflict=workspace_id,id', cycleRows),
    ]);

    // 2. Upsert child tables (stash_days, stash_entries, stash_categories, stash_events)
    await Promise.all([
      upsertWithUserIdFallback(config, 'stash_days?on_conflict=workspace_id,cycle_id,day', dayRows).catch(
        () => undefined,
      ),
      pushEntries().catch(() => undefined),
      upsertWithUserIdFallback(config, 'stash_categories?on_conflict=workspace_id,id', categoryRows).catch(
        () => undefined,
      ),
      upsertWithUserIdFallback(config, 'stash_events?on_conflict=workspace_id,id', eventRows).catch(
        () => undefined,
      ),
    ]);

    setLastSyncedAt(Date.now());
  },

  /**
   * Pulls all rows for the active `user_id` from Supabase and hydrates local IndexedDB (Dexie).
   * Automatically checks fallback keys (plain username / 'default') if data was logged
   * before a Base64 user_id was set, and migrates those rows to the user's `user_id`.
   */
  async pull(): Promise<boolean> {
    const config = getSupabaseConfig();
    if (!config) return false;

    const uid = config.userId;
    const primary = await fetchBundleForKey(config, uid);
    let { userRows, planRows, cycleRows, dayRows, entryRows, categoryRows, eventRows } = primary;

    if (!planRows.length || !cycleRows.length || !entryRows.length) {
      const fallbacks = candidateKeys(uid).filter((k) => k !== uid);
      for (const fk of fallbacks) {
        const fb = await fetchBundleForKey(config, fk);
        if (!userRows.length && fb.userRows.length) userRows = fb.userRows;
        if (!planRows.length && fb.planRows.length) planRows = fb.planRows;
        if (!cycleRows.length && fb.cycleRows.length) cycleRows = fb.cycleRows;
        if (!dayRows.length && fb.dayRows.length) dayRows = fb.dayRows;
        if (!entryRows.length && fb.entryRows.length) entryRows = fb.entryRows;
        if (!categoryRows.length && fb.categoryRows.length) categoryRows = fb.categoryRows;
        if (!eventRows.length && fb.eventRows.length) eventRows = fb.eventRows;
        if (planRows.length && cycleRows.length && entryRows.length) break;
      }
    }

    if (!planRows.length && !cycleRows.length && !entryRows.length && !eventRows.length) {
      return false;
    }

    // Reconstruct missing plan or cycle if partial rows exist in Supabase
    if (!cycleRows.length && (planRows.length || entryRows.length)) {
      const lastPlan = planRows[planRows.length - 1];
      const planAmt = lastPlan
        ? Math.max(Number(lastPlan.income) - Number(lastPlan.bills) - Number(lastPlan.savings), 0)
        : 22000;
      const totalDays = lastPlan ? Number(lastPlan.month_length) : 30;
      const earliestTs = entryRows.length
        ? Math.min(...entryRows.map((e) => Number(e.created_at)))
        : Date.now();
      const d = new Date(earliestTs);
      const startIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const maxDay = entryRows.length ? Math.max(...entryRows.map((e) => Number(e.day))) : 1;
      const targetCycleId = entryRows.length ? Number(entryRows[entryRows.length - 1].cycle_id) || 1 : 1;
      cycleRows = [
        {
          workspace_id: uid,
          user_id: uid,
          id: targetCycleId,
          start_date: startIso,
          total_days: totalDays,
          plan_amount: planAmt,
          current_day: maxDay,
          pool: planAmt,
          from_savings_total: entryRows
            .filter((e) => e.from_savings)
            .reduce((s, e) => s + Number(e.amount), 0),
          leftover_moved: false,
        },
      ];
    }

    if (!planRows.length && cycleRows.length) {
      const lastCycle = cycleRows[cycleRows.length - 1];
      planRows = [
        {
          workspace_id: uid,
          user_id: uid,
          id: 1,
          income: Number(lastCycle.plan_amount),
          bills: 0,
          savings: 0,
          month_length: Number(lastCycle.total_days) || 30,
          created_at: Date.now(),
        },
      ];
    }

    // Align cycles and entries so the active cycle always contains the user's logged spends
    if (cycleRows.length && entryRows.length) {
      const cycleIds = new Set(cycleRows.map((c) => Number(c.id)));
      const entryCycleIds = new Set(entryRows.map((e) => Number(e.cycle_id)));
      const activeCycle = cycleRows[cycleRows.length - 1];
      const activeHasEntries = entryCycleIds.has(Number(activeCycle.id));

      if (!activeHasEntries) {
        const cyclesWithEntries = cycleRows.filter((c) => entryCycleIds.has(Number(c.id)));
        if (cyclesWithEntries.length > 0) {
          cycleRows = cyclesWithEntries;
        } else {
          entryRows = entryRows.map((e) =>
            cycleIds.has(Number(e.cycle_id)) ? e : { ...e, cycle_id: Number(activeCycle.id) },
          );
        }
      }
    }

    const resolvedUsername =
      userRows[0]?.username || decodeBase64Username(uid) || getStoredUsername() || DEFAULT_USER_ID;
    const resolvedTheme = userRows[0]?.avatar_theme || getStoredAvatarTheme() || DEFAULT_AVATAR_THEME;

    const db = getDB();
    await db.transaction(
      'rw',
      [db.users, db.plan, db.cycle, db.days, db.entries, db.categories, db.events, db.meta],
      async () => {
        await Promise.all([
          db.plan.clear(),
          db.cycle.clear(),
          db.days.clear(),
          db.entries.clear(),
          db.events.clear(),
        ]);

        const userRec: UserRecord = {
          userId: uid,
          username: resolvedUsername,
          displayName: userRows[0]?.display_name || resolvedUsername,
          avatarTheme: resolvedTheme,
          createdAt: Number(userRows[0]?.created_at ?? Date.now()),
          updatedAt: Date.now(),
        };
        await db.users.put(userRec);
        await db.meta.update('main', { activeUserId: uid });

        if (planRows.length) {
          await db.plan.bulkPut(
            planRows.map((r) => ({
              id: Number(r.id),
              userId: r.user_id || uid,
              income: Number(r.income),
              bills: Number(r.bills),
              savings: Number(r.savings),
              monthLength: Number(r.month_length),
              createdAt: Number(r.created_at),
              billItems: Array.isArray(r.metadata?.billItems)
                ? (r.metadata.billItems as { name: string; amount: number }[])
                : undefined,
              savingsItems: Array.isArray(r.metadata?.savingsItems)
                ? (r.metadata.savingsItems as { name: string; amount: number }[])
                : undefined,
            })),
          );
        }

        if (cycleRows.length) {
          await db.cycle.bulkPut(
            cycleRows.map((r) => ({
              id: Number(r.id),
              userId: r.user_id || uid,
              startDate: r.start_date,
              totalDays: Number(r.total_days),
              planAmount: Number(r.plan_amount),
              currentDay: Number(r.current_day),
              pool: Number(r.pool),
              fromSavingsTotal: Number(r.from_savings_total),
              leftoverMoved: Boolean(r.leftover_moved),
            })),
          );
        }

        if (dayRows.length) {
          // Reconcile each closed day's spent total against actual non-savings entries for that (cycleId, day)
          const entrySpentByDay = new Map<string, number>();
          for (const e of entryRows) {
            if (!e.from_savings) {
              const k = `${Number(e.cycle_id)}:${Number(e.day)}`;
              entrySpentByDay.set(k, (entrySpentByDay.get(k) ?? 0) + Number(e.amount));
            }
          }
          await db.days.bulkPut(
            dayRows.map((r): DayRow => {
              const cid = Number(r.cycle_id);
              const d = Number(r.day);
              const actualSpent = entrySpentByDay.get(`${cid}:${d}`);
              return {
                cycleId: cid,
                day: d,
                userId: r.user_id || uid,
                allowanceAtStart: Number(r.allowance_at_start),
                spent: actualSpent !== undefined ? actualSpent : Number(r.spent),
                status: r.status,
              };
            }),
          );
        }

        if (entryRows.length) {
          const cycleMap = new Map(cycleRows.map((c) => [Number(c.id), c.start_date]));
          const uniqueEntries = new Map<string, DbEntryRow>();
          for (const r of entryRows) {
            uniqueEntries.set(r.id, r);
          }

          await db.entries.bulkPut(
            Array.from(uniqueEntries.values()).map((r): Entry => {
              const cid = Number(r.cycle_id);
              const cycleStart = cycleMap.get(cid);
              const rawDate =
                r.entry_date ||
                (typeof r.metadata?.date === 'string' ? r.metadata.date : null) ||
                (cycleStart ? dateOfDay(cycleStart, Number(r.day)) : null);
              const resolvedDay =
                cycleStart && rawDate ? Math.max(1, daysBetween(cycleStart, rawDate) + 1) : Number(r.day);

              return {
                id: r.id,
                userId:
                  r.user_id ||
                  (typeof r.metadata?.userId === 'string' ? r.metadata.userId : null) ||
                  uid,
                cycleId: cid,
                day: resolvedDay,
                date: rawDate ?? undefined,
                amount: Number(r.amount),
                label: r.label,
                category: r.category,
                subcategory: r.subcategory,
                event: r.event ?? (typeof r.metadata?.event === 'string' ? r.metadata.event : null),
                payment:
                  r.payment_method ?? (typeof r.metadata?.payment === 'string' ? r.metadata.payment : null),
                note: r.notes ?? (typeof r.metadata?.note === 'string' ? r.metadata.note : null),
                fromSavings: Boolean(r.from_savings),
                adjustsPool:
                  typeof r.metadata?.adjustsPool === 'boolean' ? r.metadata.adjustsPool : true,
                isEstimate: Boolean(r.is_estimate),
                hour: Number(r.hour),
                createdAt: Number(r.created_at),
              };
            }),
          );
        }

        if (categoryRows.length) {
          await db.categories.clear();
          await db.categories.bulkPut(
            categoryRows.map(
              (r): Category => ({
                id: Number(r.id),
                userId: r.user_id || uid,
                name: r.name,
                sortOrder: Number(r.sort_order),
                isSystem: Boolean(r.is_system),
                subcategories: Array.isArray(r.subcategories) ? r.subcategories : [],
              }),
            ),
          );
        }

        if (eventRows.length) {
          await db.events.bulkPut(
            eventRows.map(
              (r): StashEvent => ({
                id: Number(r.id),
                userId: r.user_id || uid,
                name: r.name,
                note: r.note ?? null,
                categories: Array.isArray(r.categories) ? r.categories : [],
                createdAt: Number(r.created_at),
              }),
            ),
          );
        }
      },
    );

    setLastSyncedAt(Date.now());
    // Push back so any rows recovered from 'default' are now stamped with `user_id = uid` in Supabase
    void this.push().catch(() => {});
    return true;
  },
};

export async function deleteRemoteEntry(entryId: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const uid = encodeURIComponent(config.userId);
  const id = encodeURIComponent(entryId);
  try {
    await pgRequest(config, `stash_entries?or=(user_id.eq.${uid},workspace_id.eq.${uid})&id=eq.${id}`, {
      method: 'DELETE',
    });
  } catch {
    try {
      await pgRequest(config, `stash_entries?workspace_id=eq.${uid}&id=eq.${id}`, {
        method: 'DELETE',
      });
    } catch {
      /* offline best-effort */
    }
  }
}

export async function deleteRemoteCategory(catId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const uid = encodeURIComponent(config.userId);
  try {
    await pgRequest(config, `stash_categories?or=(user_id.eq.${uid},workspace_id.eq.${uid})&id=eq.${catId}`, {
      method: 'DELETE',
    });
  } catch {
    try {
      await pgRequest(config, `stash_categories?workspace_id=eq.${uid}&id=eq.${catId}`, {
        method: 'DELETE',
      });
    } catch {
      /* offline best-effort */
    }
  }
}

export async function deleteRemoteEvent(eventId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const uid = encodeURIComponent(config.userId);
  try {
    await pgRequest(config, `stash_events?or=(user_id.eq.${uid},workspace_id.eq.${uid})&id=eq.${eventId}`, {
      method: 'DELETE',
    });
  } catch {
    try {
      await pgRequest(config, `stash_events?workspace_id=eq.${uid}&id=eq.${eventId}`, {
        method: 'DELETE',
      });
    } catch {
      /* offline best-effort */
    }
  }
}

export async function clearRemoteWorkspace(): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const uid = encodeURIComponent(config.userId);
  try {
    await Promise.all([
      pgRequest(config, `stash_entries?workspace_id=eq.${uid}`, { method: 'DELETE' }),
      pgRequest(config, `stash_days?workspace_id=eq.${uid}`, { method: 'DELETE' }),
      pgRequest(config, `stash_cycles?workspace_id=eq.${uid}`, { method: 'DELETE' }),
      pgRequest(config, `stash_plans?workspace_id=eq.${uid}`, { method: 'DELETE' }),
      pgRequest(config, `stash_events?workspace_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined),
      pgRequest(config, `stash_categories?workspace_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined),
      pgRequest(config, `stash_feature_data?workspace_id=eq.${uid}`, { method: 'DELETE' }).catch(() => undefined),
    ]);
  } catch {
    /* offline best-effort */
  }
}

export interface RemoteStatus {
  ok: boolean;
  userId: string;
  workspaceId: string;
  plans: number;
  cycles: number;
  entries: number;
  events: number;
  error?: string;
}

export async function checkRemoteStatus(): Promise<RemoteStatus> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      userId: DEFAULT_USER_ID,
      workspaceId: DEFAULT_USER_ID,
      plans: 0,
      cycles: 0,
      entries: 0,
      events: 0,
      error: 'No Supabase credentials configured.',
    };
  }
  try {
    const b = await fetchBundleForKey(config, config.userId);
    return {
      ok: true,
      userId: config.userId,
      workspaceId: config.workspaceId,
      plans: b.planRows.length,
      cycles: b.cycleRows.length,
      entries: b.entryRows.length,
      events: b.eventRows.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      userId: config.userId,
      workspaceId: config.workspaceId,
      plans: 0,
      cycles: 0,
      entries: 0,
      events: 0,
      error: msg,
    };
  }
}

export async function checkUsernameInCloud(username: string): Promise<RemoteStatus | null> {
  const baseConfig = getSupabaseConfig();
  if (!baseConfig) return null;
  const clean = normalizeUsername(username);
  if (!clean) return null;
  const b64 = encodeUsernameToBase64(clean);
  const config: SupabaseConfig = { ...baseConfig, userId: b64, workspaceId: b64 };
  try {
    let plansCount = 0;
    let cyclesCount = 0;
    let entriesCount = 0;
    let eventsCount = 0;

    for (const key of candidateKeys(b64)) {
      const b = await fetchBundleForKey(config, key);
      if (!plansCount && b.planRows.length) plansCount = b.planRows.length;
      if (!cyclesCount && b.cycleRows.length) cyclesCount = b.cycleRows.length;
      if (!entriesCount && b.entryRows.length) entriesCount = b.entryRows.length;
      if (!eventsCount && b.eventRows.length) eventsCount = b.eventRows.length;
      if (plansCount && cyclesCount && entriesCount) break;
    }

    return {
      ok: true,
      userId: b64,
      workspaceId: b64,
      plans: plansCount,
      cycles: cyclesCount,
      entries: entriesCount,
      events: eventsCount,
    };
  } catch (err) {
    return {
      ok: false,
      userId: b64,
      workspaceId: b64,
      plans: 0,
      cycles: 0,
      entries: 0,
      events: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(): void {
  if (typeof window === 'undefined' || !supabaseSync.isEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void supabaseSync.push().catch(() => {
      /* stays queued in local Dexie until next online sync */
    });
  }, 200);
}

/* ---------- Extensible Feature Store for Future Features ---------- */

export interface FeatureRecord<T = Record<string, unknown>> {
  workspace_id: string;
  user_id?: string;
  feature_key: string;
  item_id: string;
  payload: T;
  updated_at?: string;
}

export const featureDataRepo = {
  async list<T = Record<string, unknown>>(featureKey: string): Promise<FeatureRecord<T>[]> {
    const config = getSupabaseConfig();
    if (!config) return [];
    const fk = encodeURIComponent(featureKey);
    return queryByUser<FeatureRecord<T>>(
      config,
      'stash_feature_data',
      config.userId,
      `feature_key=eq.${fk}&order=updated_at.desc`,
    );
  },

  async upsert<T = Record<string, unknown>>(
    featureKey: string,
    itemId: string,
    payload: T,
  ): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;
    await upsertWithUserIdFallback(config, 'stash_feature_data?on_conflict=workspace_id,feature_key,item_id', [
      {
        workspace_id: config.workspaceId,
        user_id: config.userId,
        feature_key: featureKey,
        item_id: itemId,
        payload,
      },
    ]);
  },

  async remove(featureKey: string, itemId: string): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;
    const uid = encodeURIComponent(config.userId);
    const fk = encodeURIComponent(featureKey);
    const id = encodeURIComponent(itemId);
    await pgRequest(
      config,
      `stash_feature_data?workspace_id=eq.${uid}&feature_key=eq.${fk}&item_id=eq.${id}`,
      { method: 'DELETE' },
    );
  },
};
