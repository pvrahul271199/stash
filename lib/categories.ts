export const MAX_NAME = 24;

/** Returns a gentle error message, or null if the name is fine. */
export function validateName(raw: string, existing: string[]): string | null {
  const name = raw.trim();
  if (!name) return 'Give it a name first.';
  if (name.length > MAX_NAME) return `Keep it to ${MAX_NAME} characters or less.`;
  if (existing.some((e) => e.trim().toLowerCase() === name.toLowerCase())) return 'That one already exists.';
  return null;
}

/* ---------- layered categories: shared defaults + per-user overrides ---------- */

export interface DefaultCategory {
  key: string;
  name: string;
  subcategories: string[];
  isSystem?: boolean;
}

/** Shape of a stored (synced) per-user category row. */
export interface CategoryOverride {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
  /** Default category this row adjusts; null for a category the user created. */
  baseId: string | null;
  subAdded: string[];
  subRemoved: string[];
}

export interface ResolvedCategory {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
  baseId: string | null;
}

/**
 * Defaults (shared, stored once) + this user's rows (adds, removals, subcategory diffs).
 * If two devices both created an override for one default, the newest wins.
 */
export function resolveCategories(defaults: DefaultCategory[], rows: CategoryOverride[]): ResolvedCategory[] {
  const overrides = new Map<string, CategoryOverride>();
  const own: CategoryOverride[] = [];
  for (const r of rows) {
    if (r.baseId) {
      const prev = overrides.get(r.baseId);
      if (!prev || r.updatedAt > prev.updatedAt) overrides.set(r.baseId, r);
    } else if (r.deletedAt == null) {
      own.push(r);
    }
  }
  const out: ResolvedCategory[] = [];
  const system: ResolvedCategory[] = [];
  for (const d of defaults) {
    const o = overrides.get(d.key);
    if (o && o.deletedAt != null && !d.isSystem) continue; // removed by this user
    const removed = new Set(o?.subRemoved ?? []);
    const subs = d.subcategories.filter((x) => !removed.has(x));
    for (const a of o?.subAdded ?? []) if (!subs.includes(a)) subs.push(a);
    const item = { id: d.key, name: d.name, sortOrder: 0, isSystem: !!d.isSystem, subcategories: subs, baseId: d.key };
    (d.isSystem ? system : out).push(item);
  }
  own.sort((a, b) => a.sortOrder - b.sortOrder || a.updatedAt - b.updatedAt);
  // Never show a name twice (a user row copying a default, or the same name from two devices).
  // db/queries.ts `dedupeCategories` repairs the data; this only keeps the list clean until it runs.
  const shown = new Set([...out, ...system].map((c) => c.name.toLowerCase()));
  for (const r of own) {
    const lower = r.name.trim().toLowerCase();
    if (shown.has(lower)) continue;
    shown.add(lower);
    out.push({ id: r.id, name: r.name, sortOrder: 0, isSystem: false, subcategories: r.subcategories, baseId: null });
  }
  return [...out, ...system].map((c, i) => ({ ...c, sortOrder: i }));
}
