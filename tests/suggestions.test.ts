import { describe, it, expect } from 'vitest';
import { chipLabels, resolveLabel, suggestionsForHour } from '@/lib/suggestions';
import { DEFAULT_CATEGORIES } from '@/db/schema';

describe('suggestions', () => {
  it('picks by time of day', () => {
    expect(suggestionsForHour(8)).toEqual(['Chai', 'Breakfast', 'Auto', 'Metro']);
    expect(suggestionsForHour(11)).toEqual(['Lunch', 'Chai', 'Auto', 'Groceries']);
    expect(suggestionsForHour(16)).toEqual(['Snacks', 'Groceries', 'Auto', 'Recharge']);
    expect(suggestionsForHour(22)).toEqual(['Dinner', 'Groceries', 'Auto', 'Medicine']);
  });
  it('puts the last used label first without duplicating', () => {
    expect(chipLabels(8, 'Gym')[0]).toBe('Gym');
    expect(chipLabels(8, 'auto').filter((l) => l.toLowerCase() === 'auto')).toHaveLength(1);
    expect(chipLabels(8, 'Sort later')).toHaveLength(4);
  });
});

describe('resolveLabel', () => {
  it('maps quick labels', () => {
    expect(resolveLabel('Chai', DEFAULT_CATEGORIES)).toEqual({ category: 'Food', subcategory: 'Chai & snacks' });
    expect(resolveLabel('Metro', DEFAULT_CATEGORIES)).toEqual({ category: 'Travel', subcategory: 'Metro' });
  });
  it('falls back to the category if the type was deleted', () => {
    const cats = [{ name: 'Food', subcategories: ['Lunch'] }];
    expect(resolveLabel('Chai', cats)).toEqual({ category: 'Food', subcategory: null });
  });
  it('falls back to Other if the category was deleted or label unknown', () => {
    expect(resolveLabel('Auto', [{ name: 'Food', subcategories: [] }])).toEqual({ category: 'Other', subcategory: null });
    expect(resolveLabel('Gym', DEFAULT_CATEGORIES)).toEqual({ category: 'Other', subcategory: null });
  });
});
