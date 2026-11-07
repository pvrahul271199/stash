import type { Category } from '@/db/schema';

/** Time-of-day label suggestions (hour 0-23). */
export function suggestionsForHour(hour: number): string[] {
  if (hour < 11) return ['Chai', 'Breakfast', 'Auto', 'Metro'];
  if (hour < 16) return ['Lunch', 'Chai', 'Auto', 'Groceries'];
  if (hour < 20) return ['Snacks', 'Groceries', 'Auto', 'Recharge'];
  return ['Dinner', 'Groceries', 'Auto', 'Medicine'];
}

/** Last used label first (if any), then the time-of-day four, no duplicates. */
export function chipLabels(hour: number, lastUsed: string | null): string[] {
  const base = suggestionsForHour(hour);
  if (!lastUsed || lastUsed === 'Sort later') return base;
  const rest = base.filter((l) => l.toLowerCase() !== lastUsed.toLowerCase());
  return [lastUsed, ...rest].slice(0, 5);
}

const LABEL_MAP: Record<string, { category: string; subcategory: string | null }> = {
  chai: { category: 'Food', subcategory: 'Chai & snacks' },
  snacks: { category: 'Food', subcategory: 'Chai & snacks' },
  'chai and snacks': { category: 'Food', subcategory: 'Chai & snacks' },
  breakfast: { category: 'Food', subcategory: 'Breakfast' },
  lunch: { category: 'Food', subcategory: 'Lunch' },
  dinner: { category: 'Food', subcategory: 'Dinner' },
  auto: { category: 'Travel', subcategory: 'Auto' },
  metro: { category: 'Travel', subcategory: 'Metro' },
  groceries: { category: 'Home', subcategory: 'Groceries' },
  recharge: { category: 'Bills', subcategory: 'Recharge' },
  medicine: { category: 'Health', subcategory: 'Medicine' },
};

/** Map a quick label to category/type. If the type was deleted fall back to the
 *  category alone; if the category was deleted fall back to "Other". */
export function resolveLabel(
  label: string,
  categories: Pick<Category, 'name' | 'subcategories'>[],
): { category: string; subcategory: string | null } {
  const m = LABEL_MAP[label.toLowerCase()];
  if (!m) return { category: 'Other', subcategory: null };
  const cat = categories.find((c) => c.name.toLowerCase() === m.category.toLowerCase());
  if (!cat) return { category: 'Other', subcategory: null };
  const sub = cat.subcategories.find((s) => s.toLowerCase() === (m.subcategory ?? '').toLowerCase());
  return { category: cat.name, subcategory: sub ?? null };
}

export interface QuickChip {
  label: string;
  category: string;
  subcategory: string;
  pinned: boolean;
}

export const MAX_QUICK_CHIPS = 6;

/**
 * Log-screen chips drawn from the types the user keeps in Categories (never a fixed list).
 * Pinned types come first, then the most used ones, then the time-of-day suggestions that exist
 * as types for this user. Types that were removed from Categories are skipped.
 */
export function quickChips(
  cats: Pick<Category, 'name' | 'subcategories'>[],
  pinnedKeys: string[],
  used: Record<string, { name: string; count: number }[]>,
  hour: number,
  max = MAX_QUICK_CHIPS,
): QuickChip[] {
  const out: QuickChip[] = [];
  const seen = new Set<string>();
  const add = (category: string, subcategory: string, pinned: boolean) => {
    const cat = cats.find((c) => c.name.toLowerCase() === category.toLowerCase());
    const sub = cat?.subcategories.find((s) => s.toLowerCase() === subcategory.toLowerCase());
    if (!cat || !sub) return;
    const k = `${cat.name}::${sub}`.toLowerCase();
    if (seen.has(k) || out.length >= max) return;
    seen.add(k);
    out.push({ label: sub, category: cat.name, subcategory: sub, pinned });
  };
  for (const k of pinnedKeys) {
    const i = k.indexOf('::');
    if (i > 0) add(k.slice(0, i), k.slice(i + 2), true);
  }
  const ranked = Object.entries(used).flatMap(([cat, ts]) => ts.map((t) => ({ cat, ...t })));
  ranked.sort((a, b) => b.count - a.count);
  for (const r of ranked) {
    if (out.length >= Math.min(max, 5)) break;
    add(r.cat, r.name, false);
  }
  for (const label of suggestionsForHour(hour)) {
    if (out.length >= Math.min(max, 4)) break;
    const m = LABEL_MAP[label.toLowerCase()];
    if (m?.subcategory) add(m.category, m.subcategory, false);
  }
  return out;
}
