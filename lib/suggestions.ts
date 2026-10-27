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
