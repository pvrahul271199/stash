import { getDB, type Category, type Cycle, type DayRow, type Entry, type Plan, type StashEvent } from '@/db/schema';

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
  workspaceId: string;
}

const CONFIG_STORAGE_KEY = 'stash:supabase-config';
const USERNAME_STORAGE_KEY = 'stash:username';
const LAST_SYNC_STORAGE_KEY = 'stash:last-synced-at';

/**
 * Converts a human-readable username (e.g. "rahul") into a deterministic Base64 ID
 * (e.g. "cmFodWw=") to store in the database `workspace_id` column.
 */
export function encodeUsernameToBase64(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return 'default';
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'utf-8').toString('base64');
  }
  return btoa(unescape(encodeURIComponent(normalized)));
}

/**
 * Decodes a Base64 `workspace_id` back to the human-readable username if valid.
 */
export function decodeBase64Username(b64: string): string | null {
  const clean = b64.trim();
  if (!clean || clean === 'default') return null;
  try {
    if (typeof Buffer !== 'undefined') {
      const out = Buffer.from(clean, 'base64').toString('utf-8');
      return out && Buffer.from(out, 'utf-8').toString('base64') === clean ? out : null;
    }
    const out = decodeURIComponent(escape(atob(clean)));
    return out && btoa(unescape(encodeURIComponent(out))) === clean ? out : null;
  } catch {
    return null;
  }
}

export function getStoredUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    const direct = window.localStorage.getItem(USERNAME_STORAGE_KEY);
    if (direct) return direct;
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
      if (parsed.workspaceId) {
        return decodeBase64Username(parsed.workspaceId) ?? '';
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Saves the human-readable username, encodes it to Base64 (`workspaceId`),
 * and updates the active Supabase config so all DB reads/writes use the Base64 key.
 */
export function saveUsername(username: string): string {
  const clean = username.trim().toLowerCase();
  const b64 = clean ? encodeUsernameToBase64(clean) : 'default';
  if (typeof window !== 'undefined') {
    try {
      if (clean) window.localStorage.setItem(USERNAME_STORAGE_KEY, clean);
      else window.localStorage.removeItem(USERNAME_STORAGE_KEY);

      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      const parsed: Partial<SupabaseConfig> = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({
          url: parsed.url ?? '',
          anonKey: parsed.anonKey ?? '',
          workspaceId: b64,
        }),
      );
    } catch {
      /* ignore */
    }
  }
  return b64;
}

/**
 * Resolves Supabase configuration from either `.env.local` (`NEXT_PUBLIC_SUPABASE_*`)
 * or runtime settings saved via the in-app Username / Cloud Sync dialog.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    '';
  const envWorkspace = process.env.NEXT_PUBLIC_STASH_WORKSPACE_ID?.trim() || 'default';

  if (typeof window !== 'undefined') {
    try {
      const storedUser = window.localStorage.getItem(USERNAME_STORAGE_KEY)?.trim();
      const userB64 = storedUser ? encodeUsernameToBase64(storedUser) : '';
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
        const url = (parsed.url?.trim() || envUrl).replace(/\/+$/, '');
        const anonKey = parsed.anonKey?.trim() || envKey;
        const workspaceId = parsed.workspaceId?.trim() || userB64 || envWorkspace;
        if (url && anonKey) {
          return { url, anonKey, workspaceId };
        }
      } else if (envUrl && envKey && userB64) {
        return {
          url: envUrl.replace(/\/+$/, ''),
          anonKey: envKey,
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
      workspaceId: envWorkspace,
    };
  }
  return null;
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  if (typeof window === 'undefined') return;
  if (!config || (!config.url.trim() && !config.anonKey.trim())) {
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      url: config.url.trim().replace(/\/+$/, ''),
      anonKey: config.anonKey.trim(),
      workspaceId: config.workspaceId.trim() || 'default',
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

/* ---------- Row mappers (CamelCase <-> snake_case) ---------- */

interface DbPlanRow {
  workspace_id: string;
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
  cycle_id: number;
  day: number;
  allowance_at_start: number;
  spent: number;
  status: 'closed' | 'estimated';
}

interface DbEntryRow {
  workspace_id: string;
  id: string;
  cycle_id: number;
  day: number;
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
  id: number;
  name: string;
  sort_order: number;
  is_system: boolean;
  subcategories: string[];
}

interface DbEventRow {
  workspace_id: string;
  id: number;
  name: string;
  note: string | null;
  categories: string[];
  created_at: number;
}

/* ---------- Core Sync Service ---------- */

export const supabaseSync: SyncService = {
  isEnabled(): boolean {
    return getSupabaseConfig() !== null;
  },

  /**
   * Pushes all local IndexedDB (Dexie) state to Supabase for the active workspace.
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

    const ws = config.workspaceId;

    const planRows: DbPlanRow[] = plans
      .filter((p): p is Plan & { id: number } => p.id != null)
      .map((p) => ({
        workspace_id: ws,
        id: p.id,
        income: p.income,
        bills: p.bills,
        savings: p.savings,
        month_length: p.monthLength,
        created_at: p.createdAt,
        metadata: { billItems: p.billItems ?? [], savingsItems: p.savingsItems ?? [] },
      }));

    const cycleRows: DbCycleRow[] = cycles
      .filter((c): c is Cycle & { id: number } => c.id != null)
      .map((c) => ({
        workspace_id: ws,
        id: c.id,
        start_date: c.startDate,
        total_days: c.totalDays,
        plan_amount: c.planAmount,
        current_day: c.currentDay,
        pool: c.pool,
        from_savings_total: c.fromSavingsTotal,
        leftover_moved: c.leftoverMoved,
      }));

    const dayRows: DbDayRow[] = days.map((d) => ({
      workspace_id: ws,
      cycle_id: d.cycleId,
      day: d.day,
      allowance_at_start: d.allowanceAtStart,
      spent: d.spent,
      status: d.status,
    }));

    const entryRows: DbEntryRow[] = entries.map((e) => ({
      workspace_id: ws,
      id: e.id,
      cycle_id: e.cycleId,
      day: e.day,
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
    }));

    const categoryRows: DbCategoryRow[] = categories
      .filter((c): c is Category & { id: number } => c.id != null)
      .map((c) => ({
        workspace_id: ws,
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
        id: ev.id,
        name: ev.name,
        note: ev.note ?? null,
        categories: ev.categories,
        created_at: ev.createdAt,
      }));

    const upsertHeaders = { Prefer: 'resolution=merge-duplicates,return=minimal' };

    await Promise.all([
      planRows.length
        ? pgRequest(config, 'stash_plans?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(planRows),
          })
        : Promise.resolve(),
      cycleRows.length
        ? pgRequest(config, 'stash_cycles?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(cycleRows),
          })
        : Promise.resolve(),
      dayRows.length
        ? pgRequest(config, 'stash_days?on_conflict=workspace_id,cycle_id,day', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(dayRows),
          })
        : Promise.resolve(),
      entryRows.length
        ? pgRequest(config, 'stash_entries?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(entryRows),
          })
        : Promise.resolve(),
      categoryRows.length
        ? pgRequest(config, 'stash_categories?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(categoryRows),
          })
        : Promise.resolve(),
      eventRows.length
        ? pgRequest(config, 'stash_events?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(eventRows),
          }).catch(() => undefined)
        : Promise.resolve(),
    ]);

    setLastSyncedAt(Date.now());
  },

  /**
   * Pulls all workspace rows from Supabase and hydrates local IndexedDB (Dexie).
   * Returns true if remote data existed and was restored.
   */
  async pull(): Promise<boolean> {
    const config = getSupabaseConfig();
    if (!config) return false;

    const ws = encodeURIComponent(config.workspaceId);

    const [planRows, cycleRows, dayRows, entryRows, categoryRows, eventRows] = await Promise.all([
      pgRequest<DbPlanRow[]>(config, `stash_plans?workspace_id=eq.${ws}&order=id.asc`),
      pgRequest<DbCycleRow[]>(config, `stash_cycles?workspace_id=eq.${ws}&order=id.asc`),
      pgRequest<DbDayRow[]>(config, `stash_days?workspace_id=eq.${ws}`),
      pgRequest<DbEntryRow[]>(
        config,
        `stash_entries?workspace_id=eq.${ws}&deleted_at=is.null&order=created_at.asc`,
      ),
      pgRequest<DbCategoryRow[]>(config, `stash_categories?workspace_id=eq.${ws}&order=sort_order.asc`),
      pgRequest<DbEventRow[]>(config, `stash_events?workspace_id=eq.${ws}&order=created_at.asc`).catch(
        () => [] as DbEventRow[],
      ),
    ]);

    if (!planRows?.length && !cycleRows?.length && !entryRows?.length && !eventRows?.length) {
      return false;
    }

    const db = getDB();
    await db.transaction('rw', [db.plan, db.cycle, db.days, db.entries, db.categories, db.events], async () => {
      if (planRows?.length) {
        await db.plan.clear();
        await db.plan.bulkPut(
          planRows.map((r) => ({
            id: r.id,
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

      if (cycleRows?.length) {
        await db.cycle.clear();
        await db.cycle.bulkPut(
          cycleRows.map((r) => ({
            id: r.id,
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

      if (dayRows?.length) {
        await db.days.clear();
        await db.days.bulkPut(
          dayRows.map(
            (r): DayRow => ({
              cycleId: Number(r.cycle_id),
              day: Number(r.day),
              allowanceAtStart: Number(r.allowance_at_start),
              spent: Number(r.spent),
              status: r.status,
            }),
          ),
        );
      }

      if (entryRows) {
        await db.entries.clear();
        if (entryRows.length) {
          await db.entries.bulkPut(
            entryRows.map(
              (r): Entry => ({
                id: r.id,
                cycleId: Number(r.cycle_id),
                day: Number(r.day),
                amount: Number(r.amount),
                label: r.label,
                category: r.category,
                subcategory: r.subcategory,
                event: r.event ?? null,
                payment: r.payment_method ?? null,
                note: r.notes ?? null,
                fromSavings: Boolean(r.from_savings),
                isEstimate: Boolean(r.is_estimate),
                hour: Number(r.hour),
                createdAt: Number(r.created_at),
              }),
            ),
          );
        }
      }

      if (categoryRows?.length) {
        await db.categories.clear();
        await db.categories.bulkPut(
          categoryRows.map(
            (r): Category => ({
              id: r.id,
              name: r.name,
              sortOrder: Number(r.sort_order),
              isSystem: Boolean(r.is_system),
              subcategories: Array.isArray(r.subcategories) ? r.subcategories : [],
            }),
          ),
        );
      }

      if (eventRows?.length) {
        await db.events.clear();
        await db.events.bulkPut(
          eventRows.map(
            (r): StashEvent => ({
              id: r.id,
              name: r.name,
              note: r.note ?? null,
              categories: Array.isArray(r.categories) ? r.categories : [],
              createdAt: Number(r.created_at),
            }),
          ),
        );
      }
    });

    setLastSyncedAt(Date.now());
    return true;
  },
};

export async function deleteRemoteEntry(entryId: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const ws = encodeURIComponent(config.workspaceId);
  const id = encodeURIComponent(entryId);
  try {
    await pgRequest(config, `stash_entries?workspace_id=eq.${ws}&id=eq.${id}`, {
      method: 'DELETE',
    });
  } catch {
    /* offline best-effort */
  }
}

export async function deleteRemoteCategory(catId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const ws = encodeURIComponent(config.workspaceId);
  try {
    await pgRequest(config, `stash_categories?workspace_id=eq.${ws}&id=eq.${catId}`, {
      method: 'DELETE',
    });
  } catch {
    /* offline best-effort */
  }
}

export async function deleteRemoteEvent(eventId: number): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const ws = encodeURIComponent(config.workspaceId);
  try {
    await pgRequest(config, `stash_events?workspace_id=eq.${ws}&id=eq.${eventId}`, {
      method: 'DELETE',
    });
  } catch {
    /* offline best-effort */
  }
}

export async function clearRemoteWorkspace(): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const ws = encodeURIComponent(config.workspaceId);
  try {
    await Promise.all([
      pgRequest(config, `stash_entries?workspace_id=eq.${ws}`, { method: 'DELETE' }),
      pgRequest(config, `stash_days?workspace_id=eq.${ws}`, { method: 'DELETE' }),
      pgRequest(config, `stash_cycles?workspace_id=eq.${ws}`, { method: 'DELETE' }),
      pgRequest(config, `stash_plans?workspace_id=eq.${ws}`, { method: 'DELETE' }),
      pgRequest(config, `stash_events?workspace_id=eq.${ws}`, { method: 'DELETE' }).catch(() => undefined),
      pgRequest(config, `stash_categories?workspace_id=eq.${ws}`, { method: 'DELETE' }).catch(() => undefined),
      pgRequest(config, `stash_feature_data?workspace_id=eq.${ws}`, { method: 'DELETE' }).catch(() => undefined),
    ]);
  } catch {
    /* offline best-effort */
  }
}

export interface RemoteStatus {
  ok: boolean;
  workspaceId: string;
  plans: number;
  cycles: number;
  entries: number;
  events: number;
  error?: string;
}

/**
 * Queries Supabase directly for the active workspace so the user can verify
 * that rows are actually stored in the remote tables.
 */
export async function checkRemoteStatus(): Promise<RemoteStatus> {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      workspaceId: 'default',
      plans: 0,
      cycles: 0,
      entries: 0,
      events: 0,
      error: 'No Supabase credentials configured.',
    };
  }
  const ws = encodeURIComponent(config.workspaceId);
  try {
    const [plans, cycles, entries, events] = await Promise.all([
      pgRequest<{ id: number }[]>(config, `stash_plans?workspace_id=eq.${ws}&select=id`),
      pgRequest<{ id: number }[]>(config, `stash_cycles?workspace_id=eq.${ws}&select=id`),
      pgRequest<{ id: string }[]>(
        config,
        `stash_entries?workspace_id=eq.${ws}&deleted_at=is.null&select=id`,
      ),
      pgRequest<{ id: number }[]>(config, `stash_events?workspace_id=eq.${ws}&select=id`).catch(
        () => [] as { id: number }[],
      ),
    ]);
    return {
      ok: true,
      workspaceId: config.workspaceId,
      plans: plans?.length ?? 0,
      cycles: cycles?.length ?? 0,
      entries: entries?.length ?? 0,
      events: events?.length ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      workspaceId: config.workspaceId,
      plans: 0,
      cycles: 0,
      entries: 0,
      events: 0,
      error: msg,
    };
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules a non-blocking background push to Supabase 800ms after any local write.
 * Keeps UI interactions (<5s spend logging) completely instant and offline-first.
 */
export function scheduleSync(): void {
  if (typeof window === 'undefined' || !supabaseSync.isEnabled()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void supabaseSync.push().catch(() => {
      /* stays queued in local Dexie until next online sync */
    });
  }, 800);
}

/* ---------- Extensible Feature Store for Future Features ---------- */

export interface FeatureRecord<T = Record<string, unknown>> {
  workspace_id: string;
  feature_key: string;
  item_id: string;
  payload: T;
  updated_at?: string;
}

/**
 * Generic repository backed by `public.stash_feature_data` so future features
 * (e.g., 'savings_goals', 'recurring_spends', 'wallets', 'shared_splits')
 * can be built and persisted to Supabase without requiring new table migrations.
 */
export const featureDataRepo = {
  async list<T = Record<string, unknown>>(featureKey: string): Promise<FeatureRecord<T>[]> {
    const config = getSupabaseConfig();
    if (!config) return [];
    const ws = encodeURIComponent(config.workspaceId);
    const fk = encodeURIComponent(featureKey);
    return (
      (await pgRequest<FeatureRecord<T>[]>(
        config,
        `stash_feature_data?workspace_id=eq.${ws}&feature_key=eq.${fk}&order=updated_at.desc`,
      )) ?? []
    );
  },

  async upsert<T = Record<string, unknown>>(
    featureKey: string,
    itemId: string,
    payload: T,
  ): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;
    await pgRequest(config, 'stash_feature_data?on_conflict=workspace_id,feature_key,item_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        {
          workspace_id: config.workspaceId,
          feature_key: featureKey,
          item_id: itemId,
          payload,
        },
      ]),
    });
  },

  async remove(featureKey: string, itemId: string): Promise<void> {
    const config = getSupabaseConfig();
    if (!config) return;
    const ws = encodeURIComponent(config.workspaceId);
    const fk = encodeURIComponent(featureKey);
    const id = encodeURIComponent(itemId);
    await pgRequest(
      config,
      `stash_feature_data?workspace_id=eq.${ws}&feature_key=eq.${fk}&item_id=eq.${id}`,
      { method: 'DELETE' },
    );
  },
};
