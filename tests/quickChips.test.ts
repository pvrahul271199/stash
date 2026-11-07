import { describe, expect, it } from 'vitest';
import { quickChips } from '@/lib/suggestions';

const cats = [
  { name: 'Food', subcategories: ['Dinner', 'Lunch', 'Biryani'] },
  { name: 'Home', subcategories: ['Groceries'] },
];

describe('quickChips', () => {
  it('puts pinned types first and only uses types the user has', () => {
    const c = quickChips(cats, ['Food::Biryani', 'Food::Gone'], {}, 21);
    expect(c[0]).toMatchObject({ label: 'Biryani', category: 'Food', pinned: true });
    expect(c.some((x) => x.label === 'Gone')).toBe(false);
  });
  it('ranks by usage and skips types missing from categories', () => {
    const used = { Food: [{ name: 'Lunch', count: 9 }, { name: 'Removed', count: 20 }] };
    const c = quickChips(cats, [], used, 12);
    expect(c[0].label).toBe('Lunch');
    expect(c.some((x) => x.label === 'Removed')).toBe(false);
  });
  it('has no duplicates and respects max', () => {
    const c = quickChips(cats, ['Food::Dinner'], { Food: [{ name: 'Dinner', count: 3 }] }, 21, 2);
    expect(c.filter((x) => x.label === 'Dinner')).toHaveLength(1);
    expect(c.length).toBeLessThanOrEqual(2);
  });
});
