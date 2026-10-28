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

interface WorkspaceBundle {
  planRows: DbPlanRow[];
  cycleRows: DbCycleRow[];
  dayRows: DbDayRow[];
  entryRows: DbEntryRow[];
  categoryRows: DbCategoryRow[];
  eventRows: DbEventRow[];
}

async function fetchBundleForKey(config: SupabaseConfig, key: string): Promise<WorkspaceBundle> {
  const ws = encodeURIComponent(key);
  const [planRows, cycleRows, dayRows, entryRows, categoryRows, eventRows] = await Promise.all([
    pgRequest<DbPlanRow[]>(config, `stash_plans?workspace_id=eq.${ws}&order=id.asc`).catch(() => [] as DbPlanRow[]),
    pgRequest<DbCycleRow[]>(config, `stash_cycles?workspace_id=eq.${ws}&order=id.asc`).catch(() => [] as DbCycleRow[]),
    pgRequest<DbDayRow[]>(config, `stash_days?workspace_id=eq.${ws}`).catch(() => [] as DbDayRow[]),
    pgRequest<DbEntryRow[]>(
      config,
      `stash_entries?workspace_id=eq.${ws}&deleted_at=is.null&order=created_at.asc`,
    ).catch(() =>
      pgRequest<DbEntryRow[]>(config, `stash_entries?workspace_id=eq.${ws}&order=created_at.asc`).catch(
        () => [] as DbEntryRow[],
      ),
    ),
    pgRequest<DbCategoryRow[]>(config, `stash_categories?workspace_id=eq.${ws}&order=sort_order.asc`).catch(
      () => [] as DbCategoryRow[],
    ),
    pgRequest<DbEventRow[]>(config, `stash_events?workspace_id=eq.${ws}&order=created_at.asc`).catch(
      () => [] as DbEventRow[],
    ),
  ]);
  return {
    planRows: planRows ?? [],
    cycleRows: cycleRows ?? [],
    dayRows: dayRows ?? [],
    entryRows: entryRows ?? [],
    categoryRows: categoryRows ?? [],
    eventRows: eventRows ?? [],
  };
}

function candidateKeys(primaryWs: string): string[] {
  const keys = [primaryWs];
  const decoded = decodeBase64Username(primaryWs);
  if (decoded && !keys.includes(decoded)) keys.push(decoded);
  if (decoded) {
    const cap = decoded.charAt(0).toUpperCase() + decoded.slice(1);
    const capB64 = typeof Buffer !== 'undefined' ? Buffer.from(cap, 'utf-8').toString('base64') : btoa(cap);
    if (!keys.includes(capB64)) keys.push(capB64);
    if (!keys.includes(cap)) keys.push(cap);
  }
  if (!keys.includes('default')) keys.push('default');
  return keys;
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
      metadata: {
        event: e.event ?? null,
        payment: e.payment ?? null,
        note: e.note ?? null,
      },
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

    const pushEntries = async () => {
      if (!entryRows.length) return;
      try {
        await pgRequest(config, 'stash_entries?on_conflict=workspace_id,id', {
          method: 'POST',
          headers: upsertHeaders,
          body: JSON.stringify(entryRows),
        });
      } catch {
        // Fallback if optional columns (event / payment_method / notes) were not migrated yet:
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
            event: e.event ?? null,
            payment: e.payment ?? null,
            note: e.note ?? null,
          },
        }));
        await pgRequest(config, 'stash_entries?on_conflict=workspace_id,id', {
          method: 'POST',
          headers: upsertHeaders,
          body: JSON.stringify(minimalRows),
        });
      }
    };

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
          }).catch(() => undefined)
        : Promise.resolve(),
      pushEntries().catch(() => undefined),
      categoryRows.length
        ? pgRequest(config, 'stash_categories?on_conflict=workspace_id,id', {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(categoryRows),
          }).catch(() => undefined)
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
   * Automatically checks fallback keys (plain username / 'default') if data was logged
   * before a Base64 username was set, and ensures plan/cycle/entries are aligned.
   */
  async pull(): Promise<boolean> {
    const config = getSupabaseConfig();
    if (!config) return false;

    const primary = await fetchBundleForKey(config, config.workspaceId);
    let { planRows, cycleRows, dayRows, entryRows, categoryRows, eventRows } = primary;

    // If any core table is missing under the primary key (e.g. plan or spends were logged under 'default' yesterday),
    // check candidate fallback keys and merge missing pieces.
    if (!planRows.length || !cycleRows.length || !entryRows.length) {
      const fallbacks = candidateKeys(config.workspaceId).filter((k) => k !== config.workspaceId);
      for (const fk of fallbacks) {
        const fb = await fetchBundleForKey(config, fk);
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
      const planAmt = lastPlan ? Math.max(Number(lastPlan.income) - Number(lastPlan.bills) - Number(lastPlan.savings), 0) : 22000;
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
          workspace_id: config.workspaceId,
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
          workspace_id: config.workspaceId,
          id: 1,
          income: Number(lastCycle.plan_amount),
          bills: 0,
          savings: 0,
          month_length: Number(lastCycle.total_days) || 30,
          created_at: Date.now(),
        },
      ];
    }

    // If multiple cycles exist and the latest cycle has 0 spends while an earlier cycle has spends,
    // or if entries point to a cycle_id not present in cycleRows, align them so the active cycle shows all spends.
    if (cycleRows.length && entryRows.length) {
      const cycleIds = new Set(cycleRows.map((c) => Number(c.id)));
      const entryCycleIds = new Set(entryRows.map((e) => Number(e.cycle_id)));
      const activeCycle = cycleRows[cycleRows.length - 1];
      const activeHasEntries = entryCycleIds.has(Number(activeCycle.id));

      if (!activeHasEntries) {
        // Either drop a duplicate empty cycle created during re-login or re-attach orphaned entries to activeCycle
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

    const db = getDB();
    await db.transaction('rw', [db.plan, db.cycle, db.days, db.entries, db.categories, db.events], async () => {
      await Promise.all([
        db.plan.clear(),
        db.cycle.clear(),
        db.days.clear(),
        db.entries.clear(),
        db.events.clear(),
      ]);

      if (planRows.length) {
        await db.plan.bulkPut(
          planRows.map((r) => ({
            id: Number(r.id),
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
              event: r.event ?? (typeof r.metadata?.event === 'string' ? r.metadata.event : null),
              payment:
                r.payment_method ?? (typeof r.metadata?.payment === 'string' ? r.metadata.payment : null),
              note: r.notes ?? (typeof r.metadata?.note === 'string' ? r.metadata.note : null),
              fromSavings: Boolean(r.from_savings),
              isEstimate: Boolean(r.is_estimate),
              hour: Number(r.hour),
              createdAt: Number(r.created_at),
            }),
          ),
        );
      }

      if (categoryRows.length) {
        await db.categories.clear();
        await db.categories.bulkPut(
          categoryRows.map(
            (r): Category => ({
              id: Number(r.id),
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

/**
 * Checks whether a specific username already has saved data in Supabase
 * without mutating localStorage yet.
 */
export async function checkUsernameInCloud(username: string): Promise<RemoteStatus | null> {
  const baseConfig = getSupabaseConfig();
  if (!baseConfig) return null;
  const clean = username.trim().toLowerCase();
  if (!clean) return null;
  const b64 = encodeUsernameToBase64(clean);
  const config: SupabaseConfig = { ...baseConfig, workspaceId: b64 };
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
      workspaceId: b64,
      plans: plansCount,
      cycles: cyclesCount,
      entries: entriesCount,
      events: eventsCount,
    };
  } catch (err) {
    return {
      ok: false,
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
