import { describe, expect, it } from 'vitest';
import { MAX_QUICK_CHIPS, dropPinned, isPinned, renamePinnedCategory, togglePin } from '@/lib/suggestions';

describe('pinned quick types', () => {
  it('matches case-insensitively and toggles', () => {
    const a = togglePin([], 'Food', 'Meals');
    expect(a).toEqual({ keys: ['Food::Meals'], result: 'pinned' });
    expect(isPinned(a.keys, 'food', 'MEALS')).toBe(true);
    expect(togglePin(a.keys, 'food', 'meals')).toEqual({ keys: [], result: 'unpinned' });
  });

  it('refuses a pin past the chip limit instead of losing it silently', () => {
    const full = Array.from({ length: MAX_QUICK_CHIPS }, (_, i) => `Food::T${i}`);
    expect(togglePin(full, 'Food', 'New')).toEqual({ keys: full, result: 'full' });
    expect(togglePin(full, 'Food', 'T0').result).toBe('unpinned'); // unpinning always works when full
  });

  it('pins follow a renamed category and go when a type or category is removed', () => {
    const keys = ['Food::Meals', 'Food::Coffee', 'Travel::Cab'];
    expect(renamePinnedCategory(keys, 'food', 'Eating')).toEqual(['Eating::Meals', 'Eating::Coffee', 'Travel::Cab']);
    expect(dropPinned(keys, 'Food', 'Coffee')).toEqual(['Food::Meals', 'Travel::Cab']);
    expect(dropPinned(keys, 'Food')).toEqual(['Travel::Cab']);
  });
});
